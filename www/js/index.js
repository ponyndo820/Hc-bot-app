document.addEventListener('deviceready', onDeviceReady, false);

const $ = (id) => document.getElementById(id);

function log(text) {
  const el = $('log');
  if (!el) return;
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  const t = new Date().toLocaleTimeString('id-ID');
  el.textContent += `[${t}] ${text}\n`;
  const lines = el.textContent.split('\n');
  if (lines.length > 501) el.textContent = lines.slice(-501).join('\n');
  if (atBottom) el.scrollTop = el.scrollHeight;
}

function setStatus(text, kind) {
  const el = $('status');
  if (!el) return;
  el.textContent = text;
  el.className = 'pill ' + (kind || 'wait');
}

function renderInfo(info) {
  if (typeof info.uptime === 'number') window.__startedAt = Date.now() - info.uptime * 1000;
  const el = $('info');
  if (!el) return;
  const rows = [
    ['Versi Node.js', info.node],
    ['Versi nodejs-mobile', info.mobile || '-'],
    ['Platform', `${info.platform} (${info.arch})`],
    ['Aktif sejak', `${info.uptime} detik`],
    ['Folder data', info.dataDir || '-'],
  ];
  el.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  const major = parseInt(String(info.node || '').replace(/^v/, ''), 10);
  const warn = $('warn');
  if (!warn) return;
  if (!Number.isNaN(major) && major < 18) {
    warn.hidden = false;
    warn.textContent =
      `Node.js di aplikasi ini versi ${info.node}. Bot membutuhkan Node.js 18 atau lebih baru.`;
  } else {
    warn.hidden = true;
  }
}

function onNodeMessage(raw) {
  let msg;
  try {
    msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    log('Node: ' + String(raw));
    return;
  }
  switch (msg.type) {
    case 'ready':
      setStatus('Mesin Node.js berjalan', 'ok');
      log('Node.js siap: ' + msg.node);
      send({ cmd: 'info' });
      break;
    case 'info':
      if (msg.platform) renderInfo(msg);
      log('Info mesin dimuat.');
      break;
    case 'pong':
      log(`Pong dari Node.js (${msg.ms} ms sejak dikirim)`);
      break;
    case 'pairing': {
      const d = $('pairingCodeDisplay');
      if (msg.success) { if (d) d.innerText = msg.code; log('Kode pairing: ' + msg.code); }
      else { if (d) d.innerText = 'Gagal!'; log('Pairing gagal: ' + msg.message); alert(msg.message || 'Gagal membuat kode pairing.'); }
      break;
    }
    case 'log':
      log(msg.message);
      break;
    case 'error':
      setStatus('Error di Node.js', 'bad');
      log('ERROR: ' + msg.message);
      break;
    default:
      log('Node: ' + JSON.stringify(msg));
  }
}

function send(obj) {
  try {
    if (typeof nodejs !== 'undefined' && nodejs.channel) {
      nodejs.channel.send(JSON.stringify(obj));
    }
  } catch (e) {
    log('Gagal kirim ke Node: ' + e);
  }
}

function onDeviceReady() {
  setStatus('Memulai mesin Node.js...', 'wait');
  log('deviceready');
  try {
    const fs = cordova.plugins && cordova.plugins.foregroundService;
    if (fs) {
      fs.start('Hc Bot App', 'Bot WhatsApp berjalan di latar belakang');
      if (typeof fs.getWakeLock === 'function') fs.getWakeLock();
      log('Foreground service aktif');
    } else {
      log('Foreground service tidak tersedia');
    }
  } catch (e) {
    log('Foreground service error: ' + e);
  }
  if (typeof nodejs === 'undefined') {
    setStatus('Plugin nodejs-mobile tidak ada', 'bad');
    log('ERROR: objek nodejs tidak ditemukan. Plugin mungkin gagal di-link.');
    return;
  }
  try {
    nodejs.channel.setListener(onNodeMessage);
  } catch (e) {
    log('setListener error: ' + e);
  }
  nodejs.start('main.js', (err) => {
    if (err) {

      if (String(err).indexOf('already started') !== -1) {
        setStatus('Mesin Node.js berjalan', 'ok');
        log('Mesin Node.js sudah berjalan di latar belakang, tersambung kembali.');
        send({ cmd: 'info' });
        setTimeout(() => send({ cmd: 'info' }), 800);
        return;
      }
      setStatus('Gagal memulai Node.js', 'bad');
      log('Gagal memulai: ' + err);
      return;
    }
    log('Perintah start terkirim.');
    setTimeout(() => send({ cmd: 'info' }), 800);
  });

  const btnPing = $('btnPing');
  const btnInfo = $('btnInfo');
  if (btnPing) btnPing.addEventListener('click', () => send({ cmd: 'ping', t: Date.now() }));
  if (btnInfo) btnInfo.addEventListener('click', () => send({ cmd: 'info' }));
}

document.addEventListener('DOMContentLoaded', () => {
    const getPairBtn = $('getPairBtn');
    if (getPairBtn) {
        getPairBtn.addEventListener('click', async () => {
            const phone = ($('phoneNumber') || {}).value || '';
            const container = $('pairingContainer');
            const display = $('pairingCodeDisplay');
            
            if (!phone || phone.trim().length < 10) {
                alert('Masukkan nomor WhatsApp yang valid (contoh: 62858xxxxxxxx)');
                return;
            }
            
            if (display) display.innerText = 'Memuat...';
            if (container) container.style.display = 'block';
            
            send({ cmd: 'pair', number: phone.trim().replace(/[^0-9]/g, '') });
        });
    }
});
