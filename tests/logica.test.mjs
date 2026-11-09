// Testes da lógica pura (apps/barraca/js/logica.js). Correr com: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  estadoTurno, agruparPorDiaEPosto, formatarHora, formatarIntervalo, chaveDia, rotuloDia, intervaloDatas, diasEntre,
  validarNome, slugBase, slugValido, validarFesta, montarPayloadFesta, duracaoTurnoMin, mensagemErro, resumoNomes, horaCurta,
} from '../apps/barraca/js/logica.js';

const fixture = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url), 'utf8'));
const AGORA = new Date('2030-06-22T12:00:00Z');

test('estado do turno: livre, quase cheio, completo e terminado', () => {
  const base = { inicio: '2030-06-22T17:00:00Z', fim: '2030-06-22T19:00:00Z', vagas: 4 };
  assert.deepEqual(
    (({ tipo, texto, simbolo, reservavel }) => ({ tipo, texto, simbolo, reservavel }))(estadoTurno({ ...base, ocupadas: 1 }, AGORA)),
    { tipo: 'livre', texto: '3 vagas livres', simbolo: '○', reservavel: true },
  );
  assert.equal(estadoTurno({ ...base, ocupadas: 2 }, AGORA).texto, '2 vagas livres');
  const quase = estadoTurno({ ...base, ocupadas: 3 }, AGORA);
  assert.deepEqual([quase.tipo, quase.texto, quase.simbolo, quase.reservavel], ['quase', 'Falta 1 pessoa', '◐', true]);
  const cheio = estadoTurno({ ...base, ocupadas: 4 }, AGORA);
  assert.deepEqual([cheio.tipo, cheio.texto, cheio.simbolo, cheio.reservavel], ['completo', 'Completo', '●', false]);
  // Um turno já acabado é "Terminado" mesmo que tenha vagas
  const fim = estadoTurno({ ...base, ocupadas: 0 }, new Date('2030-06-22T20:00:00Z'));
  assert.deepEqual([fim.tipo, fim.texto, fim.reservavel], ['terminado', 'Terminado', false]);
});

test('formatar horas em Europe/Lisbon: 18h–20h e 22h–00h', () => {
  assert.equal(formatarIntervalo('2030-06-22T17:00:00Z', '2030-06-22T19:00:00Z'), '18h–20h'); // verão: UTC+1
  assert.equal(formatarIntervalo('2030-06-22T21:00:00Z', '2030-06-22T23:00:00Z'), '22h–00h');
  assert.equal(formatarIntervalo('2030-01-12T18:00:00Z', '2030-01-12T20:00:00Z'), '18h–20h'); // inverno: UTC+0
  assert.equal(formatarHora('2030-06-22T08:00:00Z'), '09h');
  assert.equal(formatarHora('2030-06-22T17:30:00Z'), '18h30');
  assert.equal(horaCurta('2030-06-22T13:32:00Z'), '14:32');
});

test('mudança de hora: as horas locais mantêm-se e o dia segue Lisboa', () => {
  // Fim do verão (2030-10-27, 02:00 -> 01:00): sábado ainda UTC+1, domingo UTC+0
  assert.equal(formatarIntervalo('2030-10-26T21:00:00Z', '2030-10-26T23:00:00Z'), '22h–00h');
  assert.equal(formatarIntervalo('2030-10-27T22:00:00Z', '2030-10-28T00:00:00Z'), '22h–00h');
  // Início do verão (2030-03-31, 01:00 UTC): o turno 00h30–03h dura só 1h30 mas lê-se com a hora local
  assert.equal(formatarIntervalo('2030-03-31T00:30:00Z', '2030-03-31T02:00:00Z'), '00h30–03h');
  // 00h30 do dia 27 em Lisboa ainda é 26 em UTC
  assert.equal(chaveDia('2030-10-26T23:30:00Z'), '2030-10-27');
  assert.equal(chaveDia('2030-06-22T23:30:00Z'), '2030-06-23');
});

test('rótulos de dias e de intervalos de datas', () => {
  assert.equal(rotuloDia('2030-06-22'), 'Sáb 22');
  assert.equal(rotuloDia('2030-06-22', 'longo'), 'Sábado 22');
  assert.equal(rotuloDia('2030-06-24', 'longo'), 'Segunda 24');
  assert.equal(rotuloDia('2030-06-22', 'completo'), 'Sábado 22 de junho');
  assert.equal(intervaloDatas('2030-11-16', '2030-11-17'), 'Sáb 16 e Dom 17 de novembro');
  assert.equal(intervaloDatas('2030-11-15', '2030-11-17'), 'Sex 15 a Dom 17 de novembro');
  assert.equal(intervaloDatas('2030-11-16', '2030-11-16'), 'Sáb 16 de novembro');
  assert.equal(intervaloDatas('2030-11-30', '2030-12-01'), 'Sáb 30 de novembro e Dom 1 de dezembro');
  assert.deepEqual(diasEntre('2030-02-27', '2030-03-01'), ['2030-02-27', '2030-02-28', '2030-03-01']);
});

