#!/usr/bin/env bash
# Corre tests/sql/seguranca.sql e falha se algum caso der ok=false (ou se der erro).
source "$(dirname "$0")/lib.sh"

[ "$(psql -XAtc "select count(*) from pg_namespace where nspname = 'privado'")" = 1 ] \
  || falhar "o schema 'privado' não existe: as migrações do repositório não coincidem com o que tests/sql/seguranca.sql espera (ADR do schema privado)"

saida="$(mktemp)"
sql -At -F '|' -f "$BD_RAIZ/tests/sql/seguranca.sql" >"$saida" || { cat "$saida"; falhar "seguranca.sql terminou com erro"; }

total=0; falhas=0
while IFS='|' read -r caso ok detalhe; do
  [ -n "$caso" ] || continue
  total=$((total + 1))
  if [ "$ok" = t ]; then echo "  ✓ $caso"; else echo "  ✗ $caso ($detalhe)"; falhas=$((falhas + 1)); fi
done <"$saida"
rm -f "$saida"

[ "$total" -ge 17 ] || falhar "só $total casos devolvidos (esperados pelo menos 17): o teste não correu por inteiro"
[ "$falhas" -eq 0 ] || falhar "$falhas de $total casos de segurança falharam"
echo "✓ segurança: $total de $total casos a passar"
