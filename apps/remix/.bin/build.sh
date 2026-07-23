#!/usr/bin/env bash

# Exit on error.
set -e

SCRIPT_DIR="$(readlink -f "$(dirname "$0")")"
WEB_APP_DIR="$SCRIPT_DIR/.."

# Store the original directory
ORIGINAL_DIR=$(pwd)

# Set up trap to ensure we return to original directory
trap 'cd "$ORIGINAL_DIR"' EXIT

cd "$WEB_APP_DIR"

start_time=$(date +%s)

echo "[Build]: Extracting and compiling translations"
npm run translate --prefix ../../

echo "[Build]: Building app"
npm run build:app

echo "[Build]: Building server"
npm run build:server

# Copy over the entry point for the server.
cp server/main.js build/server/main.js

# Copy over all web.js translations
cp -r ../../packages/lib/translations build/server/hono/packages/lib/translations

# Upload hashed client assets to CDN bucket when configured.
# Skip --delete so stale HTML still referencing old chunks keeps working.
if [ -n "$CDN_S3_BUCKET" ]; then
  echo "[Build]: Uploading assets to s3://$CDN_S3_BUCKET/assets/"
  aws s3 sync build/client/assets/ "s3://$CDN_S3_BUCKET/assets/" \
    --cache-control "public, immutable, max-age=31536000" \
    --no-progress
fi

# Time taken
end_time=$(date +%s)

echo "[Build]: Done in $((end_time - start_time)) seconds"