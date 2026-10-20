// Sisi Cordova (tampilan). Berkomunikasi dengan Node.js lewat nodejs.channel.
document.addEventListener('deviceready', onDeviceReady, false);

const $ = (id) => document.getElementById(id);

function log(text) {
  const t = new Date().toLocaleTimeString('id-ID');
  $('log').textContent += `[${t}] ${text}\n`;
  $('log').scrollTop = $('log').scrollHeight;
}

function setStatus(text, kind) {
  const el = $('status');
  el.textContent = text;
  el.className = 'pill ' + (kind || 'wait');
}

function renderInfo(info) {
  const rows = [
    ['Versi Node.js', info.node],
    ['Versi nodejs-mobile', info.mobile || '-'],
    ['Platform', `${info.platform} (${info.arch})`],
    ['Aktif sejak', `${info.uptime} detik`],
    ['Folder data', info.dataDir || '-'],
  ];
  $('info').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');

  // Baileys (library WhatsApp) membutuhkan Node.js 20 atau lebih baru.
  const major = parseInt(String(info.node).replace(/^v/, ''), 10);
  const warn = $('warn');
  if (!Number.isNaN(major) && major < 20) {
    warn.hidden = false;
    warn.textContent = `Node.js di aplikasi ini versi ${info.node}. Baileys membutuhkan Node.js 20 atau lebih baru, jadi bot belum bisa dijalankan dengan mesin ini. Cek versi plugin nodejs-mobile yang dipakai.`;
  } else {
    warn.hidden = true;
  }
}

function onNodeMessage(raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch { log('Node: ' + raw); return; }
  switch (msg.type) {
    case 'ready':
      setStatus('Mesin Node.js berjalan', 'ok');
      log('Node.js siap: ' + msg.node);
      break;
    case 'info':
      renderInfo(msg);
      break;
    case 'pong':
      log(`Pong dari Node.js (${msg.ms} ms sejak dikirim)`);
      break;
    case 'error':
      setStatus('Error di Node.js', 'bad');
      log('ERROR: ' + msg.message);
      break;
    default:
      log('Node: ' + raw);
  }
}

const send = (obj) => nodejs.channel.send(JSON.stringify(obj));

function onDeviceReady() {
  setStatus('Memulai mesin Node.js...', 'wait');
  nodejs.channel.setListener(onNodeMessage);
  nodejs.start('main.js', (err) => {
    if (err) {
      setStatus('Gagal memulai Node.js', 'bad');
      log('Gagal memulai: ' + err);
      return;
    }
    log('Perintah start terkirim.');
    send({ cmd: 'info' });
  });

  $('btnPing').addEventListener('click', () => send({ cmd: 'ping', t: Date.now() }));
  $('btnInfo').addEventListener('click', () => send({ cmd: 'info' }));
}
