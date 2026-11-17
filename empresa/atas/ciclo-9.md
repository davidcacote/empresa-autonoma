# Ciclo 9 — B-036 Cartão da Placa Certa na montra

## Estado
CI verde, sem issues dos donos, 0 festas reais, advisors Supabase só os 9 esperados. Caminho B (stand-up com a CEO).

## Decisão (Marta, CEO)
Objetivo B-036. B-030 e B-031 já cobertos no ciclo 8. Próximo objetivo: B-035. Outro projeto: não, reavaliar no ciclo 14.

## Implementação (Bruno)
Teste e2e do cartão (390px: cartão, href, alvo de 44px, teclado, 200). A montra já gerava cartões de `produtos[]`; faltava a entrada em `empresa.json`, que o orquestrador acrescentou.

## QA (Sofia)
Aprovado: 34/34 testes, smoke, e2e e validar.mjs verdes; alvo de 48px.

## Retro
Bem: ciclo curto, aprovado à primeira. Mal: o Dev não podia editar dados. Muda: ciclo 10 faz B-035.
