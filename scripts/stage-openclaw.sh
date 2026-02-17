#!/bin/bash
# stage-openclaw.sh — Create a minimal production bundle of openclaw-core
# Strips dev deps, source code, .git, docs, tests, .map files, and per-package bloat
# Called automatically by the electron-builder build step
set -e

SRC="server/openclaw-core"
DEST="server/openclaw-core-prod"

echo "[stage-openclaw] Creating production bundle..."
echo "[stage-openclaw] Source: $SRC"

# Clean previous staging
rm -rf "$DEST"
mkdir -p "$DEST"

# ── 1. Copy only runtime files ──────────────────────────────────────────────
echo "[stage-openclaw] Copying runtime files..."
cp "$SRC/package.json" "$DEST/"
cp "$SRC/openclaw.mjs" "$DEST/"
cp -R "$SRC/dist" "$DEST/"
cp -R "$SRC/data" "$DEST/"
[ -d "$SRC/assets" ]     && cp -R "$SRC/assets" "$DEST/"
[ -d "$SRC/extensions" ] && cp -R "$SRC/extensions" "$DEST/"
[ -d "$SRC/skills" ]     && cp -R "$SRC/skills" "$DEST/"
[ -d "$SRC/vendor" ]     && cp -R "$SRC/vendor" "$DEST/"

# ── 2. Copy node_modules (preserving symlinks for pnpm) ─────────────────────
echo "[stage-openclaw] Copying node_modules..."
cp -RP "$SRC/node_modules" "$DEST/node_modules"

# ── 3. Remove dev-only packages from .pnpm store ────────────────────────────
echo "[stage-openclaw] Removing dev-only packages..."
PNPM="$DEST/node_modules/.pnpm"

# TypeScript / build tools (never needed at runtime)
rm -rf "$PNPM"/typescript@*
rm -rf "$PNPM"/@typescript+native-preview*
rm -rf "$PNPM"/tsdown@*
rm -rf "$PNPM"/tsx@*
rm -rf "$PNPM"/rolldown@*
rm -rf "$PNPM"/@rolldown*

# Linters / formatters
rm -rf "$PNPM"/oxlint@*
rm -rf "$PNPM"/@oxlint*
rm -rf "$PNPM"/oxlint-tsgolint@*
rm -rf "$PNPM"/@oxlint-tsgolint*
rm -rf "$PNPM"/oxfmt@*

# Test frameworks
rm -rf "$PNPM"/vitest@*
rm -rf "$PNPM"/@vitest*

# Build tooling
rm -rf "$PNPM"/@esbuild*
rm -rf "$PNPM"/esbuild@*

# Type packages (not needed at runtime)
rm -rf "$PNPM"/@cloudflare+workers-types*
rm -rf "$PNPM"/@types+*

# Polyfills (Node 22+ doesn't need them)
rm -rf "$PNPM"/core-js@*

# Lit (dev-only UI lib)
rm -rf "$PNPM"/lit@*
rm -rf "$PNPM"/@lit*
rm -rf "$PNPM"/@lit-labs*

# Ollama (dev dep)
rm -rf "$PNPM"/ollama@*

# ── 4. Remove leaked build artifacts (NOT production deps or peer deps) ──────
echo "[stage-openclaw] Removing leaked build artifacts..."
# NOTE: node-llama-cpp and @napi-rs/canvas are KEPT — needed for local brain mode + image tools
rm -rf "$PNPM"/@oxfmt*
rm -rf "$PNPM"/lightningcss@*
rm -rf "$PNPM"/lightningcss-*
rm -rf "$PNPM"/playwright@*

# ── 5. Clean broken symlinks (from removed .pnpm packages) ──────────────────
echo "[stage-openclaw] Cleaning broken symlinks..."
find "$DEST/node_modules" -maxdepth 2 -type l ! -exec test -e {} \; -delete 2>/dev/null || true

# ── 6. Strip per-package bloat from ALL remaining packages ───────────────────
echo "[stage-openclaw] Stripping bloat from packages..."

# Source maps (34MB+ savings)
find "$DEST" -name "*.map" -type f -delete 2>/dev/null || true

# TypeScript definitions (not needed at runtime)
find "$DEST/node_modules" -name "*.d.ts" -type f -delete 2>/dev/null || true
find "$DEST/node_modules" -name "*.d.mts" -type f -delete 2>/dev/null || true
find "$DEST/node_modules" -name "*.d.cts" -type f -delete 2>/dev/null || true

