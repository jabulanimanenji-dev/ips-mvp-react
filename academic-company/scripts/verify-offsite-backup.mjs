// Exercises the actual offsite backup runner, crypto and storage-verification logic
// with disposable fake dump/S3 commands. CI only; no real provider credentials.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ips-offsite-ci-'));
const bin=path.join(dir,'bin');
fs.mkdirSync(bin,{recursive:true,mode:0o700});
const fakeDump=String.raw`#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' 'TEST_ONLY_ACADEMIC_MONGO_ARCHIVE_NOT_REAL_DATA'
for i in $(seq 1 40); do printf 'encryption-test-content-%s\n' "$i"; done
`;
const fakeAws=String.raw`#!/usr/bin/env bash
set -euo pipefail
[ "$1" = s3api ] || exit 41
op="$2"; shift 2
case "$op" in
  get-bucket-versioning) printf '%s\n' "$FAKE_VERSIONING" ;;
  get-public-access-block) printf '%s\n' "$FAKE_PUBLIC_FLAGS" ;;
  put-object)
    src=''
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --body) src="$2"; shift 2 ;;
        --bucket|--key|--server-side-encryption|--metadata) shift 2 ;;
        --no-cli-pager) shift ;;
        *) exit 42 ;;
      esac
    done
    cp "$src" "$FAKE_OBJECT"
    ;;
  head-object)
    query=''
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --query) query="$2"; shift 2 ;;
        --bucket|--key|--output) shift 2 ;;
        *) exit 43 ;;
      esac
    done
    case "$query" in
      Metadata.sha256) sha256sum "$FAKE_OBJECT" | cut -d' ' -f1 ;;
      ContentLength) wc -c < "$FAKE_OBJECT" | tr -d ' ' ;;
      *) exit 44 ;;
    esac
    ;;
  get-object)
    dest=''
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --bucket|--key) shift 2 ;;
        --no-cli-pager) shift ;;
        *) dest="$1"; shift ;;
      esac
    done
    cp "$FAKE_OBJECT" "$dest"
    if [ "$FAKE_TAMPER" = 'yes' ]; then
      printf 'T' | dd of="$dest" bs=1 seek=71 conv=notrunc status=none
    fi
    ;;
  *) exit 45 ;;
esac
`;
fs.writeFileSync(path.join(bin,'mongodump'),fakeDump,{mode:0o700});
fs.writeFileSync(path.join(bin,'aws'),fakeAws,{mode:0o700});
const key=crypto.randomBytes(32).toString('hex');
const env={...process.env,PATH:bin+':'+process.env.PATH,
 MONGODB_URI:'mongodb://synthetic-nonexistent.example.invalid/ips_academic_services_2026',
 IPS_BACKUP_AES256_KEY:key,IPS_BACKUP_S3_BUCKET:'ips-private-ci-tests',
 IPS_BACKUP_S3_PREFIX:'ips/academic',IPS_ACADEMIC_SOURCE_COMMIT:'a'.repeat(40),
 AWS_REGION:'eu-central-1',FAKE_VERSIONING:'Enabled',
 FAKE_PUBLIC_FLAGS:'True True True True',FAKE_TAMPER:'no',
 FAKE_OBJECT:path.join(dir,'offsite-object.aesgcm')};
const cwd=path.dirname(new URL(import.meta.url).pathname);
const run=(changes={})=>spawnSync('bash',['scripts/backup-offsite.sh'],{
 cwd:path.resolve(cwd,'..'),env:{...env,...changes},
 encoding:'utf8',maxBuffer:1024*1024});
let checks=0;
try{
 let r=run({MONGODB_URI:''});
 assert.notEqual(r.status,0);assert.match(r.stderr,/Empty required backup configuration/);checks++;
 assert.ok(!fs.existsSync(env.FAKE_OBJECT));checks++;
 r=run({FAKE_VERSIONING:'Suspended'});
 assert.notEqual(r.status,0);assert.match(r.stderr,/versioning Enabled/);checks++;
 r=run({FAKE_PUBLIC_FLAGS:'True True False True'});
 assert.notEqual(r.status,0);assert.match(r.stderr,/block all public access/);checks++;
 r=run({IPS_BACKUP_AES256_KEY:'not-a-secret'});
 assert.notEqual(r.status,0);assert.match(r.stderr,/Invalid AES-256 key/);checks++;
 r=run({IPS_BACKUP_S3_PREFIX:'../not-allowed'});
 assert.notEqual(r.status,0);assert.match(r.stderr,/Invalid object prefix/);checks++;
 r=run();
 assert.equal(r.status,0,'Valid backup should complete: '+r.stderr);
 assert.match(r.stdout,/IPS_OFFSITE_BACKUP_VERIFIED source=aaaaaaaa/);checks++;
 const saved=fs.readFileSync(env.FAKE_OBJECT);
 assert.ok(saved.length>100);
 assert.ok(saved.subarray(0,30).toString().includes('IPS-ACADEMIC-AES256GCM'));checks++;
 assert.ok(!saved.includes(Buffer.from('TEST_ONLY_ACADEMIC_MONGO_ARCHIVE_NOT_REAL_DATA')));checks++;
 r=run({FAKE_TAMPER:'yes'});
 assert.notEqual(r.status,0);assert.match(r.stderr,/Offsite ciphertext did not survive/);checks++;
 assert.ok(!r.stderr.includes(env.MONGODB_URI));checks++;
 console.log('IPS_OFFSITE_BACKUP_RUNNER_GREEN '+checks+' synthetic provider checks');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
