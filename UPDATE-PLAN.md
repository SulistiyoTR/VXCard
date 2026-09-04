# Update Plan — Shared Content Architecture

Perubahan untuk codebase VX Card yang sudah jalan.
Bukan build dari nol — ini migrasi arsitektur dari single-user ke shared content.

> ⚠️ **SPEC.md sudah tidak akurat** untuk bagian 1.1, 1.4, 1.6, 5, dan 8.
> Bagian 0 juga perlu dicek — sumber dictionary sudah Merriam-Webster Learner's, bukan dictionaryapi.dev.
> Sesi 1 di bawah memperbaikinya. Jangan pakai SPEC.md sebagai acuan sampai Sesi 1 selesai.

---

## Kenapa berubah

Sebelumnya tiap user punya salinan kata sendiri. User A dan B input "explicable" → dua kali panggil API kamus, dua kali generate LLM, dua salinan data yang isinya identik.

Sekarang konten kata jadi milik bersama. Yang personal cuma status belajarnya.

**Yang didapat:**
- Kata yang sudah pernah dibuat → nambah kata jadi instan, nol API call
- Biaya generate ditanggung user pertama, dinikmati semua
- Pool kalimat contoh tumbuh bersama, makin kaya seiring jumlah user

**Status data:** tabel `public.words`, `public.reviews`, `public.sessions` sudah di-drop. Mulai dari schema bersih. `push_subscriptions` dipertahankan.

---

## Ringkasan perubahan

| # | Perubahan | Dampak |
|---|---|---|
| 1 | Schema jadi 5 tabel | Besar — semua query kena |
| 2 | LLM ditunda sampai user tekan Save | Sedang |
| 3 | Pool kalimat jadi shared, append-only | Besar |
| 4 | Sistem tiket buat anti-conflict | Baru |
| 5 | Tombol refresh manual dihapus | Kecil |

---

# Keputusan implementasi (hasil review, mengikat)

Ditambahkan setelah plan direview. **Yang di sini menang** kalau bentrok dengan teks sesi di bawah.

## Arsitektur offline (SPEC 6.4 tetap berlaku)

- `words` jadi **cache read-only** di HP. HP tidak pernah menulis ke `words` — semua tulisan lewat backend.
- `user_cards`, `reviews`, `sessions` tetap sync **dua arah** dengan LWW seperti sekarang.
- **`words` butuh kolom `updated_at timestamptz`.** Di-bump setiap kali kontennya berubah: append kalimat, `hide_count`, `flagged`, `status`, `pool_full`.
- **Refresh cache:** `GET /api/sync` menarik `words` lewat join `user_cards → words` untuk user ini, hanya baris dengan `words.updated_at > since`. Jadi pool kalimat yang tumbuh dari user lain sampai ke HP tanpa menarik semua kata tiap sync.
- `src/lib/store/` (`idb`, `local`, `sync`, `merge`, `provider`) dan `/api/sync` perlu dirombak menyesuaikan pemisahan ini. **Kerjaan ini masuk Sesi 2** (bareng schema) — bukan sesi terpisah.

## Sumber kamus

- **`dictionaryapi.dev` dibuang total.** Hapus `FREE_API`, `tryFree`, `parseFree`, dan cabang free di `probeDictionary` dari `src/lib/dictionary.ts`. Tidak disimpan sebagai fallback.
- **Merriam-Webster Learner's = satu-satunya sumber**, di-hardcode. Hapus env `DICTIONARY_PRIMARY`.
- MW gagal / timeout / kuota habis → error jelas ke user. Tidak ada fallback diam-diam.
- **Tidak ada kolom `source` di `words`** — cuma satu sumber.

## Rate limit — 50 / hari / user, dicek di titik panggil MW

- Batas berlaku pada **lookup yang benar-benar menembak MW** (kata belum ada di `words` sama sekali), bukan di titik Save.
- Kata yang sudah ada di `words` (`dictionary_only` **atau** `complete`) = nol biaya, tidak dihitung.
- Cancel setelah search **tetap** sudah memotong kuota — itu memang tujuannya.
- **Counter dinaikkan SEBELUM panggil MW**, bukan setelah sukses. Request gagal/timeout tetap makan kuota di sisi MW; kalau cuma hitung yang sukses, counter kita lebih rendah dari pemakaian asli.

### Tabel ke-6: `mw_lookups`

| Kolom | Tipe | Catatan |
|---|---|---|
| `user_id` | uuid | PK bagian 1 |
| `day` | date | PK bagian 2 |
| `count` | int | dinaikkan tiap lookup |

