#!/usr/bin/env bash
# Arranca um Postgres temporário (wal_level=logical, para provar o tempo real) e aplica
# scripts/bd/preparar.sql e todas as migrações de supabase/migrations/ por ordem.
source "$(dirname "$0")/lib.sh"

if [ -z "$BD_BIN" ] || [ ! -x "$BD_BIN/initdb" ]; then
  echo "Postgres não encontrado; a instalar com apt…"
  sudo -n apt-get update -qq && sudo -n apt-get install -y -qq postgresql >/dev/null
  BD_BIN="$(procurar_bin)"; export PATH="$BD_BIN:$PATH"
fi
[ "$(id -u)" -ne 0 ] || falhar "o initdb não corre como root; usa outro utilizador"

if pg_isready -q 2>/dev/null; then
  echo "Já existe um Postgres em $PGHOST; a parar e recriar."
  pg_ctl -D "$BD_DIR/dados" -m immediate stop >/dev/null || true
fi
rm -rf "$BD_DIR"; mkdir -p "$BD_DIR/socket"

initdb -D "$BD_DIR/dados" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
pg_ctl -D "$BD_DIR/dados" -l "$BD_DIR/postgres.log" -w start \
  -o "-c listen_addresses='' -c unix_socket_directories='$BD_DIR/socket' -c port=$BD_PORTA \
      -c wal_level=logical -c fsync=off -c max_connections=60" >/dev/null
echo "✓ Postgres $(psql -XAtc 'show server_version') a correr em $BD_DIR/socket"

sql -f "$BD_RAIZ/scripts/bd/preparar.sql"
shopt -s nullglob
n=0
for m in "${BD_MIGRACOES:-$BD_RAIZ/supabase/migrations}"/*.sql; do
  echo "▶ migração $(basename "$m")"
  sql --single-transaction -f "$m"
  n=$((n + 1))
done
[ "$n" -gt 0 ] || falhar "nenhuma migração encontrada em supabase/migrations/"
echo "✓ $n migração(ões) aplicada(s)"
