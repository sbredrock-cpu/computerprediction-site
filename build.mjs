// Tiny static builder: wraps each page in the shared partials and fills {{KEY}} placeholders.
import fs from 'node:fs';
import path from 'node:path';

const SITE = {
  NAME: 'Computer Prediction',
  // Replace these links before uploading. Search the built pages for "#replace-" to find any you missed.
  CHECKOUT_WEEKLY_URL: 'https://whop.com/computerprediction/7-day-pass-43/',    // $39/week (Whop 7-day pass)
  CHECKOUT_MONTHLY_URL: 'https://whop.com/computerprediction/30-day-full-access-pass-46/',  // $100/month (Whop 30-day full access pass)
  SIGNUP_FORM_ACTION: '#replace-signup-form-action',       // form action URL from your email tool's embedded form (double opt-in ON; confirmed redirect -> thank-you.html)
  FREE_TELEGRAM_URL: '#replace-free-telegram-link',        // public Telegram channel
  X_URL: '#replace-x-link',
  TIKTOK_URL: '#replace-tiktok-link',
  CONTACT_EMAIL: '[your contact email]',
  YEAR: String(new Date().getFullYear()),
  V: Date.now().toString(36), // cache-buster for css/js so Hostinger's cache can't serve stale assets
};

const root = path.dirname(new URL(import.meta.url).pathname);
const preview = process.argv.includes('--preview');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const fill = (s, vars) => s.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));

// Day totals: data/daily.csv wins for any date it lists; every other date is totalled from data/picks.csv,
// so a nightly export that only appends graded picks is enough to update the site.
const DAILY = (() => {
  const lines = (f) => fs.existsSync(path.join(root, f)) ? read(f).trim().split(/\r?\n/) : [];
  const days = new Map(lines('data/daily.csv').slice(1).filter(Boolean).map((l) => [l.split(',')[0], l]));
  const pick = lines('data/picks.csv'), hdr = (pick[0] || '').split(',');
  const di = hdr.indexOf('date'), ri = hdr.indexOf('result'), pi = hdr.indexOf('pl');
  const tot = new Map();
  for (const l of pick.slice(1)) {
    const c = []; let cur = '', q = false;
    for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { c.push(cur); cur = ''; } else cur += ch; }
    c.push(cur);
    const d = c[di]; if (!d || days.has(d)) continue;
    const t = tot.get(d) || [0, 0, 0, 0]; const r = (c[ri] || '').toUpperCase();
    if (r === 'W') t[0]++; else if (r === 'L') t[1]++; else if (r === 'P') t[2]++; else continue;
    t[3] += Number((c[pi] || '0').replace(/[$,+\s]/g, '').replace('−', '-')) || 0;
    tot.set(d, t);
  }
  for (const [d, t] of tot) days.set(d, [d, t[0], t[1], t[2], Math.round(t[3])].join(','));
  return 'date,wins,losses,pushes,net\n' + [...days.keys()].sort().map((d) => days.get(d)).join('\n');
})();


// Scoreboard strip: computed from data/daily.csv (one row per graded day, flat $100 stakes).
function scoreboard() {
  const rows = DAILY.trim().split('\n').slice(1).map((l) => {
    const [date, w, l2, p, net] = l.split(',');
    return { date, w: +w, l: +l2, p: +p, net: +net };
  }).sort((a, b) => a.date.localeCompare(b.date));
  const last = rows[rows.length - 1];
  const day = (d) => new Date(d + 'T12:00:00Z');
  const sum = (rs) => rs.reduce((t, r) => ({ w: t.w + r.w, l: t.l + r.l, p: t.p + r.p, net: t.net + r.net }), { w: 0, l: 0, p: 0, net: 0 });
  const weekStart = new Date(day(last.date) - 6 * 864e5).toISOString().slice(0, 10);
  const month = last.date.slice(0, 7);
  const fmtDay = day(last.date).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'UTC' }).replace(',', '');
  const monthName = day(last.date).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  const money = (n) => (n >= 0 ? '+$' : '−$') + Math.abs(n).toLocaleString('en-US');
  const line = (label, sub, t, extra = '') => {
    const pct = t.w + t.l ? Math.round((100 * t.w) / (t.w + t.l)) : 0;
    const cls = t.net >= 0 ? 'up' : 'down';
    return `<div class="sb-row"${extra}><span class="sb-k">${label}<small>${sub}</small></span>` +
      `<span class="sb-v"><i>W-L</i><b>${t.w}-${t.l}${t.p ? '-' + t.p : ''}</b></span>` +
      `<span class="sb-v"><i>Win</i><b>${pct}%</b></span>` +
      `<span class="sb-v"><i>Net</i><b class="${cls}">${t.net >= 0 ? '▲' : '▼'} ${money(t.net)}</b></span></div>`;
  };
  return '<a class="scoreboard" href="index.html#unlock" aria-label="Results scoreboard. Flat $100 per pick."><span class="sb-flip"><span class="sb-rows">' +
    line('Yesterday', fmtDay, sum([last]), ` data-date="${last.date}"`) +
    line('Last 7 days', 'Rolling', sum(rows.filter((r) => r.date >= weekStart))) +
    line(monthName, 'Month to date', sum(rows.filter((r) => r.date.startsWith(month)))) +
    '</span></span><span class="sb-foot"><b>Full record free →</b></span></a>';
}
SITE.SCOREBOARD = scoreboard();

