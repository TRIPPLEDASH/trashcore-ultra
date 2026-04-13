// ============================================================
//  ULTRA X PROJECT — by TrashX
//  dashboard.js  |  Live stats HTTP dashboard
// ============================================================

const http = require('http');
const path = require('path');
const fs   = require('fs');

// ─── In-memory stats store (written to by index.js) ─────────
const stats = {
  status:        'starting',   // 'starting' | 'online' | 'offline' | 'reconnecting'
  botNumber:     null,
  groupCount:    0,
  chatCount:     0,
  pluginCount:   0,
  prefix:        '.',
  messagesIn:    0,
  commandsRan:   0,
  deployedAt:    Date.now(),   // persisted below
  connectedAt:   null,
  processStart:  global.botStartTime || Date.now(),
};

// Persist deployedAt across restarts via a tiny JSON file
const DEPLOY_FILE = path.join(__dirname, '.deploy_ts');
function loadDeployTs() {
  try {
    if (fs.existsSync(DEPLOY_FILE)) {
      const raw = fs.readFileSync(DEPLOY_FILE, 'utf8').trim();
      const ts  = parseInt(raw, 10);
      if (!isNaN(ts)) return ts;
    }
  } catch {}
  return null;
}
function saveDeployTs(ts) {
  try { fs.writeFileSync(DEPLOY_FILE, String(ts), 'utf8'); } catch {}
}

const savedTs = loadDeployTs();
if (savedTs) {
  stats.deployedAt = savedTs;
} else {
  saveDeployTs(stats.deployedAt);
}

// ─── Public API ──────────────────────────────────────────────
function updateStats(patch) {
  Object.assign(stats, patch);
}

function incrementMessages() { stats.messagesIn++; }
function incrementCommands()  { stats.commandsRan++; }

function getStats() {
  const now = Date.now();
  return {
    ...stats,
    uptimeMs:       now - stats.processStart,
    connectedForMs: stats.connectedAt ? now - stats.connectedAt : 0,
    serverTime:     new Date().toISOString(),
  };
}

