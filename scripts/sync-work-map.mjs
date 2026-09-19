import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../public/work-map/', import.meta.url);
const snapshot = JSON.parse(readFileSync(new URL('status.json', root), 'utf8').replace(/^\uFEFF/, ''));
const escape = value => String(value ?? '—').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
if (!Array.isArray(snapshot.tasks) || !Number.isInteger(snapshot.tests) || !Number.isFinite(Date.parse(snapshot.updatedAt))) throw Error('Invalid work-map snapshot');
const rows = snapshot.tasks.map(t => `<tr>${[t.id,t.title,t.status,t.owner,t.completedAt].map(v => `<td>${escape(v)}</td>`).join('')}</tr>`).join('');
const fallback = `<noscript>
<p>JavaScript is off — here is the published snapshot as a static table. You can also <a href="status.json">download status.json</a>.</p>
<table border="1" cellpadding="6" style="border-collapse:collapse;width:100%;font:14px/1.4 system-ui,sans-serif">
<thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Owner</th><th>Completed</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<p>Release: ${escape(snapshot.release)}. Published: ${escape(snapshot.updatedAt)} (intentional publish, not page-load time). Tests: ${snapshot.tests}.</p>
</noscript>`;
const path = new URL('index.html', root);
const html = readFileSync(path, 'utf8');
if ((html.match(/<noscript>/g) ?? []).length !== 1) throw Error('Expected one work-map fallback');
const next = html.replace(/<noscript>[\s\S]*?<\/noscript>/, fallback).replace(/(<span id="test-count">)\d+(<\/span>)/, `$1${snapshot.tests}$2`);
if (process.argv.includes('--check')) {
  if (next !== html) throw Error('Work-map fallback is stale; run npm run sync:work-map');
} else if (next !== html) writeFileSync(path, next);
console.log(`Work-map fallback matches ${snapshot.tasks.length} tasks and ${snapshot.tests} checks.`);