// All-time numbers for the credibility row, from the same CSV.
function allTime() {
  const rows = DAILY.trim().split('\n').slice(1).map((l) => l.split(',')).sort((a, b) => a[0].localeCompare(b[0]));
  let w = 0, l = 0, p = 0, net = 0; const run = [0];
  for (const r of rows) { w += +r[1]; l += +r[2]; p += +r[3]; net += +r[4]; run.push(net); }
  const picks = w + l + p;
  const lo = Math.min(...run), hi = Math.max(...run), W = 300, H = 60;
  const pts = run.map((v, i) => `${((i * W) / (run.length - 1)).toFixed(1)},${(H - ((v - lo) / (hi - lo || 1)) * H).toFixed(1)}`).join(' ');
  const d = (x) => new Date(x + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return {
    ALL_WL: `${w}-${l}${p ? '-' + p : ''}`,
    ALL_WINPCT: `${Math.round((100 * w) / (w + l))}%`,
    ALL_ROI: `${net >= 0 ? '+' : '−'}${Math.abs((100 * net) / (picks * 100)).toFixed(1)}%`,
    ALL_UNITS: `${net >= 0 ? '+' : '−'}${Math.abs(net / 100).toFixed(1)}u`,
    ALL_NET: `${net >= 0 ? '+$' : '−$'}${Math.abs(net).toLocaleString('en-US')}`,
    ALL_PICKS: String(picks),
    SINCE: d(rows[0][0]), THROUGH: d(rows[rows.length - 1][0]),
    SPARK: pts, SPARK_AREA: `0,${H} ${pts} ${W},${H}`,
  };
}
Object.assign(SITE, allTime());

// Results page: day-by-day table and pick-by-pick detail from data/daily.csv + data/picks.csv.
function record() {
  const csv = (t) => t.trim().split(/\r?\n/).map((l) => { const out = []; let cur = '', q = false;
    for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; }
    out.push(cur); return out; });
  const esc = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const money = (n) => (n >= 0 ? '+$' : '−$') + Math.abs(n).toLocaleString('en-US');
  const day = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: '2-digit', day: '2-digit', timeZone: 'UTC' }).replace(',', '');
  const days = csv(DAILY).slice(1).map(([date, w, l, p, net]) => ({ date, w: +w, l: +l, p: +p, net: +net })).sort((a, b) => a.date.localeCompare(b.date));
  const [hdr, ...pr] = csv(read('data/picks.csv'));
  const picks = pr.map((r) => Object.fromEntries(hdr.map((h, i) => [h, r[i] || ''])));
  let run = 0;
  const dayRows = days.map((d) => {
    run += d.net; const n = d.w + d.l + d.p, won = d.net + 100 * d.l;
    return `<tr><td>${day(d.date)}</td><td class="r">${n}</td><td>${d.w}-${d.l}${d.p ? '-' + d.p : ''}</td><td class="r">${Math.round((100 * d.w) / (d.w + d.l || 1))}%</td>` +
      `<td class="r">$${won.toLocaleString('en-US')}</td><td class="r">$${(100 * d.l).toLocaleString('en-US')}</td><td class="r ${d.net >= 0 ? 'w' : 'l'}">${money(d.net)}</td>` +
      `<td class="r">${d.net >= 0 ? '+' : '−'}${Math.abs((100 * d.net) / (n * 100)).toFixed(1)}%</td><td class="r">${money(run)}</td></tr>`;
  }).reverse().join('\n');
  const detail = [...days].reverse().map((d) => {
    const ps = picks.filter((p) => p.date === d.date);
    const body = ps.length ? `<div class="tbl"><table class="picks"><thead><tr><th>Time (PT)</th><th>Sport</th><th>Game</th><th>Pick</th><th class="r">Price</th><th>Result</th><th class="r">$</th></tr></thead><tbody>` +
      ps.map((p) => `<tr><td>${esc(p.time)}</td><td>${esc(p.sport)}</td><td class="game">${esc(p.game)}</td><td class="pk">${esc(p.pick)}</td><td class="r">${esc(p.price)}</td>` +
        `<td class="${p.result === 'W' ? 'w' : p.result === 'L' ? 'l' : 'p'}">${p.result === 'W' ? 'Win' : p.result === 'L' ? 'Loss' : esc(p.result || 'Pending')}</td><td class="r ${p.pl.startsWith('-') ? 'l' : 'w'}">${esc(p.pl.replace('-', '−'))}</td></tr>`).join('') +
      '</tbody></table></div>' : '<p class="empty">Pick-by-pick detail for this day is being added.</p>';
    return `<details${d === days[days.length - 1] ? ' open' : ''}><summary><span>${day(d.date)}</span><span>${d.w}-${d.l}</span><span class="${d.net >= 0 ? 'pos' : 'neg'}">${money(d.net)}</span></summary>${body}</details>`;
  }).join('\n');
  return { RECORD_DAYS: dayRows, RECORD_PICKS: detail, RECORD_NDAYS: String(days.length) };
}
Object.assign(SITE, record());

