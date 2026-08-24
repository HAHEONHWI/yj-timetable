#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
# Defaults to an in-repo folder so Netlify's own CI build (which checks out
# a fresh copy with no /private/tmp state) can publish it directly. Local
# manual deploys still point NETLIFY_DEPLOY_DIR at a scratch dir outside
# the repo (see package.json's deploy:netlify script).
DEPLOY_DIR="${NETLIFY_DEPLOY_DIR:-$ROOT_DIR/netlify-deploy}"

rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR/assets" "$DEPLOY_DIR/src" "$DEPLOY_DIR/downloads" "$DEPLOY_DIR/widget" "$DEPLOY_DIR/netlify/functions"

cp "$ROOT_DIR/index.html" "$ROOT_DIR/styles.css" "$ROOT_DIR/_redirects" "$ROOT_DIR/netlify.toml" "$ROOT_DIR/404.html" "$DEPLOY_DIR/"
cp "$ROOT_DIR/assets/logo.png" "$ROOT_DIR/assets/home-banner.png" "$DEPLOY_DIR/assets/"
cp "$ROOT_DIR/src/app.js" "$ROOT_DIR/src/storage.js" "$ROOT_DIR/src/supabase-config.js" "$DEPLOY_DIR/src/"
cp "$ROOT_DIR/widget/widget.html" "$ROOT_DIR/widget/widget.css" "$ROOT_DIR/widget/widget.js" "$DEPLOY_DIR/widget/"
cp "$ROOT_DIR/netlify/functions/wallpaper.js" "$ROOT_DIR/netlify/functions/meal.js" "$DEPLOY_DIR/netlify/functions/"
cp -r "$ROOT_DIR/netlify/functions/fonts" "$DEPLOY_DIR/netlify/functions/"

# downloads/ itself is gitignored (local scratch) and may not exist at all
# on a fresh checkout, so every file placed there must first be refreshed
# from a path that's actually tracked in git.
mkdir -p "$ROOT_DIR/downloads"
cp "$ROOT_DIR/android-widget/output/yj-timetable-widget.apk" "$ROOT_DIR/downloads/"
cp "$ROOT_DIR/android-widget/output/yj-timetable-board.apk" "$ROOT_DIR/downloads/"
cp "$ROOT_DIR/Widget-Win/용정시간표-Widget-Setup.exe" "$ROOT_DIR/downloads/yongjeong-timetable-widget-setup.exe"
cp "$ROOT_DIR/downloads/yj-timetable-board.apk" "$ROOT_DIR/downloads/yj-timetable-widget.apk" "$ROOT_DIR/downloads/yongjeong-timetable-widget-setup.exe" "$DEPLOY_DIR/downloads/"

echo "Prepared Netlify deploy directory: $DEPLOY_DIR"
