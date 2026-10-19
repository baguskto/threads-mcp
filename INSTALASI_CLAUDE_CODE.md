# Panduan Instalasi Threads MCP Server (v6)

Server ini menghubungkan Claude (Claude Code, Claude Desktop, atau klien MCP lain) ke **Threads API resmi dari Meta**. Butuh Node.js 20.12 atau lebih baru.

## 1. Siapkan access token

1. Buat aplikasi di [developers.facebook.com/apps](https://developers.facebook.com/apps) lalu tambahkan use case **Threads API**.
2. Tambahkan akun Threads Anda sebagai *tester*, lalu terima undangannya di aplikasi Threads (Settings → Account → Website permissions).
3. Minta scope yang dibutuhkan. Untuk posting cukup `threads_basic` dan `threads_content_publish`; daftar lengkap ada di [README](README.md#permissions).
4. Buat user token, lalu tukar menjadi **long-lived token** (berlaku 60 hari). Bisa juga dari server ini dengan tool `exchange_for_long_lived_token` jika `THREADS_APP_SECRET` diisi.

Akun Threads tidak lagi wajib terhubung ke Instagram, kecuali untuk jumlah follower dan demografi.

## 2. Tambahkan ke Claude Code

```bash
claude mcp add threads --env THREADS_ACCESS_TOKEN=TOKEN_ANDA -- npx -y threads-mcp-server
```

### Atau lewat file konfigurasi (Claude Desktop dan klien lain)

```json
{
  "mcpServers": {
    "threads": {
      "command": "npx",
      "args": ["-y", "threads-mcp-server"],
      "env": {
        "THREADS_ACCESS_TOKEN": "TOKEN_ANDA"
      }
    }
  }
}
```

### Dari source

```bash
git clone https://github.com/baguskto/threads-mcp.git
cd threads-mcp
npm install
npm run build
claude mcp add threads --env THREADS_ACCESS_TOKEN=TOKEN_ANDA -- node /path/ke/threads-mcp/dist/index.js
```

## 3. Variabel lingkungan

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `THREADS_ACCESS_TOKEN` | ya | Long-lived token Threads |
| `THREADS_USER_ID` | tidak | ID user Threads (menghemat satu panggilan `/me`) |
| `THREADS_APP_SECRET` | tidak | Untuk `exchange_for_long_lived_token` |
| `THREADS_READ_ONLY` | tidak | `true` = hanya tool baca (tidak bisa posting, hapus, atau menjadwalkan) |
| `THREADS_SCHEDULE_FILE` | tidak | Lokasi file post terjadwal (default `~/.threads-mcp/scheduled-posts.json`) |

## 4. Verifikasi

Mulai ulang Claude, lalu minta:

```
Jalankan validate_setup untuk Threads
```

Hasilnya menunjukkan apakah token valid, kapan kedaluwarsa, dan scope apa yang belum ada beserta tool yang membutuhkannya.

## 5. Contoh perintah

```
Posting ke Threads: "Halo dari Claude! 👋" dengan topic tag "AI"
Buat polling: "Bahasa favorit?" pilihan TypeScript, Python, Go
Jadwalkan post "Selamat pagi ☀️" besok jam 08:00 WIB
Buat carousel dari 5 gambar ini dengan alt text masing-masing
Tampilkan 5 post terbaik saya 30 hari terakhir
Kapan waktu terbaik saya posting? Pakai zona waktu Asia/Jakarta
Cari post terbaru dengan topik "MCP"
Tampilkan balasan untuk post terakhir saya dan sembunyikan yang spam
```

## 6. Penjadwalan

Threads API **tidak punya fitur jadwal bawaan**. `schedule_post` menyimpan post di komputer Anda dan server ini yang mempublikasikannya pada waktunya. Artinya server (klien MCP) harus berjalan pada waktu itu; post yang terlewat akan dipublikasikan begitu server berjalan lagi. Cek statusnya dengan `list_scheduled_posts`.

## 7. Troubleshooting

| Masalah | Solusi |
| --- | --- |
| `THREADS_ACCESS_TOKEN is not set` | Isi token di blok `env` konfigurasi MCP, lalu restart klien |
| Error 190 / token invalid | Token kedaluwarsa. Buat token baru, atau jalankan `refresh_access_token` sebelum lewat 60 hari |
| Permission denied | Scope belum diberikan. Jalankan `validate_setup` untuk melihat yang kurang |
| Video gagal dipublikasikan | URL harus publik (HTTPS), MP4/MOV, maks. 5 menit / 1 GB. Cek dengan `get_container_status` |
| Pencarian hanya menampilkan post sendiri | `threads_keyword_search` belum disetujui Meta (advanced access) |

## 8. Update

```bash
npm update -g threads-mcp-server   # jika dipasang global
```

Dengan `npx -y threads-mcp-server`, versi terbaru dipakai otomatis. Lihat [CHANGELOG](CHANGELOG.md) untuk perubahan dan tabel migrasi dari v5 di [README](README.md#migrating-from-v5).
