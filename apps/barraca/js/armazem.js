// localStorage com rede de segurança: se estiver bloqueado, tudo continua a funcionar (só não persiste).

function ler(chave, omissao) {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? JSON.parse(bruto) : omissao;
  } catch { return omissao; }
}

function escrever(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem armazenamento */ }
}

let dispositivoEmMemoria = null;

/** Identificador anónimo deste dispositivo (16–100 caracteres), para o servidor impedir inscrições repetidas. */
export function idDispositivo() {
  const guardado = ler('barraca:dispositivo', null);
  if (typeof guardado === 'string' && guardado.length >= 16) return guardado;
  dispositivoEmMemoria ??= (globalThis.crypto?.randomUUID?.()
    ?? `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);
  escrever('barraca:dispositivo', dispositivoEmMemoria);
  return dispositivoEmMemoria;
}

/** As inscrições feitas neste dispositivo: {id, slug, turnoId, nome, resumo}. */
export const minhasInscricoes = {
  listar: (slug) => ler('barraca:inscricoes', []).filter((i) => i.slug === slug),
  adicionar(registo) {
    const todas = ler('barraca:inscricoes', []).filter((i) => i.id !== registo.id);
    escrever('barraca:inscricoes', [...todas, registo]);
  },
  remover(id) {
    escrever('barraca:inscricoes', ler('barraca:inscricoes', []).filter((i) => i.id !== id));
  },
};

/** As festas criadas neste dispositivo (guarda o link de gestão). */
export function guardarFestaCriada(registo) {
  const todas = ler('barraca:festas', []).filter((f) => f.slug !== registo.slug);
  escrever('barraca:festas', [...todas, registo]);
}
