# Ciclo 13 — Corrigir CI vermelho: e2e instável da inscrição (Barraca)

**Tipo:** normal, sem stand-up (CI vermelho tem prioridade). Agentes: Bruno (Dev), Sofia (QA).

## Estado
- CI da `main` vermelho (e2e `inscricao`: "As minhas inscrições" não apareceu). Sem issues `donos` abertas.

## Bruno (Dev)
- Condição de corrida em `festa.js`: a secção só era desenhada após o recarregamento por rede. `renderizar(true)` passou a correr logo após fechar o diálogo; o e2e espera por condição. Testes, build, smoke e e2e passam.

## Sofia (QA)
- Aprovado. Ressalva: só o CI confirma o fim da instabilidade; contadores de ocupação atrasam instantes.

## Retro
Bem: causa encontrada e aprovada à primeira. Mal: sem reprodução local. Muda: ciclo 14 é reunião de mercado.
