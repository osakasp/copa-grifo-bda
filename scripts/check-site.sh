#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

for file in *.js; do
  node --check "$file" >/dev/null
done
node scripts/test-super-league-rule.js >/dev/null
node scripts/test-flash-draw.js >/dev/null
node scripts/test-flash-knockout.js >/dev/null

while IFS= read -r reference; do
  path="${reference%%\?*}"
  path="${path#./}"
  if [[ ! -e "$path" ]]; then
    echo "Referência local ausente: $reference" >&2
    exit 1
  fi
done < <(
  rg -o "\./[A-Za-z0-9._/-]+\.(js|html|svg|webmanifest)(\?v=[A-Za-z0-9._-]+)?" \
    --glob '*.js' --glob '*.html' \
    | cut -d: -f2- \
    | sort -u
)

if rg -n \
  "1 direto \+ 2 repescagem|1º direto às quartas|2º e 3º (disputam|repescagem)|3 classificados por grupo|DEFAULT_QUALIFIERS\s*=\s*3|qualifiersPerGroup:\s*3|qualifiers:\s*3" \
  --glob '*.js' --glob '*.html'; then
  echo "Regra antiga da Super League ainda está ativa no código." >&2
  exit 1
fi

bundle_check_dir="$(mktemp -d)"
trap 'rm -rf "$bundle_check_dir"' EXIT
cp arena-runtime.bundle.js arena-interface.bundle.js "$bundle_check_dir/"

bash scripts/build-production-bundles.sh

if ! cmp -s "$bundle_check_dir/arena-runtime.bundle.js" arena-runtime.bundle.js || \
   ! cmp -s "$bundle_check_dir/arena-interface.bundle.js" arena-interface.bundle.js; then
  echo "Os bundles de produção estavam desatualizados." >&2
  exit 1
fi

echo "Verificação concluída: sintaxe, referências, regra da Super League e bundles estão consistentes."
