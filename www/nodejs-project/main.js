// Node.js side – M2: channel + Express pairing API + Baileys (Node 18 compatible)

const os = require('os');
const path = require('path');
const cordova = require('cordova-bridge');
const { Crypto } = require('@peculiar/webcrypto');
globalThis.crypto = new Crypto();


let express, makeWASocket, useMultiFileAuthState, DisconnectReason, pino;
let baileysReady = false;

// Muat Express dan Pino secara normal (CommonJS)
try {
  express = require('express');
  pino = require('pino');
} catch (e) {
  global.__baileysLoadError = String(e && e.stack || e);
}


// Inisialisasi Baileys menggunakan dynamic import() agar mendukung ESM
async function initBaileysModule() {
  try {
    const baileys = await import('@whiskeysockets/baileys');
    makeWASocket = baileys.default || baileys.makeWASocket;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    DisconnectReason = baileys.DisconnectReason;
    baileysReady = true;
    console.log('Baileys berhasil dimuat');
  } catch (e) {
    let errStr = '';
    try {
      errStr = e.stack || e.message || JSON.stringify(e);
    } catch (ex) {
      errStr = String(e);
    }
    global.__baileysLoadError = errStr;
    console.error('Baileys load error:', e);
    send({ type: 'error', message: 'Baileys err: ' + errStr });
  }
}

// Jalankan inisialisasi modul Baileys
initBaileysModule();

const startedAt = Date.now();
function send(obj) {
  try {
    cordova.channel.send(JSON.stringify(obj));
  } catch (_) {}
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
    baileys: baileysReady ? 'ok' : ('error: ' + (global.__baileysLoadError || 'not loaded')),
  };
}

async function startBaileys(phoneNumber, res) {
  if (!baileysReady) {
    await initBaileysModule();
  }
  if (!baileysReady) {
    const msg = 'Baileys gagal dimuat: ' + (global.__baileysLoadError || 'unknown');
    if (res && !res.headersSent) res.status(500).json({ success: false, message: msg });
    send({ type: 'error', message: msg });
    return;
  }

  try {
    const authFolder = path.resolve(process.env.DATADIR || '.', 'auth_info_baileys');
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
    });

    global.hcMain = sock;
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === 'close') {
        const code = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output
          ? lastDisconnect.error.output.statusCode
          : 0;
        const shouldReconnect = code !== DisconnectReason.loggedOut;
        send({ type: 'error', message: 'WA disconnected code=' + code + ' reconnect=' + shouldReconnect });
        if (shouldReconnect && phoneNumber) {
          setTimeout(() => startBaileys(phoneNumber, null), 3000);
        }
      } else if (connection === 'open') {
        send({ type: 'ready', node: process.version });
        console.log('Bot WhatsApp terhubung');
      }
    });

    if (!sock.authState.creds.registered) {
      setTimeout(async () => {
        try {
          const cleanNum = String(phoneNumber || '').replace(/[^0-9]/g, '');
          if (!cleanNum) {
            if (res && !res.headersSent) {
              res.status(400).json({ success: false, message: 'Nomor tidak valid' });
            }
            return;
          }
          const code = await sock.requestPairingCode(cleanNum);
          const formatted = (code && code.match(/.{1,4}/g) || []).join('-') || code;
          if (res && !res.headersSent) {
            res.json({ success: true, code: formatted });
          }
          send({ type: 'info', pairingCode: formatted, node: process.version });
        } catch (err) {
          console.error('Gagal request pairing code:', err);
          if (res && !res.headersSent) {
            res.status(500).json({ success: false, message: String(err.message || err) });
          }
          send({ type: 'error', message: 'pairing: ' + String(err.message || err) });
        }
      }, 2500);
    } else {
      if (res && !res.headersSent) {
        res.json({ success: false, message: 'Bot sudah terdaftar sebelumnya.' });
      }
    }
  } catch (err) {
    console.error('Error Baileys:', err);
    if (res && !res.headersSent) {
      res.status(500).json({ success: false, message: String(err.message || err) });
    }
    send({ type: 'error', message: 'Baileys: ' + String(err.message || err) });
  }
}

// Express setup
if (express) {
  const app = express();
  app.use(express.json());

  app.get('/pair', async (req, res) => {
    const phoneNumber = req.query.number;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: 'Nomor telepon tidak boleh kosong' });
    }
    await startBaileys(phoneNumber, res);
  });

  app.get('/status', (_req, res) => {
    res.json({ ok: true, baileys: baileysReady, node: process.version });
  });

  try {
    app.listen(3000, '127.0.0.1', () => {
      console.log('Express di 127.0.0.1:3000');
    });
  } catch (e) {
    send({ type: 'error', message: 'Express listen: ' + e.message });
  }
}

cordova.channel.on('message', (raw) => {
  try {
    const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (msg.cmd === 'info') return send(info());
    if (msg.cmd === 'ping') {
      return send({ type: 'pong', ms: Date.now() - (msg.t || Date.now()) });
    }
    if (msg.cmd === 'pair') {
      startBaileys(msg.number, null);
      return send({ type: 'info', message: 'pairing started for ' + msg.number });
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

send({ type: 'ready', node: process.version });
if (!baileysReady) {
  send({ type: 'error', message: 'Baileys load failed: ' + (global.__baileysLoadError || '') });
}
