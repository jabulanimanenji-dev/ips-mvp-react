#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
if [[ "${IPS_EVALUATION_MODE:-}" != 'true' || "${NODE_ENV:-}" != 'production' ]]; then
  echo 'Evaluation container cannot start without its explicit, isolated safety flags' >&2
  exit 2
fi
if [[ -n "${STRIPE_SECRET_KEY:-}" || -n "${STRIPE_WEBHOOK_SECRET:-}" || -n "${CONTACT_RESEND_API_KEY:-}" ||
      -n "${R2_ENDPOINT:-}" || -n "${TELEGRAM_BOT_TOKEN:-}" || -n "${WHATSAPP_ACCESS_TOKEN:-}" ]]; then
  echo 'Evaluation container refuses ALL real provider credentials.' >&2
  exit 3
fi
for key in ADMIN_EMAIL ADMIN_PASSWORD IPS_EVAL_CLIENT_PASSWORD IPS_EVAL_SPECIALIST_PASSWORD; do
  if [[ -z "${!key:-}" ]]; then echo "Missing evaluation-only account variable: $key" >&2; exit 4; fi
done
# All demo uploads and MongoDB collections are disposable and local to this
# container. There are no external customer databases, disks or messengers.
mkdir -p /tmp/ips_eval_mongodb /var/data/ips-evaluation-files
chmod 700 /tmp/ips_eval_mongodb /var/data/ips-evaluation-files
MONGO_EVAL_PASSWORD="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))")"
export MONGO_EVAL_PASSWORD
export MONGODB_URI="mongodb://ips_eval_user:${MONGO_EVAL_PASSWORD}@127.0.0.1:27017/ips_staging_evaluation?authSource=admin"
export SESSION_SECRET="$(node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('base64url'))")"
export STORAGE_PROVIDER=local
export UPLOADS_DIR=/var/data/ips-evaluation-files
export CONTACT_EMAIL_NOTIFICATIONS_ENABLED=false
export VITE_ADMIN_ENTRY_PATH=/ips-evaluation-ops
export IPS_STAGING_MODE=false
export NODE_OPTIONS='--max-old-space-size=256'
# Loopback-only Mongo with localhost bootstrap exception, never public.
# Bootstrap in a process-private, loopback-only window without authentication,
# then restart with --auth before seeding or accepting HTTP traffic.
mongod --dbpath /tmp/ips_eval_mongodb --port 27017 --bind_ip 127.0.0.1 \
  --wiredTigerCacheSizeGB 0.25 --logpath /tmp/ips-eval-mongod.log --fork
ready=0
for i in $(seq 1 60); do
  if mongosh 'mongodb://127.0.0.1:27017/admin' --quiet --eval 'db.runCommand({ping:1}).ok' 2>/dev/null | grep -q '^1$'; then
    ready=1; break
  fi
  sleep 1
done
if [[ "$ready" -ne 1 ]]; then
  echo 'Evaluation local MongoDB failed to start' >&2
  tail -50 /tmp/ips-eval-mongod.log >&2
  exit 5
fi
mongosh 'mongodb://127.0.0.1:27017/admin' --quiet --eval \
  'db.createUser({user:"ips_eval_user",pwd:process.env.MONGO_EVAL_PASSWORD,roles:[{role:"readWrite",db:"ips_staging_evaluation"}]})' >/dev/null
mongod --dbpath /tmp/ips_eval_mongodb --shutdown >/dev/null
mongod --dbpath /tmp/ips_eval_mongodb --port 27017 --bind_ip 127.0.0.1 \
  --wiredTigerCacheSizeGB 0.25 --logpath /tmp/ips-eval-mongod.log --fork --auth >/dev/null
unset MONGO_EVAL_PASSWORD
node scripts/seed-ips-evaluation.mjs
echo 'IPS EVALUATION ONLY: starting working three-role Express backend over disposable real MongoDB 7.'
echo 'No real customer records, provider credentials, card payments, email sends, or persistent files are connected.'
exec node server.js
