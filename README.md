# RestoFlow POS - Smart & Premium Point of Sale

RestoFlow adalah sistem Point of Sale (POS) modern, berperforma tinggi, dan multi-tenant yang dirancang untuk pengalaman makan premium dan alur kerja restoran. Dibangun menggunakan **Next.js**, **PostgreSQL**, **Prisma**, **Zustand**, **Tailwind CSS v4**, dan **Shadcn UI**.

---

## 🌟 Fitur Utama (Key Features)

### 1. Sistem Autentikasi Server-side
- Desain login premium dengan ambient mesh gradient & show/hide password toggle.
- Sesi ditandatangani server dan disimpan pada cookie `HttpOnly`, `SameSite=Lax`, dan `Secure` di production.
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

### 4. Notifikasi Pesanan Masuk
- Polling API PostgreSQL tenant-scoped untuk mendeteksi pesanan meja baru tanpa koneksi Supabase di browser.
- **Audio Chime**: Memainkan efek suara lonceng ("ding-dong") menggunakan Web Audio API.
- **Visual Alert Toast**: Kartu notifikasi melayang (toast alert) berisi ID, nama pelanggan, lokasi meja, dan total pembayaran.
- **Header Notification Center**: Lencana (badge) counter aktif yang membal pada ikon Bell. Ketika diklik, menampilkan dropdown 5 transaksi pending terbaru.
- **Auto-Open Drawer**: Mengklik notifikasi pesanan di dropdown otomatis mengarahkan ke dashboard dan membuka laci verifikasi bukti bayar order tersebut.

### 5. Dasbor Manajemen Pesanan (Admin Orders Control)
- Dasbor `/orders` untuk memproses dan memverifikasi pesanan mandiri pelanggan.
- Tab filter status dinamis: Menunggu Konfirmasi, Sedang Disiapkan, Dalam Pengiriman, Selesai, dan Ditolak.
- Tampilan laci detail pembayaran (detail customer, daftar produk, dan bukti pembayaran yang dapat diunduh/diperbesar).
- Workflow status pengerjaan (Mulai Siapkan ➡️ Kirim Pesanan ➡️ Selesaikan Pesanan) lengkap dengan simulasi pengiriman email notifikasi.

### 6. Dasbor Analitik Kaya (Analytics Dashboard)
- **Metric Cards**: Pendapatan hari ini, jumlah transaksi, produk terlaris, dan peringatan stok menipis.
- **Tren Pendapatan**: Area chart 7 hari terakhir (POS + Pesanan Meja).
- **Sumber Transaksi**: Donut pie chart perbandingan omzet POS Kasir vs Pesanan Meja.
- **Menu Terlaris (Top 5)**: Tabel produk dengan jumlah porsi dan total pendapatan.
- **Pesanan Meja Aktif**: Live list pesanan `pending/preparing/delivery` dengan tombol verifikasi cepat.

### 7. Master Data & Layout Responsif
- **Master Meja**: Grid kartu meja makan interaktif untuk mengelola meja (Aktif/Nonaktif) dan mencetak QR Code pemesanan mandiri per meja.
- **Master Produk**: Manajemen stok, harga beli, harga jual, barcode, kategori, dan foto menu.
- **Master Kategori, Pelanggan, Supplier, & Pengguna**: Database entitas penunjang transaksi toko.
- **Sidebar & Header**: Sidebar desktop yang dapat dilipat (collapsible) menyimpan status preferensi, serta sliding overlay drawer di perangkat mobile.

### 8. Pengaturan & Laporan (Settings & Reports)
- **Settings**: Konfigurasi profil toko, persentase pajak, batas ukuran berkas bukti bayar, dan manajemen banyak rekening bank transfer toko.
- **Reports**: Grafik tren penjualan, produk terlaris harian, dan tabel rincian transaksi (gabungan POS & order meja) dengan kolom sumber (POS Kasir / Pesanan Meja) serta ekspor CSV.
- **Backup**: Pencadangan data tenant dari PostgreSQL ke format file JSON secara instan.

---

## 🛠️ PostgreSQL, Prisma, dan Migrasi Supabase

Seluruh akses database berjalan melalui Route Handler server-side dan Prisma. Setiap tabel bisnis memiliki `tenantId`; browser tidak pernah menerima connection string, hash password, atau API key Xendit.

### Persiapan

Salin `.env.example` menjadi `.env`, lalu isi `DATABASE_URL`, secret sesi/enkripsi, akun seed, dan koneksi sumber Supabase bila data lama akan diimpor. Jangan commit file `.env`.

### Perintah database

