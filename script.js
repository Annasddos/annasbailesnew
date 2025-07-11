// script.js
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Socket.IO connection
    const socket = io(); 

    // DOM Elements
    const commandListDiv = document.getElementById('commandList');
    const phoneNumberInput = document.getElementById('phoneNumberInput');
    const requestPairingBtn = document.getElementById('requestPairingBtn');
    const connectionStatus = document.getElementById('connectionStatus');
    const pairingStatus = document.getElementById('pairingStatus');
    const pairingCodeDisplay = document.getElementById('pairingCodeDisplay');
    const qrCodeCanvas = document.getElementById('qrCodeCanvas');
    const bugCommandSelect = document.getElementById('bugCommandSelect');
    const bugTargetInput = document.getElementById('bugTargetInput');
    const sendBugBtn = document.getElementById('sendBugBtn');
    const bugStatus = document.getElementById('bugStatus');
    const deleteSessionBtn = document.getElementById('deleteSessionBtn');
    const restartBotBtn = document.getElementById('restartBotBtn');
    const actionStatus = document.getElementById('actionStatus');
    const whatsappGlobalStatus = document.getElementById('whatsappGlobalStatus'); // For global status display
    const telegramStatus = document.getElementById('telegramStatus'); // For global status display


    // Bot Commands to display (static for now, can be fetched from API later)
    const commands = [
        { name: "Come On", description: "Delay Duration + Blank (No Invis) on target. Kirim 100x tanpa henti.", usage: "/comeon <number>" },
        { name: "Get Out", description: "Executes a Delay Invisible sequence on target. Kirim 100x tanpa henti.", usage: "/getout <number>" },
        { name: "Loving", description: "Performs Duration Hours attack on target. Kirim 100x tanpa henti.", usage: "/loving <number>" },
        { name: "Shibal", description: "Initiates Low Delay invis attack on target. Kirim 100x tanpa henti.", usage: "/shibal <number>" },
        { name: "Exsecute", description: "Triggers High Delay invis attack on target. Kirim 100x tanpa henti.", usage: "/exsecute <number>" },
        { name: "Crash Channel", description: "Attempts to crash a WhatsApp channel (newsletter). Kirim 200x tanpa henti.", usage: "/crashch <channel_number>" },
        { name: "Set Cooldown", description: "Sets the global cooldown duration for commands (Owner only).", usage: "/setjeda <duration> (e.g., 60s, 10m)" },
        { name: "Add Premium", description: "Grants premium access to a user ID (Owner only).", usage: "/addprem <user_id>" },
        { name: "Delete Premium", description: "Revokes premium access from a user ID (Owner only).", usage: "/delprem <user_id>" },
        { name: "Add Admin", description: "Grants admin access to a user ID (Owner only).", usage: "/addadmin <user_id>" },
        { name: "Delete Admin", description: "Revokes admin access from a user ID (Owner only).", usage: "/deladmin <user_id>" },
        { name: "Delete Session", description: "Deletes the current WhatsApp session (Owner only).", usage: "/delsesi" },
        { name: "Restart Bot", description: "Restarts the bot application (Owner only).", usage: "/restart" },
        { name: "Check Premium", description: "Checks your current premium status.", usage: "/cekprem" },
        { name: "Add Pairing", description: "Initiates WhatsApp pairing process for the bot (Owner only).", usage: "/addpairing <phone_number>" },
    ];

    // Populate command list
    commands.forEach(cmd => {
        const commandCard = document.createElement('div');
        commandCard.classList.add('command-card');
        commandCard.innerHTML = `
            <h3>${cmd.name}</h3>
            <p>${cmd.description}</p>
            <p>Usage: <code>${cmd.usage}</code></p>
        `;
        commandListDiv.appendChild(commandCard);
    });

    // Populate bug command select dropdown
    commands.filter(cmd => ['Come On', 'Get Out', 'Loving', 'Shibal', 'Exsecute', 'Crash Channel'].includes(cmd.name))
            .forEach(cmd => {
                const option = document.createElement('option');
                option.value = cmd.name.toLowerCase().replace(/ /g, '');
                option.textContent = cmd.name;
                bugCommandSelect.appendChild(option);
            });

    // Smooth scrolling for navigation links
    document.querySelectorAll('nav a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Function to draw QR code on canvas
    function drawQrCode(qrCodeData) {
        if (!qrCodeCanvas) {
            console.error("QR code canvas not found.");
            return;
        }
        qrCodeCanvas.innerHTML = ''; // Clear previous QR
        qrCodeCanvas.style.display = 'block';
        new QRCode(qrCodeCanvas, {
            text: qrCodeData,
            width: 200,
            height: 200,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
    }

    // --- Socket.IO Event Listeners ---
    socket.on('connect', () => {
        console.log('Connected to server via WebSocket');
        localStorage.setItem('socketId', socket.id); 
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server via WebSocket');
        connectionStatus.textContent = 'WhatsApp Status: Disconnected from server.';
        connectionStatus.style.color = '#ff6347';
        telegramStatus.textContent = 'OFF';
        telegramStatus.classList.remove('status-online');
        telegramStatus.classList.add('status-disconnected');
    });

    socket.on('whatsapp-qr', (data) => {
        pairingStatus.textContent = 'Scan QR Code or use the code below:';
        pairingStatus.style.color = '#ffd700';
        pairingCodeDisplay.textContent = data.qrCode; 
        drawQrCode(data.qrCode); 
        updateGlobalWhatsappStatus(data.status);
    });

    socket.on('whatsapp-pairing-code', (data) => {
        pairingStatus.textContent = `Pairing code received for ${data.phoneNumber}:`;
        pairingStatus.style.color = '#00ff00';
        pairingCodeDisplay.innerHTML = `<code>${data.code}</code><p>Enter this code in WhatsApp on your phone.</p>`;
        if (qrCodeCanvas) qrCodeCanvas.style.display = 'none'; 
    });

    socket.on('whatsapp-status', (data) => {
        connectionStatus.textContent = `WhatsApp Status: ${data.status}`;
        connectionStatus.style.color = data.status === 'Successfully' ? '#00ff00' : '#ff6347';
        if (data.status === 'Successfully') {
            connectionStatus.textContent += ` (Connected to: ${data.number})`;
            pairingStatus.textContent = 'WhatsApp is connected!';
            pairingStatus.style.color = '#00ff00';
            pairingCodeDisplay.textContent = '';
            if (qrCodeCanvas) qrCodeCanvas.style.display = 'none';
        } else if (data.status === 'Logged Out' || data.status === 'Session Deleted') {
            pairingStatus.textContent = data.message;
            pairingStatus.style.color = '#ff6347';
            pairingCodeDisplay.textContent = '';
            if (qrCodeCanvas) qrCodeCanvas.style.display = 'none';
        }
        updateGlobalWhatsappStatus(data.status);
    });

    socket.on('whatsapp-pairing-error', (data) => {
        pairingStatus.textContent = `Pairing Error for ${data.phoneNumber}: ${data.error}`;
        pairingStatus.style.color = '#ff6347';
        pairingCodeDisplay.textContent = '';
        if (qrCodeCanvas) qrCodeCanvas.style.display = 'none';
        updateGlobalWhatsappStatus('ERROR');
    });

    socket.on('bug-progress', (data) => {
        let message = `[${data.status.toUpperCase()}] ${data.message}`;
        if (data.progress !== undefined) {
            message += ` (${Math.round(data.progress)}%)`;
        }
        bugStatus.textContent = message;
        bugStatus.style.color = data.status === 'completed' ? '#00ff00' : (data.status === 'error' ? '#ff6347' : '#ffd700');
    });

    socket.on('bot-status', (data) => {
        actionStatus.textContent = `Bot Status: ${data.message}`;
        actionStatus.style.color = data.status === 'restarting' ? '#ffd700' : '#00ff00';
        if (data.status === 'restarting') {
             telegramStatus.textContent = 'RESTARTING';
             telegramStatus.classList.remove('status-online');
             telegramStatus.classList.add('status-connecting');
        }
    });

    socket.on('bot-status-overall', (data) => {
        updateGlobalWhatsappStatus(data.whatsapp);
        telegramStatus.textContent = data.telegram;
        if (data.telegram === 'ON') {
            telegramStatus.classList.remove('status-disconnected', 'status-connecting');
            telegramStatus.classList.add('status-online');
        } else {
            telegramStatus.classList.remove('status-online', 'status-connecting');
            telegramStatus.classList.add('status-disconnected');
        }
    });

    // Helper to update global WhatsApp status display
    function updateGlobalWhatsappStatus(status) {
        whatsappGlobalStatus.textContent = status;
        whatsappGlobalStatus.classList.remove('status-online', 'status-connecting', 'status-disconnected', 'status-error', 'status-logged-out');
        if (status === 'CONNECTED' || status === 'Successfully') {
            whatsappGlobalStatus.classList.add('status-online');
        } else if (status === 'SCAN_QR_CODE' || status === 'Pairing Initiated' || status === 'RECONNECTING') {
            whatsappGlobalStatus.classList.add('status-connecting');
        } else if (status === 'DISCONNECTED' || status === 'LOGGED_OUT' || status === 'ERROR' || status === 'Session Deleted') {
            whatsappGlobalStatus.classList.add('status-disconnected');
        }
    }


    // --- API Interactions ---

    // Function to make API requests (simplified without owner token)
    async function makeApiRequest(endpoint, method, body, targetStatusElement) {
        const socketId = localStorage.getItem('socketId');

        try {
            const response = await fetch(endpoint, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Socket-ID': socketId // Send socket ID for targeted emits
                },
                body: JSON.stringify(body),
            });

            const data = await response.json();

            if (!response.ok) {
                targetStatusElement.textContent = `Error: ${data.error || 'Terjadi kesalahan.'}`;
                targetStatusElement.style.color = '#ff6347';
                return null;
            } else {
                targetStatusElement.textContent = `Status: ${data.message}`;
                targetStatusElement.style.color = '#00ff00';
                return data;
            }
        } catch (error) {
            console.error(`Error with ${endpoint}:`, error);
            targetStatusElement.textContent = `Gagal terhubung ke server untuk ${endpoint}.`;
            targetStatusElement.style.color = '#ff6347';
            return null;
        }
    }


    // Request WhatsApp Pairing (without owner token input)
    requestPairingBtn.addEventListener('click', async () => {
        const phoneNumber = phoneNumberInput.value.trim();

        if (!phoneNumber) {
            pairingStatus.textContent = 'Mohon masukkan nomor telepon.'; 
            pairingStatus.style.color = '#ff6347';
            pairingCodeDisplay.textContent = '';
            if (qrCodeCanvas) qrCodeCanvas.style.display = 'none';
            return;
        }

        pairingStatus.textContent = 'Meminta kode pairing...';
        pairingStatus.style.color = '#ffd700';
        pairingCodeDisplay.textContent = '';
        if (qrCodeCanvas) qrCodeCanvas.style.display = 'none';

        await makeApiRequest('/api/request-pairing', 'POST', { phoneNumber }, pairingStatus); 
    });

    // Send Bug Command (without owner token input)
    sendBugBtn.addEventListener('click', async () => {
        const command = bugCommandSelect.value;
        const target = bugTargetInput.value.trim();

        if (!command || !target) {
            bugStatus.textContent = 'Mohon pilih perintah dan masukkan target.'; 
            bugStatus.style.color = '#ff6347';
            return;
        }

        bugStatus.textContent = `Mengirim bug ${command} ke ${target}...`;
        bugStatus.style.color = '#ffd700';

        await makeApiRequest('/api/send-bug', 'POST', { command, target }, bugStatus); 
    });

    // Delete WhatsApp Session (without owner token input)
    deleteSessionBtn.addEventListener('click', async () => {
        actionStatus.textContent = 'Meminta penghapusan sesi...';
        actionStatus.style.color = '#ffd700';

        await makeApiRequest('/api/delete-session', 'POST', {}, actionStatus); 
    });

    // Restart Bot (without owner token input)
    restartBotBtn.addEventListener('click', async () => {
        actionStatus.textContent = 'Meminta restart bot...';
        actionStatus.style.color = '#ffd700';

        await makeApiRequest('/api/restart-bot', 'POST', {}, actionStatus); 
    });

    // QRCode.js is loaded via CDN link in index.html
});