// Public results page: big running-profit chart, record by sport, best/worst day. Pick detail stays on the members page.
function results() {
  const days = DAILY.trim().split('\n').slice(1).map((l) => { const [date, w, lo, p, net] = l.split(','); return { date, w: +w, l: +lo, p: +p, net: +net }; });
  const money = (n) => (n >= 0 ? '+$' : '−$') + Math.abs(n).toLocaleString('en-US');
  const md = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', timeZone: 'UTC' });
  // chart
  let run = 0; const pts = [{ x: 0, y: 0, label: 'Start' }, ...days.map((d, i) => ({ x: i + 1, y: (run += d.net), label: md(d.date) }))];
  const W = 800, H = 260, L = 64, R = 30, T = 16, B = 34;
  const lo = Math.min(0, ...pts.map((p) => p.y)), hiRaw = Math.max(...pts.map((p) => p.y));
  const step = hiRaw > 2000 ? 1000 : 500, hi = Math.ceil(hiRaw / step) * step || step;
  const X = (x) => L + (x * (W - L - R)) / (pts.length - 1), Y = (y) => T + ((hi - y) * (H - T - B)) / (hi - lo || 1);
  let grid = '';
  for (let v = Math.floor(lo / step) * step; v <= hi; v += step) grid += `<line class="g" x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="ya" x="${L - 10}" y="${(Y(v) + 4).toFixed(1)}">${v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString('en-US')}</text>`;
  const line = pts.map((p) => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
  const area = `${X(0)},${Y(Math.max(lo, 0)).toFixed(1)} ${line} ${X(pts.length - 1).toFixed(1)},${Y(Math.max(lo, 0)).toFixed(1)}`;
  const dots = pts.slice(1).map((p) => `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="4"><title>${p.label}: ${money(p.y)}</title></circle><text class="xa" x="${X(p.x).toFixed(1)}" y="${H - 10}">${p.label}</text>`).join('');
  const chart = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Running profit by day, ending at ${money(run)}">${grid}<polygon class="area" points="${area}"/><polyline class="lineP" points="${line}"/>${dots}</svg>`;
  // by sport, from graded picks
  const csvRows = read('data/picks.csv').trim().split(/\r?\n/); const hdr = csvRows[0].split(',');
  const split = (l) => { const c = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { c.push(cur); cur = ''; } else cur += ch; } c.push(cur); return c; };
  const picks = csvRows.slice(1).map((l) => Object.fromEntries(hdr.map((h, i) => [h, split(l)[i] || ''])));
  const by = new Map();
  for (const p of picks) {
    const t = by.get(p.sport) || { w: 0, l: 0, p: 0, net: 0 }; const r = p.result.toUpperCase();
    if (r === 'W') t.w++; else if (r === 'L') t.l++; else if (r === 'P') t.p++; else continue;
    t.net += Number(p.pl.replace(/[$,+\s]/g, '').replace('−', '-')) || 0; by.set(p.sport, t);
  }
  const sportRows = [...by].sort((a, b) => (b[1].w + b[1].l) - (a[1].w + a[1].l)).map(([s, t]) => {
    const n = t.w + t.l + t.p;
    return `<tr><td>${s}</td><td class="r">${n}</td><td>${t.w}-${t.l}${t.p ? '-' + t.p : ''}</td><td class="r">${Math.round((100 * t.w) / (t.w + t.l || 1))}%</td><td class="r ${t.net >= 0 ? 'w' : 'l'}">${money(Math.round(t.net))}</td><td class="r">${t.net >= 0 ? '+' : '−'}${Math.abs(t.net / n).toFixed(1)}%</td></tr>`;
  }).join('\n');
  const best = days.reduce((a, b) => (b.net > a.net ? b : a)), worst = days.reduce((a, b) => (b.net < a.net ? b : a));
  const green = days.filter((d) => d.net > 0).length;
  return {
    RES_CHART: chart, RES_SPORTS: sportRows, RES_SPORT_N: String(picks.length),
    RES_BEST: `${md(best.date)} · ${best.w}-${best.l} · ${money(best.net)}`, RES_WORST: `${md(worst.date)} · ${worst.w}-${worst.l} · ${money(worst.net)}`,
    RES_GREEN: `${green} of ${days.length}`,
  };
}
Object.assign(SITE, results());


