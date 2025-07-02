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
        // Optimasi: Memastikan animasi toast tidak mengganggu render lain
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
        // Hash sederhana untuk ID pengguna lain, pastikan 8 digit
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            const char = username.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Ubah menjadi integer 32bit
        }
        // Pastikan ID selalu 8 digit
        return Math.abs(hash).toString().substring(0, 8).padEnd(8, '0');
    }

    /**
     * Memperbarui nilai statistik Uptime, Support, dan Encryption.
     */
    function updateStats() {
        const uptimeValue = document.getElementById('uptimeValue');
        const supportValue = document.getElementById('supportValue');
        const encryptionValue = document.getElementById('encryptionValue');

        // Simulasi nilai dinamis
        const currentHour = new Date().getHours();
        const currentDay = new Date().getDay(); // 0 untuk Minggu, 1 untuk Senin, dst.

        // Uptime: Selalu 99.9%
        uptimeValue.textContent = '99.9%';

        // Support: Berubah sesuai hari (misal, lebih tinggi di hari kerja)
        if (currentDay >= 1 && currentDay <= 5) { // Hari kerja (Senin-Jumat)
            supportValue.textContent = '24/7';
        } else { // Akhir pekan (Sabtu-Minggu)
            supportValue.textContent = '12/7';
        }

        // Encryption: Berubah setiap hari (simulasi)
        const encryptionLevels = ['AES-256', 'RSA-4096', 'ECC-384', 'ChaCha20'];
        const dayOfMonth = new Date().getDate();
        encryptionValue.textContent = encryptionLevels[dayOfMonth % encryptionLevels.length];
    }

    // --- Logika Splash Screen ---
    const splashDuration = 2000; // Durasi splash screen: 2 detik (lebih cepat)
    loadingBar.style.animationDuration = `${splashDuration / 1000}s`;

    // Pastikan splash screen menghilang baru tampil notifikasi motivasi
    setTimeout(() => {
        splashScreen.classList.add('hidden');
        splashScreen.addEventListener('transitionend', () => {
            splashScreen.remove(); // Hapus dari DOM setelah animasi selesai
            showMotivationNotification(); // Tampilkan notifikasi motivasi
        }, { once: true });
    }, splashDuration);

    // --- Logika Pemberitahuan Motivasi ---
    function showMotivationNotification() {
        motivationNotification.classList.add('show');
        // Set timeout agar notifikasi menghilang lebih cepat
        setTimeout(() => {
            motivationNotification.classList.remove('show');
            motivationNotification.addEventListener('transitionend', () => {
                motivationNotification.remove(); // Hapus notifikasi setelah hilang sepenuhnya
                checkLoginStatus(); // Cek status login setelah notifikasi hilang
            }, { once: true });
        }, 2000); // Tampilkan selama 2 detik, lalu mulai transisi menghilang
    }

    // --- Logika Autentikasi (Login/Daftar) ---
    /**
     * Memeriksa status login pengguna dan menampilkan UI yang sesuai.
     */
    function checkLoginStatus() {
        if (loggedInUser) {
            loginRegisterContainer.style.display = 'none';
            mainContainer.style.display = 'flex';
            // Gunakan requestAnimationFrame untuk animasi performa tinggi
            requestAnimationFrame(() => {
                mainContainer.classList.add('active'); // Aktifkan animasi masuk untuk main container
                userStatusSection.classList.add('visible'); // Tampilkan status pengguna
                socialMediaFixedContainer.classList.add('visible'); // Tampilkan ikon sosmed mengambang
            });
            myUserIdElement.textContent = users[loggedInUser].id; // Tampilkan ID pengguna
            updateStats(); // Perbarui statistik dinamis
            // Mainkan audio saat login berhasil atau langsung masuk
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

    // Mengubah mode antara Login dan Daftar
    toggleAuthMode.addEventListener('click', () => {
        isRegisterMode = !isRegisterMode;
        formTitle.textContent = isRegisterMode ? 'Daftar Akun Baru' : 'Login';
        authButton.textContent = isRegisterMode ? 'Daftar' : 'Login';
        toggleAuthMode.textContent = isRegisterMode ? 'Sudah punya akun? Login' : 'Belum punya akun? Buat akun baru';
    });

    // Menangani aksi Login atau Daftar
    authButton.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            showToast('Username dan password tidak boleh kosong!', 'error', 'Error');
            return;
        }

        if (isRegisterMode) {
            // Logika Pendaftaran
            if (users[username]) {
                showToast('Username sudah terdaftar!', 'error', 'Gagal');
            } else {
                const userId = generateUserId(username);
                users[username] = { password: password, id: userId };
                localStorage.setItem('users', JSON.stringify(users));
                showToast('Pendaftaran berhasil! Silakan login.', 'success', 'Sukses');
                // Kembali ke mode login setelah daftar
                isRegisterMode = false;
                formTitle.textContent = 'Login';
                authButton.textContent = 'Login';
                toggleAuthMode.textContent = 'Belum punya akun? Buat akun baru';
                usernameInput.value = '';
                passwordInput.value = '';
            }
        } else {
            // Logika Login
            if (users[username] && users[username].password === password) {
                loggedInUser = username;
                localStorage.setItem('loggedInUser', loggedInUser);
                showToast('Login berhasil!', 'success', 'Selamat Datang');
                loginRegisterContainer.style.display = 'none';
                mainContainer.style.display = 'flex';
                // Gunakan requestAnimationFrame untuk animasi performa tinggi
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

    // Menangani aksi Logout
    logoutButton.addEventListener('click', () => {
        loggedInUser = null;
        localStorage.removeItem('loggedInUser');
        showToast('Anda telah logout.', 'info', 'Info');
        loginRegisterContainer.style.display = 'block';
        mainContainer.style.display = 'none';
        // Nonaktifkan animasi saat logout
        mainContainer.classList.remove('active');
        userStatusSection.classList.remove('visible');
        socialMediaFixedContainer.classList.remove('visible');
        usernameInput.value = '';
        passwordInput.value = '';
        // Tutup slide yang mungkin terbuka saat logout
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
    /**
     * Membuka panel slide-out.
     * @param {HTMLElement} slideElement - Elemen slide yang akan dibuka.
     */
    function openSlide(slideElement) {
        // Sembunyikan semua elemen di luar slide saat dibuka
        document.body.classList.add('slide-active');
        slideElement.classList.add('active');
        document.body.style.overflow = 'hidden'; // Mencegah scrolling body saat slide terbuka
    }

    /**
     * Menutup panel slide-out.
     * @param {HTMLElement} slideElement - Elemen slide yang akan ditutup.
     */
    function closeSlide(slideElement) {
        document.body.classList.remove('slide-active');
        slideElement.classList.remove('active');
        document.body.style.overflow = ''; // Mengembalikan scrolling body
    }

    openPaymentSlideBtn.addEventListener('click', () => openSlide(paymentSlide));
    closePaymentSlideBtn.addEventListener('click', () => closeSlide(paymentSlide));

    openSosmedSlideBtn.addEventListener('click', () => openSlide(socialMediaSlide));
    closeSosmedSlideBtn.addEventListener('click', () => closeSlide(socialMediaSlide));

    // Menutup slide saat mengklik di luar area slide (backdrop)
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
        link.download = 'QRIS_KepfoЯannaS.jpg'; // Nama file saat diunduh
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('QRIS berhasil diunduh!', 'success', 'Unduh Berhasil');
    });

    // --- Efek Latar Belakang Partikel ---
    const particlesContainer = document.getElementById('particles');
    const numParticles = 50; // Jumlah partikel yang akan dibuat

    for (let i = 0; i < numParticles; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        const size = Math.random() * 5 + 2; // Ukuran antara 2px dan 7px
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.animationDuration = `${Math.random() * 10 + 5}s`; // Durasi animasi 5-15 detik
        particle.style.animationDelay = `${Math.random() * 5}s`; // Penundaan acak
        particlesContainer.appendChild(particle);
    }
});