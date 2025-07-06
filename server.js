// server.js
const express = require('express'); // Mengimpor Express.js untuk membuat server web
const path = require('path'); // Mengimpor modul path untuk bekerja dengan jalur file
const http = require('http'); // Mengimpor modul http untuk membuat server HTTP
const { Server } = require('socket.io'); // Mengimpor Socket.IO untuk komunikasi real-time
const chalk = require('chalk'); // Mengimpor chalk untuk pewarnaan konsol (opsional, tapi bagus untuk log)

// Mengimpor bot Telegram dan fungsi startSesi WhatsApp dari index.js
// Ini memungkinkan server.js untuk mengontrol dan berinteraksi dengan bot Anda
const { bot, startSesi, setSocketIO } = require('./index.js'); // Pastikan index.js mengekspor ini

const app = express(); // Membuat instance aplikasi Express
const server = http.createServer(app); // Membuat server HTTP menggunakan aplikasi Express
const io = new Server(server); // Membuat instance Socket.IO dan melampirkannya ke server HTTP

const PORT = process.env.PORT || 3000; // Menentukan port server, default 3000

// Middleware untuk mengurai body permintaan JSON
app.use(express.json());

// Melayani file statis dari direktori 'public'
// Ini berarti semua file di folder 'public' (index.html, style.css, script.js, images)
// akan dapat diakses oleh browser.
app.use(express.static(path.join(__dirname, 'public')));

// --- API Endpoints ---

// Endpoint untuk WhatsApp Pairing
// Ketika website mengirim permintaan POST ke '/api/request-pairing',
// endpoint ini akan menangani permintaan tersebut.
app.post('/api/request-pairing', async (req, res) => {
    const { phoneNumber } = req.body; // Mengambil nomor telepon dari body permintaan

    if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required.' });
    }

    try {
        // Karena fungsi `startSesi` di `index.js` sudah mendengarkan `connection.update`
        // dan akan memancarkan QR code atau status koneksi melalui Socket.IO,
        // kita tidak perlu memanggil `requestPairingCode` secara langsung di sini.
        // Cukup pastikan `startSesi` sudah berjalan dan `index.js` dapat mengakses `io`.

        // Kita akan menginisiasi ulang koneksi Baileys jika belum terhubung
        // atau jika ada kebutuhan untuk memicu pembuatan kode pairing baru.
        // Namun, karena kode pairing biasanya hanya muncul di awal,
        // kita akan bergantung pada `connection.update` di `index.js` untuk memancarkan QR.

        // Untuk saat ini, endpoint ini hanya mengkonfirmasi permintaan.
        // Update kode pairing atau status akan dikirimkan secara real-time melalui Socket.IO
        // langsung dari index.js ketika event Baileys terpicu.
        res.json({ message: 'Pairing request received. Awaiting code from bot.' });

        // Opsional: Jika Anda ingin memicu ulang proses QR dari sini
        // Anda mungkin perlu fungsi di `index.js` untuk memaksa pembuatan QR baru.
        // Contoh: await forceNewQR(phoneNumber); (Ini hanya ide, Anda perlu mengimplementasikannya di index.js)

    } catch (error) {
        console.error('Error handling pairing request:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});


// Socket.IO untuk pembaruan real-time (misalnya, kode pairing WhatsApp, status)
io.on('connection', (socket) => {
    console.log(chalk.green('A user connected via WebSocket'));

    // Contoh: Mengirim pesan status bot saat ada klien baru terhubung
    socket.emit('bot-status', { message: 'Bot server connected.' });

    socket.on('disconnect', () => {
        console.log(chalk.red('User disconnected from WebSocket'));
    });
});

// ********** Bagian Penting: Menghubungkan Bot Telegram dan WhatsApp **********

// Mengatur instance Socket.IO di dalam bot (index.js)
// Ini agar index.js bisa menggunakan io.emit() untuk mengirim data ke frontend
setSocketIO(io);

// Memulai sesi WhatsApp (dari index.js)
startSesi();

// Memulai bot Telegram (dari index.js)
bot.launch();

// *************************************************************************

// Menangkap sinyal untuk graceful shutdown
process.once('SIGINT', () => {
    console.log(chalk.yellow('SIGINT received. Shutting down gracefully...'));
    bot.stop('SIGINT');
    server.close(() => {
        console.log(chalk.green('HTTP server closed.'));
        process.exit(0);
    });
});
process.once('SIGTERM', () => {
    console.log(chalk.yellow('SIGTERM received. Shutting down gracefully...'));
    bot.stop('SIGTERM');
    server.close(() => {
        console.log(chalk.green('HTTP server closed.'));
        process.exit(0);
    });
});

// Memulai server Express
server.listen(PORT, () => {
    console.log(chalk.blue(`🚀 Server listening on http://localhost:${PORT}`));
    console.log(chalk.blue(`🌐 Web dashboard available at http://localhost:${PORT}`));
});