const head = read('src/partials/head.html');
const header = read('src/partials/header.html');
const footer = read('src/partials/footer.html');

function build(outDir, { bodyOnlyIndex }) {
  fs.rmSync(path.join(root, outDir), { recursive: true, force: true });
  fs.mkdirSync(path.join(root, outDir, 'assets'), { recursive: true });
  for (const f of fs.readdirSync(path.join(root, 'src/assets'))) {
    fs.copyFileSync(path.join(root, 'src/assets', f), path.join(root, outDir, 'assets', f));
  }

  for (const file of fs.readdirSync(path.join(root, 'src/pages'))) {
    let src = read(path.join('src/pages', file));
    const meta = src.match(/^<!--\s*title:\s*(.*?)\s*\|\s*description:\s*(.*?)\s*-->\n?/);
    if (!meta) throw new Error(`${file}: missing title/description comment`);
    src = src.slice(meta[0].length);
    const vars = { ...SITE, TITLE: meta[1], DESCRIPTION: meta[2], PAGE: file.replace('.html', '') };
    const inner = fill(header + src + footer, vars);
    let headHtml = fill(head, vars);
    // Members-only pages are kept out of search engines; they're reached from the confirmation email.
    if (file.startsWith('members-') || file === 'thank-you.html' || file === 'welcome.html') headHtml = headHtml.replace('</title>', '</title>\n<meta name="robots" content="noindex, nofollow">');
    // The claude.ai preview wraps its main page in its own skeleton, so that one page ships without <html>/<head>.
    const html = bodyOnlyIndex && file === 'index.html'
      ? headHtml.replace(/<!doctype html>|<\/?html[^>]*>|<\/?head>|<meta charset[^>]*>|<meta name="viewport"[^>]*>/gi, '') + inner
      : `${headHtml}<body>\n${inner}</body>\n</html>\n`;
    fs.writeFileSync(path.join(root, outDir, file), html);
  }
  console.log(`built ${outDir}/`);
}

build('dist', { bodyOnlyIndex: false });
if (preview) build('preview', { bodyOnlyIndex: true });
