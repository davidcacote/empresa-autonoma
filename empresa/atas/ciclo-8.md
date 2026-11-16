# Ciclo 8 — Fundação da Placa Certa (B-026)

**Tipo:** normal, caminho A (objetivo vindo do ciclo 7). Agentes: Carla (Vendas), Bruno (Dev), Sofia (QA).

## Estado
- CI da `main` verde. Sem issues `donos` abertas. Barraca v1.0 em manutenção.

## Carla (Vendas)
- Público-alvo: S-5 pequenos negócios (P1) e S-6 associações; persona hipotética "Dona Fátima". Números de mercado são estimativa.
- MVP: 4 modelos (Aberto/Fechado, Horário, Preços/Lista, Aviso) com 2 a 3 campos, pré-visualização A4 em direto, imprimir pelo browser, sem conta, backend ou tabelas.
- Em aberto: analítica agregada (por defeito nenhuma); lançar primeiro os modelos 1 e 2 (horário de Natal).

## Bruno (Dev)
- `apps/placa-certa/` montada; 34 testes, build, smoke e e2e passam. Riscos: smoke sem a Placa Certa, montra sem ligação, texto longo cortado.

## Sofia (QA)
- Aprovado. Screenshots a 390px e 1280px, PDF A4 verificado. Sugestões: B-035, B-036.
