# VX Card — Spec

Aplikasi kartu kosakata bahasa Inggris dengan spaced repetition.
Dipakai satu orang (single user), diakses lewat PWA di iPhone.

**Bahasa UI: Inggris.** Dokumen ini bahasa Indonesia, tapi semua teks yang tampil di app pakai bahasa Inggris.

---

## 0. Fondasi

| Topik | Keputusan |
|---|---|
| Platform | PWA, di-install ke homescreen iPhone (Safari → Share → Add to Home Screen) |
| Sumber kata | App terpisah dari Kindle. Input manual satu per satu |
| Metadata | Tidak menyimpan judul buku atau sumber |
| Pembagian sumber data | **Fakta** (definisi, IPA, audio, POS, etimologi) dari dictionary API. **Bahasa** (kalimat contoh, distraktor) dari LLM |
| Dictionary API | `dictionaryapi.dev` (gratis, tanpa key). Alternatif: Merriam-Webster Learner's |
| Terjemahan Indonesia | **Tidak ada.** App full English |
| Waktu generate | Sekali saat kartu dibuat, disimpan sebagai JSON. **Sesi quiz = nol API call** |
| Quiz sinonim | Tidak dibuat |

**Stack:** Next.js + Vercel (hosting) + Supabase (database + auth)

---

## 1. Data & Paket Kata

### 1.1 Alur generate

```
1. Normalisasi input (lowercase, trim)
2. Cek duplikat di deck
3. Panggil dictionary API
4. Panggil LLM (2 panggilan terpisah)
5. Simpan
6. Tampilkan paket lengkap ke user
```

Blocking (~3-5 detik dengan spinner). Alasan: momen membaca paket lengkap adalah bagian dari proses belajar.

### 1.2 Field dari dictionary API

| Field | Catatan |
|---|---|
| `word` | |
| `phonetic` | Nullable |
| `audio_url` | Nullable → fallback ke `speechSynthesis` browser |
| `pos` | **Kritis** — dipakai untuk filter distraktor. Ambil yang pertama saja kalau ada beberapa |
| `definition` | Makna utama (yang pertama) |
| `origin` | Bonus, sering kosong. Tampilkan kalau ada |
| `other_meanings` | Simpan **semua**, tampilkan hanya makna utama + toggle "+N more meanings" |

### 1.3 Panggilan LLM

Model: **Claude Haiku**. Temperature 0.3. Output JSON murni. API key **wajib di backend**.

Dua panggilan **terpisah**:

**Panggilan A — 5 kalimat contoh** (bisa di-regenerate)

Input: word, pos, definition
Syarat output:
- Konteks berbeda-beda, bukan variasi kalimat yang sama
- Panjang 10–20 kata
- Kata target di tengah kalimat, jangan di awal
- Sertakan `form` — bentuk kata yang dipakai (mis. `relegated` bukan `relegate`)

**Panggilan B — distraktor** (sekali seumur hidup kartu)

- `distractor_defs` — 6 definisi palsu. Harus "nyaris benar": menyerempet kata lain yang mirip bentuknya. Contoh untuk *explicable*: "able to be excused or forgiven" (excusable), "capable of being expressed in words" (expressible), "understood without being stated" (implicit)
- `distractor_words` — 6 kata dengan POS sama, tingkat kesulitan setara

### 1.4 Struktur data per kata

```json
{
  "id": "uuid",
  "word": "explicable",
  "created_at": "2026-09-02",

  "phonetic": "/ɪkˈsplɪkəb(ə)l/",
  "audio_url": "https://...mp3",
  "pos": "adjective",
  "definition": "able to be accounted for or understood",
  "origin": "mid 16th cent.: from French, or from Latin explicabilis, from explicare",
  "other_meanings": [
    { "pos": "adjective", "definition": "..." }
  ],

  "sentences": [
    { "text": "...", "form": "explicable", "used_count": 0 },
    { "text": "...", "form": "explicable", "used_count": 0 },
    { "text": "...", "form": "explicable", "used_count": 0 },
    { "text": "...", "form": "explicable", "used_count": 0 },
    { "text": "...", "form": "explicable", "used_count": 0 }
  ],

  "distractor_defs": ["...", "...", "...", "...", "...", "..."],
  "distractor_words": ["...", "...", "...", "...", "...", "..."],

  "level": 1,
  "streak": 0,
  "due_date": "2026-09-03",
  "lapse_count": 0,
  "last_seen_date": null
}
```

