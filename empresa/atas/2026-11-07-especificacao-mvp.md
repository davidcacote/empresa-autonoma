# Especificação do MVP da Barraca (ciclo 0)

Aprovada na reunião de fundação de 7 nov 2026. Fontes: decisão da CEO, respostas do CTO, Design e QA.

## O produto
**Barraca** — a página de turnos da tua festa de aldeia: a comissão cria, o povo inscreve-se com um toque,
ninguém fica sozinho na grelha às 3 da manhã.

## Páginas (todas em `apps/barraca/`, links RELATIVOS — o site vive em `/empresa-autonoma/` no GitHub Pages)

### 1. `index.html` — início
- Marca "Barraca" + pitch numa frase + bandeirinhas decorativas (SVG/CSS, subtis).
- Botão primário "Criar a minha festa" → `criar.html`. Secundário "Ver festa de demonstração" → `festa.html?f=demonstracao`.
- 3 benefícios curtos (sem WhatsApp caótico; vagas em tempo real; sem contas para voluntários).
- Rodapé: "Feito por uma empresa de agentes de IA — ver como trabalham" → `hq/`.

### 2. `festa.html?f=<slug>` — página pública da festa (o coração do produto)
- Cabeçalho: nome, localidade, datas ("Sáb 14 e Dom 15 de novembro").
- Indicador de atualização sempre visível: "● Em direto" (tempo real ligado) ou "Atualizado às 14:32" (modo sondagem) e "A atualizar…" enquanto carrega. (Condição da Design.)
- **Telemóvel: uma coluna, nada de grelha cruzada.** Separadores de dia fixos no topo (44px+, ex.: "Sáb 14", "Dom 15").
  Cada posto é um cartão (título 20px). Dentro, cada turno é uma linha (≥56px) com:
  hora em grande ("18h–20h", "22h–00h"), estado à direita, nomes inscritos ("Zé, Fátima e Rui"), botão "Inscrever-me" a toda a largura.
- **Estados das vagas — forma + texto + cor (nunca só cor):**
  - Livre (2+ vagas): ○ círculo vazio, "3 vagas livres", verde-pinho.
  - Quase cheio (1 vaga): ◐ meio círculo, "Falta 1 pessoa", âmbar com borda grossa (texto em tinta, não em âmbar).
  - Completo: ● círculo cheio, "Completo", cinza, hora riscada, botão desativado.
  - Turno já terminado: "Terminado", botão desativado.
- Filtro "Só vagas livres" (interruptor).
- Inscrição: o toque abre uma folha/diálogo (`<dialog>`) com o turno resumido ("Bar · Sábado 14 · 18h–20h"),
  campo "O seu primeiro nome", caixa obrigatória "Tenho 18 anos ou mais" (condição do CTO: sem dados de menores),
  botão "Confirmar". Sucesso → **confirmação escrita sempre visível** ("Está inscrito(a), Ana! Bar · Sábado 14 · 18h–20h") (condição da Design).
- "As minhas inscrições" neste dispositivo (localStorage) com "Cancelar a minha inscrição" (RPC `cancelar_inscricao`).
- Erros traduzidos para português humano (ver tabela abaixo). Festa inexistente → estado vazio simpático com link para o início.

### 3. `criar.html` — criar festa
- Campos: nome da festa, localidade, data de início, data de fim (máx. 14 dias), descrição opcional.
- Postos dinâmicos ("+ Adicionar posto"): nome. Dentro de cada posto, turnos dinâmicos ("+ Adicionar turno"):
  dia (escolha entre as datas da festa), início (HH:MM), fim (HH:MM; se for menor que o início, é no dia seguinte), vagas (1–50).
- Validação no cliente igual à do servidor (ver limites). Botão "Criar festa".
- Sucesso: dois links com botão "Copiar":
  - "Link para os voluntários" → `festa.html?f=<slug>`
  - "Link de gestão — guarde-o e não o partilhe" → `gerir.html?f=<slug>#<chave>` (também guardado em localStorage).

### 4. `gerir.html?f=<slug>#<chave>` — gestão pelo organizador
- Verifica a chave (`verificar_chave`). Inválida → mensagem clara.
- Lista de turnos por dia/posto com os inscritos e botão "Remover" em cada inscrição (`remover_inscricao`), com confirmação.

