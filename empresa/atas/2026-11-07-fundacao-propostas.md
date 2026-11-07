# Reunião de fundação — propostas (7 nov 2026)

Cada membro da equipa propôs um produto a partir da sua função, sem tópico prévio.

## 1. Marta Leal (CEO) — Barraca
**Pitch:** A página de turnos da tua festa de aldeia: a comissão cria, o povo inscreve-se com um toque, ninguém fica sozinho na grelha às 3 da manhã.
**Problema:** Comissões de festas, romarias e coletividades gerem voluntários (bifanas, sardinhas, bar, montagem) em grupos de WhatsApp e folhas de papel. Turnos duplicados, buracos às horas más, e quem coordena passa a semana a perguntar "quem pode?".
**Utilizador-alvo:** Coordenador(a) de comissão de festas/associação local, voluntário, 30–60 anos, pouco tempo. Voluntários só precisam de um link.
**MVP:** Página pública por festa (/festa/slug) com grelha de turnos por dia e posto; inscrição com primeiro nome e telemóvel opcional; vagas atualizam; login do organizador por link mágico; formulário para criar turnos.
**Ciclos seguintes:** modelos e duplicar festa do ano anterior; vista "buracos por preencher" + partilha WhatsApp; exportar .ics e folha A4.
**Supabase:** Auth magic link; festas, postos, turnos, inscrições com RLS; leitura pública por slug; inscrição por RPC com limites; Realtime nas vagas; Edge Function para .ics.
**Risco:** spam/inscrições falsas e "o WhatsApp chega". Mitigação: limites por RPC, organizador remove inscrições, só primeiros nomes.

## 2. Tiago Sousa (Produto) — Arraial
**Pitch:** O mapa colaborativo de festas, romarias e arraiais de aldeia, que hoje só existem em cartazes de Facebook e na boca do povo.
**Problema:** Emigrantes em agosto, filhos da terra em Lisboa e visitantes não sabem que festa há no fim de semana; informação espalhada; comissões sem sítio simples para publicar.
**MVP:** Lista móvel de festas aprovadas por data, filtro distrito/concelho, página de detalhe, formulário público de submissão (visível só após aprovação).
**Ciclos seguintes:** moderação com login; cartaz (imagem) + .ics; "este fim de semana perto de mim" + página por concelho.
**Supabase:** tabela festas com RLS (leitura só aprovadas, inserção anónima pendente), Auth moderadores, Storage cartazes, Edge Function anti-spam.
**Risco:** arranque a frio sem conteúdo. Mitigação: carregar à mão 30–50 festas reais.
**Métrica:** 100 festas aprovadas, 20 submissões de organizadores, 500 visitas únicas em 60 dias.

## 3. Rui Matos (CTO) — Vez
**Pitch:** Reservas de espaços partilhados de um prédio (churrasqueira, sala do condomínio, estendal) sem sobreposições e sem grupo de WhatsApp.
**Problema:** Papel na entrada ou mensagens no grupo; reservas duplicadas, discussões, administrador voluntário a arbitrar; apps de condomínio pesadas e pagas.
**MVP:** Magic link; criar prédio com um espaço e grelha semanal; reservar intervalo; ver reservas em tempo real; BD recusa sobreposições; prédio de demonstração fictício.
**Ciclos seguintes:** convite e papéis (admin/morador) por fração; regras por espaço e cancelamento; feed ICS e lista de espera.
**Supabase:** EXCLUDE USING gist sobre tstzrange (btree_gist); RLS por pertença via função security definer; Realtime; Edge Functions para convite e ICS.
**Risco técnico:** fusos e mudança de hora; RLS recursiva/lenta.

## 4. Inês Carvalho (Design) — Placa Certa
**Pitch:** Construtor visual de sinalética para pequenos negócios e associações (avisos "Volto já", horários de feriado, cartazes de festa) que gera um A4 pronto a imprimir em 30 segundos.
**Problema:** Avisos à mão ou no Word, ilegíveis ou feios; feriados municipais e férias repetem-se todos os anos.
**MVP:** 4 modelos, 2–3 campos, pré-visualização A4 em direto, imprimir/PDF pelo browser. Sem conta e sem backend.
**Ciclos seguintes:** modelos de eventos locais e temas; contas e "Os meus cartazes"; calendário de feriados que sugere o cartaz + partilha pública.
**Supabase:** Auth; cartazes (JSON); feriados (público); Storage para logótipos.
**Risco:** qualidade de impressão entre browsers/impressoras.
**Direção visual:** cartaz de rua, tipografia grande, sinalética e azulejo; creme, azul-cobalto, vermelho-telha, amarelo-limão; Fraunces + Inter.

## 5. Bruno Teixeira (Dev) — Bilha Certa
**Pitch:** Mapa colaborativo de quem tem a bilha de gás à porta.
**Problema:** A bilha acaba a meio do jantar; telefonar a três revendedores; horários e zonas na cabeça das pessoas.
**MVP:** Lista pública de revendedores por concelho com pesquisa, zonas, dias de entrega, telefone e data da última confirmação; seed sem scraping.
**Ciclos seguintes:** "confirmei hoje" anónimo; revendedores reclamam ficha; aviso "bilha a acabar".
**Supabase:** concelhos, revendedores, confirmações; RLS; Auth no ciclo 2; Edge Function para lembretes.
**Risco:** arranque a frio e dados desatualizados.

## 6. Sofia Nunes (QA & DevOps) — Pontual.pt
**Pitch:** Ver em segundos se o autocarro, comboio ou barco local costuma chegar à hora, com relatos anónimos.
**Problema:** Horários oficiais dizem o que devia acontecer, não o que acontece.
**MVP:** 5 carreiras de exemplo, relato em 3 toques, percentagem de pontualidade dos últimos 30 dias.
**Ciclos seguintes:** gráfico por dia/hora; pedido de nova carreira com moderação; página partilhável.
**Supabase:** carreiras, relatos, RLS, Edge Function que valida e limita, vista agregada, Auth anónima.
**Risco:** poucos dados tornam percentagens enganadoras; manipulação de relatos.