| Perintah | Keterangan |
|---|---|
| `npm run db:ensure` | Buat database dari nama di `DATABASE_URL` bila belum ada |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Terapkan migration Prisma yang belum dijalankan |
| `npm run db:seed` | Seed tenant awal, Super Admin, admin tenant, kategori, produk, meja, dan settings |
| `npm run db:verify` | Verifikasi migration, jumlah seed, dan hash kredensial pada database target |
| `npm run migrate:supabase:dry` | Hitung row Supabase tanpa menulis PostgreSQL |
| `npm run migrate:supabase` | Import seluruh tabel dan file Base64/Storage Supabase secara idempotent |

Urutan deployment baru:

```bash
npm install
npm run db:ensure
npm run db:generate
npm run db:migrate
npm run db:seed
npm run migrate:supabase:dry
npm run migrate:supabase
```

Importer menggunakan `SUPABASE_SOURCE_SECRET_KEY` atau legacy `SUPABASE_SOURCE_SERVICE_ROLE_KEY` bila tersedia dan hanya memakai anon key sebagai fallback. Data URL gambar produk, QRIS, dan bukti bayar dipindahkan ke tabel `stored_files` (`bytea`) dan dilayani melalui `/api/storage/:id`.

Jika migrator melaporkan `NXDOMAIN`, project URL sumber sudah tidak terdaftar di DNS. Periksa project ref di Supabase Dashboard dan lakukan **Resume project** bila project masih paused. Jika project sudah dihapus atau melewati masa pemulihan, REST API tidak dapat dipakai; unduh database backup dan Storage objects yang masih tersedia, lalu pulihkan ke project Supabase baru sebelum menjalankan importer. API secret/service-role hanya disimpan di `.env` dan tidak boleh memakai prefix `NEXT_PUBLIC_`.

### Multi-tenant dan pembayaran

- Super Admin masuk tanpa kode tenant lalu mengelola tenant di `/super-admin/tenants`.
- Admin/kasir masuk dengan email dan kode tenant. Semua query server otomatis dibatasi ke tenant sesi.
- Link QR meja menyertakan `tenant=<slug>` agar halaman self-order memilih tenant yang benar.
- Admin tenant dapat mengisi Secret API Key dan callback token Xendit di Pengaturan. Secret disimpan dengan AES-256-GCM.
- QRIS memakai Xendit Payments API v3 saat aktif. Bila key kosong/nonaktif atau Xendit gagal, aplikasi otomatis memakai gambar QRIS statis dan meminta bukti bayar.

---

## 🚀 Memulai Aplikasi Lokal (Getting Started)

### 1. Instal Dependensi
```bash
npm install
```

### 2. Terapkan Database
```bash
npm run db:ensure
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 3. Jalankan Server Development
```bash
npm run dev
```

Akses aplikasi di browser melalui:
- Panel Kasir/Admin: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
- Super Admin: [http://localhost:3000/super-admin/tenants](http://localhost:3000/super-admin/tenants)
- Halaman Order Meja: [http://localhost:3000/order?table=meja_01&tenant=restoflow](http://localhost:3000/order?table=meja_01&tenant=restoflow)

Kredensial awal mengikuti `SUPER_ADMIN_*` dan `TENANT_ADMIN_*` pada environment saat seed dijalankan.

### Secret deployment GitHub Actions

Workflow VPS memerlukan tiga repository secret berikut sebelum `npm ci` dijalankan:

- `DATABASE_URL`: connection string PostgreSQL production.
- `SESSION_SECRET`: random secret minimal 32 karakter.
- `FIELD_ENCRYPTION_KEY`: key Base64 32-byte untuk enkripsi konfigurasi Xendit.

Workflow meneruskan secret tersebut ke shell SSH, menjalankan production build dan `prisma migrate deploy`, lalu memperbarui environment proses PM2. Jangan menaruh nilainya langsung di workflow atau repository.

---

## 📁 Struktur Folder Penting

```
pos/
├── app/                    # Next.js App Router pages
│   ├── dashboard/          # Dasbor analitik utama
│   ├── order/              # Halaman self-order publik (untuk pelanggan)
│   ├── orders/             # Manajemen & verifikasi pesanan meja (admin)
│   ├── pos/                # Kasir POS
│   └── ...                 # pages lainnya
├── components/             # React components
│   └── layout/             # Header, Sidebar, AuthProvider
├── lib/                    # Prisma, auth session, tenant context, storage, Xendit, translations
├── prisma/                 # Schema, migration, dan seed PostgreSQL
├── scripts/
│   ├── ensure-database.mjs
│   ├── migrate-supabase-to-postgres.mjs
│   └── verify-database.mjs
├── stores/                 # Zustand state stores
├── supabase/               # Arsip migration sumber lama
├── .env.example            # Template variabel environment
└── README.md
```