Riwayat review disimpan terpisah:

```json
{
  "word_id": "uuid",
  "reviewed_at": "2026-09-02T14:30:00Z",
  "level": 3,
  "result": "slow",
  "duration_ms": 11400,
  "help_used": 0,
  "source": "due"
}
```

`result`: `correct` | `slow` | `wrong` | `dontknow`
`source`: `due` | `random` | `practice` | `hardmode`

### 1.5 Error handling

| Kasus | Penanganan |
|---|---|
| Kata tidak ditemukan, ada saran ejaan | Tawarkan: "Did you mean *explicable*?" |
| Kata tidak ditemukan, tanpa saran | Tolak, minta cek ejaan |
| Data bolong (phonetic/audio/origin kosong) | Tetap buat kartu, field kosong disembunyikan |
| Frasa (ada spasi) | Tolak — "Only single words for now" |
| Offline / API down | Tolak — "No connection. Try again later." Tidak ada antrian pending |

### 1.6 Regenerate kalimat

| Tombol | Lokasi | Syarat | Aksi |
|---|---|---|---|
| ✎ (per kalimat) | Layar feedback + Word Detail | Selalu ada | Ganti 1 kalimat, `used_count` reset 0 |
| Refresh sentences | Stats | Ada kalimat `used_count >= 3` | Generate ulang 5 kalimat untuk semua kata yang memenuhi syarat |

Tombol borongan: konfirmasi dulu ("42 words will be refreshed"), jalan di background dengan progress bar, batas maksimum 50 kata per eksekusi. Sembunyikan tombol kalau tidak ada yang memenuhi syarat.

**Rotasi kalimat:** pilih yang `used_count` terkecil. Kalau seri, acak. `used_count` naik saat kalimat **ditampilkan**, bukan saat dijawab.

---

## 2. Desain Quiz

### 2.1 Aturan umum

- Soal **hanya menggunakan makna utama**. Makna lain hanya tampil sebagai referensi di kartu
- Kalimat contoh hanya dipakai di level 3 & 4

### 2.2 Empat level

| Level | Bentuk soal | Target benar |
|---|---|---|
| 1 | Kata → arti (4 opsi) | 2× |
| 2 | Arti → kata (4 opsi) | 2× |
| 3 | Kalimat rumpang → kata (4 opsi) | 3× |
| 4 | Kalimat rumpang → ketik manual | 3× |

Total 10 jawaban benar untuk lulus.

### 2.3 Aturan naik/turun level

Tiap kata menyimpan `level` (1–5) dan `streak`.

```
LEVEL_TARGETS = { 1: 2, 2: 2, 3: 3, 4: 3 }
```

**Benar:**
1. `streak += 1`
2. Kalau `streak >= LEVEL_TARGETS[level]` → `level += 1`, `streak = 0`
3. `level = 5` berarti lulus

**Salah:**
1. `streak -= 1`
2. Kalau `streak < 0` → `level -= 1`, `streak = LEVEL_TARGETS[level_baru] - 1`
3. Di level 1, `streak` tidak bisa di bawah 0

Contoh trace:

| Kondisi awal | Jawaban | Hasil |
|---|---|---|
| L2 streak 1 | Salah | L2 streak 0 — **tidak turun** |
| L2 streak 0 | Salah | L1 streak 1 — turun, tapi 1× benar langsung kembali |
| L3 streak 2 | Benar | **L4** streak 0 |

### 2.4 Distraktor

| Level | Sumber |
|---|---|
| 1 | `distractor_defs` dari LLM (ambil 3 dari 6) |
| 2 | `distractor_words` dari LLM (ambil 3 dari 6) |
| 3, 4 | **Kata lain di deck** dengan POS sama. Fallback ke `distractor_words` kalau kandidat kurang dari 3 |

Untuk level 3, distraktor harus disesuaikan **bentuk katanya** dengan `form` di kalimat yang dipakai. Kalau kalimat pakai *relegated*, distraktor jadi *delegated*, *relocated*, *reinstated* — bukan bentuk dasar.

