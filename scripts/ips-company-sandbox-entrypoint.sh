#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
if [[ "$IPS_CLEANROOM_MODE" != sandbox || "$NODE_ENV" != test ]]; then
  echo "IPS evaluation image refuses production use." >&2
  exit 2
fi
if [[ -n "$RESEND_API_KEY" || -n "$STRIPE_SECRET_KEY" || -n "$TELEGRAM_BOT_TOKEN" || -n "$R2_ENDPOINT" ]]; then
  echo "IPS cleanroom evaluation refuses live provider credentials." >&2
  exit 3
fi
for key in ROOT_EMAIL ROOT_PASSWORD PUBLIC_APP_URL IPS_EVAL_CLIENT_PASSWORD IPS_EVAL_SPECIALIST_PASSWORD IPS_EVAL_MANAGER_PASSWORD IPS_EVAL_STAFF_PASSWORD; do
  if [[ -z "$(printenv "$key")" ]]; then echo "Evaluation requires private variable $key" >&2; exit 4; fi
done
mkdir -p /tmp/ips_company_mongodb
chmod 700 /tmp/ips_company_mongodb
MONGO_EVAL_PASSWORD="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))")"
export MONGO_EVAL_PASSWORD
export SESSION_SECRET="$(node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('base64url'))")"
export MONGODB_URI="mongodb://ips_company_sandbox:$MONGO_EVAL_PASSWORD@127.0.0.1:27017/ips_company_cleanroom_sandbox?authSource=admin"
export IPS_TEST_PAYMENTS=false
mongod --dbpath /tmp/ips_company_mongodb --port 27017 --bind_ip 127.0.0.1 --wiredTigerCacheSizeGB 0.25 --logpath /tmp/ips_company_mongodb.log --fork
ready=0
for i in $(seq 1 80); do
  if mongosh "mongodb://127.0.0.1:27017/admin" --quiet --eval "db.runCommand({ping:1}).ok" 2>/dev/null | grep -q '^1$'; then ready=1; break; fi
  sleep 1
done
if [[ $ready -ne 1 ]]; then echo "Disposable MongoDB failed" >&2; exit 5; fi
mongosh "mongodb://127.0.0.1:27017/admin" --quiet --eval 'db.createUser({user:"ips_company_sandbox",pwd:process.env.MONGO_EVAL_PASSWORD,roles:[{role:"readWrite",db:"ips_company_cleanroom_sandbox"}]})' >/dev/null
mongod --dbpath /tmp/ips_company_mongodb --shutdown >/dev/null
mongod --dbpath /tmp/ips_company_mongodb --port 27017 --bind_ip 127.0.0.1 --wiredTigerCacheSizeGB 0.25 --logpath /tmp/ips_company_mongodb.log --fork --auth >/dev/null
unset MONGO_EVAL_PASSWORD
node company-next/scripts/seed-review.mjs
echo "IPS NEW COMPANY EVALUATION ONLY: isolated data, no real payments, no outbound email or messengers."
exec node company-next/server.mjs
