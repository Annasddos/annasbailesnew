// public/js/script.js
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Socket.IO connection
    const socket = io(); // Connects to the server where socket.io is running

    // DOM Elements
    const commandListDiv = document.getElementById('commandList');
    const phoneNumberInput = document.getElementById('phoneNumberInput');
    const ownerTokenInput = document.getElementById('ownerTokenInput');
    const requestPairingBtn = document.getElementById('requestPairingBtn');
    const connectionStatus = document.getElementById('connectionStatus');
    const pairingStatus = document.getElementById('pairingStatus');
    const pairingCodeDisplay = document.getElementById('pairingCodeDisplay');
    const qrCodeCanvas = document.getElementById('qrCodeCanvas');
    const bugCommandSelect = document.getElementById('bugCommandSelect');
    const bugTargetInput = document.getElementById('bugTargetInput');
    const bugOwnerTokenInput = document.getElementById('bugOwnerTokenInput');
    const sendBugBtn = document.getElementById('sendBugBtn');
    const bugStatus = document.getElementById('bugStatus');
    const ownerTokenActionsInput = document.getElementById('ownerTokenActionsInput');
    const deleteSessionBtn = document.getElementById('deleteSessionBtn');
    const restartBotBtn = document.getElementById('restartBotBtn');
    const actionStatus = document.getElementById('actionStatus');

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
    commands.filter(cmd => cmd.name.includes('Bug') || ['Come On', 'Get Out', 'Loving', 'Shibal', 'Exsecute', 'Crash Channel'].includes(cmd.name))
            .forEach(cmd => {
                const option = document.createElement('option');
                option.value = cmd.name.toLowerCase().replace(/ /g, ''); // Convert "Come On" to "comeon"
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
        qrCodeCanvas.style.display = 'block';
        const qrcode = new QRCode(qrCodeCanvas, {
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
        // Store socket ID in a global variable or send it with API requests
        localStorage.setItem('socketId', socket.id);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server via WebSocket');
        connectionStatus.textContent = 'WhatsApp Status: Disconnected from server.';
        connectionStatus.style.color = '#ff6347';
    });

    socket.on('whatsapp-qr', (data) => {
        pairingStatus.textContent = 'Scan QR Code or use the code below:';
        pairingStatus.style.color = '#ffd700';
        pairingCodeDisplay.textContent = data.qrCode;
        drawQrCode(data.qrCode);
    });

    socket.on('whatsapp-pairing-code', (data) => {
        pairingStatus.textContent = `Pairing code received for ${data.phoneNumber}:`;
        pairingStatus.style.color = '#00ff00';
        pairingCodeDisplay.innerHTML = `<code>${data.code}</code><p>Enter this code in WhatsApp on your phone.</p>`;
        if (qrCodeCanvas) qrCodeCanvas.style.display = 'none'; // Hide QR if code is shown
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
    });

    socket.on('whatsapp-pairing-error', (data) => {
        pairingStatus.textContent = `Pairing Error for ${data.phoneNumber}: ${data.error}`;
        pairingStatus.style.color = '#ff6347';
        pairingCodeDisplay.textContent = '';
        if (qrCodeCanvas) qrCodeCanvas.style.display = 'none';
    });

    socket.on('bug-progress', (data) => {
        bugStatus.textContent = `[${data.status.toUpperCase()}] ${data.message}`;
        bugStatus.style.color = data.status === 'completed' ? '#00ff00' : (data.status === 'error' ? '#ff6347' : '#ffd700');
    });

    socket.on('bot-status', (data) => {
        actionStatus.textContent = `Bot Status: ${data.message}`;
        actionStatus.style.color = data.status === 'restarting' ? '#ffd700' : '#00ff00';
    });


    // --- API Interactions ---

    // Request WhatsApp Pairing
    requestPairingBtn.addEventListener('click', async () => {
        const phoneNumber = phoneNumberInput.value.trim();
        const ownerToken = ownerTokenInput.value.trim();
        const socketId = localStorage.getItem('socketId'); // Get the current socket ID

        if (!phoneNumber || !ownerToken) {
            pairingStatus.textContent = 'Please enter phone number and Owner Token.';
            pairingStatus.style.color = '#ff6347';
            pairingCodeDisplay.textContent = '';
            if (qrCodeCanvas) qrCodeCanvas.style.display = 'none';
            return;
        }

        pairingStatus.textContent = 'Requesting pairing code...';
        pairingStatus.style.color = '#ffd700';
        pairingCodeDisplay.textContent = '';
        if (qrCodeCanvas) qrCodeCanvas.style.display = 'none'; // Clear any previous QR

        try {
            const response = await fetch('/api/request-pairing', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Owner-Token': ownerToken, // Send owner token in header
                    'X-Socket-ID': socketId // Send socket ID so server knows where to emit back
                },
                body: JSON.stringify({ phoneNumber }),
            });

            const data = await response.json();
            if (!response.ok) {
                 pairingStatus.textContent = `Error: ${data.error || 'Failed to request pairing.'}`;
                 pairingStatus.style.color = '#ff6347';
            } else {
                 if (data.status === 'info') { // If already connected
                    pairingStatus.textContent = `Status: ${data.message}`;
                    pairingStatus.style.color = '#ffd700';
                 } else { // Pairing initiated
                    pairingStatus.textContent = `Pairing initiated. Check below for code/QR...`;
                    pairingStatus.style.color = '#ffd700';
                    // Actual QR/code will come via Socket.IO
                 }
            }
        } catch (error) {
            console.error('Error requesting pairing:', error);
            pairingStatus.textContent = 'Failed to connect to server for pairing. Check console.';
            pairingStatus.style.color = '#ff6347';
        }
    });

    // Send Bug Command
    sendBugBtn.addEventListener('click', async () => {
        const command = bugCommandSelect.value;
        const target = bugTargetInput.value.trim();
        const ownerToken = bugOwnerTokenInput.value.trim();

        if (!command || !target || !ownerToken) {
            bugStatus.textContent = 'Please select a command, enter a target, and provide Owner Token.';
            bugStatus.style.color = '#ff6347';
            return;
        }

        bugStatus.textContent = `Sending ${command} bug to ${target}...`;
        bugStatus.style.color = '#ffd700';

        try {
            const response = await fetch('/api/send-bug', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Owner-Token': ownerToken // Send owner token
                },
                body: JSON.stringify({ command, target, ownerToken }), // Send ownerToken in body as well for convenience
            });

            const data = await response.json();
            if (!response.ok) {
                bugStatus.textContent = `Error: ${data.error || 'Failed to send bug.'}`;
                bugStatus.style.color = '#ff6347';
            } else {
                // Status updates will primarily come from Socket.IO, but this confirms API call
                bugStatus.textContent = data.message;
                bugStatus.style.color = '#00ff00';
            }
        } catch (error) {
            console.error('Error sending bug:', error);
            bugStatus.textContent = 'Failed to connect to server to send bug. Check console.';
            bugStatus.style.color = '#ff6347';
        }
    });

    // Delete WhatsApp Session
    deleteSessionBtn.addEventListener('click', async () => {
        const ownerToken = ownerTokenActionsInput.value.trim();
        if (!ownerToken) {
            actionStatus.textContent = 'Please enter Owner Token Key.';
            actionStatus.style.color = '#ff6347';
            return;
        }

        actionStatus.textContent = 'Requesting session deletion...';
        actionStatus.style.color = '#ffd700';

        try {
            const response = await fetch('/api/delete-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Owner-Token': ownerToken // Send owner token
                },
                body: JSON.stringify({ ownerToken }),
            });

            const data = await response.json();
            if (!response.ok) {
                actionStatus.textContent = `Error: ${data.error || 'Failed to delete session.'}`;
                actionStatus.style.color = '#ff6347';
            } else {
                actionStatus.textContent = data.message;
                actionStatus.style.color = '#00ff00';
                // WhatsApp status will update via Socket.IO
            }
        } catch (error) {
            console.error('Error deleting session:', error);
            actionStatus.textContent = 'Failed to connect to server to delete session. Check console.';
            actionStatus.style.color = '#ff6347';
        }
    });

    // Restart Bot
    restartBotBtn.addEventListener('click', async () => {
        const ownerToken = ownerTokenActionsInput.value.trim();
        if (!ownerToken) {
            actionStatus.textContent = 'Please enter Owner Token Key.';
            actionStatus.style.color = '#ff6347';
            return;
        }

        actionStatus.textContent = 'Requesting bot restart...';
        actionStatus.style.color = '#ffd700';

        try {
            const response = await fetch('/api/restart-bot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Owner-Token': ownerToken // Send owner token
                },
                body: JSON.stringify({ ownerToken }),
            });

            const data = await response.json();
            if (!response.ok) {
                actionStatus.textContent = `Error: ${data.error || 'Failed to restart bot.'}`;
                actionStatus.style.color = '#ff6347';
            } else {
                actionStatus.textContent = data.message;
                actionStatus.style.color = '#00ff00';
                // Bot status will update via Socket.IO after restart
            }
        } catch (error) {
            console.error('Error restarting bot:', error);
            actionStatus.textContent = 'Failed to connect to server to restart bot. Check console.';
            actionStatus.style.color = '#ff6347';
        }
    });

    // Add QRCode.js library dynamically
    // This library is used to generate QR codes on the canvas
    const qrScript = document.createElement('script');
    qrScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode.js/1.0.0/qrcode.min.js';
    qrScript.onload = () => console.log('QRCode.js loaded');
    document.head.appendChild(qrScript);
});