document.addEventListener('DOMContentLoaded', () => {
    // Mendapatkan elemen-elemen DOM yang dibutuhkan
    const splashScreen = document.getElementById('splashScreen');
    const loadingBar = document.getElementById('loadingBar');
    const motivationNotification = document.getElementById('motivationNotification');
    const loginRegisterContainer = document.getElementById('loginRegisterContainer');
    const mainContainer = document.querySelector('main.container');
    const formTitle = document.getElementById('formTitle');
    const usernameInput = document.getElementById('usernameInput');
    const passwordInput = document.getElementById('passwordInput');
    const authButton = document.getElementById('authButton');
    const toggleAuthMode = document.getElementById('toggleAuthMode');
    const themeToggle = document.querySelector('.theme-toggle');
    const openPaymentSlideBtn = document.getElementById('openPaymentSlide');
    const closePaymentSlideBtn = document.getElementById('closePaymentSlide');
    const paymentSlide = document.getElementById('paymentSlide');
    const openSosmedSlideBtn = document.getElementById('openSosmedSlide');
    const closeSosmedSlideBtn = document.getElementById('closeSosmedSlide');
    const socialMediaSlide = document.getElementById('socialMediaSlide');
    const copyButtons = document.querySelectorAll('.copy-button');
    const downloadQrisBtn = document.getElementById('downloadQris');
    const qrImage = document.querySelector('.qr-image');
    const logoutButton = document.getElementById('logoutButton');
    const userStatusSection = document.getElementById('userStatusSection');
    const myUserIdElement = document.getElementById('myUserId');
    const otherUsersStatusElement = document.getElementById('otherUsersStatus');
    const socialMediaFixedContainer = document.querySelector('.social-media-container.fixed-top-right');
    const gatewayAudio = document.getElementById('gatewayAudio');
    const toastElement = document.getElementById('toast');
    const toastTitle = toastElement.querySelector('.toast-title');
    const toastMessage = toastElement.querySelector('.toast-message');

    let isRegisterMode = false;
    // Memuat data pengguna dari Local Storage
    const users = JSON.parse(localStorage.getItem('users')) || {};
    let loggedInUser = localStorage.getItem('loggedInUser');

    // --- Fungsi Utilitas ---

    /**
     * Menampilkan notifikasi toast di layar dengan optimasi requestAnimationFrame.
     * @param {string} message - Pesan yang akan ditampilkan.
     * @param {string} type - Tipe notifikasi ('success', 'error', 'info').
     * @param {string} title - Judul notifikasi.
     */
    function showToast(message, type = 'info', title = 'Notifikasi') {
        requestAnimationFrame(() => { // Optimasi DOM manipulation
            if (toastTitle) toastTitle.textContent = title;
            if (toastMessage) toastMessage.textContent = message;
            if (toastElement) {
                toastElement.className = `toast show ${type}`;
                setTimeout(() => {
                    requestAnimationFrame(() => { // Optimasi DOM manipulation
                        toastElement.className = 'toast';
                    });
                }, 3000); // Sembunyikan setelah 3 detik
            }
        });
    }

    /**
     * Menghasilkan ID pengguna berdasarkan username.
     * Khusus 'annas' akan mendapatkan ID '12345678'.
     * @param {string} username - Username pengguna.
     * @returns {string} ID pengguna 8 digit.
     */
    function generateUserId(username) {
        if (username.toLowerCase() === 'annas') {
            return '12345678';
        }
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            const char = username.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; 
        }
        return Math.abs(hash).toString().substring(0, 8).padEnd(8, '0');
    }

    /**
     * Memperbarui nilai statistik Uptime, Support, dan Encryption.
     */
    function updateStats() {
        if (!uptimeValue || !supportValue || !encryptionValue) return;

        const currentHour = new Date().getHours();
        const currentDay = new Date().getDay(); 

        uptimeValue.textContent = '99.9%';

        if (currentDay >= 1 && currentDay <= 5) { 
            supportValue.textContent = '24/7';
        } else { 
            supportValue.textContent = '12/7';
        }

        const encryptionLevels = ['AES-256', 'RSA-4096', 'ECC-384', 'ChaCha20'];
        const dayOfMonth = new Date().getDate();
        encryptionValue.textContent = encryptionLevels[dayOfMonth % encryptionLevels.length];
    }

    // --- Logika Splash Screen ---
    const splashDuration = 1000; // Durasi splash screen sangat cepat: 1 detik
    if (loadingBar) loadingBar.style.animationDuration = `${splashDuration / 1000}s`;

    setTimeout(() => {
        if (splashScreen) {
            requestAnimationFrame(() => { // Optimasi DOM manipulation
                splashScreen.classList.add('hidden');
                splashScreen.addEventListener('transitionend', () => {
                    if (splashScreen) splashScreen.remove(); 
                    showMotivationNotification(); 
                }, { once: true });
            });
        } else {
            showMotivationNotification(); // Fallback if splashScreen doesn't exist
        }
    }, splashDuration);

    // --- Logika Pemberitahuan Motivasi ---
    function showMotivationNotification() {
        if (motivationNotification) {
            requestAnimationFrame(() => { // Optimasi DOM manipulation
                motivationNotification.classList.add('show');
                setTimeout(() => {
                    requestAnimationFrame(() => { // Optimasi DOM manipulation
                        motivationNotification.classList.remove('show');
                        motivationNotification.addEventListener('transitionend', () => {
                            if (motivationNotification) motivationNotification.remove(); 
                            checkLoginStatus(); 
                        }, { once: true });
                    });
                }, 2000); // Tampilkan selama 2 detik, lalu mulai transisi menghilang
            });
        } else {
            checkLoginStatus(); // Fallback if motivationNotification doesn't exist
        }
    }

    // --- Logika Autentikasi (Login/Daftar) ---
    function checkLoginStatus() {
        if (loggedInUser) {
            if (loginRegisterContainer) loginRegisterContainer.style.display = 'none';
            if (mainContainer) {
                mainContainer.style.display = 'flex';
                requestAnimationFrame(() => {
                    mainContainer.classList.add('active'); 
                    if (userStatusSection) userStatusSection.classList.add('visible'); 
                    if (socialMediaFixedContainer) socialMediaFixedContainer.classList.add('visible'); 
                });
            }
            if (myUserIdElement && users[loggedInUser]) myUserIdElement.textContent = users[loggedInUser].id;
            updateStats();
            if (gatewayAudio) {
                gatewayAudio.play().catch(e => console.log("Audio play failed:", e));
            }
        } else {
            if (loginRegisterContainer) loginRegisterContainer.style.display = 'block';
            if (mainContainer) mainContainer.style.display = 'none';
            if (userStatusSection) userStatusSection.classList.remove('visible');
            if (socialMediaFixedContainer) socialMediaFixedContainer.classList.remove('visible');
        }
    }

    if (toggleAuthMode) {
        toggleAuthMode.addEventListener('click', () => {
            isRegisterMode = !isRegisterMode;
            if (formTitle) formTitle.textContent = isRegisterMode ? 'Daftar Akun Baru' : 'Login';
            if (authButton) authButton.textContent = isRegisterMode ? 'Daftar' : 'Login';
            if (toggleAuthMode) toggleAuthMode.textContent = isRegisterMode ? 'Sudah punya akun? Login' : 'Belum punya akun? Buat akun baru';
        });
    }

    if (authButton) {
        authButton.addEventListener('click', () => {
            const username = usernameInput ? usernameInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value.trim() : '';

            if (!username || !password) {
                showToast('Username dan password tidak boleh kosong!', 'error', 'Error');
                return;
            }

            if (isRegisterMode) {
                if (users[username]) {
                    showToast('Username sudah terdaftar!', 'error', 'Gagal');
                } else {
                    const userId = generateUserId(username);
                    users[username] = { password: password, id: userId };
                    localStorage.setItem('users', JSON.stringify(users));
                    showToast('Pendaftaran berhasil! Silakan login.', 'success', 'Sukses');
                    isRegisterMode = false;
                    if (formTitle) formTitle.textContent = 'Login';
                    if (authButton) authButton.textContent = 'Login';
                    if (toggleAuthMode) toggleAuthMode.textContent = 'Belum punya akun? Buat akun baru';
                    if (usernameInput) usernameInput.value = '';
                    if (passwordInput) passwordInput.value = '';
                }
            } else {
                if (users[username] && users[username].password === password) {
                    loggedInUser = username;
                    localStorage.setItem('loggedInUser', loggedInUser);
                    showToast('Login berhasil!', 'success', 'Selamat Datang');
                    if (loginRegisterContainer) loginRegisterContainer.style.display = 'none';
                    if (mainContainer) {
                        mainContainer.style.display = 'flex';
                        requestAnimationFrame(() => {
                            mainContainer.classList.add('active');
                            if (userStatusSection) userStatusSection.classList.add('visible');
                            if (socialMediaFixedContainer) socialMediaFixedContainer.classList.add('visible');
                        });
                    }
                    if (myUserIdElement && users[loggedInUser]) myUserIdElement.textContent = users[loggedInUser].id;
                    updateStats();
                    if (gatewayAudio) {
                        gatewayAudio.play().catch(e => console.log("Audio play failed:", e));
                    }
                } else {
                    showToast('Username atau password salah!', 'error', 'Gagal Login');
                }
            }
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            loggedInUser = null;
            localStorage.removeItem('loggedInUser');
            showToast('Anda telah logout.', 'info', 'Info');
            if (loginRegisterContainer) loginRegisterContainer.style.display = 'block';
            if (mainContainer) mainContainer.style.display = 'none';
            requestAnimationFrame(() => { // Optimasi DOM manipulation
                if (mainContainer) mainContainer.classList.remove('active');
                if (userStatusSection) userStatusSection.classList.remove('visible');
                if (socialMediaFixedContainer) socialMediaFixedContainer.classList.remove('visible');
            });
            if (usernameInput) usernameInput.value = '';
            if (passwordInput) passwordInput.value = '';
            if (paymentSlide) paymentSlide.classList.remove('active');
            if (socialMediaSlide) socialMediaSlide.classList.remove('active');
            // Pastikan body overflow direset dengan benar setelah slide ditutup
            document.body.style.overflow = 'hidden'; 
            document.body.style.touchAction = 'none';
        });
    }

    // --- Logika Ganti Tema ---
    const currentTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (themeToggle && currentTheme === 'light') {
        themeToggle.classList.add('light-mode');
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            let theme = document.documentElement.getAttribute('data-theme');
            if (theme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('theme', 'light');
                requestAnimationFrame(() => { themeToggle.classList.add('light-mode'); });
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                requestAnimationFrame(() => { themeToggle.classList.remove('light-mode'); });
            }
        });
    }

    // --- Logika Panel Slide-out (Pembayaran & Media Sosial) ---
    function openSlide(slideElement) {
        if (!slideElement) return;
        requestAnimationFrame(() => { // Optimasi DOM manipulation
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none'; 
            slideElement.classList.add('active');
        });
    }

    function closeSlide(slideElement) {
        if (!slideElement) return;
        requestAnimationFrame(() => { // Optimasi DOM manipulation
            slideElement.classList.remove('active');
            // Kembali mengatur body overflow setelah transisi selesai
            slideElement.addEventListener('transitionend', () => {
                document.body.style.overflow = 'hidden'; // Tetap hidden untuk mencegah scroll keseluruhan
                document.body.style.touchAction = 'none'; // Tetap none
            }, { once: true });
        });
    }

    if (openPaymentSlideBtn) openPaymentSlideBtn.addEventListener('click', () => openSlide(paymentSlide));
    if (closePaymentSlideBtn) closePaymentSlideBtn.addEventListener('click', () => closeSlide(paymentSlide));

    if (openSosmedSlideBtn) openSosmedSlideBtn.addEventListener('click', () => openSlide(socialMediaSlide));
    if (closeSosmedSlideBtn) closeSosmedSlideBtn.addEventListener('click', () => closeSlide(socialMediaSlide));

    document.querySelectorAll('.slide-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (event) => {
            if (event.target === backdrop) {
                if (paymentSlide) closeSlide(paymentSlide);
                if (socialMediaSlide) closeSlide(socialMediaSlide);
            }
        });
    });

    // --- Fungsi Salin ke Clipboard ---
    copyButtons.forEach(button => {
        button.addEventListener('click', () => {
            const textToCopy = button.dataset.copy;
            if (textToCopy) {
                navigator.clipboard.writeText(textToCopy)
                    .then(() => {
                        showToast(`Nomor ${textToCopy} berhasil disalin!`, 'success', 'Disalin');
                    })
                    .catch(err => {
                        console.error('Gagal menyalin: ', err);
                        showToast('Gagal menyalin nomor.', 'error', 'Error');
                    });
            } else {
                showToast('Tidak ada teks untuk disalin.', 'error', 'Error');
            }
        });
    });

    // --- Fungsi Download QRIS ---
    if (downloadQrisBtn) {
        downloadQrisBtn.addEventListener('click', () => {
            const imageUrl = qrImage ? qrImage.src : '';
            if (imageUrl) {
                const link = document.createElement('a');
                link.href = imageUrl;
                link.download = 'QRIS_KepfoЯannaS.jpg'; 
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showToast('QRIS berhasil diunduh!', 'success', 'Unduh Berhasil');
            } else {
                showToast('Gambar QRIS tidak ditemukan.', 'error', 'Error');
            }
        });
    }

    // --- Efek Latar Belakang Partikel ---
    const particlesContainer = document.getElementById('particles');
    const numParticles = 50; 

    if (particlesContainer) {
        for (let i = 0; i < numParticles; i++) {
            const particle = document.createElement('div');
            particle.classList.add('particle');
            const size = Math.random() * 5 + 2; 
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.animationDuration = `${Math.random() * 10 + 5}s`; 
            particle.style.animationDelay = `${Math.random() * 5}s`; 
            particlesContainer.appendChild(particle);
        }
    }
});