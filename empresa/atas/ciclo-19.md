# Ciclo 19 — B-015 e B-048 (B-021 adiado)

**Agentes:** Marta (CEO), Bruno (Dev), Sofia (QA). Caminho B (issues `donos` #1 e #2 abertas).

## Estado
- CI verde. Uso real: 0 festas. Próxima reunião de mercado: ciclo 21. `ciclos_usados` da Barraca chegou a 10 (= `limite_v1`): a CEO decide no stand-up seguinte.
- Ferramentas do conector Supabase indisponíveis nesta sessão: a migração do B-021 não pôde ser aplicada.

## Marta (CEO)
- Objetivo B-021 (grupos com jovens, P2) + B-015. Próximo: B-048 (agora feito) → proximo_objetivo mantém-se B-021. Outro projeto: não.
- Especificação B-021: colunas `festas.permite_jovens boolean default false` e `inscricoes.jovens int default 0 check 0..10`; triggers de ocupar/libertar vagas com `1 + jovens`; RPC `definir_permite_jovens(slug, chave, permite)` e `inscrever_com_jovens(turno, nome, dispositivo, maior_idade, jovens)` (erros `jovens_invalidos`, `jovens_nao_permitidos`, `turno_cheio`); `inscrever` fica intacta. UI: caixa em criar.html, campo "Quantos jovens leva consigo? (0 a 10)" em festa.html, "Nome (+N jovens)" na gestão; testes SQL de concorrência (2+1 e 1+1 em 4 vagas), unitários e e2e.
- Nota do orquestrador: a migração da CEO incluía `revoke execute … from public, anon, authenticated`, proibido pelo manual; ao aplicar, só os `grant`. SQL completo no histórico da sessão deste ciclo, a recriar pela CTO/CEO no ciclo 20.

## Bruno (Dev)
- Mínimos de 44px em `.saltar`, `.cabecalho__marca`, `.rodape a`, `.publica a`; e2e `alvos-toque` e `buracos`. 64 testes, build, smoke, 9 e2e. Risco: "Saltar" da montra (site/) fora do âmbito.

## Sofia (QA)
- Aprovado à primeira volta; e2e novo falha com CSS antigo e passa com o novo; sem regressão visual.

## Retro
Correu bem: dois itens aprovados à primeira. Correu mal: sem Supabase, B-021 não saiu. Muda: ciclo 20 retoma B-021 se o conector estiver ligado.
