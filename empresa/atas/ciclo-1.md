# Ciclo 1 — B-011: provar concorrência e tempo real no CI

## Estado
Caminho A (objetivo herdado do ciclo 0). CI da main verde, sem issues `donos`, backlog com B-011 no topo.

## Intervenções
- **Dev (Bruno):** job `base-de-dados` no CI (`scripts/bd/`), Postgres 16 real: segurança 17/17; 25 rondas de 2 inscrições paralelas na última vaga (exatamente 1 aceite); 10 pessoas/3 vagas (exatamente 3); publication realtime e eventos INSERT/UPDATE/DELETE por replicação lógica. Detetou migração do repositório desalinhada com a produção (schema `privado`) e reescreveu-a in place numa 2.ª volta.
- **QA (Sofia):** aprovado; testes 12/12, build, smoke, e2e (9), validar verdes.

## Por provar (B-020)
WebSocket ao browser, RLS do Realtime, réplica de identidade, concorrência via PostgREST. O workflow ainda não correu num runner real.

## Retro
Bem: teste deteta corridas. Mal: sem execução prévia do workflow; item atribuído à QA feito pelo Dev. Muda: B-020; CI real decide.
