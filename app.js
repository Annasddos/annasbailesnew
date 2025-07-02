// app.js

// --- DOM Element References ---
const splashScreen = document.getElementById('splashScreen');
const loadingBar = document.getElementById('loadingBar');
const loginRegisterContainer = document.getElementById('loginRegisterContainer');
const mainContent = document.querySelector('main.container');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const authButton = document.getElementById('authButton');
const toggleAuthMode = document.getElementById('toggleAuthMode');
const formTitle = document.getElementById('formTitle');
const myUserIdElement = document.getElementById('myUserId');
const myStatusIndicator = document.getElementById('myStatusIndicator');
const otherUsersStatus = document.getElementById('otherUsersStatus');
const userStatusSection = document.getElementById('userStatusSection'); 

// Stats elements
const uptimeValue = document.getElementById('uptimeValue');
const supportValue = document.getElementById('supportValue');
const encryptionValue = document.getElementById('encryptionValue');

// Payment Slide Elements
const openPaymentSlideButton = document.getElementById('openPaymentSlide');
const closePaymentSlideButton = document.getElementById('closePaymentSlide');
const paymentSlide = document.getElementById('paymentSlide');

// Social Media Slide Elements
const openSosmedSlideButton = document.getElementById('openSosmedSlide');
const closeSosmedSlideButton = document.getElementById('closeSosmedSlide');
const socialMediaSlide = document.getElementById('socialMediaSlide');

// Bug Panel Elements
const openBugSlideButton = document.getElementById('openBugSlide');
const closeBugSlideButton = document.getElementById('closeBugSlide');
const bugSlide = document.getElementById('bugSlide');
const botStatusElement = document.getElementById('botStatus');
const bugNoInput = document.getElementById('bugNoInput');
const sendPairingCodeButton = document.getElementById('sendPairingCode');
const sendNoTargetButton = document.getElementById('sendNoTarget');
const toggleDelayButton = document.getElementById('toggleDelay');
const delayStatusElement = document.getElementById('delayStatus');
const triggerFCButton = document.getElementById('triggerFC');
const targetOsRadios = document.querySelectorAll('input[name="targetOs"]');

// Logout Button
const logoutButton = document.getElementById('logoutButton');

// Other global elements
const themeToggle = document.querySelector('.theme-toggle');
const body = document.body;
const particlesContainer = document.getElementById('particles');
const gatewayAudio = document.getElementById('gatewayAudio');

// --- Global Variables ---
let isLoginMode = true; // State for login/register form
// Load registered users from localStorage, or initialize with 'annas'
const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers')) || {}; 

// Ensure 'annas' user exists with specific ID, or update if password changed
if (!registeredUsers['annas'] || registeredUsers['annas'].password !== '1' || registeredUsers['annas'].id !== 12345678) {
    registeredUsers['annas'] = { password: '1', id: 12345678 };
    localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
}

let currentUserId = null; // To store logged-in user's ID
let currentUsername = null; // To store current username for auto-login
let otherUsersStatusInterval = null; // Keep track of the interval for clearing

// Bug Panel State (Simulated)
let isBotOnline = false;
let isDelayActive = false;


// --- Helper Functions ---

/**
 * Generates a unique 8-digit user ID.
 * Ensures the ID is unique among currently registered users.
 * @returns {number}
 */
function generateUniqueId() {
    let id;
    const allRegisteredIds = Object.values(registeredUsers).map(user => user.id);
    do {
        id = Math.floor(10000000 + Math.random() * 90000000);
    } while (allRegisteredIds.includes(id) || id === currentUserId); // Ensure unique and not same as current user
    return id;
}

/**
 * Sets the current user's online/offline/idle status.
 * @param {string} status - 'online', 'offline', or 'idle'
 */
function setMyStatus(status) {
    if (myStatusIndicator) {
        myStatusIndicator.classList.remove('online', 'offline', 'idle');
        myStatusIndicator.classList.add(status);
    }
}

/**
 * Simulates and updates other users' online/offline status and ID.
 */
