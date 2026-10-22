// Node.js side (runs inside the app via nodejs-mobile).
// M1: only prove the engine starts and channel works.
// No external deps (express/baileys) so the process cannot crash on missing modules.

const cordova = require('cordova-bridge');
const path = require('path');
const os = require('os');

const startedAt = Date.now();

function send(obj) {
  try {
    cordova.channel.send(JSON.stringify(obj));
  } catch (e) {
    // channel may not be ready yet
  }
}

function info() {
  return {
    type: 'info',
    node: process.version,
    mobile: (process.versions && process.versions.mobile) || null,
    platform: process.platform,
    arch: process.arch,
    uptime: Math.round((Date.now() - startedAt) / 1000),
    dataDir: process.env.DATADIR || path.resolve('.'),
    hostname: os.hostname(),
  };
}

cordova.channel.on('message', (raw) => {
  try {
    const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (msg.cmd === 'info') return send(info());
    if (msg.cmd === 'ping') {
      return send({ type: 'pong', ms: Date.now() - (msg.t || Date.now()) });
    }
    send({ type: 'error', message: 'Perintah tidak dikenal: ' + (msg.cmd || '?') });
  } catch (e) {
    send({ type: 'error', message: String(e && e.message || e) });
  }
});

process.on('uncaughtException', (e) => {
  send({ type: 'error', message: String(e && e.stack || e) });
});

process.on('unhandledRejection', (e) => {
  send({ type: 'error', message: 'UnhandledRejection: ' + String(e && e.stack || e) });
});

// Signal ready to the Cordova side
send({ type: 'ready', node: process.version });
