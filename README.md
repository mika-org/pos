# ViorePos - Smart & Premium Point of Sale

ViorePos adalah sistem Point of Sale (POS) modern, berperforma tinggi, dan multi-tenant yang dirancang untuk pengalaman makan premium dan alur kerja restoran. Dibangun menggunakan **Next.js**, **PostgreSQL**, **Prisma**, **Zustand**, **Tailwind CSS v4**, serta mendukung integrasi **DOKU Payment Gateway** dan **Xendit**.

---

## 🌟 Fitur Utama (Key Features)

### 1. Sistem Autentikasi Server-side
- Desain login premium dengan ambient mesh gradient & show/hide password toggle.
- Sesi ditandatangani server menggunakan JWT (`jose`) dan disimpan pada cookie `HttpOnly`, `SameSite=Lax`, dan `Secure` di production.
- Proteksi route admin/cashier otomatis melalui `AuthProvider` (pengalihan otomatis jika belum login / sesi berakhir).

### 2. POS Kasir (Cashier POS)
- Antarmuka dual-pane responsif (kiri untuk menu, kanan untuk keranjang belanja) di layar desktop.
- Desain adaptif tab-based di layar mobile/tablet ("Menu" vs "Keranjang") lengkap dengan badge jumlah item.
- Kalkulasi otomatis untuk subtotal, diskon, pajak penjualan, total, nominal pembayaran, dan kembalian.
- Simpan pesanan sementara (Hold) dan batalkan transaksi secara instan.

### 3. Pemesanan Mandiri Customer (Self-Order Wizard) & Payment Gateway
- Halaman publik `/order` yang dioptimalkan untuk akses scan QR Code meja (tanpa memerlukan login kasir).
- Pilihan pembayaran online terintegrasi via **DOKU Jokul API** (QRIS Dinamis, Virtual Account, dsb.) dengan Client ID `BRN-0232-1788668958800` dan verifikasi status instan.
- Pilihan pembayaran via **Xendit Payments API v3** atau QRIS statis / transfer bank dengan unggah bukti pembayaran.
- Notifikasi email riil otomatis ke customer via **SMTP Gmail**.

### 4. Notifikasi Pesanan Masuk
- Polling API PostgreSQL tenant-scoped untuk mendeteksi pesanan meja baru secara real-time.
- **Audio Chime**: Memainkan efek suara lonceng ("ding-dong") menggunakan Web Audio API.
- **Visual Alert Toast**: Kartu notifikasi melayang (toast alert) berisi ID, nama pelanggan, lokasi meja, dan total pembayaran.
- **Header Notification Center**: Lencana counter aktif yang membal pada ikon Bell.

### 5. Dasbor Manajemen Pesanan (Admin Orders Control)
- Dasbor `/orders` untuk memproses dan memverifikasi pesanan mandiri pelanggan.
- Tab filter status dinamis: Menunggu Konfirmasi, Sedang Disiapkan, Dalam Pengiriman, Selesai, dan Ditolak.
- Tampilan laci detail pembayaran (detail customer, daftar produk, dan bukti pembayaran yang dapat diunduh/diperbesar).

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
- **Sidebar & Header**: Sidebar desktop yang dapat dilipat (collapsible).

### 8. Pengaturan & Laporan (Settings & Reports)
- **Settings**: Konfigurasi profil toko, DOKU Payment Gateway, Xendit API, persentase pajak, batas ukuran berkas bukti bayar, dan manajemen banyak rekening bank transfer toko.
- **Reports**: Grafik tren penjualan, produk terlaris harian, dan tabel rincian transaksi (gabungan POS & order meja) dengan kolom sumber serta ekspor Excel (.xlsx) premium via ExcelJS.
- **Backup**: Pencadangan database PostgreSQL tenant ke format file JSON secara instan.

---

## 🛠️ Konfigurasi Environment & Database PostgreSQL

### 1. File `.env.local`
```env
DATABASE_URL="postgresql://admin:eY%7D%3Ex%23u%5Ev%236%3FC3r3@103.93.162.19:5432/pos?schema=public"
JWT_SECRET="secret_pos_super_key_2026"
NEXT_PUBLIC_STORAGE_URL="https://pos.elevore.web.id/storage"
NEXT_PUBLIC_APP_URL="https://pos.elevore.web.id/"

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=dudungawug27@gmail.com
SMTP_PASS=hgpr drsv hmuw qcif
SMTP_FROM="VIOREPOS" <viorepost@gmail.com>

# DOKU Payment Gateway
DOKU_CLIENT_ID=BRN-0232-1788668958800
DOKU_SECRET_KEY=SK-ePUnXcEg73lttDKzMQS5
DOKU_API_KEY=doku_key_ad4e81ce69f3459c815eae45ba7d8183
DOKU_IS_PRODUCTION=true
```

### 2. Perintah Database

| Perintah | Keterangan |
|---|---|
| `npm run db:ensure` | Buat database dari nama di `DATABASE_URL` bila belum ada |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Terapkan migration Prisma yang belum dijalankan |
| `npm run db:seed` | Seed tenant awal, Super Admin, admin tenant, kategori, produk, meja, dan settings |
| `npm run db:verify` | Verifikasi migration, jumlah seed, dan hash kredensial pada database target |
| `npm run migrate:supabase:dry` | Hitung row Supabase tanpa menulis PostgreSQL |
| `npm run migrate:supabase` | Import seluruh tabel dan file Base64/Storage Supabase secara idempotent |

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
# atau menjalankan di port 3200
npm run dev:3200
```

Akses aplikasi di browser melalui:
- Panel Kasir/Admin: [http://localhost:3200/dashboard](http://localhost:3200/dashboard)
- Super Admin: [http://localhost:3200/super-admin/tenants](http://localhost:3200/super-admin/tenants)
- Halaman Order Meja: [http://localhost:3200/order?table=meja_01&tenant=restoflow](http://localhost:3200/order?table=meja_01&tenant=restoflow)

---

## 📁 Struktur Folder Penting

```
pos/
├── app/                    # Next.js App Router pages & API routes
│   ├── api/                # Route Handlers (/api/data, /api/auth, /api/payments, etc.)
│   ├── dashboard/          # Dasbor analitik utama
│   ├── order/              # Halaman self-order publik (untuk pelanggan)
│   ├── orders/             # Manajemen & verifikasi pesanan meja (admin)
│   ├── pos/                # Kasir POS
│   └── ...                 # pages lainnya
├── components/             # React components
│   └── layout/             # Header, Sidebar, AuthProvider
├── lib/                    # Prisma, auth session, tenant context, storage, Xendit, translations
├── prisma/                 # Schema, migration, dan seed PostgreSQL
├── scripts/                # Utility scripts (ensure-database, sync-admin, etc.)
├── stores/                 # Zustand state stores
├── .env.example            # Template variabel environment
└── README.md
```