test('agrupar por dia e posto com as fixtures', () => {
  const dias = agruparPorDiaEPosto(fixture('turnos'), fixture('postos'), AGORA, fixture('inscricoes'));
  assert.deepEqual(dias.map((d) => d.curto), ['Sáb 22', 'Dom 23']);
  assert.deepEqual(dias[0].postos.map((p) => p.posto.nome), ['Bar', 'Bifanas e castanhas', 'Montagem do arraial']);
  assert.deepEqual(dias[1].postos.map((p) => p.posto.nome), ['Bar', 'Bifanas e castanhas', 'Limpeza']);
  const bar = dias[0].postos[0].turnos;
  assert.deepEqual(bar.map((t) => t.intervalo), ['18h–20h', '20h–22h', '22h–00h']);
  assert.deepEqual(bar.map((t) => t.estado.tipo), ['completo', 'livre', 'quase']);
  assert.equal(bar[0].resumo, 'Bar · Sábado 22 · 18h–20h');
  assert.deepEqual(bar[0].nomes, ['Zé', 'Fátima', 'Rui']);
  // Turno de domingo que acaba à meia-noite fica no domingo
  assert.equal(dias[1].postos[2].turnos.at(-1).intervalo, '22h–00h');
});

test('agrupar ignora turnos de postos desconhecidos e ordena por início', () => {
  const postos = [{ id: 'p1', nome: 'Bar', ordem: 0 }];
  const turnos = [
    { id: 'b', posto_id: 'p1', inicio: '2030-06-22T19:00:00Z', fim: '2030-06-22T20:00:00Z', vagas: 2, ocupadas: 0 },
    { id: 'a', posto_id: 'p1', inicio: '2030-06-22T17:00:00Z', fim: '2030-06-22T18:00:00Z', vagas: 2, ocupadas: 0 },
    { id: 'x', posto_id: 'fantasma', inicio: '2030-06-22T17:00:00Z', fim: '2030-06-22T18:00:00Z', vagas: 2, ocupadas: 0 },
  ];
  const dias = agruparPorDiaEPosto(turnos, postos, AGORA);
  assert.deepEqual(dias[0].postos[0].turnos.map((t) => t.turno.id), ['a', 'b']);
});

test('validar nome (igual ao servidor)', () => {
  assert.deepEqual(validarNome('  Ana  '), { ok: true, valor: 'Ana' });
  assert.equal(validarNome('Maria   José').valor, 'Maria José');
  assert.equal(validarNome("D'Ávila-Santos Jr.").ok, true);
  assert.equal(validarNome('D’Ávila').valor, "D'Ávila"); // apóstrofo do teclado
  assert.equal(validarNome('Zé').ok, true);
  assert.equal(validarNome('').ok, false);
  assert.equal(validarNome('   ').ok, false);
  assert.equal(validarNome('A'.repeat(30)).ok, true);
  assert.equal(validarNome('A'.repeat(31)).ok, false);
  assert.equal(validarNome('1Ana').ok, false);
  assert.equal(validarNome('-Ana').ok, false);
  assert.equal(validarNome('Ana2').ok, false);
  assert.equal(validarNome('<img src=x onerror="alert(1)">').ok, false);
  assert.equal(validarNome(null).codigo, 'nome_invalido');
});

test('slug base', () => {
  assert.equal(slugBase('Festas de São João da Ribeira!'), 'festas-de-sao-joao-da-ribeira');
  assert.equal(slugBase('  Arraial  '), 'arraial');
  assert.equal(slugBase('Fé'), 'festa'); // curto demais
  assert.equal(slugBase('!!!'), 'festa');
  assert.ok(slugBase('a'.repeat(100)).length <= 60);
  assert.equal(slugValido('demonstracao'), true);
  assert.equal(slugValido('x/../y'), false);
  assert.equal(slugValido(null), false);
});

const festaValida = () => ({
  nome: 'Festa da Ribeira', localidade: 'Ribeira', dataInicio: '2030-06-22', dataFim: '2030-06-23', descricao: '',
  postos: [{ nome: 'Bar', turnos: [{ dia: '2030-06-22', inicio: '22:00', fim: '00:00', vagas: '4' }] }],
});

test('payload de criar festa com turno que passa a meia-noite', () => {
  const f = festaValida();
  assert.deepEqual(validarFesta(f, '2030-06-01'), []);
  assert.equal(duracaoTurnoMin('22:00', '00:00'), 120);
  assert.deepEqual(montarPayloadFesta(f), {
    p_festa: {
      nome: 'Festa da Ribeira', localidade: 'Ribeira', data_inicio: '2030-06-22', data_fim: '2030-06-23', descricao: '',
      slug_base: 'festa-da-ribeira',
      postos: [{ nome: 'Bar', turnos: [{ dia: '2030-06-22', inicio: '22:00', fim: '00:00', vagas: 4 }] }],
    },
  });
});

