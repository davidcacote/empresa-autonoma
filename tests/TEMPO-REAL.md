# Concorrência e tempo real — o que está provado e o que não está (B-011)

Corre no CI, job "Base de dados (Postgres local)", com `scripts/bd/` (Postgres 16 temporário,
sem Docker, `wal_level=logical`, migrações de `supabase/migrations/` aplicadas por ordem).
Localmente: `bash scripts/bd/tudo.sh` (não como root).

## Provado

| O quê | Como | Script |
|---|---|---|
| 17 casos de segurança e lotação como `anon` | `tests/sql/seguranca.sql`; falha se algum `ok=false`, se der erro ou se devolver menos de 17 casos | `seguranca.sh` |
| Última vaga disputada por 2 ligações em simultâneo: exatamente 1 passa, a outra recebe `turno_cheio` | 25 rondas, 1 ligação `psql` por pessoa, largadas ao mesmo tempo por um bloqueio consultivo; no fim `ocupadas` = inscrições = registos privados | `concorrencia.sh` |
| 10 pessoas para 3 vagas: exatamente 3 passam | idem | `concorrencia.sh` |
| A publication `supabase_realtime` tem exatamente `inscricoes` e `turnos` | consulta a `pg_publication_tables` | `tempo-real.sh` |
| Inscrever e cancelar geram eventos na publication (INSERT em `inscricoes`, 2 UPDATE em `turnos`, DELETE em `inscricoes`) e nenhum de tabelas privadas | slot de replicação lógica `pgoutput` com `publication_names=supabase_realtime` — o mesmo mecanismo que o servidor Realtime do Supabase usa | `tempo-real.sh` |

Verificado também que o teste de concorrência deteta uma corrida: com a guarda do trigger trocada por
"ler e depois escrever" falha logo na 1.ª ronda (2 aceites).

## Por provar (não há Supabase completo no CI)

- **Entrega ao browser**: o servidor Realtime (WebSocket) a receber o evento e a enviá-lo ao cliente
  `supabase-js`, e o indicador "● Em direto" da app a mudar. Só a leitura de código e o fallback
  por sondagem cobrem isto. Para provar: Supabase CLI (`supabase start`) no CI, que precisa de Docker
  e das imagens da Supabase (rede), ou um teste manual com os donos.
- **Autorização do Realtime**: o Realtime aplica as políticas RLS ao filtrar eventos; aqui só se prova
  que a base emite o evento, não que o `anon` o recebe via Realtime.
- **Réplica de identidade**: `inscricoes` e `turnos` usam a identidade por omissão (chave primária);
  os eventos UPDATE/DELETE trazem só a chave antiga. Chega para a app (que relê o turno), mas filtros
  Realtime por outras colunas em DELETE não funcionariam.
- **Concorrência pela API HTTP** (PostgREST + pool de ligações): aqui as ligações são diretas ao
  Postgres; a garantia vem do `UPDATE ... WHERE ocupadas < vagas` no trigger, que é independente do pool.
- **Limites do plano gratuito** (ligações/mensagens Realtime simultâneas).

