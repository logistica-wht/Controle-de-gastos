import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../app_pure.js', import.meta.url), 'utf8').split('/*PURE:START*/')[1].split('/*PURE:END*/')[0];
const L = new Function(`${src}; return { parseStatementItems, normalizeRecord, markSelfTransfers, buildExternalIds, detectInstallment, categorize };`)();

// Reproduz o layout do extrato (uma linha de valores no meio, título acima e detalhe abaixo; data só no 1º lançamento do dia).
const ROWS = [
  ['26/10/2026', 'CARTÃO VISA ELECTRON', 'PadariaE', '0534034', '', '8,50', '56,18'],
  ['03/11/2026', 'TRANSF.POUP PARA C/C', 'RAFAEL DOS SANTOS', '0109006', '3.000,00', '', '3.056,18'],
  ['', 'PIX RECEBIDO', 'REM: Keila Regina Goncalve 02/11', '1107221', '20,00', '', '3.076,18'],
  ['', 'PIX ENVIADO', 'DES: Keila Regina Goncalve 02/11', '1001067', '', '320,00', '2.756,18'],
  ['', 'CONTA DE GAS', 'COMGAS/SP-47541253', '4754125', '', '47,33', '2.708,85'],
  ['05/11/2026', 'PIX RECEBIDO', 'REM: Kelly Gonçalves dos S 05/11', '1422163', '106,00', '', '2.814,85'],
  ['', 'RENTAB.INVEST FACILCRED*', '', '0000002', '0,01', '', '2.814,86'],
  ['', 'TV POR ASSINATURA', 'CLARO SA-RESIDENCIAL-2330892', '2233089', '', '98,61', '2.716,25'],
  ['', 'PIX ENVIADO', 'DES: RAFAEL DOS SANTOS 05/11', '0638112', '', '100,00', '2.616,25'],
  ['09/11/2026', 'PAGTO ELETRON COBRANCA', 'PORTOSEG SA C FINANC E INVEST', '0000164', '', '3.605,17', '988,92'], // saldo vira negativo: impresso sem sinal
  ['', 'PAGTO ELETRON COBRANCA', 'CONTR 292290055 PARC 007/048', '9990313', '', '890,51', '1.879,43'],
  ['10/11/2026', 'TRANSF.POUP PARA C/C', 'RAFAEL DOS SANTOS', '0109581', '980,00', '', '899,43']
];
function build(rows) {
  const items = [];
  const header = 800;
  items.push({ str: 'Extrato de: Agência: 109 | Conta: 326166-2', x: 40, y: 830, w: 200 }, { str: 'Folha: 1/2', x: 640, y: 830, w: 50 });
  items.push({ str: 'Data', x: 40, y: header, w: 25 }, { str: 'Histórico', x: 120, y: header, w: 50 }, { str: 'Docto.', x: 368, y: header, w: 35 },
    { str: 'Crédito (R$)', x: 458, y: header, w: 74 }, { str: 'Débito (R$)', x: 530, y: header, w: 67 }, { str: 'Saldo (R$)', x: 630, y: header, w: 60 });
  rows.forEach((r, i) => {
    const y = 740 - i * 44;
    if (r[0]) items.push({ str: r[0], x: 40, y, w: 60 });
    items.push({ str: r[1], x: 120, y: y + 7, w: 150 });
    if (r[2]) items.push({ str: r[2], x: 120, y: y - 7, w: 170 });
    items.push({ str: r[3], x: 368, y, w: 45 });
    if (r[4]) items.push({ str: r[4], x: 540 - r[4].length * 5.2, y, w: r[4].length * 5.2 });      // alinhado à direita (crédito)
    if (r[5]) items.push({ str: r[5], x: 607 - r[5].length * 5.2, y, w: r[5].length * 5.2 });      // débito
    items.push({ str: r[6], x: 690 - r[6].length * 5.2, y, w: r[6].length * 5.2 });                 // saldo
  });
  return items.sort(() => Math.random() - 0.5); // ordem dos itens não pode importar
}

test('extrato bancário: data, descrição, receita/despesa', () => {
  const raw = L.parseStatementItems([build(ROWS)]);
  assert.equal(raw.length, ROWS.length);
  const recs = L.markSelfTransfers(raw.map((r) => L.normalizeRecord(r)));
  const by = (txt) => recs.find((r) => r.description.includes(txt));
  assert.equal(recs.length, ROWS.length);
  assert.equal(recs[0].transaction_date, '2026-10-26'); assert.equal(recs[0].kind, 'expense'); assert.equal(recs[0].amount, 8.5); assert.equal(recs[0].category, 'Alimentação');
  assert.equal(recs[1].transaction_date, '2026-11-03'); assert.equal(recs[1].kind, 'transfer');           // poupança → conta
  assert.equal(recs[2].transaction_date, '2026-11-03'); assert.equal(recs[2].kind, 'income');             // PIX recebido herda a data do dia
  assert.equal(recs[3].kind, 'expense'); assert.equal(recs[3].amount, 320);
  assert.equal(by('CONTA DE GAS').category, 'Moradia');
  assert.equal(by('Kelly').transaction_date, '2026-11-05'); assert.equal(by('Kelly').kind, 'income');
  assert.equal(by('RENTAB').kind, 'income');
  assert.equal(by('TV POR ASSINATURA').category, 'Assinaturas');
  assert.equal(by('DES: RAFAEL DOS SANTOS').kind, 'transfer');                                          // Pix para si mesmo
  assert.equal(by('PORTOSEG').kind, 'expense'); assert.equal(by('PORTOSEG').amount, 3605.17);
  const parc = by('CONTR 292290055');
  assert.deepEqual(parc.installment, { current: 7, total: 48 }); assert.equal(parc.description, 'PAGTO ELETRON COBRANCA CONTR 292290055');
  assert.equal(recs[11].transaction_date, '2026-11-10'); assert.equal(recs[11].kind, 'transfer');
  assert.ok(!recs.some((r) => /Folha|Extrato de|Histórico/i.test(r.description)));
});

test('sem cabeçalho de colunas, usa a variação do saldo', () => {
  const items = build(ROWS).filter((i) => !['Data', 'Histórico', 'Docto.', 'Crédito (R$)', 'Débito (R$)', 'Saldo (R$)'].includes(i.str));
  const raw = L.parseStatementItems([items]);
  const kinds = raw.slice(1).map((r) => r.tipo);
  assert.deepEqual(kinds, ['Credito', 'Credito', 'Debito', 'Debito', 'Credito', 'Credito', 'Debito', 'Debito', 'Debito', 'Debito', 'Credito']);
});

test('CSV do banco com colunas Crédito e Débito separadas', () => {
  const r1 = L.normalizeRecord({ Data: '03/11/2026', 'Histórico': 'PIX RECEBIDO REM: Keila', 'Docto.': '1107221', 'Crédito (R$)': '20,00', 'Débito (R$)': '', 'Saldo (R$)': '3.076,18' });
  assert.equal(r1.kind, 'income'); assert.equal(r1.amount, 20);
  const r2 = L.normalizeRecord({ Data: '03/11/2026', 'Histórico': 'CONTA DE GAS', 'Crédito (R$)': '', 'Débito (R$)': '47,33', 'Saldo (R$)': '2.708,85' });
  assert.equal(r2.kind, 'expense'); assert.equal(r2.amount, 47.33);
});
