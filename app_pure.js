/*PURE:START*/
const CATEGORIES = ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Educação', 'Lazer', 'Assinaturas', 'Compras', 'Impostos e taxas', 'Renda', 'Outros'];
const strip = (s = '') => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const money = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
const pad2 = (n) => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const monthKey = (d = today()) => String(d).slice(0, 7);

function addMonths(iso, months) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
}

/** Senha temporária aleatória (sem caracteres ambíguos). */
function genPassword(len = 12) {
  const al = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const limit = 256 - (256 % al.length);
  let out = '';
  while (out.length < len) {
    const buf = crypto.getRandomValues(new Uint8Array(len * 2));
    for (const b of buf) { if (b < limit && out.length < len) out += al[b % al.length]; }
  }
  return out;
}

function parseAmount(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || /-/.test(s) || /(\d|\s)D$/i.test(s);
  s = s.replace(/[^\d.,]/g, '');
  if (!/\d/.test(s)) return null;
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if (lc > ld) s = s.replace(/\./g, '').replace(',', '.');
  else if (ld > lc) {
    const dec = s.length - ld - 1, dots = (s.match(/\./g) || []).length;
    s = (lc === -1 && dec === 3 && dots >= 1) ? s.replace(/\./g, '') : s.replace(/,/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? { value: Math.abs(n), negative } : null;
}

const validDate = (y, m, d) => { const dt = new Date(Date.UTC(y, m - 1, d)); return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d; };
function normalizeDate(s, fallbackYear = new Date().getFullYear()) {
  if (!s) return null;
  const t = String(s).trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return validDate(+m[1], +m[2], +m[3]) ? `${m[1]}-${m[2]}-${m[3]}` : null;
  m = t.match(/(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/);
  if (!m) return null;
  const d = +m[1], mo = +m[2];
  let y = m[3] ? +m[3] : fallbackYear;
  if (m[3] && m[3].length === 2) y += 2000;
  return validDate(y, mo, d) ? `${y}-${pad2(mo)}-${pad2(d)}` : null;
}

function categorize(desc = '') {
  const t = strip(desc);
  const rules = [
    ['Alimentação', /mercado|supermercado|padaria|restaurante|lanchonete|ifood|rappi|acougue|hortifruti|pizz|burger|cafe/],
    ['Transporte', /uber|99 ?pop|combustivel|posto|gasolina|etanol|estacionamento|pedagio|sem parar|onibus|metro|passagem/],
    ['Saúde', /farmacia|drogaria|drogasil|hospital|clinica|saude|laboratorio|dentista|plano de saude|unimed/],
    ['Assinaturas', /netflix|spotify|prime|disney|hbo|max\b|youtube|assinatura|icloud|google one|deezer/],
    ['Moradia', /aluguel|condominio|energia|luz\b|agua\b|saneamento|internet|gas\b|iptu|enel|cemig|sabesp|vivo|claro|tim\b/],
    ['Educação', /escola|curso|faculdade|universidade|livraria|mensalidade|udemy|alura/],
    ['Lazer', /cinema|viagem|hotel|parque|ingresso|show|airbnb|booking|streaming/],
    ['Compras', /amazon|mercado ?livre|shopee|magalu|magazine|americanas|shein|aliexpress|renner|c&a|riachuelo|zara/],
    ['Impostos e taxas', /imposto|tarifa|taxa|iof|anuidade|juros|multa|ipva/],
    ['Renda', /salario|pagamento de salario|rendimento|dividendo|provento|pix recebido/]
  ];
  for (const [cat, re] of rules) if (re.test(t)) return cat;
  return 'Outros';
}

function detectInstallment(desc = '', extra = '') {
  const valid = (c, t) => (t >= 2 && t <= 120 && c >= 1 && c <= t ? { current: c, total: t } : null);
  const strictM = String(extra || '').match(/^\s*(\d{1,3})\s*(?:\/|de)\s*(\d{1,3})\s*$/i);
  if (strictM) { const r = valid(+strictM[1], +strictM[2]); if (r) return { ...r, cleanDescription: desc }; }
  const re = /\bparc(?:ela|\.)?\s*(\d{1,3})\s*(?:\/|de)\s*(\d{1,3})\b/i;
  const m = String(desc).match(re);
  if (m) {
    const r = valid(+m[1], +m[2]);
    if (r) return { ...r, cleanDescription: String(desc).replace(re, '').replace(/\s{2,}/g, ' ').replace(/[-–\s]+$/, '').trim() };
  }
  return null;
}

const INCOME_RE = /salario|credito recebido|rendimento|rentab|deposito|pix recebido|dividendo|provento|estorno/;
const TRANSFER_RE = /pagamento (de )?fatura|pagamento recebido|pgto fatura|pagamento efetuado|transferencia entre contas|transf\.? ?poup|poupanca|aplicacao|resgate/;

function pick(row, names) {
  const keys = Object.keys(row), norm = keys.map(strip);
  const has = (i) => row[keys[i]] !== '' && row[keys[i]] != null;
  for (const n of names) { const i = norm.indexOf(n); if (i >= 0 && has(i)) return row[keys[i]]; }
  for (const n of names) { const i = norm.findIndex((k) => k.includes(n)); if (i >= 0 && has(i)) return row[keys[i]]; }
  return '';
}

function normalizeRecord(r, fallbackYear, signed = false) {
  let parsed = parseAmount(pick(r, ['valor', 'amount', 'value', 'preco', 'total']));
  let colKind = null;
  if (!parsed || !parsed.value) {
    // Extratos com colunas separadas de Crédito e Débito
    const cr = parseAmount(pick(r, ['credito', 'entrada'])), db = parseAmount(pick(r, ['debito', 'saida']));
    if (cr && cr.value) { parsed = cr; colKind = 'income'; } else if (db && db.value) { parsed = db; colKind = 'expense'; }
  }
  const description = String(pick(r, ['descricao', 'description', 'estabelecimento', 'merchant', 'historico', 'lancamento', 'loja', 'nome']) || '').trim();
  const date = normalizeDate(pick(r, ['data', 'date', 'compra']), fallbackYear);
  if (!parsed || !parsed.value || !description || !date) return null;
  const typeCol = strip(pick(r, ['tipo', 'type', 'natureza', 'd/c']));
  const d = strip(description);
  let kind = 'expense';
  if (colKind) kind = colKind;
  else if (signed) kind = parsed.negative ? 'expense' : 'income';
  if (/credito|entrada|receita|^c$/.test(typeCol) || (!colKind && !signed && INCOME_RE.test(d))) kind = 'income';
  else if (/debito|saida|despesa|^d$/.test(typeCol)) kind = 'expense';
  if (TRANSFER_RE.test(d) || /transferencia/.test(typeCol)) kind = 'transfer';
  const inst = detectInstallment(description, pick(r, ['parcela', 'parcelas']));
  const finalDescription = inst ? inst.cleanDescription || description : description;
  const given = String(pick(r, ['categoria']) || '').trim();
  const category = CATEGORIES.find((c) => strip(c) === strip(given)) || (kind === 'income' ? 'Renda' : categorize(finalDescription));
  return { description: finalDescription.slice(0, 200), amount: Math.round(parsed.value * 100) / 100, transaction_date: date, kind, category, installment: inst ? { current: inst.current, total: inst.total } : null };
}

/** Marca como transferência o que é movimento entre contas do próprio titular (ex.: Pix para si mesmo).
 *  names: nomes do titular (campo "Seu nome no extrato" / nome do usuário). Também infere o titular por "TRANSF.POUP ... C/C NOME". */
function markSelfTransfers(records, names = []) {
  const own = new Set(names.map((n) => strip(n)).filter((n) => n.length >= 5 && n.includes(' ')));
  for (const r of records) {
    const m = strip(r.description).match(/transf\.? ?poup\w*\s+(?:para|de)\s+c\/c\s+(.+)$/);
    if (m && m[1].includes(' ')) own.add(m[1].trim());
  }
  if (!own.size) return records;
  for (const r of records) {
    const d = strip(r.description);
    if (r.kind !== 'transfer' && /\b(pix|ted|doc|transf)/.test(d) && [...own].some((n) => d.includes(n))) r.kind = 'transfer';
  }
  return records;
}

function buildExternalIds(records) {
  const seen = new Map();
  return records.map((x) => {
    const base = `${x.transaction_date}|${strip(x.description)}|${x.amount.toFixed(2)}|${x.kind}`;
    const n = (seen.get(base) || 0) + 1; seen.set(base, n);
    return `${base}|${n}`.slice(0, 300);
  });
}

/** CSV simples: aspas, delimitador automático (; , tab) e cabeçalho após linhas de preâmbulo. */
function parseCSVText(text) {
  text = text.replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) || '';
  const counts = { ';': 0, ',': 0, '\t': 0 };
  let q = false;
  for (const ch of firstLine) { if (ch === '"') q = !q; else if (!q && ch in counts) counts[ch]++; }
  const delim = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur); if (row.some((x) => x.trim() !== '')) rows.push(row);
  let h = rows.findIndex((r) => r.some((x) => /^(data|date)/.test(strip(x))) && r.some((x) => /(valor|amount|total|credito|debito)/.test(strip(x))));
  if (h < 0) h = 0;
  const seen = {};
  const header = (rows[h] || []).map((x, i) => { let k = x.trim() || `col${i}`; seen[k] = (seen[k] || 0) + 1; return seen[k] > 1 ? `${k}_${seen[k]}` : k; });
  return rows.slice(h + 1).map((r) => Object.fromEntries(header.map((k, i) => [k, (r[i] ?? '').trim()])));
}

function extractFromText(text) {
  const years = (text.match(/\b20\d{2}\b/g) || []).reduce((a, y) => ((a[y] = (a[y] || 0) + 1), a), {});
  const top = Object.entries(years).sort((a, b) => b[1] - a[1])[0]?.[0];
  const fallbackYear = top ? +top : new Date().getFullYear();
  const re = /^(\d{2}[/.-]\d{2}(?:[/.-]\d{2,4})?)\s+(.+?)\s+(-?\s?(?:R\$\s?)?\d{1,3}(?:\.\d{3})*,\d{2}(?:\s?[CD])?)\s*$/;
  const found = [];
  for (const line of text.split('\n')) { const m = line.trim().match(re); if (m) found.push({ date: m[1], description: m[2].trim(), amount: m[3] }); }
  return { found, fallbackYear };
}


/**
 * Extratos bancários em PDF (colunas Data | Histórico | Docto | Crédito | Débito | Saldo).
 * A data aparece só na 1ª linha do dia e o histórico ocupa 2 linhas; por isso as linhas são ancoradas nos valores.
 * pages: [[{str, x, y, w}]] — itens de texto de cada página (y cresce para cima, como no PDF).
 */
function parseStatementItems(pages) {
  const MONEY = /^-?\(?\d{1,3}(?:\.\d{3})*,\d{2}\)?-?[CD]?$/i, DATE = /^\d{2}\/\d{2}\/\d{4}$/;
  const money = (tok) => {
    const neg = /^-|-$|^\(|[D]$/i.test(tok);
    const v = Number(tok.replace(/[^\d,]/g, '').replace(',', '.'));
    return { v, neg, signed: neg ? -v : v };
  };
  const out = []; let carryDate = null, prev = null, cols = null;
  for (const items of pages) {
    const its = items.filter((i) => i.str && i.str.trim()).map((i) => ({ s: i.str.trim(), x: i.x, y: i.y, w: i.w || 0 }));
    const hc = its.find((i) => /^credito/.test(strip(i.s))), hd = its.find((i) => /^debito/.test(strip(i.s)));
    const hs = its.find((i) => /^saldo/.test(strip(i.s))), hh = its.find((i) => /^historico/.test(strip(i.s))), hdoc = its.find((i) => /^docto|^documento/.test(strip(i.s)));
    let headY = Infinity;
    if (hc && hd) {
      cols = { credit: hc.x + hc.w, debit: hd.x + hd.w, saldo: hs ? hs.x + hs.w : null, histX: hh ? hh.x : null, doctoX: hdoc ? hdoc.x : null };
      headY = hc.y;
    } else if (cols) headY = Infinity;
    const body = its.filter((i) => i.y < headY - 2);
    const isMoney = (i) => MONEY.test(i.s);
    const moneyItems = body.filter(isMoney).sort((a, b) => b.y - a.y);
    // âncoras: itens de valor na mesma altura
    const anchors = [];
    for (const m of moneyItems) {
      const a = anchors.find((z) => Math.abs(z.y - m.y) <= 3);
      if (a) a.m.push(m); else anchors.push({ y: m.y, m: [m] });
    }
    anchors.forEach((a) => a.m.sort((p, q) => p.x - q.x));
    if (!anchors.length) continue;
    const gaps = anchors.slice(1).map((a, i) => anchors[i].y - a.y).sort((p, q) => p - q);
    const spacing = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 40;
    const cutoff = Math.max(12, Math.min(30, spacing * 0.55));
    const dates = body.filter((i) => DATE.test(i.s)).sort((a, b) => b.y - a.y);
    const histMin = cols && cols.histX != null ? cols.histX - 6 : -Infinity;
    const histMax = cols && cols.doctoX != null ? cols.doctoX - 2 : Infinity;
    const descItems = body.filter((i) => !isMoney(i) && !DATE.test(i.s) && i.x >= histMin && i.x < histMax && !/^\d{6,}$/.test(i.s));
    for (const d of descItems) {
      let best = null, bd = Infinity;
      for (const a of anchors) { const dist = Math.abs(a.y - d.y); if (dist < bd) { bd = dist; best = a; } }
      if (best && bd <= cutoff) (best.d ||= []).push(d);
    }
    for (const a of anchors) {
      const lines = [];
      for (const d of (a.d || []).sort((p, q) => q.y - p.y || p.x - q.x)) {
        const L = lines.find((l) => Math.abs(l.y - d.y) <= 2);
        if (L) L.t.push(d); else lines.push({ y: d.y, t: [d] });
      }
      const text = lines.sort((p, q) => q.y - p.y).map((l) => l.t.sort((p, q) => p.x - q.x).map((t) => t.s).join(' ')).join(' ').replace(/\s{2,}/g, ' ').trim();
      const above = dates.filter((dt) => dt.y >= a.y - 8);
      if (above.length) carryDate = above[above.length - 1].s;
      const saldoIt = a.m.length >= 2 ? a.m[a.m.length - 1] : null;
      if (/saldo (anterior|do dia|final|parcial|disponivel)/.test(strip(text)) || !saldoIt) {
        if (/saldo/.test(strip(text))) { const mv = money(a.m[a.m.length - 1].s); prev = mv.signed; }
        continue;
      }
      const valIts = a.m.slice(0, -1);
      let val = valIts[0], dir = null;
      if (cols) {
        const nearest = (it) => (Math.abs(it.x + it.w - cols.credit) <= Math.abs(it.x + it.w - cols.debit) ? 'credit' : 'debit');
        if (valIts.length === 1) dir = nearest(val);
      }
      const value = money(val.s).v, bal = money(saldoIt.s);
      if (prev !== null) {
        const variants = [bal.signed, bal.v, -bal.v];
        const match = (dd) => { const exp = prev + (dd === 'credit' ? value : -value); return variants.some((c) => Math.abs(c - exp) < 0.015) ? exp : null; };
        const mc = match('credit'), md = match('debit');
        if (mc !== null && md === null) { dir = 'credit'; prev = mc; } else if (md !== null && mc === null) { dir = 'debit'; prev = md; } else prev = bal.signed;
      } else prev = bal.signed;
      if (!carryDate || !text) continue;
      out.push({ data: carryDate, descricao: text, valor: val.s.replace(/[^\d.,]/g, ''), tipo: dir === 'credit' ? 'Credito' : dir === 'debit' ? 'Debito' : '' });
    }
  }
  return out;
}

/** Dicas calculadas localmente (sem IA). rows = lançamentos do período; allRows = todos. */
function localTips(rows, allRows, inst, goals, month) {
  const exp = rows.filter((x) => x.kind === 'expense'), inc = rows.filter((x) => x.kind === 'income');
  const sum = (a) => a.reduce((s, x) => s + Number(x.amount), 0);
  const totalExp = sum(exp), totalInc = sum(inc);
  if (!exp.length) return 'Ainda não há despesas no período para analisar. Importe seus extratos ou registre lançamentos.';
  const by = {};
  exp.forEach((x) => { const c = x.category || 'Outros'; by[c] = (by[c] || 0) + Number(x.amount); });
  const ranked = Object.entries(by).sort((a, b) => b[1] - a[1]);
  const out = [];
  out.push(`Panorama: despesas de ${money(totalExp)}${totalInc ? ` para receitas de ${money(totalInc)} (saldo ${money(totalInc - totalExp)})` : ''}.`);
  ranked.slice(0, 3).forEach(([c, v]) => out.push(`• ${c} pesa ${Math.round((v / totalExp) * 100)}% das despesas (${money(v)}). Fixe um teto mensal para essa categoria e acompanhe.`));
  if (month) {
    const [y, m] = month.split('-').map(Number);
    const prev = monthKey(new Date(Date.UTC(y, m - 2, 1)).toISOString());
    const pe = allRows.filter((x) => x.kind === 'expense' && x.transaction_date.startsWith(prev));
    if (pe.length) {
      const pby = {}; pe.forEach((x) => { const c = x.category || 'Outros'; pby[c] = (pby[c] || 0) + Number(x.amount); });
      ranked.forEach(([c, v]) => { const p = pby[c] || 0; if (p > 0 && v > p * 1.2 && v - p > 50) out.push(`• ${c} subiu ${Math.round(((v - p) / p) * 100)}% frente a ${prev} (+${money(v - p)}). Vale revisar o que mudou.`); });
    }
  }
  if (by['Assinaturas']) out.push(`• Assinaturas somam ${money(by['Assinaturas'])}. Cancele as que você não usou nas últimas semanas.`);
  const monthly = inst.filter((i) => i.remaining_count > 0).reduce((s, i) => s + Number(i.installment_amount), 0);
  if (monthly > 0) {
    const open = inst.reduce((s, i) => s + Number(i.installment_amount) * i.remaining_count, 0);
    out.push(`• Parcelamentos comprometem ${money(monthly)} por mês (${money(open)} em aberto)${totalInc ? `, cerca de ${Math.round((monthly / totalInc) * 100)}% da renda do período` : ''}. Evite novas parcelas até quitar as maiores.`);
  }
  if (totalInc > 0) {
    const rate = (totalInc - totalExp) / totalInc;
    out.push(rate < 0 ? '• Você gastou mais do que recebeu no período: priorize cortar gastos variáveis antes de assumir novos compromissos.' : rate < 0.1 ? `• Taxa de poupança de ${Math.round(rate * 100)}%. Uma meta comum é guardar 10–20% da renda; tente automatizar uma transferência no dia do pagamento.` : `• Taxa de poupança de ${Math.round(rate * 100)}%: bom ritmo. Direcione o excedente às suas metas.`);
  }
  const g = goals.find((x) => Number(x.current_amount) < Number(x.target_amount));
  if (g) out.push(`• Meta “${g.name}”: faltam ${money(Number(g.target_amount) - Number(g.current_amount))}.`);
  out.push('Ideias de renda extra de baixo risco (genéricas): vender itens parados; serviços sob demanda com sua habilidade profissional; revisar tarifas de contas, planos e seguros para reduzir custos fixos. Valide com pouco dinheiro antes de investir tempo.');
  out.push('Estas dicas são automáticas e baseadas só nos lançamentos importados; revise categorias e valores antes de decidir.');
  return out.join('\n');
}


/*PURE:END*/
