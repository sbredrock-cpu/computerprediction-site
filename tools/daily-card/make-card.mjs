#!/usr/bin/env node
// Makes the printable members' card for one day of plays.
//
//   node tools/daily-card/make-card.mjs today.csv            -> CP-Card-<date>-v1.pdf
//   node tools/daily-card/make-card.mjs today.csv --v 2      -> CP-Card-<date>-v2.pdf (after adding plays)
//
// Input CSV needs a header row with: date,time,sport,game,pick,price
// Any other columns (system, edge, notes...) are ignored on purpose, so they never reach members.
// Rows with a "new" column set to yes/y/1/true are marked NEW on the card.
// Output goes next to the CSV unless --out <folder> is given. Never commit the CSV or the card:
// today's plays are for paying members only.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : dflt;
};
const version = flag('--v', '1');
const outDirArg = flag('--out', null);
const htmlOnly = args.includes('--html') ? (args.splice(args.indexOf('--html'), 1), true) : false;
const csvPath = args[0];
if (!csvPath) {
  console.error('Usage: node make-card.mjs <plays.csv> [--v 2] [--out folder] [--html]');
  process.exit(1);
}

// Small CSV reader that handles quoted fields with commas.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => v.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some(v => v.trim() !== '')) rows.push(row);
  return rows;
}

const [header, ...body] = parseCsv(fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, ''));
const cols = header.map(h => h.trim().toLowerCase());
const need = ['date', 'time', 'sport', 'game', 'pick', 'price'];
const missing = need.filter(n => !cols.includes(n));
if (missing.length) {
  console.error(`The CSV is missing column(s): ${missing.join(', ')}`);
  process.exit(1);
}
const idx = Object.fromEntries(cols.map((c, i) => [c, i]));
const plays = body.map(r => ({
  date: (r[idx.date] || '').trim(),
  time: (r[idx.time] || '').trim(),
  sport: (r[idx.sport] || '').trim().toUpperCase(),
  game: (r[idx.game] || '').trim(),
  pick: (r[idx.pick] || '').trim(),
  price: (r[idx.price] || '').trim(),
  isNew: 'new' in idx && /^(y|yes|1|true)$/i.test((r[idx.new] || '').trim()),
})).filter(p => p.pick);

if (!plays.length) { console.error('No plays found in the CSV.'); process.exit(1); }
const date = plays[0].date;

const toMinutes = t => {
  const m = /^(\d{1,2}):(\d{2})\s*([AP]M)?/i.exec(t);
  if (!m) return 9999;
  let h = +m[1] % 12;
  if (m[3] && m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + +m[2];
};
plays.sort((a, b) => a.sport.localeCompare(b.sport) || toMinutes(a.time) - toMinutes(b.time) || a.game.localeCompare(b.game));

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const prettyDate = (() => {
  const d = new Date(date + 'T12:00:00');
  return isNaN(d) ? date : d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
})();
const stamp = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });

let logo = '';
const logoFile = path.join(here, '..', '..', 'src', 'assets', 'mark.png');
if (fs.existsSync(logoFile)) logo = `<img class="mark" alt="" src="data:image/png;base64,${fs.readFileSync(logoFile).toString('base64')}">`;

const bySport = {};
for (const p of plays) (bySport[p.sport] ||= []).push(p);

const sections = Object.entries(bySport).map(([sport, list]) => {
  let lastGame = '';
  const rows = list.map(p => {
    const showGame = p.game !== lastGame;
    lastGame = p.game;
    return `<tr class="${showGame ? 'first' : ''}">
      <td class="box">&#9744;</td>
      <td class="time">${showGame ? esc(p.time) : ''}</td>
      <td class="game">${showGame ? esc(p.game) : ''}</td>
      <td class="pick">${p.isNew ? '<b class="new">NEW</b> ' : ''}${esc(p.pick)}</td>
      <td class="price">${esc(p.price)}</td>
    </tr>`;
  }).join('');
  return `<section><h2>${esc(sport)} <span>${list.length} play${list.length === 1 ? '' : 's'}</span></h2>
  <table><thead><tr><th></th><th>Time</th><th>Game</th><th>Play</th><th>Price</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}).join('');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>CP Card ${esc(date)} v${esc(version)}</title>
<style>
  @page { size: letter; margin: 0.45in; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 10.5pt/1.3 "Segoe UI", Arial, sans-serif; color: #111; background: #fff; }
  header { display: flex; align-items: center; gap: 12px; border-bottom: 3px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
  .mark { width: 44px; height: 44px; }
  header h1 { margin: 0; font-size: 17pt; letter-spacing: .02em; }
  header p { margin: 2px 0 0; color: #444; font-size: 9.5pt; }
  .ver { margin-left: auto; text-align: right; font-size: 9.5pt; }
  .ver b { display: block; font-size: 13pt; }
  section { margin-top: 12px; }
  h2 { font-size: 12pt; margin: 0 0 4px; padding: 3px 6px; background: #111; color: #fff; break-after: avoid; }
  h2 span { font-weight: 400; font-size: 9.5pt; opacity: .8; margin-left: 6px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 8.5pt; color: #555; font-weight: 600; border-bottom: 1px solid #999; padding: 2px 5px; }
  td { padding: 3px 5px; vertical-align: top; }
  tr { break-inside: avoid; }
  tr.first td { border-top: 1px solid #ccc; }
  tbody tr:first-child td { border-top: 0; }
  .box { width: 18px; font-size: 11pt; color: #666; }
  .time { width: 62px; white-space: nowrap; }
  .game { width: 38%; }
  .pick { font-weight: 600; }
  .price { width: 52px; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .new { background: #111; color: #fff; font-size: 7.5pt; padding: 0 4px; border-radius: 2px; }
  footer { margin-top: 16px; border-top: 1px solid #999; padding-top: 6px; font-size: 8pt; color: #555; }
</style></head><body>
<header>${logo}<div><h1>COMPUTER PREDICTION &middot; MEMBERS' CARD</h1><p>${esc(prettyDate)} &middot; ${plays.length} plays</p></div>
<div class="ver"><b>v${esc(version)}</b>Updated ${esc(stamp)}</div></header>
${sections}
<footer>For paid members only. Please don't share or repost. Prices are what our models locked when selected; lines move, so check your book before betting. New plays during the day go to the members' Telegram first and a new card version follows. Bet responsibly. 21+. Problem gambling? Call 1-800-GAMBLER.</footer>
</body></html>`;

const outDir = outDirArg || path.dirname(path.resolve(csvPath));
const base = path.join(outDir, `CP-Card-${date}-v${version}`);
fs.writeFileSync(base + '.html', html);

if (htmlOnly) { console.log(`Card saved: ${base}.html`); process.exit(0); }

// Turn the HTML into a PDF with whatever Chrome-type browser is installed (Edge ships with Windows).
const candidates = [
  process.env.CARD_BROWSER,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);
const browser = candidates.find(p => fs.existsSync(p));
if (!browser) {
  console.log(`Card saved: ${base}.html (no Chrome or Edge found, so open it and use Print > Save as PDF)`);
  process.exit(0);
}
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-card-'));
execFileSync(browser, [
  '--headless', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer',
  `--user-data-dir=${profile}`, `--print-to-pdf=${base}.pdf`, 'file://' + path.resolve(base + '.html'),
], { stdio: 'ignore' });
fs.rmSync(profile, { recursive: true, force: true });
fs.rmSync(base + '.html');
console.log(`Card saved: ${base}.pdf`);