// ─── Dashboard HTML ──────────────────────────────────────────
const DASHBOARD_HTML = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>ULTRA X · TrashX Dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@400;600;700&family=Orbitron:wght@700;900&display=swap" rel="stylesheet"/>
<style>
  :root {
    --bg:       #0a0b0f;
    --panel:    #10121a;
    --border:   #1e2235;
    --accent1:  #00ffe0;
    --accent2:  #bd93f9;
    --accent3:  #ff6ac1;
    --green:    #50fa7b;
    --yellow:   #ffdd57;
    --orange:   #ffb86c;
    --red:      #ff5555;
    --dim:      #44475a;
    --text:     #cdd6f4;
    --muted:    #6272a4;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Rajdhani', sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* ── Grid noise texture overlay ── */
  body::before {
    content: '';
    position: fixed; inset: 0;
    background-image:
      repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(0,255,224,.03) 40px),
      repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(0,255,224,.03) 40px);
    pointer-events: none; z-index: 0;
  }

  .wrap {
    position: relative; z-index: 1;
    max-width: 1100px;
    margin: 0 auto;
    padding: 32px 20px 60px;
  }

  /* ── Header ── */
  header {
    display: flex; align-items: center; gap: 18px;
    margin-bottom: 36px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 24px;
  }
  .logo-box {
    width: 52px; height: 52px;
    border: 2px solid var(--accent1);
    display: grid; place-items: center;
    font-family: 'Orbitron', sans-serif;
    font-size: 18px; color: var(--accent1);
    box-shadow: 0 0 18px rgba(0,255,224,.25);
  }
  .logo-text h1 {
    font-family: 'Orbitron', sans-serif;
    font-size: clamp(18px, 4vw, 26px);
    font-weight: 900; color: var(--accent1);
    letter-spacing: 2px;
    text-shadow: 0 0 18px rgba(0,255,224,.4);
  }
  .logo-text p {
    font-family: 'Share Tech Mono', monospace;
    font-size: 11px; color: var(--muted);
    letter-spacing: 3px; margin-top: 2px;
  }
  .header-right {
    margin-left: auto; text-align: right;
  }
  #status-badge {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 6px 16px;
    border: 1px solid var(--border);
    font-family: 'Share Tech Mono', monospace;
    font-size: 12px; letter-spacing: 1px;
    text-transform: uppercase;
    transition: all .4s;
  }
  #status-badge .dot {
    width: 8px; height: 8px; border-radius: 50%;
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0%,100% { opacity:1; } 50% { opacity:.3; }
  }
  .badge-online  { color: var(--green);  border-color: var(--green);  background: rgba(80,250,123,.06); }
  .badge-online  .dot { background: var(--green); }
  .badge-offline { color: var(--red);    border-color: var(--red);    background: rgba(255,85,85,.06); }
  .badge-offline .dot { background: var(--red); }
  .badge-reconnecting { color: var(--yellow); border-color: var(--yellow); background: rgba(255,221,87,.06); }
  .badge-reconnecting .dot { background: var(--yellow); }
  .badge-starting { color: var(--muted); border-color: var(--dim); }
  .badge-starting .dot { background: var(--muted); }

  #last-ping {
    font-family: 'Share Tech Mono', monospace;
    font-size: 10px; color: var(--dim);
    margin-top: 6px;
  }

  /* ── Stats grid ── */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }

  .card {
    background: var(--panel);
    border: 1px solid var(--border);
    padding: 20px 22px;
    position: relative;
    overflow: hidden;
    transition: border-color .3s, box-shadow .3s;
  }
  .card:hover {
    border-color: var(--accent2);
    box-shadow: 0 0 20px rgba(189,147,249,.1);
  }
  .card::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: var(--card-accent, var(--accent2));
    opacity: .8;
  }
  .card-label {
    font-family: 'Share Tech Mono', monospace;
    font-size: 10px; letter-spacing: 3px;
    color: var(--muted); text-transform: uppercase;
    margin-bottom: 10px;
  }
  .card-value {
    font-family: 'Orbitron', sans-serif;
    font-size: clamp(20px, 3vw, 28px);
    font-weight: 700;
    color: var(--card-accent, var(--accent1));
    line-height: 1;
    word-break: break-all;
  }
  .card-sub {
    font-family: 'Share Tech Mono', monospace;
    font-size: 10px; color: var(--dim);
    margin-top: 8px;
  }

  /* color variants */
  .c1 { --card-accent: var(--accent1); }
  .c2 { --card-accent: var(--accent2); }
  .c3 { --card-accent: var(--accent3); }
  .c4 { --card-accent: var(--green); }
  .c5 { --card-accent: var(--yellow); }
  .c6 { --card-accent: var(--orange); }

  /* ── Wide uptime bar ── */
  .wide-card {
    background: var(--panel);
    border: 1px solid var(--border);
    padding: 20px 26px;
    display: flex; align-items: center; gap: 24px;
    flex-wrap: wrap;
    margin-bottom: 24px;
    position: relative; overflow: hidden;
  }
  .wide-card::before {
    content: ''; position: absolute;
    top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, var(--accent1), var(--accent2), var(--accent3));
  }
  .uptime-label {
    font-family: 'Share Tech Mono', monospace;
    font-size: 10px; letter-spacing: 3px;
    color: var(--muted); text-transform: uppercase;
    margin-bottom: 6px;
  }
  .uptime-value {
    font-family: 'Orbitron', sans-serif;
    font-size: clamp(22px, 4vw, 36px);
    font-weight: 900;
    background: linear-gradient(90deg, var(--accent1), var(--accent2));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }
  .uptime-group { margin-right: 32px; }

  /* ── Deployed section ── */
  .section-title {
    font-family: 'Share Tech Mono', monospace;
    font-size: 10px; letter-spacing: 4px;
    color: var(--dim); text-transform: uppercase;
    margin-bottom: 14px;
    display: flex; align-items: center; gap: 10px;
  }
  .section-title::after {
    content: ''; flex: 1; height: 1px;
    background: var(--border);
  }

  /* ── Pulsing online glow ── */
  @keyframes glow {
    0%,100% { box-shadow: 0 0 8px rgba(80,250,123,.2); }
    50%      { box-shadow: 0 0 24px rgba(80,250,123,.5); }
  }
  .online-glow { animation: glow 3s infinite; }

  /* ── Footer ── */
  footer {
    margin-top: 48px;
    border-top: 1px solid var(--border);
    padding-top: 18px;
    font-family: 'Share Tech Mono', monospace;
    font-size: 10px; color: var(--dim);
    letter-spacing: 2px; text-align: center;
  }

  @media (max-width: 500px) {
    .grid { grid-template-columns: 1fr 1fr; }
    .wide-card { flex-direction: column; align-items: flex-start; }
  }
