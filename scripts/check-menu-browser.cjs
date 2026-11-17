// Run the built app in headless Edge and verify actual visibility and settings access.
const http = require('node:http')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { spawn } = require('node:child_process')
const browser = process.argv[2] || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const dist = path.resolve(__dirname, '../dist')
const harness = `<!doctype html><style>iframe{width:1100px;height:800px;border:0}</style><iframe src="/"></iframe><pre id="report">Running</pre><script>
const frame = document.querySelector('iframe'), results = [];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function check(condition, message) { if (!condition) throw Error(message); results.push(message); }
function hit(w, el) { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && el.contains(w.document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }
frame.onload = async () => {
 try {
  const w = frame.contentWindow, d = w.document;
  await wait(800);
  const menu = d.getElementById('background-toggle');
  check(!!d.getElementById('shared-toolbar'), 'Original balloons toolbar mounted globally');
  for (const view of ['balloons', 'sketchpad', 'matching', 'puzzle']) {
   w.location.hash = '/' + view; await wait(250);
   check(hit(w, menu), view + ': menu is visible and receives pointer input');
   menu.click();
   const cooldown = d.querySelector('[data-settings="cooldown"]');
   check(hit(w, cooldown), view + ': cooldown settings visible in menu');
   cooldown.click();
   const dialog = d.querySelector('.play-settings[open]');
   check(!!dialog, view + ': cooldown opens existing timer dialog');
   const field = dialog.querySelector('[name="cooldown"]');
   check(d.activeElement === field, view + ': cooldown duration focused');
   check(!!dialog.querySelector('[name="cooldownApp"]'), view + ': cooldown activity available');
   field.value = '3'; dialog.querySelector('[name="cooldownApp"]').value = 'puzzle';
   dialog.querySelector('form').requestSubmit();
   const saved = JSON.parse(w.localStorage.getItem('balloons.play.settings'));
   check(saved.cooldown === 3 && saved.cooldownApp === 'puzzle', view + ': cooldown duration and activity persist');
   for (const section of ['activity', 'screensaver', 'balloon', 'puzzle']) {
    menu.click(); d.querySelector('[data-settings="' + section + '"]').click();
    await wait(80);
    const roots = [d, ...[...d.body.children].filter(el => el.shadowRoot).map(el => el.shadowRoot)];
    const opened = roots.map(root => root.querySelector('dialog[open]')).find(Boolean);
    check(!!opened, view + ': ' + section + ' settings open');
    if (section === 'balloon') check(!opened.querySelector('#balloon-settings-panel').hidden, view + ': generation settings visible');
    if (section === 'puzzle') check(!opened.querySelector('#puzzle-settings-panel').hidden, view + ': puzzle settings visible');
    opened.close();
   }
  }
  d.getElementById('exit-simple-mode').click();
  const toggle = d.getElementById('exit-simple-mode');
  check(hit(w, toggle), 'Collapsed menu toggle remains visible on puzzle screen');
  toggle.click(); check(hit(w, menu), 'Menu expands on puzzle screen');
  document.getElementById('report').textContent = JSON.stringify({ passed: results.length, results });
 } catch (error) { document.getElementById('report').textContent = JSON.stringify({ error: error.message, results }); }
};
</script>`
;(async () => {
 const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'balloons-menu-browser-'))
 const server = http.createServer(async (req, res) => {
  try {
   if (req.url === '/menu-check') { res.setHeader('Content-Type', 'text/html'); return res.end(harness) }
   const pathname = new URL(req.url, 'http://localhost').pathname
   const target = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname))
   if (!target.startsWith(dist + path.sep)) { res.writeHead(403); return res.end() }
   const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.webp': 'image/webp' }
   res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream')
   res.end(await fs.readFile(target))
  } catch { res.writeHead(404); res.end() }
 })
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
 const address = 'http://127.0.0.1:' + server.address().port + '/menu-check'
 const child = spawn(browser, ['--headless', '--disable-gpu', '--no-first-run', '--disable-extensions', '--disable-background-networking', '--disable-features=msEdgeSidebarV2', '--user-data-dir=' + profile, '--virtual-time-budget=15000', '--dump-dom', address], { windowsHide: true })
 let output = '', errors = ''
 child.stdout.on('data', chunk => output += chunk)
 child.stderr.on('data', chunk => errors += chunk)
 const timer = setTimeout(() => child.kill(), 45000)
 child.on('error', error => { errors += error.message })
 await new Promise(resolve => child.on('close', resolve))
 clearTimeout(timer); server.closeAllConnections(); server.close()
 const match = output.match(/<pre id="report">([^<]*)<\/pre>/)
 if (!match) { console.error(errors.slice(-2000)); process.exitCode = 1; return }
 const report = JSON.parse(match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&gt;', '>').replaceAll('&lt;', '<'))
 console.log(JSON.stringify(report, null, 2))
 if (report.error || !report.passed) process.exitCode = 1
})().catch(error => { console.error(error); process.exitCode = 1 })
