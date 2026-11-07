# Manual do ciclo (para o orquestrador)

Este ficheiro é seguido, passo a passo, pela sessão agendada que corre uma vez por noite (01:39, hora de Lisboa).
O orquestrador não é membro da equipa: convoca os agentes, passa mensagens entre eles,
executa o que decidem (git, Supabase) e regista tudo. Não decide produto nem escreve funcionalidades.

**Regra de ouro:** um objetivo pequeno por ciclo, `main` sempre verde, tudo registado no HQ.
Não pedir confirmações a ninguém: os donos podem não estar presentes. Se algo exigir uma decisão
irreversível que possa correr mal (apagar dados reais, mudar algo fora deste repositório e do projeto
Supabase `barraca`), não o fazer: registar como pendente para os donos.

## 0. Preparar
1. Repositório em `/home/claude/empresa-autonoma` (clonar ou `git pull --rebase`). `git config user.name "Empresa Autónoma"`, `git config user.email "agentes@empresa-autonoma.invalid"`.
2. Ler `empresa/CONSTITUICAO.md` e `empresa/dados/orcamento.json`.
3. Se `"pausado": true` → terminar já, sem commits.
4. `n` = último `n` em `empresa/dados/ciclos.json` + 1. Guardar a hora de início (UTC, ISO).

## 1. Recolher o estado (sem agentes, barato)
- Último ciclo (`ciclos.json`): resultado, retro.
- CI da `main`: `gh api "repos/davidcacote/empresa-autonoma/actions/runs?branch=main&per_page=1" --jq '.workflow_runs[0] | {status, conclusion, html_url}'`.
- Pedidos dos donos: `gh api "repos/davidcacote/empresa-autonoma/issues?labels=donos&state=open" --jq '.[] | {number, title, body}'`.
- Backlog (`backlog.json`): itens `em_curso` e os 5 `a_fazer` de maior prioridade.
- Supabase (projeto `dlnqbgsrwuscppnjkogy`): `get_advisors` (security) — contar avisos novos (os 5 das RPC públicas e os 4 de tabelas privadas sem políticas são esperados, ver ADR-004).
- Escrever este resumo em `empresa/atas/ciclo-<n>.md` (secção "Estado").

## 2. Quem decide o objetivo (1 agente: CEO **ou** especialista)
O ciclo tem no máximo `max_agentes_por_ciclo` agentes (3): **um que decide/especifica + Dev + QA**.
- **Caminho A — sem stand-up:** se o último ciclo deixou `proximo_objetivo` em `ciclos.json`, o CI está verde
  e não há issues `donos` abertas, o objetivo é esse. Não se lança a CEO. Se o item mexer na interface,
  na BD/arquitetura ou tiver a história mal definida, lança-se **um** especialista (passo 3) no lugar dela;
  se não precisar (CI, testes, correções pequenas), passa-se direto ao Dev.
- **Caminho B — stand-up com a CEO:** em todos os outros casos. Não há especialista neste ciclo.

Stand-up: lançar a Marta (`subagent_type` general-purpose, `model` = `modelo_ceo` do orçamento) com:
o caminho do papel (`empresa/papeis/ceo.md`), a constituição e o resumo do estado.
Ela devolve: **objetivo do ciclo** (um id do backlog ou uma correção), porquê numa frase,
**critérios de aceitação** (reaproveitando os do backlog), e **que especialista** precisa de entrar:
`produto` (história mal definida), `design` (mexe na interface), `cto` (mexe na BD ou arquitetura) ou `nenhum`.
Prioridade obrigatória: CI vermelho ou bug > issue `donos` > topo do backlog.
Ela devolve também **o próximo objetivo** (para o ciclo seguinte poder seguir pelo caminho A).
No caminho B o campo do especialista é ignorado: a CEO escreve os critérios e o Dev segue a especificação
que já existir no backlog e nas atas.

## 3. Especificação — só no caminho A (1 agente, opcional)
Se o objetivo precisar de um especialista, lançá-lo (`model` = `modelo_agentes`) com o objetivo e os critérios. Devolve uma especificação curta
e concreta (Design: layout, estados, textos exatos; CTO: SQL/migração, riscos; Produto: história e critérios).
Se o CTO propuser uma migração: o orquestrador grava-a em `supabase/migrations/AAAAMMDDHHMMSS_nome.sql`
e aplica-a com `apply_migration`. **Proibido** `drop`, `truncate`, `revoke` ou `delete` fora de funções
(pedem confirmação que ninguém pode dar — ADR-004): adicionar colunas/tabelas/funções novas, nunca destruir.
Depois correr `tests/sql/seguranca.sql` com `execute_sql` e `get_advisors`.

