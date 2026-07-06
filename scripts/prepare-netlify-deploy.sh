#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
DEPLOY_DIR="${NETLIFY_DEPLOY_DIR:-/private/tmp/timetable-netlify-deploy}"

rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR/assets" "$DEPLOY_DIR/src" "$DEPLOY_DIR/downloads" "$DEPLOY_DIR/widget" "$DEPLOY_DIR/netlify/functions"

cp "$ROOT_DIR/index.html" "$ROOT_DIR/styles.css" "$ROOT_DIR/_redirects" "$ROOT_DIR/404.html" "$DEPLOY_DIR/"
cp "$ROOT_DIR/assets/logo.png" "$ROOT_DIR/assets/home-banner.png" "$DEPLOY_DIR/assets/"
cp "$ROOT_DIR/src/app.js" "$ROOT_DIR/src/storage.js" "$ROOT_DIR/src/supabase-config.js" "$DEPLOY_DIR/src/"
cp "$ROOT_DIR/widget/widget.html" "$ROOT_DIR/widget/widget.css" "$ROOT_DIR/widget/widget.js" "$DEPLOY_DIR/widget/"
cp "$ROOT_DIR/netlify/functions/wallpaper.js" "$DEPLOY_DIR/netlify/functions/"
cp -r "$ROOT_DIR/netlify/functions/fonts" "$DEPLOY_DIR/netlify/functions/"
cp "$ROOT_DIR/downloads/yj-timetable-board.apk" "$ROOT_DIR/downloads/yongjeong-timetable-widget-setup.exe" "$DEPLOY_DIR/downloads/"

echo "Prepared Netlify deploy directory: $DEPLOY_DIR"
