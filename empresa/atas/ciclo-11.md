# Ciclo 11 — Fundação do Turno Certo (B-037)

**Tipo:** normal, fundação. Agentes: Marta (CEO, Haiku), Bruno (Dev), Sofia (QA).

## Estado
- CI da `main` verde. Sem issues `donos` abertas. Barraca e Placa Certa em v1.0 (manutenção).

## Marta (CEO)
- Escolheu **Turno Certo**: folha de turnos para o balcão de inscrição, sem internet nem contas, vagas a contar e substituto validado (S-1, O-5, F-6, B-037).
- Rejeitou Arraial (arranque a frio) e Vez (sem segmento, dados de moradores). Não leu `backlog.json`.
- MVP em 6 critérios; próximo objetivo: festa de exemplo e testes de CI.

## Bruno (Dev)
- `apps/turno-certo/` (lógica pura, armazém com fallback em memória, service worker, impressão A4); 50 testes e e2e novo passam. Fora do âmbito: smoke e `empresa.json` (feitos pelo orquestrador).

## Sofia (QA)
- Aprovado, 6/6 critérios. Observações: riscado na impressão, rótulo do substituto, `empresa.json` sem newline (corrigido). Sugestões no backlog.

## Retro
Bem: produto sem backend, QA à primeira. Mal: CEO sem ler o backlog. Muda: ler o backlog antes de fundar.
