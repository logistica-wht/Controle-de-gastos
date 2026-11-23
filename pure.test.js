import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../app_pure.js', import.meta.url), 'utf8').split('/*PURE:START*/')[1].split('/*PURE:END*/')[0];
const L = new Function(`${src}; return { parseAmount, normalizeDate, detectInstallment, normalizeRecord, buildExternalIds, parseCSVText, extractFromText, categorize, addMonths, genPassword, localTips };`)();

test('parseAmount', () => {
  assert.equal(L.parseAmount('1.234,56').value, 1234.56);
  assert.equal(L.parseAmount('-45,90').negative, true);
  assert.equal(L.parseAmount('1.234').value, 1234);
  assert.equal(L.parseAmount('12.50').value, 12.5);
  assert.equal(L.parseAmount('abc'), null);
});
test('normalizeDate', () => {
  assert.equal(L.normalizeDate('05/11/2026'), '2026-11-05');
  assert.equal(L.normalizeDate('05/11', 2026), '2026-11-05');
  assert.equal(L.normalizeDate('31/02/2026'), null);
});
test('parcelas', () => {
  assert.deepEqual(L.detectInstallment('LOJA PARC 03/10'), { current: 3, total: 10, cleanDescription: 'LOJA' });
  assert.equal(L.detectInstallment('Compra 05/11'), null);
  assert.equal(L.detectInstallment('X', '4/12').current, 4);
});
test('CSV com aspas, ; e preâmbulo', () => {
  const csv = 'Extrato do banco\nConta 123\n\nData;Descrição;Valor\n10/11/2026;"Loja ""X"" PARC 02/05";199,90\n11/11/2026;Salário;5.000,00\n';
  const rows = L.parseCSVText(csv);
  assert.equal(rows.length, 2);
  const r = L.normalizeRecord(rows[0]);
  assert.equal(r.description, 'Loja "X"');
  assert.equal(r.amount, 199.9);
  assert.deepEqual(r.installment, { current: 2, total: 5 });
  assert.equal(L.normalizeRecord(rows[1]).kind, 'income');
});
test('CSV com vírgula e BOM', () => {
  const rows = L.parseCSVText('\uFEFFdate,description,amount\n2026-11-01,Cafe,"12,50"\n');
  assert.equal(L.normalizeRecord(rows[0]).amount, 12.5);
});
test('ids externos', () => {
  const rec = { transaction_date: '2026-11-01', description: 'Café', amount: 5, kind: 'expense' };
  const ids = L.buildExternalIds([rec, rec]);
  assert.notEqual(ids[0], ids[1]);
});
test('PDF texto', () => {
  const { found } = L.extractFromText('Fatura 2026\n05/11 SUPERMERCADO 123,45\n06/11/2026 UBER 1.234,56');
  assert.equal(found.length, 2);
});
test('senha gerada', () => {
  const p = L.genPassword(12);
  assert.equal(p.length, 12);
  assert.notEqual(p, L.genPassword(12));
});
test('dicas locais', () => {
  const rows = [
    { kind: 'expense', category: 'Alimentação', amount: 800, transaction_date: '2026-11-03' },
    { kind: 'expense', category: 'Assinaturas', amount: 120, transaction_date: '2026-11-04' },
    { kind: 'income', category: 'Renda', amount: 3000, transaction_date: '2026-11-01' }
  ];
  const t = L.localTips(rows, rows, [{ installment_amount: 100, remaining_count: 3 }], [], '2026-11');
  assert.match(t, /Alimentação/); assert.match(t, /Assinaturas/); assert.match(t, /Parcelamentos/);
  assert.match(L.localTips([], [], [], [], ''), /Ainda não há despesas/);
});

test('modelo CSV e backup são reimportáveis', () => {
  const tpl = '\uFEFFData;Descrição;Valor;Tipo;Categoria;Parcela\r\n05/11/2026;Supermercado Exemplo;152,40;Despesa;Alimentação;\r\n06/11/2026;Loja Exemplo;199,90;Despesa;Compras;2/5\r\n10/11/2026;Salário;5000,00;Receita;Renda;\r\n11/11/2026;"Pix, família";50,00;Transferência;Outros;\r\n';
  const rows = L.parseCSVText(tpl).map((r) => L.normalizeRecord(r));
  assert.equal(rows.length, 4);
  assert.equal(rows[0].category, 'Alimentação'); assert.equal(rows[0].kind, 'expense');
  assert.deepEqual(rows[1].installment, { current: 2, total: 5 });
  assert.equal(rows[2].kind, 'income');
  assert.equal(rows[3].kind, 'transfer'); assert.equal(rows[3].description, 'Pix, família');
});
