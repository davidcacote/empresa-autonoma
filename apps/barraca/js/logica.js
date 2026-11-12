// Lógica pura da Barraca: sem DOM e sem rede, para poder ser testada com `node --test`.
// Todas as horas e dias mostrados ao utilizador usam o fuso Europe/Lisbon.

export const FUSO = 'Europe/Lisbon';

// ── Formatação de datas e horas ─────────────────────────────────────────────

const fmtPartes = new Intl.DateTimeFormat('pt-PT', {
  timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const fmtSemana = new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', weekday: 'long' });
const fmtMes = new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', month: 'long' });

/** Decompõe um instante nos campos de calendário de Lisboa. */
export function partesLisboa(instante) {
  const o = {};
  for (const p of fmtPartes.formatToParts(new Date(instante))) o[p.type] = p.value;
  return { ano: o.year, mes: o.month, dia: o.day, hora: o.hour, minuto: o.minute };
}

/** "18h", "00h" ou "18h30". */
export function formatarHora(instante) {
  const { hora, minuto } = partesLisboa(instante);
  return minuto === '00' ? `${hora}h` : `${hora}h${minuto}`;
}

/** "18h–20h", "22h–00h". */
export function formatarIntervalo(inicio, fim) {
  return `${formatarHora(inicio)}–${formatarHora(fim)}`;
}

/** "14:32" (para "Atualizado às 14:32"). */
export function horaCurta(instante) {
  const { hora, minuto } = partesLisboa(instante);
  return `${hora}:${minuto}`;
}

/** Dia de calendário de Lisboa de um instante, como "AAAA-MM-DD". */
export function chaveDia(instante) {
  const { ano, mes, dia } = partesLisboa(instante);
  return `${ano}-${mes}-${dia}`;
}

const capitalizar = (t) => t.charAt(0).toUpperCase() + t.slice(1);

function dataDeChave(chave) {
  const [a, m, d] = chave.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d, 12));
}

/** "Sáb 14" (curto), "Sábado 14" (longo) ou "Sábado 14 de novembro" (completo). */
export function rotuloDia(chave, estilo = 'curto') {
  const data = dataDeChave(chave);
  const dia = data.getUTCDate();
  const nome = capitalizar(fmtSemana.format(data));
  if (estilo === 'curto') return `${nome.slice(0, 3)} ${dia}`;
  const longo = `${nome.replace(/-feira$/, '')} ${dia}`;
  return estilo === 'completo' ? `${longo} de ${fmtMes.format(data)}` : longo;
}

