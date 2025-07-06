document.addEventListener('DOMContentLoaded', () => {
    const WEB_PANEL_BASE_URL = window.location.origin; // Sesuaikan jika Anda host di domain lain
    const OWNER_TOKEN_KEY = '6878949999'; // Key untuk menyimpan token di localStorage

    // --- Elemen UI ---
    const navLinks = document.querySelectorAll('.main-nav ul li a');
    const sections = document.querySelectorAll('main section');

    // Dashboard Status
    const waStatus = document.getElementById('waStatus');
    const linkedNumber = document.getElementById('linkedNumber');
    const platformInfo = document.getElementById('platform');
    const cpuInfo = document.getElementById('cpu');
    const hostnameInfo = document.getElementById('hostname');
    const botUptimeInfo = document.getElementById('botUptime');
    const processUptimeInfo = document.getElementById('processUptime');
    const premiumCount = document.getElementById('premiumCount');
    const adminCount = document.getElementById('adminCount');

    // Pairing Form
    const pairingForm = document.getElementById('pairingForm');
    const waNumberInput = document.getElementById('waNumberInput');
    const pairingResult = document.getElementById('pairingResult');

    // Bug Form
    const bugForm = document.getElementById('bugForm');
    const targetNumberInput = document.getElementById('targetNumberInput');
    const bugTypeSelect = document.getElementById('bugTypeSelect');
    const bugResult = document.getElementById('bugResult');
    const bugProgressBar = document.getElementById('bugProgressBar');
    const bugProgressText = document.getElementById('bugProgressText');

    // Admin Tools
    const ownerTokenInput = document.getElementById('ownerTokenInput');
    const premiumUserIdInput = document.getElementById('premiumUserId');
    const adminUserIdInput = document.getElementById('adminUserId');
    const cooldownDurationInput = document.getElementById('cooldownDuration');
    const adminToolResult = document.getElementById('adminToolResult');

    // Footer
    document.getElementById('currentYear').textContent = new Date().getFullYear();

    // --- Fungsi Helper ---
    async function fetchData(url, method = 'GET', body = null, useOwnerToken = false) {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        if (useOwnerToken) {
            const token = localStorage.getItem(OWNER_TOKEN_KEY);
            if (token) {
                options.headers['Authorization'] = `Bearer ${token}`;
            } else {
                displayResult(adminToolResult, 'warning', 'Owner Token tidak ditemukan. Harap masukkan token Anda.', true);
                throw new Error('Owner Token missing');
            }
        }

        const response = await fetch(`${WEB_PANEL_BASE_URL}${url}`, options);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return response.json();
    }

    function displayResult(element, type, message, clearAfter = false) {
        element.textContent = message;
        element.className = `result-box ${type}`; // Add type class for styling (e.g., success, error, info, warning)
        element.style.display = 'block';

        if (clearAfter) {
            setTimeout(() => {
                element.style.display = 'none';
                element.textContent = '';
                element.className = 'result-box';
            }, 5000); // Clear after 5 seconds
        }
    }

    function updateProgressBar(progress) {
        bugProgressBar.style.width = `${progress}%`;
        bugProgressText.textContent = `${progress}% Selesai`;
    }

    function showSection(id) {
        sections.forEach(section => {
            section.classList.remove('active');
        });
        navLinks.forEach(link => {
            link.classList.remove('active');
        });

        document.getElementById(id).classList.add('active');
        document.querySelector(`.main-nav ul li a[href="#${id}"]`).classList.add('active');
    }

    function scrollToSection(id) {
        document.getElementById(id).scrollIntoView({ behavior: 'smooth' });
        showSection(id); // Also activate the section in navigation
    }

    // --- Inisialisasi & Event Listeners ---

    // Navigasi
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            showSection(targetId);
        });
    });

    // Load initial dashboard data
    async function loadDashboardStatus() {
        try {
            const data = await fetchData('/api/status');
            waStatus.textContent = data.whatsappConnected ? 'Terhubung ✅' : 'Terputus ❌';
            linkedNumber.textContent = data.linkedNumber || 'Belum Terhubung';
            platformInfo.textContent = data.platform || '-';
            cpuInfo.textContent = data.cpu || '-';
            hostnameInfo.textContent = data.hostname || '-';
            botUptimeInfo.textContent = data.uptimeBot || '-';
            processUptimeInfo.textContent = data.uptimeProcess || '-';
            premiumCount.textContent = data.premiumUsersCount !== undefined ? data.premiumUsersCount : '-';
            adminCount.textContent = data.adminUsersCount !== undefined ? data.adminUsersCount : '-';
            // Update WA pairing section message if connected
            if (data.whatsappConnected) {
                displayResult(pairingResult, 'success', `WhatsApp sudah terhubung dengan nomor: ${data.linkedNumber}.`);
            }
        } catch (error) {
            console.error('Error fetching dashboard status:', error);
            displayResult(waStatus.parentElement, 'error', 'Gagal memuat status bot.', true);
        }
    }

    // Load owner token from localStorage
    const storedOwnerToken = localStorage.getItem(OWNER_TOKEN_KEY);
    if (storedOwnerToken) {
        ownerTokenInput.value = storedOwnerToken;
    }
    // Save token on input change
    ownerTokenInput.addEventListener('input', () => {
        localStorage.setItem(OWNER_TOKEN_KEY, ownerTokenInput.value);
    });

    // Pairing Form Submission
    if (pairingForm) {
        pairingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const phoneNumber = waNumberInput.value.trim();
            if (!phoneNumber) {
                displayResult(pairingResult, 'error', 'Harap masukkan nomor WhatsApp.');
                return;
            }
            displayResult(pairingResult, 'info', '🔄 Mengirim permintaan pairing...');
            try {
                // Untuk pairing, kita juga perlu token owner
                const data = await fetchData('/api/addpairing', 'POST', { phoneNumber }, true); // true for useOwnerToken
                if (data.success) {
                    displayResult(pairingResult, 'success', `✅ Kode Pairing: ${data.code}. Silakan scan atau masukkan di WhatsApp Anda.`);
                    loadDashboardStatus(); // Refresh status setelah pairing
                } else {
                    displayResult(pairingResult, 'error', `❌ ${data.message}`);
                }
            } catch (error) {
                displayResult(pairingResult, 'error', `⚠️ Gagal melakukan pairing: ${error.message}`);
                console.error('Pairing Error:', error);
            }
        });
    }

    // Bug Form Submission
    if (bugForm) {
        bugForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const targetNumber = targetNumberInput.value.trim();
            const bugType = bugTypeSelect.value;

            if (!targetNumber || !bugType) {
                displayResult(bugResult, 'error', 'Harap masukkan nomor target dan pilih jenis bug.');
                return;
            }

            displayResult(bugResult, 'info', `🚀 Mengirim bug '${bugType}' ke ${targetNumber}...`);
            updateProgressBar(0);

            let currentProgress = 0;
            const totalSteps = 10; // Jumlah estimasi langkah untuk progress bar
            const intervalTime = 500; // Milidetik per langkah

            const progressInterval = setInterval(() => {
                currentProgress += (100 / totalSteps);
                if (currentProgress > 95) currentProgress = 95; // Stop before 100% until actual completion
                updateProgressBar(Math.round(currentProgress));
            }, intervalTime);


            try {
                // Menggunakan token owner untuk mengirim bug juga
                const data = await fetchData(`/api/sendbug/${bugType}`, 'POST', { targetNumber }, true);

                clearInterval(progressInterval);
                updateProgressBar(100);
                if (data.success) {
                    displayResult(bugResult, 'success', `✅ ${data.message}`);
                } else {
                    displayResult(bugResult, 'error', `❌ ${data.message}`);
                }
            } catch (error) {
                clearInterval(progressInterval);
                updateProgressBar(0);
                displayResult(bugResult, 'error', `⚠️ Gagal mengirim bug: ${error.message}`);
                console.error('Bug Sending Error:', error);
            }
        });
    }

    // Admin Tools Functions
    window.callAdminTool = async (action) => {
        let userId;
        let duration;
        let payload = {};
        let endpoint = `/api/${action}`;

        if (action === 'addprem' || action === 'delprem') {
            userId = premiumUserIdInput.value.trim();
            if (!userId) {
                displayResult(adminToolResult, 'error', 'ID Pengguna Premium wajib diisi.'); return;
            }
            payload = { userId };
        } else if (action === 'addadmin' || action === 'deladmin') {
            userId = adminUserIdInput.value.trim();
            if (!userId) {
                displayResult(adminToolResult, 'error', 'ID Pengguna Admin wajib diisi.'); return;
            }
            payload = { userId };
        } else if (action === 'setjeda') {
            duration = cooldownDurationInput.value.trim();
            if (!duration) {
                displayResult(adminToolResult, 'error', 'Durasi cooldown wajib diisi (e.g., 60s, 5m).'); return;
            }
            payload = { duration };
        }

        displayResult(adminToolResult, 'info', `🔄 Mengirim permintaan '${action}'...`);

        try {
            const data = await fetchData(endpoint, 'POST', payload, true); // true for useOwnerToken
            if (data.success) {
                displayResult(adminToolResult, 'success', `✅ ${data.message}`);
                loadDashboardStatus(); // Refresh dashboard status
            } else {
                displayResult(adminToolResult, 'error', `❌ ${data.message}`);
            }
        } catch (error) {
            displayResult(adminToolResult, 'error', `⚠️ Gagal menjalankan ${action}: ${error.message}`);
            console.error(`Admin Tool Error (${action}):`, error);
        }
    };


    // Initial Load
    showSection('dashboard'); // Show dashboard on load
    loadDashboardStatus(); // Load data for dashboard
    setInterval(loadDashboardStatus, 60000); // Refresh dashboard status every 1 minute
});