function updateOtherUsersStatus() {
    const statuses = ['Online', 'Offline', 'Online', 'Online', 'Offline', 'Offline', 'Online'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    
    let otherId;
    do {
        otherId = Math.floor(10000000 + Math.random() * 90000000); // Generate temporary unique ID for other users
    } while (otherId === currentUserId); // Make sure it's not the same as logged-in user's ID

    if (otherUsersStatus) {
        otherUsersStatus.textContent = `${randomStatus} (ID: ${otherId})`;
    }
}

/**
 * Updates dynamic stats (Uptime, Support, Encryption) based on current date.
 */
function updateDynamicStats() {
    const today = new Date();
    const dayOfMonth = today.getDate();
    const month = today.getMonth() + 1; // getMonth() returns 0-11

    if (uptimeValue) {
        // Example: Uptime always high, slightly changes
        uptimeValue.textContent = `99.${(dayOfMonth % 10) + 9}%`; 
    }
    if (supportValue) {
        // Example: Support hours based on day
        supportValue.textContent = `${(dayOfMonth % 3) + 2}4/7`;
    }
    if (encryptionValue) {
        // Example: Encryption strength changes slightly
        const strengths = ['256-bit', '512-bit', '384-bit'];
        encryptionValue.textContent = strengths[dayOfMonth % strengths.length];
    }
}

/**
 * Displays a toast notification.
 * @param {string} title - The title of the toast.
 * @param {string} message - The message content.
 * @param {string} iconClass - Class for the toast icon ('success', 'warning', 'error', 'info').
 */
function showToast(title, message, iconClass = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    const toastTitle = toast.querySelector('.toast-title');
    const toastMessage = toast.querySelector('.toast-message');
    const toastIcon = toast.querySelector('.toast-icon');

    if (toastTitle) toastTitle.textContent = title;
    if (toastMessage) toastMessage.textContent = message;
    
    if (toastIcon) {
        toastIcon.className = 'toast-icon'; // Reset class
        if (iconClass) {
            toastIcon.classList.add(iconClass); // Add the new icon class
        }
    }
    
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000); // Hide after 3 seconds
}

/**
 * Creates dynamic particles in the background.
 */
function createParticles() {
    if (particlesContainer) {
        particlesContainer.innerHTML = ''; 
    } else {
        console.warn("Particles container not found! Cannot create particles.");
        return;
    }

    const numParticles = 50; 

    for (let i = 0; i < numParticles; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        
        const x = Math.random() * 100; 
        const y = Math.random() * 100; 
        particle.style.left = `${x}vw`;
        particle.style.top = `${y}vh`;

        const size = Math.random() * 5 + 3; 
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;

        const animationDelay = Math.random() * 6; 
        particle.style.animationDelay = `${animationDelay}s`;
        
        const animationDuration = Math.random() * 10 + 6; 
        particle.style.setProperty('--animation-duration', `${animationDuration}s`); 
        particle.style.setProperty('--particle-opacity', `${Math.random() * 0.4 + 0.6}`); 

        particlesContainer.appendChild(particle);
    }
}

/**
 * Handles successful login: shows main content, sets user status, plays audio.
 * @param {string} username - The username of the logged-in user.
 * @param {number} userId - The ID of the logged-in user.
 */
function handleLoginSuccess(username, userId) {
    showToast('Berhasil!', `Selamat datang, ${username}!`, 'success');
    currentUserId = userId;
    currentUsername = username; // Store for auto-login
    localStorage.setItem('loggedInUser', JSON.stringify({ username: username, id: userId })); // Save login session

    if (myUserIdElement) myUserIdElement.textContent = currentUserId; 
    if (userStatusSection) {
        userStatusSection.style.display = 'flex'; 
        setTimeout(() => {
            userStatusSection.classList.add('visible'); 
        }, 50); 
    }
    
    if (loginRegisterContainer) loginRegisterContainer.classList.remove('active'); 
    if (mainContent) mainContent.style.display = 'block'; 
    setMyStatus('online'); 
    updateDynamicStats(); // Update stats on login
    if (gatewayAudio) gatewayAudio.play().catch(e => console.error("Audio play failed:", e)); 
    if (!otherUsersStatusInterval) { // Start interval only if not already running
        otherUsersStatusInterval = setInterval(updateOtherUsersStatus, 5000); 
    }
    // Set bot status randomly on login
    isBotOnline = Math.random() < 0.7; // 70% chance to be online
    updateBotStatusDisplay();
}