/** Todas as datas entre duas chaves, inclusive (máx. 400 por segurança). */
export function diasEntre(inicio, fim) {
  const dias = [];
  const d = dataDeChave(inicio);
  const limite = dataDeChave(fim);
  while (d <= limite && dias.length < 400) {
    dias.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dias;
}

/** "Sáb 14 e Dom 15 de novembro" / "Sex 13 a Dom 15 de novembro" / "Sáb 14 de novembro". */
export function intervaloDatas(inicio, fim) {
  const mesDe = (c) => fmtMes.format(dataDeChave(c));
  if (inicio === fim) return `${rotuloDia(inicio)} de ${mesDe(inicio)}`;
  const ligacao = diasEntre(inicio, fim).length === 2 ? ' e ' : ' a ';
  if (mesDe(inicio) === mesDe(fim) && inicio.slice(0, 7) === fim.slice(0, 7)) {
    return `${rotuloDia(inicio)}${ligacao}${rotuloDia(fim)} de ${mesDe(fim)}`;
  }
  return `${rotuloDia(inicio)} de ${mesDe(inicio)}${ligacao}${rotuloDia(fim)} de ${mesDe(fim)}`;
}

// ── Partilha no WhatsApp ────────────────────────────────────────────────────

/** Mensagem para partilhar a festa (só o link dos voluntários, nunca o de gestão). */
export function textoPartilha({ nome, localidade, ini, fim }, link) {
  return `Vem ajudar na festa! 🎉\n${nome} · ${localidade}\n${intervaloDatas(ini, fim)}\n\n`
    + `Escolhe o teu turno aqui, é só um toque e sem criar conta:\n${link}`;
}

/** Ligação wa.me que abre o WhatsApp com o texto já escrito. */
export const ligacaoWhatsApp = (texto) => `https://wa.me/?text=${encodeURIComponent(texto)}`;

// ── Estado dos turnos ───────────────────────────────────────────────────────

/** Estado de um turno: forma + texto (a cor é só reforço). */
export function estadoTurno(turno, agora = new Date()) {
  const livres = Math.max(0, turno.vagas - turno.ocupadas);
  if (new Date(turno.fim) < agora) return { tipo: 'terminado', livres, simbolo: '✓', texto: 'Terminado', reservavel: false };
  if (livres === 0) return { tipo: 'completo', livres, simbolo: '●', texto: 'Completo', reservavel: false };
  if (livres === 1) return { tipo: 'quase', livres, simbolo: '◐', texto: 'Falta 1 pessoa', reservavel: true };
  return { tipo: 'livre', livres, simbolo: '○', texto: `${livres} vagas livres`, reservavel: true };
}

/** "Zé, Fátima e Rui". */
export function resumoNomes(nomes) {
  if (nomes.length <= 1) return nomes[0] ?? '';
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

/** "Bar · Sábado 14 · 18h–20h". */
export function resumoTurno(nomePosto, chave, inicio, fim) {
  return `${nomePosto} · ${rotuloDia(chave, 'longo')} · ${formatarIntervalo(inicio, fim)}`;
}

/**
 * Agrupa turnos por dia (Lisboa) e, dentro do dia, por posto.
 * Devolve [{chave, curto, longo, postos: [{posto, turnos: [{turno, estado, intervalo, nomes, resumo}]}]}].
 */
export function agruparPorDiaEPosto(turnos, postos, agora = new Date(), inscricoes = []) {
  const nomesPorTurno = new Map();
  for (const i of [...inscricoes].sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em)))) {
    if (!nomesPorTurno.has(i.turno_id)) nomesPorTurno.set(i.turno_id, []);
    nomesPorTurno.get(i.turno_id).push(i.primeiro_nome);
  }
  const ordemPostos = [...postos].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const porDia = new Map();
  for (const turno of [...turnos].sort((a, b) => new Date(a.inicio) - new Date(b.inicio))) {
    const posto = ordemPostos.find((p) => p.id === turno.posto_id);
    if (!posto) continue;
    const chave = chaveDia(turno.inicio);
    if (!porDia.has(chave)) porDia.set(chave, new Map());
    const doDia = porDia.get(chave);
    if (!doDia.has(posto.id)) doDia.set(posto.id, []);
    const nomes = nomesPorTurno.get(turno.id) ?? [];
    doDia.get(posto.id).push({
      turno,
      estado: estadoTurno(turno, agora),
      intervalo: formatarIntervalo(turno.inicio, turno.fim),
      nomes,
      resumo: resumoTurno(posto.nome, chave, turno.inicio, turno.fim),
    });
  }
  return [...porDia.keys()].sort().map((chave) => ({
    chave,
    curto: rotuloDia(chave, 'curto'),
    longo: rotuloDia(chave, 'longo'),
    postos: ordemPostos.filter((p) => porDia.get(chave).has(p.id)).map((posto) => ({ posto, turnos: porDia.get(chave).get(posto.id) })),
  }));
}

// ── Validação (igual à do servidor) ─────────────────────────────────────────

