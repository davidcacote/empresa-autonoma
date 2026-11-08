#!/usr/bin/env bash
# Inscrições realmente em paralelo (uma ligação psql por pessoa, largadas em simultâneo
# por um bloqueio consultivo). Em cada turno de 1 vaga, 2 pessoas disputam a última vaga:
# exatamente uma passa, a outra recebe 'turno_cheio'. Depois, 10 pessoas disputam 3 vagas.
source "$(dirname "$0")/lib.sh"

RONDAS="${RONDAS:-25}"
CHAVE_BARREIRA=7770001
tmp="$(mktemp -d)"
slug=""
# A tabela privada vive em 'privado' (ADR do schema privado) ou, em migrações antigas, em 'public'.
priv="$(psql -XAt -c "select coalesce(to_regclass('privado.inscricoes_privado'), to_regclass('public.inscricoes_privado'))")"
[ -n "$priv" ] || falhar "tabela inscricoes_privado não encontrada"
limpar() {
  jobs -p | xargs -r kill 2>/dev/null || true
  if [ -n "$slug" ]; then
    psql -XqAt -c "delete from public.festas where slug = '$slug'" >/dev/null 2>&1 || true
  fi
  rm -rf "$tmp"
}
trap limpar EXIT

# ── Preparação: uma festa com RONDAS turnos de 1 vaga e 1 turno de 3 vagas ──
slug="$(sql -At <<SQL
set role anon;
select set_config('request.headers', '{"x-forwarded-for":"10.200.0.1"}', false);
select public.criar_festa(json_build_object(
  'nome', 'Festa Concorrência CI', 'localidade', 'CI', 'slug_base', 'concorrencia-ci',
  'data_inicio', current_date + 1, 'data_fim', current_date + 1,
  'postos', json_build_array(json_build_object('nome', 'Bar', 'turnos',
    (select json_agg(json_build_object('dia', current_date + 1, 'inicio', '10:00', 'fim', '11:00',
                                       'vagas', case when n = 0 then 3 else 1 end))
       from generate_series(0, $RONDAS) n))))) ->> 'slug';
SQL
)"
slug="$(echo "$slug" | tail -1)"
[ -n "$slug" ] || falhar "não foi possível criar a festa de teste"
turno_de_3="$(psql -XAt -c "select t.id from public.turnos t join public.festas f on f.id = t.festa_id where f.slug = '$slug' and t.vagas = 3")"
mapfile -t turnos_de_1 < <(psql -XAt -c "select t.id from public.turnos t join public.festas f on f.id = t.festa_id where f.slug = '$slug' and t.vagas = 1")
[ "${#turnos_de_1[@]}" -eq "$RONDAS" ] || falhar "esperava $RONDAS turnos de 1 vaga, há ${#turnos_de_1[@]}"

# Corre N inscrições em paralelo no mesmo turno. Escreve um resultado por linha em $tmp/<rotulo>.res
disputar() {
  local rotulo="$1" turno="$2" n="$3" i pid_titular
  rm -f "$tmp/$rotulo".w*
  # Titular da barreira: segura o bloqueio até todos os trabalhadores estarem à espera.
  PGAPPNAME=ci-titular psql -XqAt -c "select pg_advisory_lock($CHAVE_BARREIRA); select pg_sleep(120)" >/dev/null 2>&1 &
  pid_titular=$!
  for _ in $(seq 100); do
    [ "$(psql -XAt -c "select count(*) from pg_locks where locktype='advisory' and granted and mode='ExclusiveLock'")" = 1 ] && break
    sleep 0.1
  done
  for i in $(seq "$n"); do
    PGAPPNAME=ci-trabalhador psql -X -qAt -v ON_ERROR_STOP=1 \
      -v turno="$turno" -v disp="ci-disp-$rotulo-w$i-0123456789" -v ip="10.$((RANDOM % 200 + 1)).$rotulo.$i" >"$tmp/$rotulo.w$i" 2>&1 <<'SQL' &
set role anon;
select set_config('request.headers', json_build_object('x-forwarded-for', :'ip')::text, false);
select pg_advisory_lock_shared(7770001);
select public.inscrever(:'turno'::uuid, 'Pessoa', :'disp', true);
SQL
  done
  # Esperar que todos estejam bloqueados na barreira e largá-los ao mesmo tempo.
  for _ in $(seq 200); do
    [ "$(psql -XAt -c "select count(*) from pg_stat_activity where application_name='ci-trabalhador' and wait_event='advisory'")" = "$n" ] && break
    sleep 0.1
  done
  psql -XqAt -c "select pg_terminate_backend(pid) from pg_stat_activity where application_name='ci-titular'" >/dev/null
  wait "$pid_titular" 2>/dev/null || true
  for pid in $(jobs -p); do wait "$pid" 2>/dev/null || true; done
}

contar() { # <rotulo> <padrão> → quantos ficheiros de resultado contêm o padrão
  local c=0 f
  for f in "$tmp/$1".w*; do grep -q "$2" "$f" && c=$((c + 1)); done
  echo "$c"
}

verificar_contadores() { # <turno> <vagas esperadas ocupadas>
  local linha
  linha="$(psql -XAt -F ' ' -c "select t.ocupadas, (select count(*) from public.inscricoes i where i.turno_id = t.id), (select count(*) from $priv p where p.turno_id = t.id) from public.turnos t where t.id = '$1'")"
  [ "$linha" = "$2 $2 $2" ] || falhar "contadores incoerentes no turno $1: ocupadas/inscrições/privado = '$linha', esperado '$2 $2 $2'"
}

# ── Parte 1: 2 pessoas, 1 vaga, RONDAS vezes ──
for r in $(seq "$RONDAS"); do
  turno="${turnos_de_1[$((r - 1))]}"
  disputar "r$r" "$turno" 2
  ok="$(contar "r$r" '"id"')"; cheio="$(contar "r$r" 'turno_cheio')"
  if [ "$ok" -ne 1 ] || [ "$cheio" -ne 1 ]; then
    echo "Resultados da ronda $r:"; head -n 5 "$tmp"/r"$r".w*
    falhar "ronda $r: esperava 1 inscrição aceite e 1 'turno_cheio', obtive $ok aceite(s) e $cheio 'turno_cheio'"
  fi
  verificar_contadores "$turno" 1
done
echo "✓ $RONDAS rondas com 2 inscrições em paralelo na última vaga: exatamente 1 passa em todas"

# ── Parte 2: 10 pessoas, 3 vagas ──
disputar "grande" "$turno_de_3" 10
ok="$(contar grande '"id"')"; cheio="$(contar grande 'turno_cheio')"
if [ "$ok" -ne 3 ] || [ "$cheio" -ne 7 ]; then
  head -n 5 "$tmp"/grande.w*
  falhar "10 em paralelo para 3 vagas: esperava 3 aceites e 7 'turno_cheio', obtive $ok e $cheio"
fi
verificar_contadores "$turno_de_3" 3
echo "✓ 10 inscrições em paralelo para 3 vagas: exatamente 3 passam, 7 recebem 'turno_cheio'"