/**
 * Handles user logout.
 */
function handleLogout() {
    localStorage.removeItem('loggedInUser'); // Clear login session
    currentUserId = null;
    currentUsername = null;

    if (userStatusSection) {
        userStatusSection.classList.remove('visible');
        setTimeout(() => {
            userStatusSection.style.display = 'none'; // Hide after fade out
        }, 500); 
    }
    if (mainContent) mainContent.style.display = 'none'; 
    if (loginRegisterContainer) loginRegisterContainer.classList.add('active'); // Show login form again
    setMyStatus('idle'); // Set status back to idle
    showToast('Berhasil!', 'Anda telah logout.', 'info');
    if (otherUsersStatusInterval) { // Clear interval for other users status
        clearInterval(otherUsersStatusInterval);
        otherUsersStatusInterval = null;
    }
    // Reset bot status on logout
    isBotOnline = false;
    isDelayActive = false;
    updateBotStatusDisplay();
    if (delayStatusElement) delayStatusElement.classList.remove('active'); // Ensure delay indicator is off
    if (delayStatusElement) delayStatusElement.textContent = 'OFF';
}

/**
 * Updates the display of bot status.
 */
function updateBotStatusDisplay() {
    if (botStatusElement) {
        botStatusElement.textContent = isBotOnline ? 'Online' : 'Offline';
        botStatusElement.classList.remove('status-online', 'status-offline');
        botStatusElement.classList.add(isBotOnline ? 'status-online' : 'status-offline');
    }
}

/**
 * Validates a given phone number.
 * Simple validation: starts with 62, minimum 10 digits, max 15.
 * @param {string} number - The phone number to validate.
 * @returns {boolean}
 */
function isValidPhoneNumber(number) {
    // Basic validation for Indonesian numbers
    const regex = /^62[0-9]{8,13}$/; // Starts with 62, 8-13 more digits
    return regex.test(number);
}


// --- Event Listeners and Main Logic ---

// 1. Initial Page Load & Splash Screen Logic
window.addEventListener('load', () => {
    // Initialize theme from localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        body.setAttribute('data-theme', savedTheme);
    } else {
        body.setAttribute('data-theme', 'dark'); 
    }
    
    createParticles(); // Create dynamic particles
    updateDynamicStats(); // Initial update of dynamic stats
    setInterval(updateDynamicStats, 24 * 60 * 60 * 1000); // Update daily

    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));

    // Simulate loading bar progress
    let progress = 0;
    const interval = setInterval(() => {
        progress += 10;
        if (loadingBar) loadingBar.style.width = `${progress}%`;
        if (progress >= 100) {
            clearInterval(interval);
            // After loading bar is full, start splash screen fade out
            setTimeout(() => {
                if (splashScreen) {
                    splashScreen.classList.add('hidden'); 
                }
                setTimeout(() => {
                    if (splashScreen) {
                        splashScreen.style.display = 'none'; 
                    }
                    if (loggedInUser && registeredUsers[loggedInUser.username] && registeredUsers[loggedInUser.username].id === loggedInUser.id) {
                        // If logged in, skip login form
                        handleLoginSuccess(loggedInUser.username, loggedInUser.id);
                    } else {
                        // Otherwise, show login form
                        if (loginRegisterContainer) {
                            loginRegisterContainer.classList.add('active'); 
                        }
                    }
                }, 1000); // Wait for fade-out animation
            }, 500); 
        }
    }, 100); 

    // Start other users status interval regardless of login state (updates only if content is visible)
    otherUsersStatusInterval = setInterval(updateOtherUsersStatus, 5000);
});


// 2. Login/Register Form Logic
if (toggleAuthMode) {
    toggleAuthMode.addEventListener('click', () => {
        isLoginMode = !isLoginMode;
        if (formTitle) formTitle.textContent = isLoginMode ? 'Login' : 'Daftar Akun Baru';
        if (authButton) authButton.textContent = isLoginMode ? 'Login' : 'Daftar';
        if (toggleAuthMode) toggleAuthMode.textContent = isLoginMode ? 'Belum punya akun? Buat akun baru' : 'Sudah punya akun? Login';
        if (passwordInput) passwordInput.setAttribute('autocomplete', isLoginMode ? 'current-password' : 'new-password');
        
        if (usernameInput) usernameInput.value = '';
        if (passwordInput) passwordInput.value = '';
    });
}

