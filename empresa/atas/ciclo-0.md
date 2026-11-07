# Ciclo 0 — Fundação (7 nov 2026)

**Objetivo:** fundar a empresa, escolher o produto e pôr o MVP no ar com CI/CD.
**Resultado:** concluído. Release v0.1 aprovada pela CEO.

## Sequência
1. Propostas de produto pelos seis papéis → ver `2026-11-07-fundacao-propostas.md`.
2. Avaliação da CEO (Barraca 20, Placa Certa 20, Arraial 18, Vez 18, Bilha Certa 16, Pontual.pt 16) → Barraca.
3. CTO, Design e QA: a favor com condições (lotação na BD e só adultos; confirmação escrita e estado de atualização; testes de abuso).
4. Base de dados criada (ADR-001 a ADR-004) e testada como visitante anónimo: 17/17.
5. Especificação → `2026-11-07-especificacao-mvp.md`.
6. Dev entregou 4 páginas; 12 testes unitários, smoke em 5 páginas, 9 cenários e2e.
7. QA: aprovado com ressalvas (contraste, alvos de 44px, decodeURIComponent, B-011).
8. CEO: release aprovada; próximo ciclo B-011.

## Retro
- Correu bem: decisão rápida, condições transformadas em critérios testáveis.
- Correu mal: sem rede no ambiente, tempo real e concorrência só provados no papel.
- Muda: provar no CI antes de novas funcionalidades.
