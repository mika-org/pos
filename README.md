# RestoFlow POS - Smart & Premium Point of Sale

RestoFlow adalah sistem Point of Sale (POS) modern, berperforma tinggi, dan tersinkronisasi ke cloud yang dirancang untuk pengalaman makan premium dan alur kerja restoran. Dibangun menggunakan **Next.js**, **Supabase**, **Zustand**, **Tailwind CSS v4**, dan **Shadcn UI**.

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
- **Backup**: Pencadangan database dari cloud Supabase ke format file JSON secara instan.

---

## 🛠️ Cara Migrasi Database (Supabase Migrations)

RestoFlow menyediakan **dua cara** untuk menerapkan migrasi database:

### Cara A: Migration Runner Otomatis (npm run migrate) ✨ Recommended

Migration runner bawaan yang membaca semua file SQL dari `supabase/migrations/` dan menerapkannya secara otomatis tanpa perlu Supabase CLI.

#### Persiapan

1. **Buat file `.env.local`** di root project (salin dari `.env.example`):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```
   > Temukan key di: Supabase Dashboard → Settings → API

2. **Buat fungsi helper SQL** di Supabase SQL Editor (sekali saja):
   ```sql
   CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
   RETURNS void AS $$
   BEGIN
     EXECUTE sql;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;

   GRANT EXECUTE ON FUNCTION public.exec_sql TO service_role;
   ```

#### Perintah Migrasi

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