if (authButton) {
    authButton.addEventListener('click', () => {
        const username = usernameInput ? usernameInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value.trim() : '';

        if (username === "" || password === "") {
            showToast('Peringatan', 'Username dan password tidak boleh kosong!', 'warning');
            return;
        }

        if (isLoginMode) {
            // --- Simulate Login ---
            if (registeredUsers[username] && registeredUsers[username].password === password) {
                handleLoginSuccess(username, registeredUsers[username].id);
            } else {
                showToast('Gagal', 'Username atau password salah!', 'error');
            }
        } else {
            // --- Simulate Registration ---
            if (registeredUsers[username]) {
                showToast('Gagal', 'Username sudah terdaftar. Gunakan nama lain.', 'error');
            } else {
                // Ensure 'annas' is always 12345678, others get random
                const newUserId = (username === 'annas' && password === '1') ? 12345678 : generateUniqueId();
                registeredUsers[username] = { password: password, id: newUserId };
                localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers)); 
                showToast('Berhasil!', 'Akun berhasil dibuat! Silakan login.', 'success');
                
                if (usernameInput) usernameInput.value = '';
                if (passwordInput) passwordInput.value = '';
                isLoginMode = true; 
                if (formTitle) formTitle.textContent = 'Login';
                if (authButton) authButton.textContent = 'Login';
                if (toggleAuthMode) toggleAuthMode.textContent = 'Belum punya akun? Buat akun baru';
                if (passwordInput) passwordInput.setAttribute('autocomplete', 'current-password');
            }
        }
    });
}


// 3. Payment Slide Logic
if (openPaymentSlideButton) {
    openPaymentSlideButton.addEventListener('click', () => {
        if (paymentSlide) paymentSlide.classList.add('active');
        if (body) body.classList.add('payment-slide-active'); 
    });
}

if (closePaymentSlideButton) {
    closePaymentSlideButton.addEventListener('click', () => {
        if (paymentSlide) paymentSlide.classList.remove('active');
        if (body) body.classList.remove('payment-slide-active');
    });
}

// 4. Social Media Slide Logic
if (openSosmedSlideButton) {
    openSosmedSlideButton.addEventListener('click', () => {
        if (socialMediaSlide) socialMediaSlide.classList.add('active');
        if (body) body.classList.add('payment-slide-active'); 
    });
}

if (closeSosmedSlideButton) {
    closeSosmedSlideButton.addEventListener('click', () => {
        if (socialMediaSlide) socialMediaSlide.classList.remove('active');
        if (body) body.classList.remove('payment-slide-active');
    });
}

// 5. Bug Panel Logic
if (openBugSlideButton) {
    openBugSlideButton.addEventListener('click', () => {
        if (bugSlide) bugSlide.classList.add('active');
        if (body) body.classList.add('payment-slide-active'); // Re-use class for blocking scroll
        updateBotStatusDisplay(); // Update status when panel opens
    });
}

if (closeBugSlideButton) {
    closeBugSlideButton.addEventListener('click', () => {
        if (bugSlide) bugSlide.classList.remove('active');
        if (body) body.classList.remove('payment-slide-active');
    });
}

if (sendPairingCodeButton) {
    sendPairingCodeButton.addEventListener('click', () => {
        if (!isBotOnline) {
            showToast('Bot Offline', 'Bot tidak online untuk mengirim kode pairing.', 'error');
            return;
        }
        const targetNo = bugNoInput ? bugNoInput.value.trim() : '';
        if (!isValidPhoneNumber(targetNo)) {
            showToast('Invalid Number', 'Nomor target tidak valid. Gunakan format 62xxxxxx.', 'warning');
            return;
        }
        const selectedOs = document.querySelector('input[name="targetOs"]:checked');
        const osValue = selectedOs ? selectedOs.value : 'unknown';
        
        // Simulating bug sent effect
        showToast('Bug Sent!', `Mengirim kode pairing ke ${targetNo} (${osValue})...`, 'success');
    });
}

