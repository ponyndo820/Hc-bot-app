// Cordova side. Talks to Node.js via nodejs.channel.
document.addEventListener('deviceready', onDeviceReady, false);

const $ = (id) => document.getElementById(id);

function log(text) {
  const el = $('log');
  if (!el) return;
  const t = new Date().toLocaleTimeString('id-ID');
  el.textContent += `[${t}] ${text}\n`;
  el.scrollTop = el.scrollHeight;
}

function setStatus(text, kind) {
  const el = $('status');
  if (!el) return;
  el.textContent = text;
  el.className = 'pill ' + (kind || 'wait');
}

function renderInfo(info) {
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
      renderInfo(msg);
      log('Info mesin dimuat.');
      break;
    case 'pong':
      log(`Pong dari Node.js (${msg.ms} ms sejak dikirim)`);
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

// Event listener untuk tombol Pairing (M2)
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
            
            try {
                const response = await fetch(`http://localhost:3000/pair?number=${phone.trim()}`);
                const data = await response.json();
                
                if (data.success) {
                    if (display) display.innerText = data.code;
                } else {
                    if (display) display.innerText = 'Gagal!';
                    alert(data.message || 'Terjadi kesalahan saat mengambil kode pairing.');
                }
            } catch (err) {
                console.error(err);
                if (display) display.innerText = 'Error!';
                alert('Gagal terhubung ke server Node.js di dalam aplikasi.');
            }
        });
    }
});