test('validar festa: limites do servidor', () => {
  const campos = (f, hoje = '2030-06-01') => validarFesta(f, hoje).map((e) => e.campo);
  const mut = (fn) => { const f = festaValida(); fn(f); return f; };
  assert.deepEqual(campos(mut((f) => { f.nome = ''; })), ['nome']);
  assert.deepEqual(campos(mut((f) => { f.dataFim = '2030-06-21'; })), ['data_fim']);
  assert.deepEqual(campos(mut((f) => { f.dataInicio = '2030-06-01'; f.dataFim = '2030-06-20'; f.postos[0].turnos[0].dia = '2030-06-01'; })), ['data_fim']); // 20 dias > 14
  assert.deepEqual(campos(festaValida(), '2030-07-01'), ['data_fim']); // já passou
  assert.deepEqual(campos(mut((f) => { f.postos = []; })), ['postos']);
  assert.deepEqual(campos(mut((f) => { f.postos[0].nome = ' '; })), ['postos.0.nome']);
  assert.deepEqual(campos(mut((f) => { f.postos[0].turnos = []; })), ['postos.0.turnos']);
  assert.deepEqual(campos(mut((f) => { f.postos[0].turnos[0].vagas = '0'; })), ['postos.0.turnos.0.vagas']);
  assert.deepEqual(campos(mut((f) => { f.postos[0].turnos[0].vagas = '51'; })), ['postos.0.turnos.0.vagas']);
  assert.deepEqual(campos(mut((f) => { f.postos[0].turnos[0].vagas = '2.5'; })), ['postos.0.turnos.0.vagas']);
  assert.deepEqual(campos(mut((f) => { f.postos[0].turnos[0].dia = '2030-06-30'; })), ['postos.0.turnos.0.dia']);
  assert.deepEqual(campos(mut((f) => { f.postos[0].turnos[0].inicio = '08:00'; f.postos[0].turnos[0].fim = '21:00'; })), ['postos.0.turnos.0.fim']); // 13 h
  assert.deepEqual(campos(mut((f) => { f.postos[0].turnos[0].inicio = '08:00'; f.postos[0].turnos[0].fim = '08:00'; })), ['postos.0.turnos.0.fim']); // 24 h
  assert.deepEqual(campos(mut((f) => { f.postos = Array.from({ length: 13 }, (_, i) => ({ nome: `P${i}`, turnos: [{ dia: '2030-06-22', inicio: '10:00', fim: '11:00', vagas: 1 }] })); })), ['postos']);
  const muitos = mut((f) => { f.postos = Array.from({ length: 9 }, (_, i) => ({ nome: `P${i}`, turnos: Array.from({ length: 9 }, () => ({ dia: '2030-06-22', inicio: '10:00', fim: '11:00', vagas: 1 })) })); });
  assert.deepEqual(campos(muitos), ['postos']); // 81 turnos
});

test('mensagem de erro por código', () => {
  assert.equal(mensagemErro('turno_cheio'), 'Este turno ficou completo agora mesmo. Escolha outro, por favor.');
  assert.equal(mensagemErro('ja_inscrito'), 'Já está inscrito(a) neste turno a partir deste telemóvel.');
  assert.equal(mensagemErro('nome_invalido'), 'Escreva só o primeiro nome, com letras (até 30).');
  assert.equal(mensagemErro('confirmar_maioridade'), 'Para se inscrever tem de ter 18 anos ou mais.');
  assert.equal(mensagemErro('demasiados_pedidos'), 'Muitas tentativas seguidas. Espere um pouco e tente outra vez.');
  assert.equal(mensagemErro('turno_terminado'), 'Este turno já terminou.');
  assert.equal(mensagemErro('chave_invalida'), 'Este link de gestão não é válido. Confirme que o copiou inteiro.');
  assert.equal(mensagemErro('rede'), 'Sem ligação. Verifique a internet e tente outra vez.');
  assert.equal(mensagemErro({ codigo: 'turno_cheio' }), mensagemErro('turno_cheio'));
  for (const c of ['codigo_desconhecido', undefined, null, 'toString', '__proto__']) {
    assert.equal(mensagemErro(c), 'Algo correu mal. Tente outra vez daqui a pouco.');
  }
});

test('resumo de nomes', () => {
  assert.equal(resumoNomes([]), '');
  assert.equal(resumoNomes(['Zé']), 'Zé');
  assert.equal(resumoNomes(['Zé', 'Fátima']), 'Zé e Fátima');
  assert.equal(resumoNomes(['Zé', 'Fátima', 'Rui']), 'Zé, Fátima e Rui');
  assert.equal(resumoNomes(['A', 'B', 'C', 'D']), 'A, B, C e D');
});
