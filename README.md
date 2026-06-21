# RestoFlow POS - Smart & Premium Point of Sale

RestoFlow is a modern, high-performance, cloud-synced Point of Sale (POS) system designed for premium dining experiences and restaurant workflows. It is built using **Next.js**, **Supabase**, **Zustand**, **Tailwind CSS v4**, and **Shadcn UI**.

---

## 🌟 Fitur Utama (Key Features)

### 1. Sistem Autentikasi Modern (JWT & Session Sync)
- Desain login premium dengan ambient mesh gradient & show/hide password toggle.
- Flow otentikasi client-side menggunakan token **JWT** (`localStorage`).
- Proteksi route admin/cashier otomatis melalui `AuthProvider` (pengalihan otomatis jika belum login / sesi berakhir).

### 2. POS Kasir (Cashier POS)
- Antarmuka dual-pane responsif (kiri untuk menu, kanan untuk keranjang belanja) di layar desktop.
- Desain adaptif tab-based di layar mobile/tablet ("Menu" vs "Keranjang") lengkap dengan badge jumlah item.
- Kalkulasi otomatis untuk subtotal, diskon, pajak penjualan, total, nominal pembayaran, dan kembalian.
- Simpan pesanan sementara (Hold) dan batalkan transaksi secara instan.

### 3. Pemesanan Mandiri Customer (Self-Order Wizard)
- Halaman publik `/order` yang dioptimalkan untuk akses scan QR Code meja (tanpa memerlukan login kasir).
- Deteksi otomatis nomor meja melalui query parameter URL (Contoh: `/order?table=meja_01` mengunci pilihan ke "Meja 01").
- Wizard multi-langkah interaktif: Informasi Pelanggan ➡️ Pilih Menu ➡️ Rincian & Pajak ➡️ Pembayaran Bank Transfer/QRIS (dengan pengunggahan bukti bayar) ➡️ Selesai & Pelacakan.

### 4. Notifikasi Pesanan Masuk Real-time
- Integrasi channel realtime Supabase untuk mendeteksi pesanan meja baru seketika.
- **Audio Chime**: Memainkan efek suara lonceng ("ding-dong") menggunakan Web Audio API.
- **Visual Alert Toast**: Kartu notifikasi melayang (toast alert) berisi ID, nama pelanggan, lokasi meja, dan total pembayaran.
- **Header Notification Center**: Lencana (badge) counter aktif yang membal pada ikon Bell. Ketika diklik, menampilkan dropdown 5 transaksi pending terbaru.
- **Auto-Open Drawer**: Mengklik notifikasi pesanan di dropdown otomatis mengarahkan ke dashboard dan membuka laci verifikasi bukti bayar order tersebut.

### 5. Dasbor Manajemen Pesanan (Admin Orders Control)
- Dasbor `/orders` untuk memproses dan memverifikasi pesanan mandiri pelanggan.
- Tab filter status dinamis: Menunggu Konfirmasi, Sedang Disiapkan, Dalam Pengiriman, Selesai, dan Ditolak.
- Tampilan laci detail pembayaran (detail customer, daftar produk, dan bukti pembayaran yang dapat diunduh/diperbesar).
- Workflow status pengerjaan (Mulai Siapkan ➡️ Kirim Pesanan ➡️ Selesaikan Pesanan) lengkap dengan simulasi pengiriman email notifikasi.

### 6. Master Data & Layout Responsif
- **Master Meja**: Grid kartu meja makan interaktif untuk mengelola meja (Aktif/Nonaktif) dan mencetak QR Code pemesanan mandiri per meja.
- **Master Produk**: Manajemen stok, harga beli, harga jual, barcode, kategori, dan foto menu.
- **Master Kategori, Pelanggan, Supplier, & Pengguna**: Database entitas penunjang transaksi toko.
- **Sidebar & Header**: Sidebar desktop yang dapat dilipat (collapsible) menyimpan status preferensi, serta sliding overlay drawer di perangkat mobile.

### 7. Pengaturan & Laporan (Settings & Reports)
- **Settings**: Konfigurasi profil toko, persentase pajak, batas ukuran berkas bukti bayar, dan manajemen banyak rekening bank transfer toko.
- **Reports**: Grafik tren penjualan, produk terlaris harian, dan tabel rincian transaksi (gabungan POS & order meja) dengan kolom sumber (POS Kasir / Pesanan Meja) serta ekspor CSV.
- **Backup**: Pencadangan database dari cloud Supabase ke format file JSON secara instan.

---

## 🛠️ Cara Migrasi Database (Supabase Migrations)

RestoFlow menggunakan standard migration CLI dari Supabase. Semua file skema database disimpan dalam folder `supabase/migrations/`.

### Persyaratan Awal (Prerequisites)
Pastikan Anda memiliki Supabase CLI. Jika belum terinstal, Anda dapat menjalankannya langsung melalui `npx`.

### 1. Hubungkan Project ke Supabase
Hubungkan kode lokal Anda dengan database remote Supabase Anda dengan menjalankan perintah:
```bash
npm run supabase:link
```
*Anda akan diminta untuk memasukkan **Project Reference ID** (misal: `rgccflnozdvdmmxnshqv`) dan **Database Password** proyek Supabase Anda.*

### 2. Jalankan Migrasi (Push Migrations)
Terapkan semua file migrasi skema database lokal (`supabase/migrations/*`) ke database remote Supabase dengan menjalankan:
```bash
npm run supabase:push
```
*Perintah ini akan secara otomatis membuat tabel-tabel (`users`, `products`, `categories`, `tables`, `customer_orders`, dll.), menetapkan relasi foregin key, menyalakan RLS, membuat policy publik, dan mengaktifkan database realtime replication untuk tabel `customer_orders`.*

### 3. Cek Status Migrasi
Untuk memeriksa riwayat file migrasi yang telah diterapkan di database remote, gunakan perintah:
```bash
npm run supabase:status
```

---

## 🚀 Memulai Aplikasi Lokal (Getting Started)

### 1. Instal Dependensi
```bash
npm install
```

### 2. Jalankan Server Development
```bash
npm run dev
```

Akses aplikasi di browser melalui:
- Panel Kasir/Admin: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
  - *Akun Admin Bawaan:* `admin@store.com` / `admin123`
- Halaman Order Meja: [http://localhost:3000/order?table=meja_01](http://localhost:3000/order?table=meja_01)
