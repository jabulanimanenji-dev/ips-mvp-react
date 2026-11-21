#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
if [[ "$(printenv IPS_ACADEMIC_MODE || true)" != "evaluation" || "$(printenv NODE_ENV || true)" != "test" ]]; then
  echo "IPS academic evaluation image refuses production service settings." >&2; exit 2
fi
if [[ -n "$(printenv RESEND_API_KEY || true)" || -n "$(printenv STRIPE_SECRET_KEY || true)" || -n "$(printenv TELEGRAM_BOT_TOKEN || true)" ||
      -n "$(printenv R2_ENDPOINT || true)" || -n "$(printenv MONGODB_URI || true)" ]]; then
  echo "IPS academic evaluation refuses live provider tokens and external MongoDB." >&2; exit 3
fi
for key in ROOT_EMAIL ROOT_PASSWORD PUBLIC_APP_URL IPS_REVIEW_STUDENT_PASSWORD IPS_REVIEW_SPECIALIST_PASSWORD IPS_REVIEW_MANAGER_PASSWORD IPS_REVIEW_STAFF_PASSWORD; do
  if [[ -z "$(printenv "$key" || true)" ]]; then
    echo "Synthetic academic review requires private environment variable $key" >&2; exit 4
  fi
done
mkdir -p /tmp/ips_academic_mongodb
chmod 700 /tmp/ips_academic_mongodb
export MONGO_EVAL_PASS="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))")"
export SESSION_SECRET="$(node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('base64url'))")"
export MONGODB_URI="mongodb://ips_academic_preview:$MONGO_EVAL_PASS@127.0.0.1:27017/ips_academic_sandbox?authSource=admin"
export IPS_ACADEMIC_TEST_SETTLEMENT=false
mongod --dbpath /tmp/ips_academic_mongodb --port 27017 --bind_ip 127.0.0.1 \
  --wiredTigerCacheSizeGB 0.25 --logpath /tmp/ips_academic_mongodb.log --fork
ready=0
for i in $(seq 1 70); do
  if mongosh "mongodb://127.0.0.1:27017/admin" --quiet --eval 'db.runCommand({ping:1}).ok' 2>/dev/null | grep -q '^1$'; then
    ready=1; break
  fi
  sleep 1
done
if [[ $ready -ne 1 ]]; then echo "Private academic MongoDB failed to start." >&2; exit 5; fi
mongosh "mongodb://127.0.0.1:27017/admin" --quiet --eval \
  'db.createUser({user:"ips_academic_preview",pwd:process.env.MONGO_EVAL_PASS,roles:[{role:"readWrite",db:"ips_academic_sandbox"}]})' >/dev/null
mongod --dbpath /tmp/ips_academic_mongodb --shutdown >/dev/null
mongod --dbpath /tmp/ips_academic_mongodb --port 27017 --bind_ip 127.0.0.1 \
  --wiredTigerCacheSizeGB 0.25 --logpath /tmp/ips_academic_mongodb.log --fork --auth >/dev/null
unset MONGO_EVAL_PASS
node scripts/seed-review.mjs
echo "IPS ACADEMIC SERVICES review: fictional students, academic Specialists and commissions; no external mail, messages or payments."
exec node src/app.mjs
