
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

      if (msg.pairingCode) {
        const display = $('pairingCodeDisplay');
        if (display) display.innerText = msg.pairingCode;
        log('Kode pairing berhasil diterima.');
      }

      if (msg.message) {
        log(msg.message);
      }
      break;

    case 'pong':
      log(`Pong dari Node.js (${msg.ms} ms sejak dikirim)`);
      break;

    case 'error':
      setStatus('Error di Node.js', 'bad');
      log('ERROR: ' + msg.message);

      if (
        msg.message &&
        /pairing|baileys|auth|whatsapp/i.test(msg.message)
      ) {
        const display = $('pairingCodeDisplay');
        if (display) display.innerText = 'Gagal';

        alert('Gagal mendapatkan kode pairing: ' + msg.message);
      }
      break;

    default:
      log('Node: ' + JSON.stringify(msg));
  }
}
