const os = require('os');
const path = require('path');
const fs = require('fs');
const cordova = require('cordova-bridge');
const { Crypto } = require('@peculiar/webcrypto');
globalThis.crypto = new Crypto();

let express, makeWASocket, useMultiFileAuthState, DisconnectReason, pino;
let baileysReady = false;
let hcHandler = async () => {};
try {
  hcHandler = require('./Hc.js');
} catch (e) {
  global.__hcLoadError = String(e && e.stack || e);
}

try {
  express = require('express');
  pino = require('pino');
} catch (e) {
  global.__baileysLoadError = String(e && e.stack || e);
}

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

initBaileysModule();

const startedAt = Date.now();
let failCount = 0;
const MAX_FAILS = 5;
function clearSession(reason) {
  try {
    const dir = path.join(getDataDir(), 'auth_info_baileys');
    fs.rmSync(dir, { recursive: true, force: true });
    send({ type: 'error', message: 'Sesi dihapus otomatis (' + reason + '). Silakan pairing ulang.' });
  } catch (e) {
    send({ type: 'error', message: 'Gagal menghapus sesi: ' + String(e && e.message || e) });
  }
}
function getDataDir() {
  try {
    if (cordova.app && typeof cordova.app.datadir === 'function') return cordova.app.datadir();
  } catch (_) {}
  return process.env.DATADIR || os.tmpdir();
}

const channelRes = {
  headersSent: false,
  status() { return this; },
  json(o) { this.headersSent = true; send(Object.assign({ type: 'pairing' }, o)); },
};
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
    dataDir: getDataDir(),
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
    const authFolder = path.join(getDataDir(), 'auth_info_baileys');
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    
    if (global.hcMain) {
      try { global.hcMain.ev.removeAllListeners(); global.hcMain.end(undefined); } catch (_) {}
      global.hcMain = null;
    }
    const hc = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
    });

    global.hcMain = hc;
    hc.ev.on('creds.update', saveCreds);

    hc.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const m of messages) {
        try { await hcHandler(hc, m); }
        catch (e) { send({ type: 'error', message: 'Hc.js: ' + String(e && e.message || e) }); }
      }
    });

    hc.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === 'close') {
        const code = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output
          ? lastDisconnect.error.output.statusCode
          : 0;
        const badCodes = [
          DisconnectReason.loggedOut,
          DisconnectReason.badSession,
          DisconnectReason.forbidden,
          DisconnectReason.multideviceMismatch,
          405,
        ];

        if (code === DisconnectReason.connectionReplaced) {
          failCount = 0;
          global.hcMain = null;
          send({ type: 'error', message: 'Code 440: sesi ini dipakai perangkat/bot lain. Matikan bot lain yang memakai nomor yang sama, lalu buka ulang aplikasi.' });
          return;
        }
        
        if (code !== DisconnectReason.restartRequired) failCount++;
        const fatal = badCodes.includes(code) || failCount >= MAX_FAILS;
        send({ type: 'error', message: 'WA disconnected code=' + code + ' reconnect=' + !fatal });
        if (fatal) {
          failCount = 0;
          global.hcMain = null;
          clearSession(badCodes.includes(code) ? 'code ' + code : 'gagal terhubung ' + MAX_FAILS + 'x');
        } else if (phoneNumber) {
          setTimeout(() => startBaileys(phoneNumber, null), 3000);
        }
      } else if (connection === 'open') {
        failCount = 0;
        send({ type: 'ready', node: process.version });
        console.log('Bot WhatsApp terhubung');
      }
    });

    if (!hc.authState.creds.registered) {
      setTimeout(async () => {
        try {
          const cleanNum = String(phoneNumber || '').replace(/[^0-9]/g, '');
          if (!cleanNum) {
            if (res && !res.headersSent) {
              res.status(400).json({ success: false, message: 'Nomor tidak valid' });
            }
            return;
          }
          const code = await hc.requestPairingCode(cleanNum);
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

if (express) {
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => { res.setHeader('Access-Control-Allow-Origin', '*'); next(); });

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
      channelRes.headersSent = false;
      return startBaileys(msg.number, channelRes);
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
if (global.__hcLoadError) send({ type: 'error', message: 'Hc.js gagal dimuat: ' + global.__hcLoadError });
