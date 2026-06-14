#!/bin/sh
set -e

KEY_PATH="${TRUSTAI_SIGNING_KEY_PATH:-/app/secrets/signing_key.pem}"

if [ ! -f "$KEY_PATH" ]; then
  echo "Generating signing key at $KEY_PATH"
  python /app/scripts/generate_signing_key.py --output "$KEY_PATH"
fi

cd /app/backend
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
