// Sisi Node.js (berjalan di dalam aplikasi). Nanti kode bot dipindahkan ke sini.
const cordova = require('cordova-bridge'); // disediakan oleh plugin nodejs-mobile-cordova
const path = require('path');

const startedAt = Date.now();
const send = (obj) => cordova.channel.send(JSON.stringify(obj));

function info() {
  return {
    type: 'info',
    node: process.version,
    mobile: (process.versions && process.versions.mobile) || null,
    platform: process.platform,
    arch: process.arch,
    uptime: Math.round((Date.now() - startedAt) / 1000),
    dataDir: process.env.DATADIR || path.resolve('.'),
  };
}

cordova.channel.on('message', (raw) => {
  try {
    const msg = JSON.parse(raw);
    if (msg.cmd === 'info') return send(info());
    if (msg.cmd === 'ping') return send({ type: 'pong', ms: Date.now() - msg.t });
    send({ type: 'error', message: 'Perintah tidak dikenal: ' + msg.cmd });
  } catch (e) {
    send({ type: 'error', message: e.message });
  }
});

process.on('uncaughtException', (e) => send({ type: 'error', message: String(e && e.stack || e) }));

send({ type: 'ready', node: process.version });
