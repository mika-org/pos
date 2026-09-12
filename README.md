# ViorePos - Smart & Premium Point of Sale

ViorePos adalah sistem Point of Sale (POS) modern, berperforma tinggi, dan tersinkronisasi langsung ke database **PostgreSQL murni** yang dirancang untuk pengalaman makan premium dan alur kerja restoran. Dibangun menggunakan **Next.js**, **PostgreSQL (pg)**, **Zustand**, **Tailwind CSS v4**, dan **DOKU Payment Gateway**.

---

## 🌟 Fitur Utama (Key Features)

### 1. Sistem Autentikasi Modern (JWT & Session Sync)
- Desain login premium dengan ambient mesh gradient & show/hide password toggle.
- Flow otentikasi client-side menggunakan token **JWT** (`localStorage`) yang di-hash dengan `JWT_SECRET`.
- Proteksi route admin/cashier otomatis melalui `AuthProvider` (pengalihan otomatis jika belum login / sesi berakhir).

### 2. POS Kasir (Cashier POS)
- Antarmuka dual-pane responsif (kiri untuk menu, kanan untuk keranjang belanja) di layar desktop.
- Desain adaptif tab-based di layar mobile/tablet ("Menu" vs "Keranjang") lengkap dengan badge jumlah item.
- Kalkulasi otomatis untuk subtotal, diskon, pajak penjualan, total, nominal pembayaran, dan kembalian.
- Simpan pesanan sementara (Hold) dan batalkan transaksi secara instan.

### 3. Pemesanan Mandiri Customer (Self-Order Wizard) & DOKU Payment Gateway
- Halaman publik `/order` yang dioptimalkan untuk akses scan QR Code meja (tanpa memerlukan login kasir).
- Pilihan pembayaran online terintegrasi langsung via **DOKU Jokul API** (QRIS Dinamis, Virtual Account, dsb.) dengan verifikasi status instan.
- Notifikasi email riil otomatis ke customer via **SMTP Gmail**.

### 4. Notifikasi Pesanan Masuk Real-time
- Polling otomatis ke PostgreSQL untuk mendeteksi pesanan meja baru seketika.
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
- **Settings**: Konfigurasi profil toko, DOKU Payment Gateway, persentase pajak, batas ukuran berkas bukti bayar, dan manajemen rekening bank.
- **Reports**: Grafik tren penjualan, produk terlaris harian, dan tabel rincian transaksi dengan ekspor CSV & Excel.
- **Backup**: Pencadangan database langsung ke format file JSON secara instan.

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

### 2. Perintah Migrasi Database PostgreSQL
```bash
npm run migrate       # Jalankan migrasi tertunda
npm run migrate:dry   # Cek daftar migrasi tanpa mengeksekusi
```

| Perintah | Keterangan |
|---|---|
| `npm run migrate` | Terapkan semua migrasi yang belum dijalankan |
| `npm run migrate:dry` | Lihat daftar file yang akan dijalankan tanpa mengubah database |
| `npm run migrate:file 20260622000001` | Jalankan file migrasi tertentu saja |

```bash
# Preview apa yang akan dijalankan
npm run migrate:dry

# Terapkan semua migrasi
npm run migrate
```

Migration runner secara otomatis:
- ✅ Membaca semua `.sql` dari `supabase/migrations/` (urut berdasarkan nama file)
- ✅ Melacak migrasi yang sudah diterapkan di tabel `migrations_log`
- ✅ Melewati file yang sudah dijalankan sebelumnya (idempotent)
- ✅ Memeriksa koneksi fallback dari `lib/supabase.ts` jika tidak ada `.env.local`

---

### Cara B: Supabase CLI (npx supabase)

Menggunakan official Supabase CLI untuk link dan push migrasi.

#### 1. Hubungkan Project ke Supabase
```bash
npm run supabase:link
```
*Anda akan diminta untuk memasukkan **Project Reference ID** dan **Database Password** proyek Supabase Anda.*

#### 2. Jalankan Migrasi (Push Migrations)
```bash
npm run supabase:push
```
*Terapkan semua file migrasi skema database lokal ke database remote Supabase.*

#### 3. Cek Status Migrasi
```bash
npm run supabase:status
```

---

### File Migrasi yang Tersedia

| File | Keterangan |
|---|---|
| `20260622000000_initial_schema.sql` | Skema lengkap: semua tabel, RLS, policy, dan data awal meja |
| `20260622000001_orders_realtime.sql` | Aktifkan Supabase Realtime untuk `customer_orders` + seed data dummy produk & settings |

---

## 🚀 Memulai Aplikasi Lokal (Getting Started)

### 1. Instal Dependensi
```bash
npm install
```

### 2. Terapkan Migrasi Database
```bash
# Review dulu
npm run migrate:dry

# Lalu terapkan
npm run migrate
```

### 3. Jalankan Server Development
```bash
npm run dev
```

Akses aplikasi di browser melalui:
- Panel Kasir/Admin: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
  - *Akun Admin Bawaan:* `admin@store.com` / `admin123`
- Halaman Order Meja: [http://localhost:3000/order?table=meja_01](http://localhost:3000/order?table=meja_01)

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
├── lib/                    # Utilities: db types, supabase client, jwt, translations
├── scripts/
│   └── migrate.js          # ✨ Migration runner otomatis
├── stores/                 # Zustand state stores
├── supabase/
│   └── migrations/         # File SQL migrasi database (urut timestamp)
├── .env.example            # Template variabel environment
└── README.md
```
