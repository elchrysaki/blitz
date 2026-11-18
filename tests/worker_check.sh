#!/bin/sh
# Runs src/worker.js's game logic (cleanQuiz + the GameRoom Durable Object) with fake Cloudflare
# storage and D1, using macOS's built-in JavaScriptCore (no Node needed). Catches worker bugs before a deploy.
#   sh tests/worker_check.sh
set -e
cd "$(dirname "$0")/.."
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
TMP=$(mktemp -d)
sed 's#^import { DurableObject } from "cloudflare:workers";#class DurableObject { constructor(c, e) { this.ctx = c; this.env = e; } }#' src/worker.js > "$TMP/worker.mjs"
printf '\nexport { cleanQuiz };\n' >> "$TMP/worker.mjs"
cp tests/worker_harness.mjs "$TMP/"
"$JSC" -m "$TMP/worker_harness.mjs"
rm -rf "$TMP"