### 2.5 Scoring

```
kalau salah atau "Don't know"  → wrong / dontknow
kalau benar:
    lambat = (durasi > AMBANG[level]) OR (help_used > 0)
    → slow kalau lambat, correct kalau tidak
```

**Ambang lambat per level** (tebakan awal, kalibrasi setelah ada data):

```
SLOW_THRESHOLD = { 1: 5000, 2: 6000, 3: 10000, 4: 15000 }  // ms
```

**Batas atas:** durasi > 60 detik → data dibuang (kemungkinan user ter-distract), dihitung sebagai `correct` normal.

**Dampak:**
- `correct` → naik streak normal, interval penuh
- `slow` → naik streak normal, **interval mundur satu step**
- `wrong` / `dontknow` → turun streak, `lapse_count += 1`, due besok

### 2.6 Level 4 — ketik manual

- User mengetik **kata penuh** dari nol, bukan per huruf
- Hint di atas input: `e _ _ _ _ _ _ _ _ _` (huruf pertama + jumlah huruf)
- **Fuzzy matching**: salah 1 huruf tetap dihitung benar, dengan catatan "Almost — it's spelled *explicable*"
- Ada tombol **Answer** (level 4 satu-satunya yang punya tombol submit). Enter di keyboard juga berfungsi

**Tombol bantuan (Hint):**

| Aspek | Aturan |
|---|---|
| Jatah | 2× per soal. **1× kalau kata < 6 huruf** |
| Efek | Reveal 1 huruf, posisi acak |
| Posisi dikecualikan | Huruf pertama, huruf terakhir, huruf yang sudah ter-reveal |
| Timer | Pause saat tombol ditekan, jalan lagi setelah huruf muncul |
| Kalau benar | Dihitung `slow` |
| Kalau salah | `wrong` biasa, tidak ada keringanan |

### 2.7 Lain-lain

- Ada tombol **"Don't know"** terpisah dari menebak salah — sinyal lebih bersih
- Kata yang dijawab salah **dimunculkan lagi di akhir sesi**

---

## 3. Scheduler

### 3.1 Prinsip

Tiap kata punya `due_date`. Prioritas antrian **murni berdasarkan seberapa telat** (`hari_ini - due_date`), **bukan** berdasarkan skor.

Alur satu arah: `skor → interval → due_date → urutan antrian`

### 3.2 Tangga interval

```
INTERVALS = [2, 2, 4, 8, 15, 25, 45, 90, 180]  // hari
```

| Step | Kondisi setelah jawaban | Interval |
|---|---|---|
| 0 | L1 | 2 hari |
| 1 | L2 | 2 hari |
| 2 | L3, streak 0 | 4 hari |
| 3 | L3, streak 1 | 8 hari |
| 4 | L3, streak 2 | 15 hari |
| 5 | L4, streak 0 | 25 hari |
| 6 | L4, streak 1 | 45 hari |
| 7 | L4, streak 2 | 90 hari |
| 8 | Lulus (L5) | 180 hari |

Tiap angka = **jarak ke review berikutnya dari tanggal tes**, bukan akumulasi.

- `correct` → ambil interval sesuai step
- `slow` → ambil interval **satu step lebih rendah** (minimum 1 hari)
- `wrong` / `dontknow` → `due_date = besok`

**Tidak ada pemotongan interval** untuk kartu yang ditarik lebih awal. Interval selalu dihitung dari tanggal tes. Ini disengaja: kartu yang ditarik lewat slot acak jadwalnya bergeser lebih awal secara permanen, dan itu membantu meratakan distribusi jadwal.

### 3.3 Komposisi sesi

```
jumlah_due    = min(due_tersedia, slot × 0.8)
jumlah_random = slot − jumlah_due
```

Random **minimal 20%**, melar mengisi kekosongan.

| Due tersedia | Slot 15 |
|---|---|
| 40 | 12 due + 3 random |
| 12 | 12 due + 3 random |
| 5 | 5 due + 10 random |
| 0 | 15 random |

**Pemilihan due:** ambil `jumlah_due × 1.5` kata yang paling telat, lalu acak dari situ.
Contoh: butuh 12 → ambil 18 paling telat → acak pilih 12.

