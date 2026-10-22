const cordova = require('cordova-bridge'); 
const path = require('path');
const express = require('express');

const app = express();
app.use(express.json());

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

// ENDPOINT API PAIRING UNTUK APLIKASI
app.get('/pair', async (req, res) => {
    const phoneNumber = req.query.number;
    if (!phoneNumber) {
        return res.status(400).json({ success: false, message: 'Nomor telepon tidak boleh kosong' });
    }

    try {
        if (global.hcMain && !global.hcMain.authState.creds.registered) {
            const cleanNum = phoneNumber.replace(/[^0-9]/g, '');
            const code = await global.hcMain.requestPairingCode(cleanNum);
            const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
            return res.json({ success: true, code: formattedCode });
        } else {
            return res.status(400).json({ success: false, message: 'Bot sudah terdaftar atau belum siap.' });
        }
    } catch (err) {
        console.error('Error pairing API:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.listen(3000, () => {
    console.log('Server Express berjalan di port 3000');
});

// KODE BOT WHATSAPP (BAILEYS) ANDA DI SINI
// (Pastikan saat membuat koneksi Baileys, instance socket-nya disimpan ke global.hcMain)
// Contoh: global.hcMain = sock;

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
