# Limitasi Threads API dan Solusinya (v6, Oktober 2026)

Server ini hanya memakai endpoint yang didokumentasikan Meta. Berikut hal yang **tidak bisa** dilakukan lewat API resmi, dan alternatifnya.

## Fitur yang tidak ada di Threads API

| Fitur | Status | Alternatif |
| --- | --- | --- |
| Like / unlike post | Tidak ada endpoint | Jumlah like tersedia di `get_thread_insights` |
| Follow / unfollow / block | Tidak ada endpoint | `create_web_intent_link` dengan `type: "follow"` membuat link follow untuk diklik |
| Daftar follower / following | Tidak ada endpoint | Jumlah follower di `get_my_insights`, demografi di `get_audience_demographics` |
| Daftar siapa yang me-like | Tidak ada endpoint | — |
| Trending / explore | Tidak ada endpoint | `search_posts` dengan `search_type: "TOP"` |
| Penjadwalan bawaan | Tidak ada | `schedule_post` (disimpan lokal, dipublikasikan oleh server ini) |
| Batalkan repost | Tidak didokumentasikan | — |
| Edit post | Tidak ada endpoint | Hapus (`delete_thread`) lalu posting ulang |
| Upload file | Tidak ada endpoint | Media harus berupa URL HTTPS publik |
| Pesan langsung (DM) | Tidak ada endpoint | — |

Versi v5 punya tool untuk sebagian fitur di atas, tetapi tool itu memanggil endpoint yang tidak ada sehingga selalu gagal. Di v6 tool tersebut dihapus.

## Batas pemakaian (per 24 jam, bergulir)

| Aksi | Batas |
| --- | --- |
| Post (carousel dihitung 1) | 250 |
| Reply | 1.000 |
| Hapus post | 100 |
| Pencarian lokasi | 500 |
| Pencarian keyword | 2.200 |
| Lookup profil publik | 1.000 |
| oEmbed | 1.000 per jam |

Cek pemakaian saat ini dengan `get_publishing_limit`.

## Aturan konten

- Teks maksimal 500 karakter; emoji dihitung sesuai panjang byte UTF-8-nya (satu emoji bisa dihitung 4). Untuk teks panjang gunakan `text_attachment` (hingga 10.000 karakter).
- Maksimal 5 link per post.
- Satu topic tag per post (1–50 karakter, tanpa titik atau `&`).
- Polling: 2–4 pilihan, maksimal 25 karakter per pilihan, berlaku 24 jam, hanya untuk post teks, dan tidak bisa digabung dengan link attachment atau text attachment.
- GIF hanya dari GIPHY (Tenor dihentikan Maret 2026).
- Ghost post hanya untuk post teks, bukan reply, dan tidak bisa memakai reply approvals.
- Carousel: 2–20 item.
- Gambar: JPEG/PNG maks. 8 MB. Video: MP4/MOV maks. 5 menit dan 1 GB.

Server memvalidasi aturan ini sebelum mengirim, jadi kesalahan langsung terlihat tanpa memakai kuota.

## Akses standar vs. advanced

Sebelum Meta menyetujui *advanced access*:

- `search_posts` hanya mengembalikan post Anda sendiri.
- `lookup_profile` / `get_profile_posts` hanya untuk akun resmi Meta (@meta, @threads, @instagram, @facebook).
- `get_mentions` hanya dari akun tester.
- `search_locations` sangat terbatas.

## Insights

- Data akun hanya tersedia mulai 13 April 2024.
- `followers_count` dan `follower_demographics` butuh akun Instagram yang terhubung; demografi butuh minimal 100 follower.
- Metrik `views` dan `shares` per post masih berlabel "in development" oleh Meta.