**Pemilihan random:** acak murni dari **semua kata** (termasuk yang sudah lulus dan yang belum jatuh tempo), dikurangi kata yang sudah terpilih di sesi itu. Tidak ada pembobotan — unsur tak terduga disengaja.

**Urutan:** due dan random diaduk, jangan dikelompokkan.

### 3.4 Kata baru

Kata baru = kata biasa dengan `due_date = besok`. Tidak ada perlakuan khusus, tidak ada inbox, tidak ada kuota.

Kata baru otomatis punya "keterlambatan 0", jadi berada di urutan paling bawah pool due. Kalau backlog menumpuk, kata baru otomatis tidak kebagian — rem alami tanpa aturan tambahan.

Di hari pertama (semua kata due besok, due hari ini = 0), sesi terisi 100% random sehingga kata baru tetap bisa dimainkan.

### 3.5 Main berulang

**Bebas tanpa batas.** Semua sesi dihitung penuh — level, streak, `due_date` semua ter-update.

Anti-duplikat **hanya berlaku dalam satu sesi** (satu kata tidak muncul dua kali dalam sesi yang sama). Antar sesi bebas.

Konsekuensi yang diterima: kata bisa lulus dalam satu hari kalau di-grinding. Peredamnya adalah slot acak 20% yang menarik dari semua kata termasuk yang lulus — kalau ternyata sudah lupa, kata turun level dan kembali ke rotasi.

### 3.6 Practice more

Sesi tambahan setelah sesi utama selesai. Menarik dari:
1. Sisa due yang belum keluar hari itu
2. Acak

Tidak menarik kata yang belum jatuh tempo secara sengaja.

### 3.7 Hard Mode

| Aspek | Aturan |
|---|---|
| Pool | Kata level 4 + lulus (L5) |
| Unlock | Dicek dinamis: `eligible >= 10`. **Bisa terkunci lagi** kalau jumlahnya turun |
| Bentuk soal | Semua level 4 (kalimat rumpang, ketik manual) |
| Jawab benar | **Tidak berpengaruh apa-apa** (level, streak, due_date tidak berubah) |
| Jawab salah | Berpengaruh penuh: `streak -= 1`, `lapse_count += 1`, due besok |
| Rem | Maksimum **2 kata turun level per sesi**. Salah ke-3 dst tetap dicatat tapi level tidak turun di sesi itu |
| Main berulang | Boleh, tanpa batas |

Alasan asimetri: kabar buruk (sudah lupa) selalu didengar, kabar baik tidak bisa dieksploitasi untuk farming interval.

### 3.8 Yang TIDAK ada

- **Suspend / leech handling** — dihapus. `lapse_count` tetap dicatat untuk statistik, tapi tidak ada kata yang otomatis dikeluarkan dari rotasi
- **Fuzz interval** — tidak perlu, karena pool 1,5× dan slot acak sudah memecah barisan jadwal secara alami

---

## 4. UI / UX

### 4.1 Peta layar

```
HOME ─┬─ Add word
      ├─ Session setup ─ Quiz ─ Session complete
      ├─ My words ─ Word detail
      └─ Stats ─ Calendar
```

**Tab bar 3 tab:** 🏠 Home · 📚 My words · 📊 Stats

Quiz **fullscreen** — tab bar disembunyikan selama sesi.

Semua aksi utama ditaruh di bagian bawah layar (jangkauan jempol, dipakai satu tangan).

### 4.2 Home

```
🔥 13 days

Today
50 words waiting

[ ▶  Review          ]
[ 🔒 Hard Mode 7/10  ]
[ +  Add word        ]
```

**Tombol Hard Mode:**

| Kondisi | Tampilan | Aktif |
|---|---|---|
| eligible < 10 | `🔒 Hard Mode · 7/10 words` | ❌ |
| eligible >= 10 | `⚡ Hard Mode` | ✅ |

**Indikator tunggakan** — satu angka saja, tidak dipisah due/overdue:

| Kondisi (jatah 15) | Tampilan |
|---|---|
| <= 2× jatah (≤30) | `50 words waiting` — teks biasa |
| 2–4× jatah (30–60) | `50 words waiting` + ⚠ kecil |
| > 4× jatah (>60) | `68 words waiting` + saran: *"Try more per session, or pause adding new words."* |
| 0 | `Nothing due — free practice` |