## 4. Implementação — Dev (1 agente)
Lançar o Bruno com: papel, constituição, objetivo, critérios, especificação, e as regras:
só escreve em `app/` e `tests/`; corre `node --test 'tests/**/*.test.mjs'`, `node scripts/build.mjs`,
`node scripts/smoke.mjs` e `for f in tests/e2e/*.e2e.mjs; do node "$f" || exit 1; done`; não há internet
(Supabase/CDN simulados nas fixtures). Devolve: ficheiros alterados, resultado dos testes, riscos.

## 5. QA — Sofia (1 agente)
Lançar a Sofia com: papel, critérios, e o pedido para rever `git diff` e correr os mesmos testes,
verificar critério a critério (passa/falha com evidência) e tirar screenshots (390px e 1280px) dos ecrãs alterados
para `/tmp/qa-<n>/`. Veredicto: **aprovado** ou **bloqueado** com a lista de falhas.
Se bloqueado: devolver ao Dev com `SendMessage` (no máximo `max_voltas_qa_dev` voltas) e voltar à QA.
Se continuar bloqueado: `git checkout -- app tests` (descartar) e o item fica para o ciclo seguinte.

## 6. Release
1. Atualizar os registos (passo 7) **antes** do commit, para irem no mesmo push.
2. `node scripts/validar.mjs` tem de passar.
3. Commit em português (`feat: …`, `fix: …`, `chore: …`) com a linha `Ciclo <n>` e push para `main`.
4. Acompanhar o CI: `gh run list --branch main --limit 1` e `gh run watch <id> --exit-status` (timeout 15 min).
5. Se só o job "Publicar no GitHub Pages" falhar por regras de ambiente ou definições do repositório
   ("not allowed to deploy", "protection rules"), não é um defeito do código: não reverter; registar em
   `ciclos.json` (`notas`) e abrir uma issue com a etiqueta `donos` a explicar o clique que falta.
6. CI vermelho → uma tentativa de correção pelo Dev (conta como volta). Se continuar vermelho,
   `git revert` do commit, push, e registar `resultado: "falhou"`.

## 7. Registos (o que os donos veem no HQ)
- `reunioes.json`: acrescentar 1 entrada `R-<n>` "Ciclo <n>: <objetivo>" com as intervenções **reais** de cada agente
  (texto devolvido por eles, pode ser resumido mas nunca inventado; o orquestrador fala como `sistema`).
- `backlog.json`: mudar estados (`em_curso` → `feito`), acrescentar ideias novas que a equipa propôs (estado `ideia`).
- `decisoes.json`: acrescentar ADR se houve decisão técnica ou de produto.
- `ciclos.json`: acrescentar `{n, inicio, fim, tipo: "normal", objetivo, resultado, entregue, retro, agentes, chamadas_agentes, commit, proximo_objetivo, notas}`.
  `proximo_objetivo` só existe se a CEO o deu neste ciclo (caminho B); no caminho A fica vazio, e o ciclo seguinte faz stand-up.
  `resultado` ∈ `concluido | falhou | bloqueado | sem_alteracoes`. A retro são 3 frases: correu bem / correu mal / muda.
- `empresa.json`: `ciclo_atual = n`, `proximo_ciclo` = próxima 01:39 de Lisboa (em UTC), `produto.estado` atualizado.
- Ata completa em `empresa/atas/ciclo-<n>.md`.
- Se uma issue `donos` foi resolvida: comentar nela com o link do commit e fechá-la.

## 8. Orçamento (os donos querem ficar abaixo de ~80% do plano)
- No máximo `max_agentes_por_ciclo` agentes lançados (3: CEO **ou** especialista, Dev, QA), mais as voltas QA↔Dev.
- CEO com `model` = `modelo_ceo`; os outros com `model` = `modelo_agentes`. O orquestrador não faz trabalho de agentes "para poupar".
- Ler só o necessário: o orquestrador não relê ficheiros grandes nem repete testes que a QA já correu.
- Um objetivo. Acabou → registar e terminar. Nada de "já agora".
- Se a sessão atingir um limite de uso: parar limpo, sem push de código a meio; o próximo ciclo retoma.
- Se o backlog não tiver nada que caiba num ciclo, a CEO pode decidir um ciclo de manutenção curto
  (dívida técnica, acessibilidade, testes) ou terminar sem alterações.

## 9. Proibições
- Segredos no repositório ou nas atas. Mostrar chaves completas em logs.
- Mexer noutros repositórios ou noutros projetos Supabase.
- Alterar `orcamento.json` (é dos donos).
- Desligar, saltar ou enfraquecer testes para o CI passar.
- Dados pessoais reais na festa de demonstração.