/** Nome: 1–30 caracteres, só letras, espaços, ponto, apóstrofo e hífen, a começar por letra. */
export function validarNome(bruto) {
  // Normaliza espaços, acentos compostos e o apóstrofo tipográfico dos teclados de telemóvel.
  const valor = String(bruto ?? '').normalize('NFC').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
  const comprimento = [...valor].length;
  if (comprimento < 1 || comprimento > 30 || !/^\p{L}[\p{L} .'-]*$/u.test(valor)) {
    return { ok: false, codigo: 'nome_invalido', mensagem: MENSAGENS.nome_invalido };
  }
  return { ok: true, valor };
}

/** Base do endereço da festa: minúsculas, sem acentos, só [a-z0-9-], máx. 60 (como o servidor). */
export function slugBase(nome) {
  const s = String(nome ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').slice(0, 60).replace(/^-+|-+$/g, '');
  return s.length < 3 ? 'festa' : s;
}

/** O slug vem do endereço: só aceitamos o que o servidor pode ter gerado. */
/** Chave de gestão a partir do fragmento (#): descodifica %XX; devolve '' se vazia ou mal codificada. */
export function chaveDoFragmento(fragmento) {
  const bruto = String(fragmento ?? '').replace(/^#/, '');
  try { return decodeURIComponent(bruto); } catch { return ''; }
}

export const slugValido = (s) => typeof s === 'string' && /^[a-z0-9-]{1,80}$/i.test(s);

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const minutos = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Duração em minutos; se o fim for ≤ início, o turno acaba no dia seguinte. */
export function duracaoTurnoMin(inicio, fim) {
  const d = (minutos(fim) - minutos(inicio) + 1440) % 1440;
  return d === 0 ? 1440 : d;
}

export const LIMITES = { postos: 12, turnos: 80, vagasMin: 1, vagasMax: 50, duracaoMaxMin: 720, diasMax: 14 };

/**
 * Valida o formulário de criar festa. Devolve [{campo, mensagem}] (vazio = válido).
 * `campo` identifica o input: "nome", "data_fim", "postos.0.nome", "postos.0.turnos.1.vagas"…
 */
export function validarFesta(f, hoje = chaveDia(new Date())) {
  const erros = [];
  const erro = (campo, mensagem) => erros.push({ campo, mensagem });
  const texto = (v) => String(v ?? '').trim();

  if (texto(f.nome).length < 3) erro('nome', 'Escreva o nome da festa (pelo menos 3 letras).');
  if (texto(f.nome).length > 80) erro('nome', 'O nome da festa pode ter até 80 caracteres.');
  if (!texto(f.localidade)) erro('localidade', 'Escreva a localidade.');
  if (texto(f.descricao).length > 500) erro('descricao', 'A descrição pode ter até 500 caracteres.');

  const datasOk = DATA_RE.test(f.dataInicio ?? '') && DATA_RE.test(f.dataFim ?? '');
  if (!DATA_RE.test(f.dataInicio ?? '')) erro('data_inicio', 'Escolha o dia em que a festa começa.');
  if (!DATA_RE.test(f.dataFim ?? '')) erro('data_fim', 'Escolha o dia em que a festa acaba.');
  if (datasOk) {
    if (f.dataFim < f.dataInicio) erro('data_fim', 'A festa não pode acabar antes de começar.');
    else if (diasEntre(f.dataInicio, f.dataFim).length > LIMITES.diasMax) erro('data_fim', `A festa pode durar no máximo ${LIMITES.diasMax} dias.`);
    if (f.dataFim < hoje) erro('data_fim', 'A festa já passou. Escolha datas a partir de hoje.');
  }

  // Dias onde os turnos podem cair (só se o intervalo de datas fizer sentido)
  const diasFesta = datasOk && f.dataFim >= f.dataInicio ? diasEntre(f.dataInicio, f.dataFim) : null;
  const postos = f.postos ?? [];
  if (postos.length < 1) erro('postos', 'Adicione pelo menos um posto.');
  if (postos.length > LIMITES.postos) erro('postos', `Pode ter no máximo ${LIMITES.postos} postos.`);
  let total = 0;
  postos.forEach((p, i) => {
    const turnos = p.turnos ?? [];
    total += turnos.length;
    if (!texto(p.nome)) erro(`postos.${i}.nome`, `Dê um nome ao posto ${i + 1}.`);
    if (texto(p.nome).length > 40) erro(`postos.${i}.nome`, `O nome do posto ${i + 1} pode ter até 40 caracteres.`);
    if (turnos.length === 0) erro(`postos.${i}.turnos`, `Adicione pelo menos um turno ao posto ${texto(p.nome) || i + 1}.`);
    turnos.forEach((t, j) => {
      const onde = `no turno ${j + 1} do posto ${texto(p.nome) || i + 1}`;
      const base = `postos.${i}.turnos.${j}`;
      if (!t.dia || (diasFesta && !diasFesta.includes(t.dia))) erro(`${base}.dia`, `Escolha o dia ${onde}.`);
      const horasOk = HORA_RE.test(t.inicio ?? '') && HORA_RE.test(t.fim ?? '');
      if (!HORA_RE.test(t.inicio ?? '')) erro(`${base}.inicio`, `Indique a hora de início ${onde}.`);
      if (!HORA_RE.test(t.fim ?? '')) erro(`${base}.fim`, `Indique a hora de fim ${onde}.`);
      if (horasOk && duracaoTurnoMin(t.inicio, t.fim) > LIMITES.duracaoMaxMin) erro(`${base}.fim`, `Cada turno pode durar no máximo 12 horas (${onde}).`);
      const vagas = Number(t.vagas);
      if (!Number.isInteger(vagas) || vagas < LIMITES.vagasMin || vagas > LIMITES.vagasMax) erro(`${base}.vagas`, `As vagas têm de ser entre 1 e 50 ${onde}.`);
    });
  });
  if (total > LIMITES.turnos) erro('postos', `A festa pode ter no máximo ${LIMITES.turnos} turnos (tem ${total}).`);
  return erros;
}

/** Corpo do pedido à função criar_festa. Turnos que passam a meia-noite seguem como estão (fim ≤ início). */
export function montarPayloadFesta(f) {
  const texto = (v) => String(v ?? '').trim();
  return {
    p_festa: {
      nome: texto(f.nome),
      localidade: texto(f.localidade),
      data_inicio: f.dataInicio,
      data_fim: f.dataFim,
      descricao: texto(f.descricao),
      slug_base: slugBase(f.nome),
      postos: f.postos.map((p) => ({
        nome: texto(p.nome),
        turnos: p.turnos.map((t) => ({ dia: t.dia, inicio: t.inicio, fim: t.fim, vagas: Number(t.vagas) })),
      })),
    },
  };
}

// ── Mensagens de erro ───────────────────────────────────────────────────────

export const MENSAGENS = {
  turno_cheio: 'Este turno ficou completo agora mesmo. Escolha outro, por favor.',
  ja_inscrito: 'Já está inscrito(a) neste turno a partir deste telemóvel.',
  nome_invalido: 'Escreva só o primeiro nome, com letras (até 30).',
  confirmar_maioridade: 'Para se inscrever tem de ter 18 anos ou mais.',
  demasiados_pedidos: 'Muitas tentativas seguidas. Espere um pouco e tente outra vez.',
  turno_terminado: 'Este turno já terminou.',
  chave_invalida: 'Este link de gestão não é válido. Confirme que o copiou inteiro.',
  turno_inexistente: 'Este turno já não existe. Atualize a página.',
  postos_invalidos: 'Uma festa precisa de 1 a 12 postos.',
  sem_turnos: 'Adicione pelo menos um turno.',
  turnos_a_mais: 'A festa pode ter no máximo 80 turnos.',
  turno_fora_das_datas: 'Há turnos fora das datas da festa. Confira os dias escolhidos.',
  festa_no_passado: 'A festa já passou. Escolha datas a partir de hoje.',
  dispositivo_invalido: 'Não foi possível identificar este telemóvel. Atualize a página e tente outra vez.',
  rede: 'Sem ligação. Verifique a internet e tente outra vez.',
  outro: 'Algo correu mal. Tente outra vez daqui a pouco.',
};

/** Mensagem humana para um código de erro (ou para um objeto com `.codigo`). */
export function mensagemErro(erro) {
  const codigo = typeof erro === 'string' ? erro : erro?.codigo;
  return Object.hasOwn(MENSAGENS, codigo) ? MENSAGENS[codigo] : MENSAGENS.outro;
}
