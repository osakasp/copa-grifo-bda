#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
node scripts/check-portal.cjs
npm test
# Ensure committed legacy bundles are reproducible without modifying the checkout.
check_dir="${TMPDIR:-/tmp}/arena-bda-bundle-check-$$"
mkdir -p "$check_dir"
trap 'rm -rf "$check_dir"' EXIT
cp arena-runtime.bundle.js arena-interface.bundle.js "$check_dir/"
bash scripts/build-production-bundles.sh
cmp "$check_dir/arena-runtime.bundle.js" arena-runtime.bundle.js
cmp "$check_dir/arena-interface.bundle.js" arena-interface.bundle.js
