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
const { bot, startSesi, setSocketIO, validateBotToken, Mikasa, bugCommands, deleteSession } = require('./index.js');
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

// Middleware for owner authentication (using OWNER_TOKEN_KEY)
const authenticateOwner = (req, res, next) => {
    const token = req.headers['x-owner-token'] || req.body.ownerToken || req.query.ownerToken;
    if (token === config.OWNER_TOKEN_KEY) {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden: Invalid owner token.' });
    }
};

// --- API Endpoints ---

// Endpoint for WhatsApp Pairing via web
app.post('/api/request-pairing', authenticateOwner, async (req, res) => {
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
            // This might happen if Baileys init failed or is very slow
            if (io && socketId) {
                 io.to(socketId).emit('whatsapp-pairing-error', { phoneNumber: cleanedPhoneNumber, error: 'Klien WhatsApp belum siap. Coba lagi sebentar.' });
            }
            return res.status(500).json({ error: 'WhatsApp client is not initialized. Please wait or restart.' });
        }
        if (Mikasa && Mikasa.user && Mikasa.user.id) { // Check if user property exists and has an ID
            const currentLinkedNumber = Mikasa.user.id.split(':')[0].split('@')[0]; // Extract just the number
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

        // `requestPairingCode` will trigger 'connection.update' which emits QR/code via Socket.IO
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

// Endpoint to trigger bug commands from web
app.post('/api/send-bug', authenticateOwner, async (req, res) => {
    const { command, target, ownerToken } = req.body;
    const socketId = req.headers['x-socket-id'];

    if (!command || !target || !ownerToken) {
        return res.status(400).json({ error: 'Command, target, and ownerToken are required.' });
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
        // Emit initial status to the specific client
        if (io && socketId) {
            io.to(socketId).emit('bug-progress', { status: 'started', command: command, target: target, message: `Mengirim bug ${command} ke ${target}...` });
        }
        // Call the bug function from index.js. These functions already handle progress emitting via `io`.
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

// Endpoint to delete WhatsApp session
app.post('/api/delete-session', authenticateOwner, async (req, res) => {
    const socketId = req.headers['x-socket-id'];
    try {
        const success = deleteSession(); // Call the exported deleteSession function from index.js
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

// Endpoint to restart the bot process
app.post('/api/restart-bot', authenticateOwner, async (req, res) => {
    const socketId = req.headers['x-socket-id'];
    try {
        if (io && socketId) {
            io.to(socketId).emit('bot-status', { status: 'restarting', message: 'Bot sedang me-restart...' });
        }
        res.json({ status: 'success', message: 'Proses restart bot dimulai.' });
        console.log(chalk.yellow('Restarting bot process...'));
        // Give time for response before exiting
        setTimeout(() => { process.exit(0); }, 2000); 
    } catch (error) {
        console.error(chalk.red('Error restarting bot:'), error);
        res.status(500).json({ error: 'Gagal me-restart bot.' });
    }
});


// --- Serve HTML, CSS, JS directly from root ---
// Serve static files from the project root (for images, etc.)
app.use(express.static(path.join(__dirname))); 

// Home route to render the dashboard
app.get('/', (req, res) => {
    // Render the HTML template
    res.send(htmlTemplate({ 
        title: 'Mikasa Cloud - Bot Dashboard',
        currentYear: new Date().getFullYear()
    }));
});

// Serve static CSS file (must match <link href="style.css"> in index.html)
app.get('/style.css', (req, res) => {
    res.type('text/css');
    res.send(cssContent);
});

// Serve static JavaScript file (must match <script src="script.js"> in index.html)
app.get('/script.js', (req, res) => {
    res.type('application/javascript');
    res.send(jsContent);
});


// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(chalk.green(`A user connected via WebSocket. Socket ID: ${socket.id}`));
    // Send the current WhatsApp connection status to the newly connected client
    socket.emit('whatsapp-status', { 
        status: Mikasa && Mikasa.user ? 'Successfully' : 'Disconnected',
        message: Mikasa && Mikasa.user ? 'WhatsApp connected!' : 'WhatsApp disconnected!',
        number: Mikasa && Mikasa.user ? Mikasa.user.id.split(':')[0] : 'N/A'
    });

    socket.on('disconnect', () => {
        console.log(chalk.red(`User disconnected from WebSocket. Socket ID: ${socket.id}`));
    });
});


// ********** Initialize Bot Logic **********
let htmlTemplate;
let cssContent;
let jsContent;

async function initializeApp() {
    console.clear();
    console.log(chalk.blue("Starting Mikasa Cloud Bot Dashboard Server..."));

    // Load frontend files
    try {
        htmlTemplate = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
        cssContent = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
        jsContent = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
        htmlTemplate = handlebars.compile(htmlTemplate); // Compile HTML with Handlebars
        console.log(chalk.green("Frontend files loaded successfully."));
    } catch (error) {
        console.error(chalk.red("Error loading frontend files:"), error);
        process.exit(1);
    }

    const tokenIsValid = await validateBotToken();
    if (!tokenIsValid) {
        console.log(chalk.red("Bot token is invalid. Exiting."));
        process.exit(1);
    }

    setSocketIO(io); // Pass the Socket.IO instance to index.js
    startSesi(); // Start WhatsApp session
    bot.launch(); // Launch Telegram bot

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

// Start the entire application
initializeApp();

// Enable graceful stop for Express and Telegraf bot
process.once('SIGINT', () => {
    console.log(chalk.yellow('SIGINT received. Shutting down gracefully...'));
    bot.stop('SIGINT');
    if (Mikasa) Mikasa.end(); // End Baileys connection
    server.close(() => {
        console.log(chalk.green('HTTP server closed.'));
        process.exit(0);
    });
});
process.once('SIGTERM', () => {
    console.log(chalk.yellow('SIGTERM received. Shutting down gracefully...'));
    bot.stop('SIGTERM');
    if (Mikasa) Mikasa.end(); // End Baileys connection
    server.close(() => {
        console.log(chalk.green('HTTP server closed.'));
        process.exit(0);
    });
});