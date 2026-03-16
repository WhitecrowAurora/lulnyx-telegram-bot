#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
mkdir -p "$DIST_DIR"

cd "$ROOT_DIR"

NODE_BIN="$(command -v node || true)"
if [[ -n "${SEA_NODE_BIN:-}" ]]; then
  NODE_BIN="$SEA_NODE_BIN"
fi
if [[ -z "$NODE_BIN" || ! -f "$NODE_BIN" ]]; then
  echo "node binary not found. Set SEA_NODE_BIN or ensure node is in PATH." >&2
  exit 1
fi

echo "Bundling app (esbuild)..."
npx --yes esbuild index.mjs --bundle --platform=node --format=cjs --target=node18 --outfile="$DIST_DIR/sea-main.cjs" >/dev/null

echo "Generating SEA blob..."
"$NODE_BIN" --experimental-sea-config sea-config.json >/dev/null

OUT_BIN="$DIST_DIR/bot"
cp "$NODE_BIN" "$OUT_BIN"

BLOB="$DIST_DIR/sea-prep.blob"
if [[ ! -f "$BLOB" ]]; then
  echo "missing blob: $BLOB" >&2
  exit 1
fi

echo "Injecting blob (requires postject via npx)..."
npx --yes postject "$OUT_BIN" NODE_SEA_BLOB "$BLOB" \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
  --overwrite

chmod +x "$OUT_BIN"
echo "Done: $OUT_BIN"
echo "Run in dist/ with config.json: ./bot"