Nada informatif, **bukan menghukum**. Jangan pakai warna merah.

### 4.3 Add word

Input:
```html
<input autocorrect="off" autocapitalize="off" spellcheck="false" />
```

Suggestion bar keyboard iOS tetap muncul (tidak bisa dan tidak perlu dimatikan). Yang dimatikan hanya penggantian otomatis.

Keyboard auto-open saat layar dibuka.

**Alur:** ketik → Search → loading 3-5 detik → pratinjau paket → Save / Cancel → kembali ke input dengan keyboard terbuka + toast "explicable saved"

**Error state:**

| Kasus | Tampilan |
|---|---|
| Sudah ada | `"explicable" is already in your deck. Level 3 · due in 15 days` + tombol View |
| Typo | `Did you mean explicable?` + Yes / No |
| Tidak ditemukan | `"zxcvb" not found. Check the spelling.` |
| Frasa | `Only single words for now.` |
| Offline | `No connection. Try again later.` |

### 4.4 Session setup

```
How many words today?

[ 10 ]  [ 15 ]  [ 20 ]
   [ Custom ]

8 words due

[ Start ]
```

- Tap angka = **langsung mulai** (tidak perlu tekan Start terpisah)
- Pilihan terakhir diingat dan ditandai; tombol Start memakai pilihan itu
- Batas atas = total kata di deck (normal) atau pool eligible (Hard Mode)
- Deck 12 kata → tampilkan `10 · 12 · Custom`
- **Deck < 10 kata → skip layar ini**, langsung mulai dengan semua kata
- Deck kosong → arahkan ke Add word

### 4.5 Layar quiz

```
×    ▓▓▓▓▓░░░░░  4/10

      explicable

[ able to be excused or forgiven    ]
[ able to be accounted for...       ]
[ capable of being expressed...     ]
[ understood without being stated   ]

         Don't know
```

- **Tanpa label A/B/C/D.** Tap kotak = langsung terkirim, tidak ada tombol Submit
- Soal di atas, opsi di bawah
- "Don't know" berupa teks polos, bukan kotak — supaya tidak terlihat seperti opsi kelima
- Progress bar `4/10` di atas. **Tidak ada skor berjalan**
- Level 4 punya tombol **Answer** dan keyboard auto-open, tombol menempel di atas keyboard

**Alur:** soal → jawab → feedback → tap Continue → soal berikutnya
Feedback **tidak auto-lanjut**. Transisi geser dari kanan, ~200ms.

**Keluar di tengah:**
```
Quit session?
Your 4 answers are saved,
but your streak won't count today.

[ Keep going ]   [ Quit ]
```

### 4.6 Layar feedback

Muncul setelah setiap jawaban. Baris atas berbeda sesuai hasil:

| Hasil | Tampilan |
|---|---|
| correct | `✅ Correct · 3.2s` |
| slow (waktu) | `🐢 Correct, but slow · 11.4s` |
| slow (help) | `🐢 Correct, used 1 hint` |
| wrong | `❌ Wrong` + `Your answer: intelligible` |
| dontknow | `⬜ Not yet — that's fine` |

Isi di bawahnya sama untuk semua:

```
─────────────────────────────

explicable
/ɪkˈsplɪkəb(ə)l/  🔊

adjective
able to be accounted for or understood

  "The English class system is not entirely
   explicable in terms of money."

▸ +1 more meaning
▸ Origin

─────────────────────────────
Level 3  ●●○           in 15 days
                    ✎ change sentence

              [ Continue → ]
```

- Kalimat contoh **selalu ditampilkan**, termasuk di level 1-2 yang soalnya tidak pakai kalimat
- Origin tertutup default; barisnya hilang kalau kata tidak punya origin
- `●●○` = streak di level ini
- "in 15 days" = jarak, bukan tanggal
- **Tidak ditampilkan:** `lapse_count`, skor sesi, nomor soal

### 4.7 Session complete

```
        ✓
   Session complete

  ✅ 7    🐢 2    ❌ 1
     🔥 13 days
─────────────────────
Level up
explicable      L2 → L3
vivid           L1 → L2

Needs review
relegate        L3 → L2
─────────────────────
[    Practice more    ]
        Done
```

