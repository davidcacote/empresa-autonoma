#!/usr/bin/env bash
# Tempo real, o que é possível provar só com Postgres (ver tests/TEMPO-REAL.md para o resto):
#  1. a publication supabase_realtime inclui turnos e inscricoes, e não inclui tabelas privadas;
#  2. uma inscrição e um cancelamento geram mesmo eventos de replicação lógica (pgoutput,
#     o formato que o servidor Realtime do Supabase consome): INSERT em inscricoes,
#     UPDATE em turnos (contador), DELETE em inscricoes — e nenhum evento de tabelas privadas.
source "$(dirname "$0")/lib.sh"

SLOT=ci_realtime
slug=""
limpar() {
  psql -XqAt -c "select pg_drop_replication_slot('$SLOT') from pg_replication_slots where slot_name = '$SLOT'" >/dev/null 2>&1 || true
  [ -z "$slug" ] || psql -XqAt -c "delete from public.festas where slug = '$slug'" >/dev/null 2>&1 || true
}
trap limpar EXIT

# 1. Publication
tabelas="$(psql -XAt -c "select string_agg(tablename, ',' order by tablename) from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'")"
[ "$tabelas" = "inscricoes,turnos" ] || falhar "supabase_realtime deveria ter exatamente public.inscricoes e public.turnos; tem: '${tabelas:-nada}'"
echo "✓ publication supabase_realtime = public.inscricoes + public.turnos"

# 2. Eventos reais
[ "$(psql -XAt -c 'show wal_level')" = logical ] || falhar "wal_level não é logical"
slug="$(sql -At <<'SQL' | tail -1
set role anon;
select set_config('request.headers', '{"x-forwarded-for":"10.201.0.1"}', false);
select public.criar_festa(json_build_object(
  'nome', 'Festa Tempo Real CI', 'localidade', 'CI', 'slug_base', 'tempo-real-ci',
  'data_inicio', current_date + 1, 'data_fim', current_date + 1,
  'postos', json_build_array(json_build_object('nome', 'Bar', 'turnos',
    json_build_array(json_build_object('dia', current_date + 1, 'inicio', '10:00', 'fim', '12:00', 'vagas', 2)))))) ->> 'slug';
SQL
)"
turno="$(psql -XAt -c "select t.id from public.turnos t join public.festas f on f.id = t.festa_id where f.slug = '$slug'")"
psql -XqAt -c "select pg_drop_replication_slot('$SLOT') from pg_replication_slots where slot_name = '$SLOT'" >/dev/null
psql -XqAt -c "select pg_create_logical_replication_slot('$SLOT', 'pgoutput')" >/dev/null

# Uma inscrição e o respetivo cancelamento, como anónimo, pela API pública.
sql -At -v turno="$turno" >/dev/null <<'SQL'
set role anon;
select set_config('request.headers', '{"x-forwarded-for":"10.201.0.2"}', false);
select public.inscrever(:'turno'::uuid, 'Pessoa', 'ci-disp-tempo-real-0123456789', true);
select public.cancelar_inscricao((select id from public.inscricoes where turno_id = :'turno'::uuid), 'ci-disp-tempo-real-0123456789');
SQL

resumo="$(psql -XAt -F ' ' -c "
with ev as (
  select data from pg_logical_slot_get_binary_changes('$SLOT', null, null,
    'proto_version', '1', 'publication_names', 'supabase_realtime')
), rel as (
  select (regexp_match(encode(data, 'escape'), 'public\\\\000([a-z_]+)\\\\000'))[1] as tabela from ev where get_byte(data, 0) = 82
)
select
  (select count(*) from ev where get_byte(data, 0) = 73),
  (select count(*) from ev where get_byte(data, 0) = 85),
  (select count(*) from ev where get_byte(data, 0) = 68),
  (select string_agg(tabela, ',' order by tabela) from rel)")"
read -r ins upd del rels <<<"$resumo"
echo "  eventos: INSERT=$ins UPDATE=$upd DELETE=$del tabelas=$rels"
[ "$ins" = 1 ] || falhar "esperava 1 INSERT (inscricoes), obtive $ins"
[ "$upd" = 2 ] || falhar "esperava 2 UPDATE (turnos.ocupadas ao inscrever e ao cancelar), obtive $upd"
[ "$del" = 1 ] || falhar "esperava 1 DELETE (inscricoes), obtive $del"
[ "$rels" = "inscricoes,turnos" ] || falhar "os eventos deveriam envolver só inscricoes e turnos; envolveram '$rels'"
echo "✓ inscrever + cancelar geram INSERT/UPDATE/DELETE na publication e nada das tabelas privadas"