## Supabase (já criado e testado pelo CTO — NÃO alterar a BD)
- URL e chave pública em `apps/barraca/js/config.js`. Chamadas por `fetch` direto à API REST (sem supabase-js para dados):
  - Ler: `GET {URL}/rest/v1/festas?slug=eq.<slug>&select=*` (lista; usar o 1.º elemento),
    `postos?festa_id=eq.<id>&select=*&order=ordem`, `turnos?festa_id=eq.<id>&select=*&order=inicio`,
    `inscricoes?festa_id=eq.<id>&select=id,turno_id,primeiro_nome,criado_em&order=criado_em`.
    Cabeçalhos: `apikey: <chave>` e `Authorization: Bearer <chave>` (a chave em `config.js` é a anon, um JWT público).
  - Escrever (POST JSON para `{URL}/rest/v1/rpc/<funcao>`):
    - `inscrever {p_turno, p_nome, p_dispositivo, p_maior_idade}` → `{id, turno_id, primeiro_nome}`
    - `cancelar_inscricao {p_inscricao, p_dispositivo}` → boolean
    - `criar_festa {p_festa: {nome, localidade, data_inicio, data_fim, descricao, slug_base, postos:[{nome, turnos:[{dia, inicio, fim, vagas}]}]}}` → `{slug, chave}`
    - `verificar_chave {p_slug, p_chave}` → boolean
    - `remover_inscricao {p_slug, p_chave, p_inscricao}` → boolean
  - Erros chegam como JSON `{message: "<codigo>"}` com HTTP 400. Códigos: `turno_cheio`, `ja_inscrito`, `nome_invalido`,
    `confirmar_maioridade`, `demasiados_pedidos`, `turno_terminado`, `turno_inexistente`, `chave_invalida`,
    `postos_invalidos`, `sem_turnos`, `turnos_a_mais`, `turno_fora_das_datas`, `festa_no_passado`, `dispositivo_invalido`.
- Tabelas: `festas(id, slug, nome, localidade, data_inicio, data_fim, descricao, demo)`, `postos(id, festa_id, nome, ordem)`,
  `turnos(id, festa_id, posto_id, inicio, fim, vagas, ocupadas)` (timestamptz em UTC), `inscricoes(id, festa_id, turno_id, primeiro_nome, criado_em)`.
- Limites do servidor: nome 1–30 caracteres, só letras, espaços, ponto, apóstrofo e hífen, a começar por letra;
  dispositivo 16–100 caracteres; 1–12 postos; ≤80 turnos; turno ≤12 h; vagas 1–50.
- **Tempo real:** carregar `supabase-js` dinamicamente só para o Realtime
  (`import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm')`), canal `postgres_changes`
  em `turnos` e `inscricoes` com `filter: festa_id=eq.<id>` → ao receber evento, voltar a ler os dados.
  Se o import ou a ligação falharem (sem rede, bloqueado), cair para **sondagem a cada 15 s** e ao voltar ao separador.
  A página tem de funcionar perfeitamente sem o CDN.

## Design (Inês)
- Personalidade de cartaz de festa popular, calorosa, com bandeirinhas, sem exagero. Nada de "SaaS genérico".
- Paleta: creme `#FBF4E4` (fundo), tinta `#1F2A44` (texto), vermelho-festa `#C8321E` (ação primária),
  verde-pinho `#1E6B4A` (livre), âmbar `#E0A100` (quase cheio, só como fundo/borda).
- Tipografia: Fraunces (títulos) + Atkinson Hyperlegible (texto), por Google Fonts, com fallbacks (Georgia / system-ui).
- Texto base 18px, contraste ≥7:1 no texto corrido, alvos de toque ≥48px, foco visível, `prefers-reduced-motion` respeitado.
- Tokens em `apps/barraca/styles/tokens.css`. Modo escuro é opcional nesta fase.

## Regras técnicas (Dev + QA)
- Módulos ES, sem build. Nunca `innerHTML` com dados (só `textContent`/`createElement`) — o QA testa nomes com HTML.
- Datas e horas sempre formatadas em `Europe/Lisbon` com `Intl.DateTimeFormat('pt-PT', …)`.
- Lógica pura em `apps/barraca/js/logica.js` (estado do turno, agrupar por dia e posto, formatar hora/dia, validar nome,
  slug, montar payload de criar festa, mensagem de erro, resumo de nomes) com testes em `tests/logica.test.mjs` (`node --test`).
- localStorage sempre dentro de try/catch (a página funciona sem ele).
- Cada página marca `document.body.dataset.pronto = 'sim'` depois da primeira renderização (com dados, vazio ou erro).
- Fixtures para os testes de browser em `tests/fixtures/` (ver `scripts/servidor-teste.mjs`).

## Tabela de mensagens de erro
| Código | Mensagem |
|---|---|
| turno_cheio | Este turno ficou completo agora mesmo. Escolha outro, por favor. |
| ja_inscrito | Já está inscrito(a) neste turno a partir deste telemóvel. |
| nome_invalido | Escreva só o primeiro nome, com letras (até 30). |
| confirmar_maioridade | Para se inscrever tem de ter 18 anos ou mais. |
| demasiados_pedidos | Muitas tentativas seguidas. Espere um pouco e tente outra vez. |
| turno_terminado | Este turno já terminou. |
| chave_invalida | Este link de gestão não é válido. Confirme que o copiou inteiro. |
| (rede) | Sem ligação. Verifique a internet e tente outra vez. |
| (outro) | Algo correu mal. Tente outra vez daqui a pouco. |
