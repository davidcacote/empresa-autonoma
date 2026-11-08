#!/usr/bin/env bash
# Variáveis e funções partilhadas pelos scripts de base de dados (Postgres local, sem Docker).
set -euo pipefail

BD_RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BD_DIR="${BD_DIR:-${RUNNER_TEMP:-/tmp}/barraca-bd}"
BD_PORTA="${BD_PORTA:-54329}"

# Ligação por socket Unix, sem palavra-passe (cluster temporário e descartável).
export PGHOST="$BD_DIR/socket" PGPORT="$BD_PORTA" PGUSER=postgres PGDATABASE=postgres

procurar_bin() {
  local d
  d="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
  if [ -n "$d" ]; then echo "$d"; elif command -v initdb >/dev/null; then dirname "$(command -v initdb)"; fi
}
BD_BIN="${BD_BIN:-$(procurar_bin)}"
[ -n "$BD_BIN" ] && export PATH="$BD_BIN:$PATH"

# psql silencioso, sem .psqlrc, a parar ao primeiro erro
sql() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }

falhar() { echo "✗ $*" >&2; exit 1; }