PK gabungan `(user_id, day)`. Di-`upsert` dengan increment tepat sebelum tiap panggilan MW. Cek `count >= DAILY_NEW_WORD_LIMIT` dulu — kalau lewat, tolak dengan error "daily lookup limit reached". RLS: backend saja.

## `reviews`

FK **`word_id` + `user_id` langsung**. Tidak ada FK ke `user_cards`. (Menimpa baris "FK ke user_cards" di Sesi 2.)

## Sistem tiket (Sesi 5)

Anti-conflict lapis 2 pakai **Postgres function** dengan `SELECT ... FOR UPDATE SKIP LOCKED`, dipanggil via `supabase.rpc()`. Client memanggil endpoint baru **setelah layar hasil sesi tampil**.

## Migration `0004_shared_content.sql`

- **Create-only.** `public.words`, `public.reviews`, `public.sessions` sudah di-drop manual.
- Kalau ada `drop ... if exists` defensif, **wajib** prefix `public.` — jangan sampai menyentuh `auth.sessions` bawaan Supabase.
- `push_subscriptions` tidak disentuh.

## SPEC.md & ground rules

- Sesi 1 **boleh** mengedit SPEC.md (menimpa larangan di CLAUDE.md). CLAUDE.md + AGENTS.md di-update di sesi yang sama supaya konsisten.
- Kalimat pembuka SPEC "Dipakai satu orang (single user)" ikut dikoreksi — sudah shared content, 3 user.

## `regenerate` kalimat per-item

Tombol ✎ "Change this sentence" **tidak lagi memanggil LLM**. Murni: hide untuk user ini + `hide_count += 1` global, auto-`flagged` di 3. `regenerateSentence` di `src/lib/actions.ts` dihapus. Kebosanan ditangani auto-generate tiket.

## Config

Hapus `REFRESH_THRESHOLD` dan `REFRESH_BATCH_MAX` (tombol borongan hilang). Tambah yang di bagian "Config tambahan" di bawah. `DAILY_NEW_WORD_LIMIT` (50) tetap — sekarang juga jadi cap lookup MW/hari/user.

---

# Sesi 1 — Sinkronkan SPEC.md

**Tujuan:** SPEC.md jadi akurat lagi sebelum ada kode yang ditulis berdasarkan itu.

Prompt:

> Baca SPEC.md dan UPDATE-PLAN.md. Sesi 1: update SPEC.md supaya sesuai dengan keputusan baru di UPDATE-PLAN.md. Bagian yang berubah: 0 (sumber dictionary sudah Merriam-Webster), 1.1 (alur generate), 1.4 (struktur data), 1.6 (regenerate), 5 (database), 8 (config). Jangan ubah bagian lain. Jangan tulis kode apa pun di sesi ini.

Selesai kalau:
- [ ] SPEC.md bagian 5 berisi 5 tabel, bukan 2
- [ ] Tidak ada lagi sebutan `dictionaryapi.dev`
- [ ] Bagian 1.6 tidak lagi menyebut tombol refresh manual di Stats
- [ ] Config di bagian 8 punya `MAX_SENTENCE_POOL`, `SENTENCE_BATCH`, `FRESH_THRESHOLD`, `TICKET_TIMEOUT_MINUTES`, `MAX_TICKETS_PER_SESSION`

---

# Sesi 2 — Schema baru

**Tujuan:** lima tabel siap dengan RLS yang benar.

## Struktur

**`words`** — konten bersama, **tanpa `user_id`**

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | uuid | PK |
| `word` | text | **unique global** |
| `created_at` | timestamptz | |
| `phonetic` | text | nullable |
| `audio_url` | text | nullable |
| `pos` | text | |
| `definition` | text | |
| `origin` | text | nullable |
| `other_meanings` | jsonb | |
| `sentences` | jsonb | array, **append-only** |
| `distractor_defs` | jsonb | array 6, nullable |
| `distractor_words` | jsonb | array 6, nullable |
| `status` | text | `dictionary_only` \| `complete` |
| `pool_full` | boolean | true kalau sentences sudah 15 |
| `updated_at` | timestamptz | **wajib** — di-bump tiap konten berubah, dipakai sync (lihat Keputusan implementasi) |

Bentuk tiap elemen `sentences`:

```json
{ "text": "...", "form": "explicable", "hide_count": 0, "flagged": false }
```

> Tidak ada `used_count` di sini. Itu pindah ke `user_cards`.

