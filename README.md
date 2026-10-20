# Hc Bot App

Aplikasi Android (Cordova + nodejs-mobile) yang menjalankan Node.js langsung di HP. Tujuan akhirnya: menjalankan Hc-bot tanpa Termux.

**Tahap sekarang (M1):** memastikan Node.js berjalan di dalam aplikasi, dan melihat versinya. Baileys butuh Node.js 20 atau lebih baru.

## Cara membangun APK (hanya dari HP)

1. Buat repo baru di GitHub (mis. `hc-bot-app`), lalu unggah semua file proyek ini. Folder tersembunyi `.github` sering sulit diunggah dari HP. Kalau gagal, buka **Add file → Create new file**, ketik nama `.github/workflows/build-apk.yml`, lalu tempel isinya.
2. Buka tab **Actions** → pilih **Build APK** → **Run workflow**.
3. Tunggu sampai hijau (beberapa menit), buka hasil run itu, lalu unduh artefak **hc-bot-app-debug-apk** di bagian bawah.
4. Ekstrak zip-nya, lalu pasang `app-debug.apk` (izinkan "pasang dari sumber tidak dikenal").
5. Buka aplikasi. Kartu **Status mesin Node.js** harus menampilkan versi Node.js.

## Kalau build gagal

Buka run yang merah di tab Actions, lalu salin bagian log yang berwarna merah dan kirim untuk diperiksa. Build pertama sering butuh 1 sampai 3 perbaikan kecil.

## Rencana tahap berikutnya

- M2: pasang Baileys di `www/nodejs-project`, tampilkan kode pairing di layar.
- M3: layanan latar depan (foreground service) agar bot tetap hidup saat aplikasi ditutup.
- M4: pindahkan fitur bot. `yt-dlp`, `ffmpeg`, dan Python tidak ikut, jadi fitur terkait perlu pengganti.
