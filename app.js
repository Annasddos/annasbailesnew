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
     * Menampilkan notifikasi toast di layar.
     * @param {string} message - Pesan yang akan ditampilkan.
     * @param {string} type - Tipe notifikasi ('success', 'error', 'info').
     * @param {string} title - Judul notifikasi.
     */
    function showToast(message, type = 'info', title = 'Notifikasi') {
        requestAnimationFrame(() => {
            toastTitle.textContent = title;
            toastMessage.textContent = message;
            toastElement.className = `toast show ${type}`;
            setTimeout(() => {
                toastElement.className = 'toast';
            }, 3000); // Sembunyikan setelah 3 detik
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
        const uptimeValue = document.getElementById('uptimeValue');
        const supportValue = document.getElementById('supportValue');
        const encryptionValue = document.getElementById('encryptionValue');

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
    const splashDuration = 1500; // Durasi splash screen lebih cepat: 1.5 detik
    loadingBar.style.animationDuration = `${splashDuration / 1000}s`;

    setTimeout(() => {
        splashScreen.classList.add('hidden');
        splashScreen.addEventListener('transitionend', () => {
            splashScreen.remove(); 
            showMotivationNotification(); 
        }, { once: true });
    }, splashDuration);

    // --- Logika Pemberitahuan Motivasi ---
    function showMotivationNotification() {
        motivationNotification.classList.add('show');
        setTimeout(() => {
            motivationNotification.classList.remove('show');
            motivationNotification.addEventListener('transitionend', () => {
                motivationNotification.remove(); 
                checkLoginStatus(); 
            }, { once: true });
        }, 2000); // Tampilkan selama 2 detik, lalu mulai transisi menghilang
    }

    // --- Logika Autentikasi (Login/Daftar) ---
    function checkLoginStatus() {
        if (loggedInUser) {
            loginRegisterContainer.style.display = 'none';
            mainContainer.style.display = 'flex';
            requestAnimationFrame(() => {
                mainContainer.classList.add('active'); 
                userStatusSection.classList.add('visible'); 
                socialMediaFixedContainer.classList.add('visible'); 
            });
            myUserIdElement.textContent = users[loggedInUser].id;
            updateStats();
            if (gatewayAudio) {
                gatewayAudio.play().catch(e => console.log("Audio play failed:", e));
            }
        } else {
            loginRegisterContainer.style.display = 'block';
            mainContainer.style.display = 'none';
            userStatusSection.classList.remove('visible');
            socialMediaFixedContainer.classList.remove('visible');
        }
    }

    toggleAuthMode.addEventListener('click', () => {
        isRegisterMode = !isRegisterMode;
        formTitle.textContent = isRegisterMode ? 'Daftar Akun Baru' : 'Login';
        authButton.textContent = isRegisterMode ? 'Daftar' : 'Login';
        toggleAuthMode.textContent = isRegisterMode ? 'Sudah punya akun? Login' : 'Belum punya akun? Buat akun baru';
    });

    authButton.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

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
                formTitle.textContent = 'Login';
                authButton.textContent = 'Login';
                toggleAuthMode.textContent = 'Belum punya akun? Buat akun baru';
                usernameInput.value = '';
                passwordInput.value = '';
            }
        } else {
            if (users[username] && users[username].password === password) {
                loggedInUser = username;
                localStorage.setItem('loggedInUser', loggedInUser);
                showToast('Login berhasil!', 'success', 'Selamat Datang');
                loginRegisterContainer.style.display = 'none';
                mainContainer.style.display = 'flex';
                requestAnimationFrame(() => {
                    mainContainer.classList.add('active');
                    userStatusSection.classList.add('visible');
                    socialMediaFixedContainer.classList.add('visible');
                });
                myUserIdElement.textContent = users[loggedInUser].id;
                updateStats();
                if (gatewayAudio) {
                    gatewayAudio.play().catch(e => console.log("Audio play failed:", e));
                }
            } else {
                showToast('Username atau password salah!', 'error', 'Gagal Login');
            }
        }
    });

    logoutButton.addEventListener('click', () => {
        loggedInUser = null;
        localStorage.removeItem('loggedInUser');
        showToast('Anda telah logout.', 'info', 'Info');
        loginRegisterContainer.style.display = 'block';
        mainContainer.style.display = 'none';
        mainContainer.classList.remove('active');
        userStatusSection.classList.remove('visible');
        socialMediaFixedContainer.classList.remove('visible');
        usernameInput.value = '';
        passwordInput.value = '';
        paymentSlide.classList.remove('active');
        socialMediaSlide.classList.remove('active');
    });

    // --- Logika Ganti Tema ---
    const currentTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (currentTheme === 'light') {
        themeToggle.classList.add('light-mode');
    }

    themeToggle.addEventListener('click', () => {
        let theme = document.documentElement.getAttribute('data-theme');
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
            themeToggle.classList.add('light-mode');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            themeToggle.classList.remove('light-mode');
        }
    });

    // --- Logika Panel Slide-out (Pembayaran & Media Sosial) ---
    function openSlide(slideElement) {
        // Mengunci scroll body saat slide aktif
        document.body.style.overflow = 'hidden';
        document.body.style.touchAction = 'none'; // Mencegah geser/zoom pada touch devices

        // Pastikan slide menutupi seluruh layar
        slideElement.style.width = '100vw';
        slideElement.style.height = '100vh';
        slideElement.classList.add('active');
    }

    function closeSlide(slideElement) {
        // Mengembalikan scroll body saat slide tidak aktif
        document.body.style.overflow = 'hidden'; // Tetap hidden untuk mencegah scroll keseluruhan
        document.body.style.touchAction = 'none'; // Tetap none
        
        slideElement.classList.remove('active');
        // Mungkin perlu delay sedikit sebelum mengembalikan overflow, tergantung transisi CSS
        setTimeout(() => {
            // Karena body sudah fixed dan overflow hidden, tidak perlu mengubah ini
            // Ini akan menjaga anti-scroll dan anti-zoom di seluruh aplikasi
        }, 500); // Sesuaikan dengan durasi transisi slide-out
    }

    openPaymentSlideBtn.addEventListener('click', () => openSlide(paymentSlide));
    closePaymentSlideBtn.addEventListener('click', () => closeSlide(paymentSlide));

    openSosmedSlideBtn.addEventListener('click', () => openSlide(socialMediaSlide));
    closeSosmedSlideBtn.addEventListener('click', () => closeSlide(socialMediaSlide));

    document.querySelectorAll('.slide-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (event) => {
            if (event.target === backdrop) {
                closeSlide(paymentSlide);
                closeSlide(socialMediaSlide);
            }
        });
    });

    // --- Fungsi Salin ke Clipboard ---
    copyButtons.forEach(button => {
        button.addEventListener('click', () => {
            const textToCopy = button.dataset.copy;
            navigator.clipboard.writeText(textToCopy)
                .then(() => {
                    showToast(`Nomor ${textToCopy} berhasil disalin!`, 'success', 'Disalin');
                })
                .catch(err => {
                    console.error('Gagal menyalin: ', err);
                    showToast('Gagal menyalin nomor.', 'error', 'Error');
                });
        });
    });

    // --- Fungsi Download QRIS ---
    downloadQrisBtn.addEventListener('click', () => {
        const imageUrl = qrImage.src;
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = 'QRIS_KepfoЯannaS.jpg'; 
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('QRIS berhasil diunduh!', 'success', 'Unduh Berhasil');
    });

    // --- Efek Latar Belakang Partikel ---
    const particlesContainer = document.getElementById('particles');
    const numParticles = 50; 

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
});