- Hanya tiga angka ✅🐢❌. **Tidak ada persentase atau "skor"**
- Hanya tampilkan kata yang **naik atau turun level**. Kata yang salah tapi hanya berkurang streak tidak disebut
- Seksi kosong dihilangkan sepenuhnya
- Kata di daftar bisa di-tap → Word detail
- **Practice more** langsung mulai sesi baru dengan jumlah soal yang sama
- Semua benar → `Nice, all correct 🎉`, seksi Needs review hilang
- Keluar di tengah → judul jadi `Session stopped`

**Streak** dihitung kalau sesi **habis sampai soal terakhir**. Keluar di tengah = streak tidak dihitung hari itu.

### 4.8 My words

```
My words              234
[ 🔍 Search              ]

All  L1  L2  L3  L4  Finished  Suspended
───                    (scroll horizontal)

                ⇅ A–Z
─────────────────────
abate               L1 ●○
verb            tomorrow
─────────────────────
candid              L4 ●○○
adjective        in 45d
─────────────────────
explicable          L3 ●●○
adjective        in 15d
```

- Filter chip scroll horizontal. Chip dengan isi diberi angka: `Finished (18)`
- **Sorting toggle: `⇅ A–Z` ↔ `⇅ Newest`.** Pilihan diingat
- Tab "All" = daftar rata, **tidak dikelompokkan per level**
- Kata lulus ditandai `✓`, bukan "L5"
- Search mencari di kata dan definisi
- Filter kosong → `No words here yet.`

> Catatan: chip "Suspended" hanya relevan kalau fitur suspend nanti ditambahkan. Di V0 fitur ini dihapus, jadi chip-nya tidak perlu dibuat.

### 4.9 Word detail

```
←                    ⋯

explicable
/ɪkˈsplɪkəb(ə)l/  🔊

adjective
able to be accounted for or understood

▸ 1 more meaning
▸ Origin
─────────────────────
Examples

"The English class system..."       ✎
"Her sudden change of mood..."      ✎
(+3 more)
─────────────────────
Progress

Level 3  ●●○
Next review    in 15 days
Added          2 Sep 2026
Reviewed       12 times
Missed         3 times
```

Menu **⋯** (aksi destruktif, sengaja disembunyikan):
- Delete word — **permanen**, dengan konfirmasi `This can't be undone.`
- Reset progress — kembali ke L1, streak 0, due besok

### 4.10 Stats

```
       🔥 13
     day streak
    best: 21 days

    [ 📅 Calendar ]
─────────────────────
234 words
18 finished
─────────────────────
Level breakdown
L1  ▓▓▓▓▓▓▓▓        62
L2  ▓▓▓▓▓▓          48
L3  ▓▓▓▓▓▓▓▓▓▓      74
L4  ▓▓▓▓            32
✓   ▓▓              18
─────────────────────
Accuracy (30 days)
✅ 68%   🐢 21%   ❌ 11%
─────────────────────
[ Refresh sentences  ]
[ 12 words ready     ]
```

Muat dalam satu layar tanpa scroll. Kalender dipisah ke layar sendiri.

**Tidak ada di V0:** badge/achievement, grafik jumlah soal per hari, total waktu belajar.

### 4.11 Calendar (layar terpisah)

```
←    Activity

 ‹    September 2026    ›

M   T   W   T   F   S   S
─────────────────────────
    1   2   3   4   5   6
    ░   ▓   ▓   ░   ▓   ░

7   8   9  10  11  12  13
▓   ▓   ░   ▓   ▓   ▒   ▓

...

September 2026
18 days active · 34 sessions

Less ░ ▒ ▓ More
```

**Navigasi tombol `‹ ›` per bulan.** Default buka di bulan berjalan.

| Kondisi | `‹` | `›` |
|---|---|---|
| Bulan berjalan | aktif kalau ada bulan sebelumnya | **mati** |
| Bulan lama | aktif kalau masih ada yang lebih lama | aktif |
| Bulan pertama pakai app | mati | aktif |

Tombol mati tetap ditampilkan (redup), jangan disembunyikan.

**Gradasi** berdasarkan jumlah sesi hari itu:

| | Arti |
|---|---|
| Kosong | Tidak main |
| ░ | 1 sesi |
| ▒ | 2 sesi |
| ▓ | 3+ sesi |