# Documentation and metadata bloat
find "$DEST/node_modules" -maxdepth 4 \( \
    -name "README.md" -o -name "README" -o -name "readme.md" -o \
    -name "CHANGELOG.md" -o -name "CHANGELOG" -o -name "changelog.md" -o \
    -name "HISTORY.md" -o -name "HISTORY" -o \
    -name "CONTRIBUTING.md" -o -name "CONTRIBUTING" -o \
    -name "AUTHORS" -o -name "SPONSORS.md" -o \
    -name ".editorconfig" -o -name ".eslintrc*" -o -name ".prettierrc*" -o \
    -name ".npmignore" -o -name ".gitattributes" -o \
    -name "tsconfig*.json" -o -name "tslint.json" -o \
    -name ".eslintignore" -o -name ".travis.yml" -o \
    -name "Makefile" -o -name "Gruntfile.js" -o -name "Gulpfile.js" -o \
    -name "karma.conf.js" -o -name "jest.config.*" -o \
    -name ".babelrc" -o -name "babel.config.*" -o \
    -name "rollup.config.*" -o -name "webpack.config.*" \
\) -type f -delete 2>/dev/null || true

# Test directories within packages
find "$DEST/node_modules/.pnpm" -maxdepth 5 -type d \( \
    -name "test" -o -name "tests" -o -name "__tests__" -o \
    -name "__mocks__" -o -name "fixtures" -o -name "example" -o \
    -name "examples" -o -name "benchmark" -o -name "benchmarks" \
\) -exec rm -rf {} + 2>/dev/null || true

# ── 7. Strip per-package junk (safe — removes unused files WITHIN packages) ──
echo "[stage-openclaw] Stripping per-package junk..."

# node-wav ships 7.5MB of test data (the actual lib is 8KB)
rm -f "$PNPM"/node-wav@*/node_modules/node-wav/x.json 2>/dev/null
rm -f "$PNPM"/node-wav@*/node_modules/node-wav/file.wav 2>/dev/null
rm -f "$PNPM"/node-wav@*/node_modules/node-wav/x.js~ 2>/dev/null

# pdfjs-dist: strip legacy browser builds + browser viewer UI (server only needs modern build)
rm -rf "$PNPM"/pdfjs-dist@*/node_modules/pdfjs-dist/legacy 2>/dev/null
rm -rf "$PNPM"/pdfjs-dist@*/node_modules/pdfjs-dist/web 2>/dev/null
rm -rf "$PNPM"/pdfjs-dist@*/node_modules/pdfjs-dist/image_decoders 2>/dev/null
find "$PNPM"/pdfjs-dist@* -name "*.min.mjs" -delete 2>/dev/null || true

# @larksuiteoapi/node-sdk: strip duplicate ESM build (CJS lib/ is used)
rm -rf "$PNPM"/@larksuiteoapi+node-sdk@*/node_modules/@larksuiteoapi/node-sdk/es 2>/dev/null

# @mistralai: strip TypeScript source (compiled output is used)
rm -rf "$PNPM"/@mistralai+mistralai@*/node_modules/@mistralai/mistralai/src 2>/dev/null

# @google/genai: strip browser bundles
rm -rf "$PNPM"/@google+genai@*/node_modules/@google/genai/dist/web 2>/dev/null

# highlight.js: strip browser CSS themes + SCSS
find "$PNPM" -path "*/highlight.js/styles" -type d -exec rm -rf {} + 2>/dev/null || true
find "$PNPM" -path "*/highlight.js/scss" -type d -exec rm -rf {} + 2>/dev/null || true

# Strip src/ directories inside packages where dist/ exists (compiled output is used)
for pkg in "$PNPM"/@wasm-audio-decoders+opus-ml@*/node_modules/@wasm-audio-decoders/opus-ml \
           "$PNPM"/ogg-opus-decoder@*/node_modules/ogg-opus-decoder; do
    [ -d "$pkg/dist" ] && [ -d "$pkg/src" ] && rm -rf "$pkg/src" 2>/dev/null
done

# ── 8. Report final size ────────────────────────────────────────────────────
TOTAL=$(du -sm "$DEST" | cut -f1)
NM=$(du -sm "$DEST/node_modules" 2>/dev/null | cut -f1)
DIST=$(du -sm "$DEST/dist" 2>/dev/null | cut -f1)
echo ""
echo "[stage-openclaw] ✅ Production bundle ready!"
echo "[stage-openclaw]    Total: ${TOTAL}MB (node_modules: ${NM}MB, dist: ${DIST}MB)"
echo "[stage-openclaw]    Location: $DEST"
