const cordova = require('cordova-bridge');
const path = require('path');
const os = require('os');
const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
app.use(express.json());

const startedAt = Date.now();
function send(obj) {
  try {
    cordova.channel.send(JSON.stringify(obj));
  } catch (e) {
    // channel belum siap
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

// Inisialisasi Sesi Baileys & Pairing Code
async function startBaileys(phoneNumber, res) {
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
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) {
          startBaileys();
        }
      } else if (connection === 'open') {
        console.log('Bot WhatsApp berhasil terhubung!');
      }
    });

    // Jika belum terdaftar, minta kode pairing
    if (!sock.authState.creds.registered) {
      setTimeout(async () => {
        try {
          const cleanNum = phoneNumber.replace(/[^0-9]/g, '');
          const code = await sock.requestPairingCode(cleanNum);
          const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
          if (res && !res.headersSent) {
            res.json({ success: true, code: formattedCode });
          }
        } catch (err) {
          console.error('Gagal request pairing code:', err);
          if (res && !res.headersSent) {
            res.status(500).json({ success: false, message: err.message });
          }
        }
      }, 3000);
    } else {
      if (res && !res.headersSent) {
        res.json({ success: false, message: 'Bot sudah terdaftar sebelumnya.' });
      }
    }
  } catch (err) {
    console.error('Error Baileys:', err);
    if (res && !res.headersSent) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

// Endpoint API Pairing untuk Frontend
app.get('/pair', async (req, res) => {
    const phoneNumber = req.query.number;
    if (!phoneNumber) {
        return res.status(400).json({ success: false, message: 'Nomor telepon tidak boleh kosong' });
    }
    await startBaileys(phoneNumber, res);
});

app.listen(3000, () => {
    console.log('Server Express berjalan di port 3000');
});

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

send({ type: 'ready', node: process.version });
