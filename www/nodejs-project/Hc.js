const settings = require('./settings.js');
const runtime = require('./lib/function.js');

const getContentType = (content) => {
  if (!content) return undefined;
  const keys = Object.keys(content).filter(
    (k) => k !== 'messageContextInfo' && k !== 'senderKeyDistributionMessage'
  );
  return keys[0];
};

const pickRandom = (list) => list[Math.floor(Math.random() * list.length)];

async function Hc(hc, m) {
  try {
    if (!m.message) return;

    let msg = m.message;
    if (msg.ephemeralMessage) msg = msg.ephemeralMessage.message;
    if (msg.viewOnceMessage) msg = msg.viewOnceMessage.message;
    if (msg.viewOnceMessageV2) msg = msg.viewOnceMessageV2.message;

    const type = getContentType(msg);
    if (!type) return;

    const body = (type === 'conversation') ? msg.conversation :
      (type === 'extendedTextMessage') ? msg.extendedTextMessage?.text :
      (type === 'imageMessage') ? msg.imageMessage?.caption :
      (type === 'videoMessage') ? msg.videoMessage?.caption : '';
    if (!body) return;

    const from = m.key.remoteJid;
    if (from === 'status@broadcast') return;

    const sender = m.key.fromMe
      ? (hc.user.id.split(':')[0] + '@s.whatsapp.net')
      : (m.key.participant || m.key.remoteJid);
    const senderClean = sender.split(':')[0];
    const isGroup = from.endsWith('@g.us');

    const prefixUsed = settings.prefix.find(p => body.startsWith(p));
    const isCmd = !!prefixUsed;
    const prefix = isCmd ? prefixUsed : '';
    if (!isCmd) return;

    const reply = async (text, options = {}) => {
      return await hc.sendMessage(from, { text, ...options }, { quoted: m });
    };
    const react = async (emoji) => {
      return await hc.sendMessage(from, { react: { text: emoji, key: m.key } });
    };

    const command = body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase();
    const args = body.trim().split(/ +/).slice(1);
    const text = args.join(' ');
    const participant = m.key.participant || sender;
    const isCreator = m.key.fromMe || settings.ownerNumber.some(owner => participant.includes(owner));
    const author = settings.author || 'Heart candy';
    const packname = settings.packname || 'ponyndo';
    const botname = settings.botName?.[0] || 'Hc-bot';
    const setv = pickRandom(settings.listv);
    
    // Add case command disini
    switch (command) {
      case 'tes': {
        reply('ya');
      }
      break
      case 'runtime': case 'bot': {
        if (!args[0] && !args[1]) return reply(`*Bot Telah Aktif Selama*\n*${runtime(process.uptime())}*`);
      }
      break
      
      
      default:
    } // Penutup case command
  } catch (err) {
    console.error('Error di Hc.js:', err);
  }
}

module.exports = Hc;
module.exports.default = Hc;