**`user_cards`** — status belajar per user

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK `auth.users` |
| `word_id` | uuid | FK `words` |
| `level` | int | 1–4, 5 = lulus |
| `streak` | int | |
| `due_date` | date | **diindeks** |
| `lapse_count` | int | |
| `last_seen_date` | date | anti-duplikat dalam sesi |
| `sentence_usage` | jsonb | array int, sejajar index `words.sentences` |
| `hidden_sentences` | jsonb | array index yang disembunyikan user ini |
| `created_at` | timestamptz | |

Unique constraint: `(user_id, word_id)`

**`reviews`** — riwayat jawaban. Sama seperti sebelumnya: kolom `word_id` + `user_id` langsung, **tanpa** FK ke `user_cards` (lihat Keputusan implementasi).

**`sessions`** — untuk perhitungan streak (aturan B1: sesi harus habis sampai soal terakhir).

| Kolom | Tipe |
|---|---|
| `id`, `user_id`, `started_at`, `finished_at` | |
| `completed` | boolean |
| `planned`, `answered` | int |
| `source` | text — `review` \| `practice` \| `hardmode` |

**`sentence_requests`** — antrian tiket

| Kolom | Tipe | Catatan |
|---|---|---|
| `word_id` | uuid | **UNIQUE** — ini lapis anti-conflict pertama |
| `created_at` | timestamptz | |
| `locked_at` | timestamptz | nullable — kapan tiket diambil |

## RLS

| Tabel | Aturan |
|---|---|
| `words` | Semua user login boleh **baca**. Tulis lewat backend saja |
| `user_cards` | `auth.uid() = user_id` |
| `reviews` | `auth.uid() = user_id` |
| `sessions` | `auth.uid() = user_id` |
| `sentence_requests` | Tidak diakses langsung dari client — backend saja |
| `mw_lookups` | Tidak diakses langsung dari client — backend saja |

Prompt:

> Sesi 2: bikin schema baru di Supabase sesuai UPDATE-PLAN.md Sesi 2. Lima tabel, index, dan RLS. Perhatikan bahwa `words` sekarang shared (tanpa user_id) dan boleh dibaca semua user login. Kasih tahu langkah manual apa yang perlu saya lakukan di dashboard.

Selesai kalau:
- [ ] Lima tabel muncul di Supabase
- [ ] `words` tidak punya kolom `user_id`
- [ ] `sentence_requests.word_id` punya unique constraint
- [ ] RLS aktif di semua tabel
- [ ] Bisa login dan app tidak crash (walaupun deck kosong)

---

# Sesi 3 — Alur generate baru

**Tujuan:** hemat biaya, dan nambah kata jadi instan untuk kata yang sudah ada.

## Alur

```
1. User ketik kata → normalisasi
2. Cek tabel `words`

   a. Ada, status = complete
      → Tampilkan pratinjau (0 API, 0 LLM)
      → Save = cuma bikin baris di user_cards
      → INSTAN

   b. Ada, status = dictionary_only
      → Tampilkan pratinjau (0 API)
      → Save → generate LLM → status jadi complete

   c. Belum ada
      → Panggil Merriam-Webster
      → Simpan ke `words` dengan status dictionary_only
      → Tampilkan pratinjau
      → Save → generate LLM → complete
      → Cancel → data kamus tetap tersimpan, nol biaya LLM

3. Cek juga: user ini sudah punya kartu untuk kata ini?
   → Kalau ya, tolak dengan pesan "already in your deck"
```

**Dua hal penting:**

Data kamus tetap disimpan walaupun user cancel. Ini yang bikin API kamus tidak pernah dipanggil dua kali untuk kata yang sama — penting karena kuotanya 1000/hari untuk seluruh app.

Pratinjau tidak punya kalimat dari LLM. Tidak masalah — Learner's Dictionary hampir selalu punya contoh kalimat sendiri.

Prompt:

> Sesi 3: ubah alur Add word sesuai UPDATE-PLAN.md Sesi 3. Cek database dulu sebelum panggil API. Tunda panggilan LLM sampai user tekan Save. Simpan data kamus walaupun user cancel. Bedakan antara "kata sudah ada di database global" dan "kata sudah ada di deck saya".

Selesai kalau:
- [ ] Kata yang sudah complete → pratinjau muncul instan, tanpa loading
- [ ] Cancel → tidak ada panggilan LLM, tapi data kamus tersimpan
- [ ] Input kata yang sama kedua kalinya → tidak panggil API kamus lagi
- [ ] Kata yang sudah ada di deck sendiri → ditolak dengan pesan yang benar

---

# Sesi 4 — Pool kalimat per user

