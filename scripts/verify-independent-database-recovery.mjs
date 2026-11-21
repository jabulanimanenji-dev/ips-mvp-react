import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {mkdtemp,readFile,readdir,lstat,writeFile,mkdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {MongoClient,BSON} from 'mongodb';

// This test deliberately excludes all real accounts and real infrastructure.
// Source and restoration MUST be different MongoDB 7 processes on different
// loopback ports, with independent databases and only disposable CI identities.
const sourceUri=String(process.env.MONGODB_URI||'');
const restoreUri=String(process.env.MONGODB_RESTORE_URI||'');
const mustBeIsolated=(text,port,dbName)=>{
  const u=new URL(text);
  assert.equal(u.protocol,'mongodb:');
  assert.ok(['localhost','127.0.0.1'].includes(u.hostname));
  assert.equal(u.port,String(port));
  assert.equal(decodeURIComponent(u.pathname),'/' + dbName);
  assert.equal(process.env.NODE_ENV,'development');
  assert.equal(String(process.env.IPS_EVALUATION_MODE||'').toLowerCase(),'');
  assert.ok(!/atlas|mongodb\.net|render\.com|production/i.test(text));
};
mustBeIsolated(sourceUri,27017,'ips_ci');
mustBeIsolated(restoreUri,27018,'ips_ci_recovery_target');
const testRun=crypto.randomBytes(6).toString('hex');
const src=new MongoClient(sourceUri,{serverSelectionTimeoutMS:12000});
const dest=new MongoClient(restoreUri,{serverSelectionTimeoutMS:12000});
const root=await mkdtemp(path.join(os.tmpdir(),'ips-mongo-recovery-'));
const archivePath=path.join(root,'ips-ci-logical-backup.json');
const restoreFiles=path.join(root,'restored-private-objects');
const fileRoot=path.resolve(process.env.UPLOADS_DIR||'uploads');
const outputDir='recovery-evidence';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const bsonValue=value=>BSON.serialize({record:value});
const parseBson=base64=>BSON.deserialize(Buffer.from(base64,'base64')).record;
const indexOptions=index=>Object.fromEntries(['unique','sparse','expireAfterSeconds',
  'partialFilterExpression','collation','weights','default_language','language_override',
  'textIndexVersion','2dsphereIndexVersion','bits','min','max','bucketSize','wildcardProjection',
  'hidden'].filter(key=>index[key]!==undefined).map(key=>[key,index[key]]));
const safePath=key=>{
  assert.equal(typeof key,'string');
  assert.ok(key.length>0&&!path.isAbsolute(key)&&!key.includes('\\'));
  const p=key.split('/');
  assert.ok(p.every(component=>component&&!['.','..'].includes(component)&&!component.includes('\0')));
  return path.join(...p);
};
const safeFileWalk=async (base,prefix='')=>{
  let items=[];
  for(const entry of await readdir(path.join(base,prefix),{withFileTypes:true})){
    const rel=prefix?prefix+'/'+entry.name:entry.name;
    assert.ok(!entry.isSymbolicLink(),'Backup must never follow a symlink');
    if(entry.isDirectory())items.push(...await safeFileWalk(base,rel));
    else{
      assert.ok(entry.isFile(),'Only regular private file objects are supported');
      assert.ok((await lstat(path.join(base,rel))).size<=25*1024*1024,
        'Unexpectedly large CI object: '+rel);
      items.push(rel);
    }
  }
  return items;
};
function verifyBackup(envelope){
  assert.equal(envelope?.format,'IPS_MONGODB_CI_LOGICAL_SNAPSHOT_V1');
  assert.ok(Array.isArray(envelope.collections)&&envelope.collections.length>=8);
  assert.ok(Array.isArray(envelope.objects)&&envelope.objects.length>=1);
  for(const col of envelope.collections){
    assert.ok(/^[A-Za-z0-9_.-]{1,120}$/.test(col.name));
    assert.ok(Array.isArray(col.documents)&&Array.isArray(col.indexes));
    for(const d of col.documents)
      assert.equal(sha(Buffer.from(d.base64,'base64')),d.sha256,'Corrupted BSON for '+col.name);
  }
  for(const obj of envelope.objects){
    safePath(obj.key);
    assert.equal(sha(Buffer.from(obj.base64,'base64')),obj.sha256,'Corrupted object '+obj.key);
  }
  return true;
}
const report={
  kind:'IPS_INDEPENDENT_DISPOSABLE_DATABASE_RECOVERY_DRILL',
  source:'MongoDB 7 CI server on loopback port 27017',
  restored_to:'separate MongoDB 7 CI server on loopback port 27018',
  production_database_access:false,
  production_customer_data_copied:false,
  payment_proof:'isolated signed test callback, not customer funds',
  telegram_outbound_live_proof:false,
  result:'FAIL'
};
let connected=false;
try{
  await mkdir(outputDir,{recursive:true});
  await Promise.all([src.connect(),dest.connect()]);
  connected=true;
  const source=src.db('ips_ci');
  const restore=dest.db('ips_ci_recovery_target');
  const previous=await restore.listCollections().toArray();
  assert.equal(previous.length,0,'Restore destination must begin completely empty');
  const collections=(await source.listCollections({},{nameOnly:false}).toArray())
    .filter(item=>item.type==='collection'&&!item.name.startsWith('system.'))
    .sort((a,b)=>a.name.localeCompare(b.name));
  const collectionNames=collections.map(x=>x.name);
  for(const required of ['clients','writers','servicerequests','studentpayments','platformfiles','notifications']){
    assert.ok(collectionNames.includes(required),'Actual tested IPS lifecycle collection missing: '+required);
  }
  const snapshot=[];
  for(const col of collections){
    const cursor=source.collection(col.name).find({},{batchSize:100});
    const documents=[];
    for await (const d of cursor){
      const bytes=bsonValue(d);
      documents.push({base64:bytes.toString('base64'),sha256:sha(bytes)});
    }
    const indexes=await source.collection(col.name).listIndexes().toArray();
    snapshot.push({name:col.name,options:col.options||{},
      indexes:indexes.map(x=>({key:x.key,name:x.name,options:indexOptions(x)})),
      documents});
  }
  const objectKeys=await safeFileWalk(fileRoot);
  const objects=[];
  for(const key of objectKeys){
    const bytes=await readFile(path.join(fileRoot,safePath(key)));
    objects.push({key,base64:bytes.toString('base64'),sha256:sha(bytes),length:bytes.length});
  }
  const envelope={
    format:'IPS_MONGODB_CI_LOGICAL_SNAPSHOT_V1',created_at:new Date().toISOString(),
    source_database:'ips_ci',source_is_disposable:true,
    collections:snapshot,objects
  };
  assert.equal(verifyBackup(envelope),true);
  const backupBytes=Buffer.from(JSON.stringify(envelope));
  await writeFile(archivePath,backupBytes,{mode:0o600});
  assert.ok((await lstat(archivePath)).size>0);
  const disk=await readFile(archivePath);
  assert.equal(sha(disk),sha(backupBytes));
  // The backup must detect even a single-byte change before any restore writes.
  const corrupt=Buffer.from(disk);
  const pivot=Math.max(10,Math.floor(corrupt.length/2));
  corrupt[pivot]=corrupt[pivot]===65?66:65;
  assert.notEqual(sha(corrupt),sha(disk));
  const validateDisk=async(data,expectedHash)=>{
    assert.equal(sha(data),expectedHash,'Backup archive checksum mismatch');
    const candidate=JSON.parse(data.toString('utf8'));
    verifyBackup(candidate);
    return candidate;
  };
  await assert.rejects(validateDisk(corrupt,sha(disk)),/checksum mismatch/);
  assert.equal((await restore.listCollections().toArray()).length,0,
    'Corrupted archive must never partly restore data');
  const verified=await validateDisk(disk,sha(disk));
  let indexCount=0,recordCount=0;
  for(const col of verified.collections){
    const allowed=Object.fromEntries(['validator','validationLevel','validationAction',
      'collation','capped','size','max','timeseries','expireAfterSeconds','clusteredIndex']
      .filter(key=>col.options[key]!==undefined).map(key=>[key,col.options[key]]));
    await restore.createCollection(col.name,allowed);
    const target=restore.collection(col.name);
    if(col.documents.length){
      for(let i=0;i<col.documents.length;i+=100){
        await target.insertMany(col.documents.slice(i,i+100).map(d=>parseBson(d.base64)),
          {ordered:true});
      }
    }
    const remaining=col.indexes.filter(ix=>ix.name!=='_id_');
    if(remaining.length){
      await target.createIndexes(remaining.map(ix=>({key:ix.key,name:ix.name,...ix.options})));
    }
    indexCount+=col.indexes.length;
    recordCount+=col.documents.length;
    const received=await target.find({}).toArray();
    assert.equal(received.length,col.documents.length,'Collection document count differs: '+col.name);
    const originalHashes=col.documents.map(d=>d.sha256).sort();
    const restoredHashes=received.map(d=>sha(bsonValue(d))).sort();
    assert.deepEqual(restoredHashes,originalHashes,'BSON field-level recovery differs: '+col.name);
    const restoredIndexes=await target.listIndexes().toArray();
    assert.deepEqual(restoredIndexes.map(x=>x.name).sort(),
      col.indexes.map(x=>x.name).sort(),'Unique and TTL index declarations differ: '+col.name);
  }
  await mkdir(restoreFiles,{recursive:true});
  for(const obj of verified.objects){
    const targetFile=path.join(restoreFiles,safePath(obj.key));
    assert.ok(targetFile.startsWith(restoreFiles+path.sep));
    await mkdir(path.dirname(targetFile),{recursive:true});
    await writeFile(targetFile,Buffer.from(obj.base64,'base64'),{mode:0o600});
    assert.equal(sha(await readFile(targetFile)),obj.sha256);
  }
  // A direct recovery witness of the EXACT academic lifecycle, not a mock
  // placeholder: verified private client, vetted specialist, signed test
  // payment, final release to the owner and its original stored document.
  const project=await restore.collection('servicerequests').findOne({
    client_id:'CID-TEST-ALICE',category:'Academic Support',
    status:'Completed',provider_id:'WID-CI-VERIFIED-01'
  });
  assert.ok(project?.request_id,'Restored completed academic service is missing');
  assert.ok(['paid','refunded','partially_refunded'].includes(project.payment_status));
  assert.ok(await restore.collection('clients').findOne({client_id:project.client_id,
    email_verified_at:{$ne:null}}),'Restored verified client identity is missing');
  assert.ok(await restore.collection('writers').findOne({writer_id:project.provider_id,
    application_status:'approved',email_verified_at:{$ne:null}}),
    'Restored vetted specialist identity is missing');
  const file=await restore.collection('platformfiles').findOne({
    order_id:project.request_id,state:'released'
  });
  assert.ok(file?.stored_name&&/^[A-Za-z0-9._-]+$/.test(file.stored_name),
    'Restored approved deliverable record is missing');
  const restoredObject=path.join(restoreFiles,file.stored_name);
  const content=await readFile(restoredObject);
  assert.equal(sha(content),file.checksum,'Restored real deliverable fails original sha256 checksum');
  assert.equal(content.length,file.size,'Restored deliverable size changed');
  const matchedPayment=await restore.collection('studentpayments').findOne({
    request_id:project.request_id
  });
  assert.ok(matchedPayment,'Signed isolated test payment record was not restored');
  const restoredCaseNotifications=await restore.collection('notifications').countDocuments({
    order_id:project.request_id
  });
  assert.ok(restoredCaseNotifications>=2,
    'Client/specialist project notifications were not restored');
  const sourceFingerprint=sha(disk);
  report.result='PASS';
  report.integrity={
    archive_sha256:sourceFingerprint,restored_collections:snapshot.length,
    restored_records:recordCount,restored_indexes:indexCount,
    restored_file_objects:objects.length,
    restored_file_bytes:objects.reduce((n,o)=>n+o.length,0),
    corruption_detection_passed:true,
    separate_mongodb_instance_passed:true,
    full_bson_value_equivalence_passed:true,
    all_index_names_preserved:true,
    real_completed_client_specialist_case_linked:true,
    original_deliverable_sha256_verified:true,
    signed_test_payment_record_restored:true,
    private_notifications_restored:true
  };
  console.log('IPS_INDEPENDENT_BACKUP_RESTORE_GREEN '+JSON.stringify({
    collections:snapshot.length,records:recordCount,indexes:indexCount,
    files:objects.length,source_and_restore_are_distinct:true,
    completed_client_specialist_delivery_recovered:true,archive_sha256:sourceFingerprint
  }));
}catch(error){
  report.failure=String(error?.message||error).slice(0,350);
  console.error('IPS_INDEPENDENT_BACKUP_RESTORE_FAILED '+report.failure);
  process.exitCode=1;
}finally{
  await mkdir(outputDir,{recursive:true});
  if(connected){
    try{
      const restore=dest.db('ips_ci_recovery_target');
      // Destructive cleanup allowed only on the guarded, separate CI restore
      // server. The source service (port 27017) is NEVER dropped.
      await restore.dropDatabase();
      report.restored_database_wiped_after_test=true;
    }catch(error){
      report.result='FAIL';
      report.cleanup_error=String(error?.message||error).slice(0,200);
      process.exitCode=1;
    }
  }
  await Promise.allSettled([src.close(),dest.close()]);
  await rm(root,{recursive:true,force:true});
  await writeFile(path.join(outputDir,'independent-backup-restore-report.json'),
    JSON.stringify(report,null,2)+'\n',{mode:0o600});
  console.log('IPS_RECOVERY_REPORT '+JSON.stringify(report));
}