- `[▓]` — hari ini, diberi border
- `·` — hari yang belum lewat (titik redup, bukan kotak kosong)
- Tap tanggal → `12 Sep · 2 sessions · 25 words`

---

## 5. Database

### 5.1 Tabel `words`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK ke `auth.users` |
| `word` | text | unique per user |
| `created_at` | timestamptz | |
| `phonetic` | text | nullable |
| `audio_url` | text | nullable |
| `pos` | text | |
| `definition` | text | |
| `origin` | text | nullable |
| `other_meanings` | jsonb | array |
| `sentences` | jsonb | array of `{text, form, used_count}` |
| `distractor_defs` | jsonb | array of 6 |
| `distractor_words` | jsonb | array of 6 |
| `level` | int | 1–4, **5 = lulus** |
| `streak` | int | |
| `due_date` | date | **diindeks** |
| `lapse_count` | int | |
| `last_seen_date` | date | anti-duplikat dalam sesi |

### 5.2 Tabel `reviews`

| Kolom | Tipe |
|---|---|
| `id` | uuid |
| `user_id` | uuid |
| `word_id` | uuid FK |
| `reviewed_at` | timestamptz |
| `level` | int |
| `result` | text |
| `duration_ms` | int |
| `help_used` | int |
| `source` | text |

### 5.3 Kenapa jsonb, bukan tabel terpisah

`sentences`, `distractor_defs`, `distractor_words` selalu dibaca bersama kata-nya, tidak pernah di-query lintas kata, dan jumlahnya tetap dan kecil. Memecah jadi tabel terpisah hanya menambah join tanpa manfaat.

Konsekuensi: update `used_count` harus baca-ubah-tulis seluruh array. Untuk single-user ini tidak masalah.

### 5.4 Index

```sql
CREATE INDEX idx_words_due ON words(user_id, due_date);
CREATE INDEX idx_reviews_word ON reviews(word_id);
```

### 5.5 Query pemilihan sesi

```sql
-- 1. Kandidat due
SELECT * FROM words
WHERE user_id = :uid
  AND due_date <= CURRENT_DATE
ORDER BY due_date ASC
LIMIT :jumlah_due * 1.5;
-- lalu acak di aplikasi, ambil :jumlah_due
```

```sql
-- 2. Random
SELECT * FROM words
WHERE user_id = :uid
  AND id NOT IN (:sudah_terpilih)
ORDER BY RANDOM()
LIMIT :jumlah_random;
```

```sql
-- 3. Distraktor dari deck (level 3-4)
SELECT word FROM words
WHERE user_id = :uid
  AND pos = :pos
  AND id != :current_word_id
ORDER BY RANDOM()
LIMIT 3;
```

Pengacakan pool due dilakukan **di aplikasi**, bukan SQL — hasilnya sudah kecil (18 baris), dan `ORDER BY RANDOM()` lambat di tabel besar.

**Seluruh sesi ditarik sekaligus di awal**, tidak per soal. Hasil jawaban dikirim ke server di background (non-blocking). Kalau gagal, tumpuk dan coba lagi.

### 5.6 Auth

**Supabase Auth dengan Google login.**

Aktifkan Row Level Security di kedua tabel:

```sql
CREATE POLICY "own rows" ON words
  FOR ALL USING (auth.uid() = user_id);
```

**Rate limit di endpoint generate: maksimum 50 kata baru per hari.** Ini pengaman terhadap bug/loop, bukan terhadap orang asing.

---

## 6. PWA

### 6.1 Manifest

```json
{
  "name": "VX Card",
  "short_name": "VX Card",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Meta tag di `<head>`:

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<link rel="apple-touch-icon" href="/icon-192.png">
```

Service worker pakai `next-pwa`.

### 6.2 Install

Manual: **Safari → Share → Add to Home Screen.** Harus dari Safari, bukan dari in-app browser (WhatsApp, dll). Tidak ada prompt otomatis di iOS.

### 6.3 Notifikasi (V3)

