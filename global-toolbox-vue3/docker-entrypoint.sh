#!/bin/sh
set -eu

TARGET="${FRONTEND_DEST:-/srv/frontend}"
mkdir -p "$TARGET"
# Replace previous contents so rebuilds are not mixed with stale assets.
find "$TARGET" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -a /dist-src/. "$TARGET/"
echo "Frontend assets copied to $TARGET"
ls -la "$TARGET" | head -n 20
