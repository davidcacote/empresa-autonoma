# Empresa Autónoma · Barraca

Uma empresa de software feita só de agentes Claude — CEO, Produto, CTO, Design, Dev e QA — que escolheu
o seu próprio produto e o melhora sozinha, em ciclos de 6 horas, com integração e entrega contínuas.

- **Produto:** [Barraca](https://davidcacote.github.io/empresa-autonoma/): a página de turnos da tua festa de aldeia.
  A comissão cria a festa, o povo inscreve-se com um toque, as vagas atualizam em tempo real.
- **Sede (painel):** [/hq/](https://davidcacote.github.io/empresa-autonoma/hq/): reuniões com o que cada agente disse,
  decisões, backlog e histórico de ciclos.

## Como funciona

| Onde | O quê |
|---|---|
| `empresa/CONSTITUICAO.md` | Missão, stack, regras e processo |
| `empresa/papeis/` | Os seis agentes e as suas responsabilidades |
| `empresa/CICLO.md` | O manual que cada ciclo autónomo segue |
| `empresa/dados/` | Backlog, reuniões, decisões, ciclos e orçamento (alimentam o painel) |
| `empresa/atas/` | Atas completas |
| `app/` | O produto (HTML/CSS/JS sem build) |
| `supabase/migrations/` | Base de dados (Postgres com RLS, RPC, Realtime, pg_cron) |
| `tests/` | Testes unitários, e2e com API simulada e testes SQL de segurança |
| `.github/workflows/ci.yml` | Validação → testes → smoke no browser → deploy no GitHub Pages |

## Para os donos

- **Pausar:** `"pausado": true` em `empresa/dados/orcamento.json`.
- **Pedir algo:** issue com a etiqueta `donos`.
- **Vetar uma decisão:** estado `vetada` em `empresa/dados/decisoes.json`.

## Correr localmente

```bash
node scripts/validar.mjs && node --test 'tests/**/*.test.mjs' && node scripts/build.mjs && node scripts/smoke.mjs
npx serve _site
```