</style>
</head>
<body>
<div class="wrap">

  <!-- Header -->
  <header>
    <div class="logo-box">UX</div>
    <div class="logo-text">
      <h1>ULTRA X</h1>
      <p>TRASHX · LIVE DASHBOARD</p>
    </div>
    <div class="header-right">
      <div id="status-badge" class="badge-starting">
        <span class="dot"></span>
        <span id="status-text">LOADING</span>
      </div>
      <div id="last-ping">—</div>
    </div>
  </header>

  <!-- Uptime bar -->
  <div class="section-title">UPTIME</div>
  <div class="wide-card" id="uptime-card">
    <div class="uptime-group">
      <div class="uptime-label">PROCESS UPTIME</div>
      <div class="uptime-value" id="process-uptime">—</div>
    </div>
    <div class="uptime-group">
      <div class="uptime-label">CONNECTED FOR</div>
      <div class="uptime-value" id="connected-uptime" style="font-size:clamp(16px,2.5vw,24px);opacity:.7">—</div>
    </div>
  </div>

  <!-- Deploy info -->
  <div class="section-title">DEPLOYMENT</div>
  <div class="grid" style="margin-bottom:24px">
    <div class="card c5">
      <div class="card-label">First Deployed</div>
      <div class="card-value" id="deployed-date" style="font-size:14px;word-break:break-word">—</div>
      <div class="card-sub" id="deployed-ago">—</div>
    </div>
    <div class="card c6">
      <div class="card-label">Last Connected</div>
      <div class="card-value" id="connected-date" style="font-size:14px;word-break:break-word">—</div>
      <div class="card-sub" id="connected-ago">—</div>
    </div>
    <div class="card c1">
      <div class="card-label">Bot Number</div>
      <div class="card-value" id="bot-number" style="font-size:13px">—</div>
    </div>
    <div class="card c2">
      <div class="card-label">Prefix</div>
      <div class="card-value" id="prefix">—</div>
    </div>
  </div>

  <!-- Live counters -->
  <div class="section-title">LIVE STATS</div>
  <div class="grid">
    <div class="card c4">
      <div class="card-label">Groups</div>
      <div class="card-value" id="groups">—</div>
    </div>
    <div class="card c2">
      <div class="card-label">Chats</div>
      <div class="card-value" id="chats">—</div>
    </div>
    <div class="card c3">
      <div class="card-label">Plugins Loaded</div>
      <div class="card-value" id="plugins">—</div>
    </div>
    <div class="card c1">
      <div class="card-label">Messages In</div>
      <div class="card-value" id="messages">—</div>
    </div>
    <div class="card c6">
      <div class="card-label">Commands Ran</div>
      <div class="card-value" id="commands">—</div>
    </div>
  </div>

  <footer>TRASHCORE ULTRA X &nbsp;·&nbsp; by TrashX &nbsp;·&nbsp; AUTO-REFRESHES EVERY 5s</footer>
</div>

<script>
  function fmt(ms) {
    if (!ms || ms <= 0) return '—';
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
    if (h > 0) return h + 'h ' + m + 'm ' + sec + 's';
    return m + 'm ' + sec + 's';
  }

  function fmtDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
      + ' · ' + d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
  }

  function ago(ts) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    return fmt(diff) + ' ago';
  }

  function set(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  async function fetchStats() {
    try {
      const res  = await fetch('/api/stats');
      const data = await res.json();

      // Status badge
      const badge = document.getElementById('status-badge');
      const stText = document.getElementById('status-text');
      badge.className = 'badge-' + data.status;
      stText.textContent = data.status.toUpperCase();

      // Uptime
      set('process-uptime', fmt(data.uptimeMs));
      set('connected-uptime', data.connectedForMs > 0 ? fmt(data.connectedForMs) : 'Not connected');

      // Deploy info
      set('deployed-date', fmtDate(data.deployedAt));
      set('deployed-ago',  ago(data.deployedAt));
      set('connected-date', data.connectedAt ? fmtDate(data.connectedAt) : 'Never');
      set('connected-ago',  data.connectedAt ? ago(data.connectedAt) : '');
      set('bot-number', data.botNumber ? '+' + data.botNumber : 'Waiting...');
      set('prefix', data.prefix || '.');

      // Live stats
      set('groups',   data.groupCount);
      set('chats',    data.chatCount);
      set('plugins',  data.pluginCount);
      set('messages', data.messagesIn);
      set('commands', data.commandsRan);

      // Last ping
      set('last-ping', 'LAST PING · ' + new Date().toLocaleTimeString('en-GB'));

      // Online glow
      const uptimeCard = document.getElementById('uptime-card');
      if (data.status === 'online') uptimeCard.classList.add('online-glow');
      else uptimeCard.classList.remove('online-glow');

    } catch (e) {
      document.getElementById('status-badge').className = 'badge-offline';
      document.getElementById('status-text').textContent = 'OFFLINE';
    }
  }

  fetchStats();
  setInterval(fetchStats, 5000);
</script>
</body>
</html>`;

// ─── HTTP server ─────────────────────────────────────────────
function startDashboard(port) {
  port = port || process.env.PORT || 3000;

  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];

    if (url === '/api/stats') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      });
      return res.end(JSON.stringify(getStats()));
    }

    if (url === '/' || url === '/dashboard') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(DASHBOARD_HTML);
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(port, () => {
    console.log(`\x1b[36m»  [DASHBOARD] Live at http://localhost:${port}\x1b[0m`);
  });

  return server;
}

module.exports = { startDashboard, updateStats, incrementMessages, incrementCommands };