**Tujuan:** rotasi kalimat jalan benar di lingkungan shared.

## Kenapa ini rumit

`sentence_usage` nyambung ke `words.sentences` lewat **index**. Kalau kalimat dihapus dari array, semua index geser dan catatan semua user rusak.

Makanya: **kalimat tidak pernah dihapus atau ditimpa. Hanya ditambah di belakang.** Kalimat jelek ditandai `flagged`, bukan dibuang.

## Tiga angka

```js
// Kalimat yang boleh dilihat user ini
available = index dimana !flagged AND index tidak ada di hidden_sentences

// Dari available, yang belum pernah dilihat
fresh = available.filter(i => usage(i) === 0)

// Ukuran pool aktif
poolSize = sentences.filter(s => !s.flagged).length
```

Kalau `sentence_usage` lebih pendek dari `sentences` (pool baru tumbuh), index yang belum ada dianggap **0**.

## Rotasi

Pilih index dengan `usage` terkecil. Kalau seri, acak. `usage` naik saat kalimat **ditampilkan**, bukan saat dijawab.

## Tombol "Change this sentence"

Ini untuk kalimat **jelek**, bukan kalimat **bosan**. Beda mekanisme dari auto-generate.

```
1. Tambah index ke user_cards.hidden_sentences
2. words.sentences[i].hide_count += 1
3. Kalau hide_count >= 3 → flagged = true (konsensus global)
```

Kalimat tidak dihapus. User lain tidak terpengaruh sampai ada 3 orang yang setuju kalimat itu jelek.

Prompt:

> Sesi 4: pindahkan tracking pemakaian kalimat dari words ke user_cards sesuai UPDATE-PLAN.md Sesi 4. Implementasi sentence_usage dan hidden_sentences sebagai array index. Rotasi pilih usage terkecil. Tombol "Change this sentence" menyembunyikan per user dan menaikkan hide_count global, dengan flag otomatis di 3.

Selesai kalau:
- [ ] Dua user berbeda punya `sentence_usage` terpisah untuk kata yang sama
- [ ] Rotasi tidak mengulang kalimat sebelum semua terpakai
- [ ] `usage` naik saat ditampilkan, bukan saat dijawab
- [ ] Hide oleh satu user tidak mempengaruhi user lain
- [ ] Hide oleh tiga user berbeda → kalimat hilang dari pool semua orang

---

# Sesi 5 — Sistem tiket

**Tujuan:** pool kalimat tumbuh otomatis tanpa conflict.

## Kapan generate

Dua syarat, **keduanya** harus terpenuhi:

1. Ada user yang `fresh < 3`
2. `poolSize < 15`

Kalau `pool_full = true` → lewati pengecekan sepenuhnya. Kata yang sudah matang jadi nol biaya cek.

Jalur pertumbuhan: **5 → 10 → 15**. Nambah 5 sekaligus.

> Pemicunya **per user, bukan rata-rata.** Orang yang kehabisan kalimat selalu minoritas — kalau pakai rata-rata, user aktif tidak akan pernah jadi mayoritas dan akan muter-muter di kalimat yang sama selamanya.

## Anti-conflict — tiga lapis

| Lapis | Mencegah | Caranya |
|---|---|---|
| 1 | Tiket kembar | `word_id` UNIQUE — nitip kedua ditolak database |
| 2 | Dua proses ngerjain tiket sama | `SELECT ... FOR UPDATE SKIP LOCKED` |
| 3 | Tiket nyangkut | `locked_at` lewat 2 menit → dianggap nganggur lagi |

## Kapan jalan

Setelah sesi selesai, **di belakang layar**, setelah layar hasil tampil. Dua langkah **berurutan**:

```
[ Langkah 1 — NITIP ]
  Untuk tiap kata level 3-4 yang muncul di sesi ini:
    Kalau pool_full → lewati
    Kalau fresh < 3 dan poolSize < 15 → tulis tiket
                                        (ditolak otomatis kalau sudah ada)

[ Langkah 2 — NGERJAIN ]
  Ambil tiket nganggur (FOR UPDATE SKIP LOCKED)
  Untuk tiap tiket, maksimum 3:
    Cek ulang poolSize < 15
    Generate 5 kalimat → append ke words.sentences
    Kalau poolSize jadi 15 → set pool_full = true
    Hapus tiket
```

**Nitip dulu, baru ngerjain.** Kalau kebalik, tiket yang barusan dibuat tidak akan dikerjakan di ronde itu.

**Yang nitip cuma yang butuh. Yang ngerjain siapa saja yang lewat** — termasuk user yang tidak punya kata itu di deck-nya.

