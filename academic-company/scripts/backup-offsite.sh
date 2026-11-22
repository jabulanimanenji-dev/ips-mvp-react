#!/usr/bin/env bash
# IPS academic company: encrypted, versioned, read-back-verified offsite backup.
# Secondary defence only: Atlas-managed snapshots are ALSO required.
# NO plaintext MongoDB archive is written to disk, and customer data is never logged.
set -Eeuo pipefail
umask 077

die() { printf '%s\n' "IPS_OFFSITE_BACKUP_FAILED: $1" >&2; exit 2; }
for name in MONGODB_URI IPS_BACKUP_AES256_KEY IPS_BACKUP_S3_BUCKET IPS_BACKUP_S3_PREFIX AWS_REGION IPS_ACADEMIC_SOURCE_COMMIT; do
  printenv "$name" >/dev/null || die "Missing required backup configuration: $name"
  [ -n "$(printenv "$name")" ] || die "Empty required backup configuration: $name"
done
[[ "$IPS_BACKUP_S3_BUCKET" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]] || die "Invalid bucket name"
[[ "$IPS_BACKUP_S3_PREFIX" =~ ^[A-Za-z0-9/_-]{1,100}$ ]] || die "Invalid object prefix"
[[ "$AWS_REGION" =~ ^[a-z0-9-]{3,32}$ ]] || die "Invalid AWS region"
[[ "$IPS_ACADEMIC_SOURCE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || die "Unpinned academic source"
[[ "$IPS_BACKUP_AES256_KEY" =~ ^[0-9a-fA-F]{64}$ ]] || die "Invalid AES-256 key"
for binary in mongodump node aws sha256sum mktemp; do
  command -v "$binary" >/dev/null 2>&1 || die "Missing backup dependency: $binary"
done
# The destination must already have versioning and all four public-access guards.
versioning="$(aws s3api get-bucket-versioning --bucket "$IPS_BACKUP_S3_BUCKET" --query Status --output text)"
[ "$versioning" = "Enabled" ] || die "Offsite storage must have versioning Enabled"
protection="$(aws s3api get-public-access-block --bucket "$IPS_BACKUP_S3_BUCKET" \
  --query 'PublicAccessBlockConfiguration.[BlockPublicAcls,IgnorePublicAcls,BlockPublicPolicy,RestrictPublicBuckets]' \
  --output text | tr '\t' ' ' | tr -s ' ')"
[ "$protection" = "True True True True" ] || die "Offsite bucket must block all public access"

workdir="$(mktemp -d /tmp/ips-academic-backup.XXXXXXXX)" || die "Cannot allocate private temporary directory"
chmod 700 "$workdir"
trap 'rm -rf -- "$workdir"' EXIT
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
nonce="$(node -e "process.stdout.write(require('node:crypto').randomBytes(8).toString('hex'))")"
archive="$workdir/academic-encrypted.aesgcm"
readback="$workdir/offsite-readback.aesgcm"
object="$IPS_BACKUP_S3_PREFIX/academic-$timestamp-$nonce.aesgcm"
root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

# Streaming-only encryption; pipefail fails if the real database dump is incomplete.
mongodump --uri "$MONGODB_URI" --db ips_academic_services_2026 --archive | \
  node "$root/scripts/encrypted-mongo-archive.mjs" encrypt "$archive"
[ -s "$archive" ] || die "No encrypted archive created"
sha="$(sha256sum "$archive" | cut -d' ' -f1)"
bytes="$(wc -c < "$archive" | tr -d ' ')"
# Metadata holds no client names, addresses, academic content or database URI.
aws s3api put-object \
  --bucket "$IPS_BACKUP_S3_BUCKET" --key "$object" --body "$archive" \
  --server-side-encryption AES256 \
  --metadata "sha256=$sha,source=$IPS_ACADEMIC_SOURCE_COMMIT,format=ips-aes256gcm-v1" \
  --no-cli-pager >/dev/null
stored_sha="$(aws s3api head-object --bucket "$IPS_BACKUP_S3_BUCKET" --key "$object" \
  --query Metadata.sha256 --output text)"
stored_bytes="$(aws s3api head-object --bucket "$IPS_BACKUP_S3_BUCKET" --key "$object" \
  --query ContentLength --output text)"
[ "$sha" = "$stored_sha" ] && [ "$bytes" = "$stored_bytes" ] ||
 die "Uploaded archive metadata disagrees with original"

# Independently fetch from the object store and authenticate ciphertext before success.
aws s3api get-object --bucket "$IPS_BACKUP_S3_BUCKET" --key "$object" \
  "$readback" --no-cli-pager >/dev/null
[ "$(sha256sum "$readback" | cut -d' ' -f1)" = "$sha" ] ||
 die "Offsite ciphertext did not survive independent read-back"
node "$root/scripts/encrypted-mongo-archive.mjs" decrypt "$readback" >/dev/null ||
 die "Offsite ciphertext authentication failed"
printf 'IPS_OFFSITE_BACKUP_VERIFIED source=%s object=%s bytes=%s sha256=%s\n' \
 "$IPS_ACADEMIC_SOURCE_COMMIT" "$object" "$bytes" "$sha"