- Web Push jalan di iOS 16.4+, **hanya kalau PWA sudah di-install ke home screen**
- Tidak bisa dijadwalkan dari dalam app (iOS tidak support Background Sync) — harus dikirim dari server
- Pakai **Vercel Cron**: fungsi harian yang cek siapa yang belum main, lalu kirim push
- Isi: `12 words waiting` atau `Keep your 13-day streak`
- Butuh: VAPID key, tabel `push_subscriptions`

### 6.4 Offline-first (V3)

| | Aturan |
|---|---|
| Sumber data utama | **IndexedDB di HP** |
| Server | Cadangan + sinkronisasi |
| Konflik | Last-write-wins (bandingkan timestamp) |
| Jalan offline | Main (Review, Hard Mode, Practice), My words, Stats, Calendar |
| Butuh koneksi | Add word, Refresh sentences, sinkronisasi |

Ukuran deck 1000 kata ≈ 2-3 MB, tidak masalah untuk IndexedDB.

---

## 7. Roadmap

### V0 — Bisa dipakai (~1-2 minggu)

| # | Kerjaan |
|---|---|
| 1 | Setup Next.js + Vercel + Supabase, dua tabel, Google login, RLS |
| 2 | **PWA manifest + install ke homescreen** (murah, langsung dipakai dari hari pertama) |
| 3 | Endpoint generate (dictionary API + 2× Haiku) |
| 4 | Layar Add word + pratinjau + simpan |
| 5 | Fungsi `updateCard()` — level, streak, due_date |
| 6 | Fungsi pemilihan sesi — 80/20, pool 1,5× |
| 7 | Layar quiz level 1 & 2 |
| 8 | Layar feedback |
| 9 | Home + Session setup + Session complete |

**Setelah V0, pakai minimal 2 minggu sebelum lanjut.** Banyak angka di spec ini masih tebakan dan butuh data nyata untuk dikalibrasi.

### V1 — Lengkapi inti (~1 minggu)

- Level 3 & 4 (cloze, ketik manual, fuzzy matching, tombol Hint)
- Distraktor dari deck
- My words + Word detail
- Hard Mode
- Practice more

Level 3-4 ditunda karena kata baru butuh waktu naik ke level 3 — minggu pertama semua kata masih di L1-L2.

### V2 — Bikin nempel (~1 minggu)

- Streak + Stats + Calendar
- Indikator tunggakan
- Regenerate kalimat (satuan + borongan)

### V3 — Yang berat (~1 minggu)

- Offline-first (IndexedDB + layer sinkron)
- Notifikasi (VAPID + Vercel Cron)

Ditaruh terakhir karena paling banyak kerjaan dan paling mudah menimbulkan bug. Kalau dikerjakan di awal, waktu habis untuk debug sinkronisasi sebelum sempat tahu app-nya berguna atau tidak.

---

## 8. Nilai yang harus jadi config

Semua angka ini adalah tebakan awal. Taruh di satu file konstanta, jangan di-hardcode:

```js
export const CONFIG = {
  LEVEL_TARGETS:    { 1: 2, 2: 2, 3: 3, 4: 3 },
  INTERVALS:        [2, 2, 4, 8, 15, 25, 45, 90, 180],
  SLOW_THRESHOLD:   { 1: 5000, 2: 6000, 3: 10000, 4: 15000 },
  MAX_DURATION:     60000,
  DUE_RATIO:        0.8,
  POOL_MULTIPLIER:  1.5,
  HARD_MODE_MIN:    10,
  HARD_MODE_MAX_DEMOTION: 2,
  SENTENCES_PER_WORD: 5,
  DISTRACTORS_PER_WORD: 6,
  HINT_COUNT:       2,
  HINT_COUNT_SHORT: 1,
  SHORT_WORD_LEN:   6,
  REFRESH_THRESHOLD: 3,
  REFRESH_BATCH_MAX: 50,
  DAILY_NEW_WORD_LIMIT: 50,
};
```

Catatan kalibrasi:
- `SLOW_THRESHOLD` — setel setelah lihat distribusi durasi asli di tabel `reviews`
- `POOL_MULTIPLIER` — `1.0` berarti FIFO murni (lebih pasti, kurang tak terduga)
- `INTERVALS[8]` (180 hari) — bisa diturunkan ke 90 kalau kata lulus terasa terlalu jarang muncul. Ingat: slot acak 20% tetap menariknya lebih cepat dari jadwal resmi
