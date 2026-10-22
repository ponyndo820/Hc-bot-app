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

  const major = parseInt(String(info.node).replace(/^v/, ''), 10);
  const warn = $('warn');
  if (!Number.isNaN(major) && major < 18) {
    warn.hidden = false;
    warn.textContent = `Node.js di aplikasi ini versi ${info.node}. Bot membutuhkan Node.js 18 atau lebih baru.`;
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

document.addEventListener('DOMContentLoaded', () => {
    const getPairBtn = document.getElementById('getPairBtn');
    if (getPairBtn) {
        getPairBtn.addEventListener('click', async () => {
            const phone = document.getElementById('phoneNumber').value.trim();
            const container = document.getElementById('pairingContainer');
            const display = document.getElementById('pairingCodeDisplay');

            if (!phone || phone.length < 10) {
                alert('Masukkan nomor WhatsApp yang valid (contoh: 62858xxxxxxxx)');
                return;
            }

            display.innerText = 'Memuat...';
            container.style.display = 'block';

            try {
                const response = await fetch(`http://localhost:3000/pair?number=${phone}`);
                const data = await response.json();

                if (data.success) {
                    display.innerText = data.code;
                } else {
                    display.innerText = 'Gagal!';
                    alert(data.message || 'Terjadi kesalahan saat mengambil kode pairing.');
                }
            } catch (err) {
                console.error(err);
                display.innerText = 'Error!';
                alert('Gagal terhubung ke server Node.js di dalam aplikasi.');
            }
        });
    }
});