if (sendNoTargetButton) {
    sendNoTargetButton.addEventListener('click', () => {
        if (!isBotOnline) {
            showToast('Bot Offline', 'Bot tidak online untuk mengirim tanpa target.', 'error');
            return;
        }
        showToast('Bug Sent!', 'Mengirim tanpa nomor target...', 'success');
    });
}

if (toggleDelayButton) {
    toggleDelayButton.addEventListener('click', () => {
        if (!isBotOnline) {
            showToast('Bot Offline', 'Bot tidak online untuk mengubah delay.', 'error');
            return;
        }
        isDelayActive = !isDelayActive;
        if (delayStatusElement) {
            delayStatusElement.textContent = isDelayActive ? 'ON' : 'OFF';
            delayStatusElement.classList.toggle('active', isDelayActive);
        }
        showToast('Delay Status', `Delay bot sekarang ${isDelayActive ? 'AKTIF' : 'NONAKTIF'}.`, 'info');
    });
}

if (triggerFCButton) {
    triggerFCButton.addEventListener('click', () => {
        if (!isBotOnline) {
            showToast('Bot Offline', 'Bot tidak online untuk trigger FC.', 'error');
            return;
        }
        const targetNo = bugNoInput ? bugNoInput.value.trim() : '';
        if (!isValidPhoneNumber(targetNo)) {
            showToast('Invalid Number', 'Nomor target tidak valid. Gunakan format 62xxxxxx.', 'warning');
            return;
        }
        showToast('Bug Sent!', `Mengirim perintah FC ke ${targetNo}...`, 'success');
    });
}

// 6. Logout Logic
if (logoutButton) {
    logoutButton.addEventListener('click', handleLogout);
}


// 7. Theme Toggle Logic
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const currentTheme = body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        if (body) body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme); 
        createParticles(); 
    });
}

// 8. Copy Button Logic for payment methods
document.querySelectorAll('.copy-button').forEach(button => {
    button.addEventListener('click', () => {
        const textToCopy = button.dataset.copy;
        if (textToCopy) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                showToast('Berhasil', 'Nomor berhasil disalin!', 'success');
            }).catch(err => {
                showToast('Gagal', 'Gagal menyalin nomor!', 'error');
                console.error('Gagal menyalin:', err);
            });
        } else {
            showToast('Error', 'Tidak ada teks untuk disalin!', 'error');
        }
    });
});

// 9. Status Toggle Logic (Dana, GoPay, OVO)
document.querySelectorAll('.status-toggle').forEach(button => {
    button.addEventListener('click', () => {
        const paymentCard = button.closest('.payment-card');
        if (!paymentCard) return;

        const currentStatus = paymentCard.dataset.status;
        const copyButton = paymentCard.querySelector('.copy-button');
        const statusText = button.querySelector('.status-text');
        const statusIndicator = button.querySelector('.status-indicator');

        if (currentStatus === 'ready') {
            paymentCard.dataset.status = 'not-ready';
            if (statusText) statusText.textContent = 'Not Ready';
            if (statusIndicator) {
                statusIndicator.classList.remove('ready');
                statusIndicator.classList.add('not-ready');
            }
            if (copyButton) copyButton.disabled = true;
            showToast('Status Diperbarui', 'Metode pembayaran menjadi Tidak Siap.', 'warning');
        } else {
            paymentCard.dataset.status = 'ready';
            if (statusText) statusText.textContent = 'Ready';
            if (statusIndicator) {
                statusIndicator.classList.remove('not-ready');
                statusIndicator.classList.add('ready');
            }
            if (copyButton) copyButton.disabled = false;
            showToast('Status Diperbarui', 'Metode pembayaran menjadi Siap.', 'success');
        }
    });
});

// 10. Download QRIS Logic (placeholder)
const downloadQrisButton = document.getElementById('downloadQris');
if (downloadQrisButton) {
    downloadQrisButton.addEventListener('click', () => {
        showToast('Informasi', 'Fungsi unduh QRIS belum diimplementasikan.', 'info');
    });
}