Hanya cek kata level 3-4 yang muncul di sesi itu. Kata level 1-2 tidak menyentuh kalimat sama sekali, jadi statusnya tidak mungkin berubah. Scan seluruh deck itu pemborosan.

## Kalau gagal

Diam saja. Tidak ada notifikasi, tidak ada retry di tempat. Tiket masih di meja, nanti ada yang mengambil.

Prompt:

> Sesi 5: implementasi antrian tiket untuk auto-generate kalimat sesuai UPDATE-PLAN.md Sesi 5. Jalan setelah sesi quiz selesai di background — nitip dulu, baru ngerjain. Pakai unique constraint di word_id dan FOR UPDATE SKIP LOCKED untuk mencegah conflict, plus timeout 2 menit untuk tiket yang nyangkut. Maksimum 3 tiket per eksekusi.

Selesai kalau:
- [ ] Dua user selesai quiz bersamaan di kata yang sama → hanya satu tiket, hanya satu generate
- [ ] Pool tumbuh 5 → 10 → 15, tidak pernah lewat
- [ ] `pool_full` di-set saat mencapai 15, dan pengecekan dilewati setelahnya
- [ ] Tiket yang nyangkut lebih dari 2 menit bisa diambil ulang
- [ ] Layar hasil sesi tampil tanpa menunggu generate

**Cara tes conflict:** buka dua browser dengan akun berbeda, selesaikan sesi hampir bersamaan pada kata yang sama. Cek pool bertambah 5, bukan 10.

---

# Sesi 6 — Bersih-bersih UI

**Tujuan:** hapus yang sudah tidak relevan.

- [ ] Hapus tombol **"Refresh sentences"** di Stats — sudah digantikan auto-generate
- [ ] Pastikan tombol **"Change this sentence"** masih ada di layar feedback dan Word detail
- [ ] Cek layar Word detail masih menampilkan progress dengan benar setelah pemisahan tabel
- [ ] Cek `My words` masih jalan — query-nya sekarang join `user_cards` ke `words`

Prompt:

> Sesi 6: hapus tombol Refresh sentences di Stats. Cek semua layar masih jalan setelah pemisahan tabel words dan user_cards — terutama My words, Word detail, dan Stats yang query-nya sekarang perlu join.

---

# Hal yang perlu diwaspadai

**Lisensi Merriam-Webster.** Pendaftaran memakai deskripsi "single-user, non-commercial, personal study". Sekarang sudah ada 3 user. Cek terms mereka sebelum dipublikasikan lebih luas — ketentuan untuk aplikasi multi-user biasanya berbeda.

**Paparan biaya.** User lain menambah kata = tagihan Anthropic. Batas 50 kata baru per hari per user sekarang bukan lagi pengaman bug, tapi pengaman dompet. Sadari juga orang bisa membuat banyak akun.

**Kuota Merriam-Webster 1000/hari untuk seluruh app.** Dengan cache di tabel `words`, ini seharusnya cukup — tapi pantau kalau user bertambah banyak.

---

# Config tambahan

```js
MAX_SENTENCE_POOL:      15,   // cap keras
SENTENCE_BATCH:         5,    // generate 5 sekaligus: 5 → 10 → 15
FRESH_THRESHOLD:        3,    // fresh di bawah ini → nitip tiket
FLAG_THRESHOLD:         3,    // hide oleh N user → flagged global
TICKET_TIMEOUT_MINUTES: 2,    // tiket nyangkut dianggap nganggur
MAX_TICKETS_PER_SESSION: 3,   // batas kerja per momen
```

---

# Urutan pengerjaan

```
Sesi 1  Sinkronkan SPEC.md          ← wajib duluan
Sesi 2  Schema baru                 ← fondasi
Sesi 3  Alur generate baru
Sesi 4  Pool kalimat per user
Sesi 5  Sistem tiket
Sesi 6  Bersih-bersih UI
```

Sesi 1 dan 2 harus berurutan. Sesi 4 harus sebelum 5 — sistem tiket bergantung pada perhitungan `fresh` yang dibuat di Sesi 4.

**Commit setelah tiap sesi.** Ini migrasi arsitektur, bukan penambahan fitur — kalau ada yang rusak, lebih gampang mundur satu langkah daripada mencari di tumpukan perubahan.

Setelah semua selesai, isi ulang deck dan pakai beberapa hari sebelum menganggap ini beres. Bug di rotasi kalimat dan perhitungan `fresh` biasanya baru kelihatan setelah beberapa sesi.
