# Build Plan — VX Card

Panduan langkah demi langkah dari nol sampai app jalan.
Pasangannya `SPEC.md` — file itu isinya *apa* yang dibangun, file ini *kapan* dan *bagaimana*.

**Cara pakai:** kerjakan satu sesi per waktu. Jangan lompat. Centang kalau selesai.

---

## Peta perjalanan

```
FASE 0  Persiapan            ~2 jam       (sekali seumur hidup)
FASE 1  V0 — Bisa dipakai    ~10 sesi     ← target utama
        ⏸  PAKAI 2 MINGGU
FASE 2  V1 — Lengkapi inti   ~5 sesi
FASE 3  V2 — Bikin nempel    ~4 sesi
FASE 4  V3 — Yang berat      ~4 sesi
```

Satu sesi = 1–3 jam. Kalau cuma bisa 3 sesi seminggu, V0 selesai sekitar 3–4 minggu.

**Yang paling penting: sampai akhir Fase 1, lalu berhenti dan pakai.** Banyak angka di SPEC masih tebakan dan cuma bisa dikalibrasi dengan data nyata.

---

# FASE 0 — Persiapan

Sekali saja. Tidak ada coding di sini.

### Akun yang dibutuhkan

- [ ] **GitHub** — github.com, gratis
- [ ] **Vercel** — vercel.com, login pakai GitHub
- [ ] **Supabase** — supabase.com, gratis
- [ ] **Anthropic Console** — console.anthropic.com, isi saldo ~$5
- [ ] Pastikan langganan **Claude Pro/Max** aktif (untuk Claude Code)

> Dua hal terpisah yang sering tertukar:
> **Langganan Claude Pro** → untuk memakai Claude Code saat ngoding
> **API key dari Console** → untuk app-nya memanggil Haiku. Ini yang dibayar per pemakaian, sekitar $1 per 500 kata

### Install di laptop

- [ ] **Node.js** — nodejs.org, versi LTS
      Cek: `node --version`
- [ ] **Claude Code**
      `curl -fsSL https://claude.ai/install.sh | bash`
      Cek: `claude --version` lalu `claude doctor`
- [ ] **Login Claude Code** — ketik `claude`, ikuti prompt di browser
- [ ] **Editor** — VS Code (code.visualstudio.com) kalau belum punya

### Siapkan folder

- [ ] Buat folder:
      ```bash
      mkdir ~/vx-card && cd ~/vx-card
      ```
- [ ] Copy `SPEC.md` dan `BUILD-PLAN.md` ke folder itu
- [ ] Buat repo GitHub kosong bernama `vx-card`

**Selesai Fase 0 kalau:** `claude doctor` bersih, dan folder `~/vx-card` berisi dua file .md.

---

# FASE 1 — V0

Target: app yang bisa dipakai tiap hari. Belum lengkap, tapi jalan.

---

## Sesi 1 — Kerangka project

**Tujuan:** Next.js jalan di laptop dan sudah online di Vercel.

Prompt awal:

> Baca SPEC.md dan BUILD-PLAN.md. Kita mulai Sesi 1: bikin project Next.js baru (App Router, TypeScript, Tailwind) di folder ini, setup git, dan deploy ke Vercel. SPEC.md dan BUILD-PLAN.md jangan diubah. Jelaskan rencana dulu sebelum bikin file.

Selesai kalau:
- [ ] `npm run dev` jalan, halaman kebuka di localhost:3000
- [ ] Kode sudah di-push ke GitHub
- [ ] Ada URL Vercel yang bisa dibuka dari HP

> ⚠️ Jangan lanjut sebelum URL Vercel bisa dibuka dari iPhone. Kalau deploy bermasalah, lebih baik ketahuan sekarang daripada 8 sesi lagi.

---

## Sesi 2 — Database & login

**Tujuan:** tabel siap, bisa login pakai Google.

Prompt awal:

> Sesi 2: setup Supabase. Bikin tabel `words` dan `reviews` sesuai SPEC bagian 5, lengkap dengan index dan Row Level Security. Lalu pasang Supabase Auth dengan Google login. Kasih tahu langkah manual apa saja yang harus saya lakukan di dashboard Supabase.

Selesai kalau:
- [ ] Dua tabel terlihat di dashboard Supabase
- [ ] RLS aktif di kedua tabel
- [ ] Bisa login Google, dan setelah login muncul halaman kosong bertuliskan email saya
- [ ] Environment variable sudah dipasang di Vercel juga, bukan cuma lokal

---

## Sesi 3 — Endpoint generate

**Tujuan:** kasih satu kata, dapat paket lengkap.

Prompt awal:

> Sesi 3: bikin API route `/api/generate`. Sesuai SPEC bagian 1: panggil dictionaryapi.dev, lalu dua panggilan Haiku terpisah (A: 5 kalimat contoh, B: 6 distraktor definisi + 6 distraktor kata). Kembalikan JSON sesuai struktur di SPEC 1.4. Tangani semua error state di SPEC 1.5. Belum perlu UI — saya mau tes lewat curl dulu.

Selesai kalau:
- [ ] `curl` dengan kata "explicable" mengembalikan JSON lengkap
- [ ] Kata ngawur seperti "zxcvb" ditolak dengan rapi
- [ ] Frasa dengan spasi ditolak
- [ ] API key tidak muncul di kode frontend

> 💡 Ini sesi paling penting untuk dicek pelan-pelan. **Baca hasil generate-nya, jangan cuma lihat statusnya 200.** Kalimat contohnya natural? Distraktornya masuk akal? Kalau jelek, perbaiki prompt-nya sekarang — nanti tiap kartu baru pakai prompt ini.

---

## Sesi 4 — Layar Add word

**Tujuan:** bisa ngisi deck.

Prompt awal:

> Sesi 4: bikin layar Add word sesuai SPEC 4.3. Input dengan autocorrect off, pratinjau paket sebelum simpan, semua error state, simpan ke Supabase. Belum perlu styling bagus, yang penting berfungsi.

Selesai kalau:
- [ ] Bisa nambah kata dari HP
- [ ] Kata duplikat ditolak
- [ ] Data masuk ke tabel `words` (cek di dashboard Supabase)
- [ ] **Sudah masuk 30 kata** ← lakukan ini sebelum sesi berikutnya

> Kenapa 30: sesi berikutnya butuh data buat dites. Ambil kata dari buku yang lagi lo baca.

---

## Sesi 5 — Otak sistem

**Tujuan:** logika level dan penjadwalan, tanpa UI.

Prompt awal:

> Sesi 5: implementasi logika inti sebagai fungsi murni (tanpa UI). Dua fungsi: `updateCard()` sesuai SPEC 2.3 + 3.2, dan `buildSession()` sesuai SPEC 3.3. Semua angka ambil dari file config di SPEC bagian 8. Tulis unit test untuk keduanya, termasuk kasus naik/turun level dan komposisi 80/20.

Selesai kalau:
- [ ] Test lulus semua
- [ ] Trace di SPEC 2.3 (tabel L2 streak 1 → salah → tidak turun) terbukti benar di test
- [ ] `buildSession()` menghasilkan komposisi benar untuk due = 40, 12, 5, dan 0

> Ini sesi paling teknis dan paling tidak terlihat hasilnya. Tapi kalau ada bug di sini, semua yang di atasnya ikut salah — dan susah dilacak karena tersembunyi di balik UI.

---

## Sesi 6 — Layar quiz (level 1 & 2)

**Tujuan:** bisa mengerjakan soal.

Prompt awal:

> Sesi 6: bikin layar quiz sesuai SPEC 4.5, tapi level 1 dan 2 saja. Ambil seluruh sesi sekaligus di awal (SPEC 5.5). Catat durasi jawaban. Tombol "Don't know" terpisah. Belum perlu layar feedback — untuk sekarang langsung lanjut ke soal berikutnya.

Selesai kalau:
- [ ] Soal muncul dengan 4 opsi, tap langsung terkirim
- [ ] Progress bar jalan
- [ ] Durasi tercatat di tabel `reviews`
- [ ] Level dan due_date berubah setelah dijawab (cek di Supabase)

---

## Sesi 7 — Layar feedback

**Tujuan:** dapat umpan balik setelah menjawab.

Prompt awal:

> Sesi 7: bikin layar feedback sesuai SPEC 4.6. Empat variasi baris atas (correct/slow/wrong/dontknow), paket kata lengkap, toggle untuk makna lain dan origin, indikator level dan streak, tombol Continue manual.

Selesai kalau:
- [ ] Empat variasi tampil benar
- [ ] Tombol audio 🔊 berbunyi
- [ ] Jawaban lambat ditandai 🐢 dan intervalnya lebih pendek
- [ ] Toggle makna lain berfungsi

---

## Sesi 8 — Home & alur sesi

**Tujuan:** semua tersambung jadi satu app.

Prompt awal:

> Sesi 8: bikin Home (SPEC 4.2), Session setup (4.4), dan Session complete (4.7). Plus tab bar 3 tab. Hard Mode dan Stats belum ada isinya — bikin placeholder dulu.

Selesai kalau:
- [ ] Alur penuh jalan: Home → pilih jumlah → quiz → selesai → Home
- [ ] Indikator "N words waiting" akurat
- [ ] Deck < 10 kata otomatis skip layar setup
- [ ] Keluar di tengah memunculkan konfirmasi

---

## Sesi 9 — PWA

**Tujuan:** app-nya jadi ikon di homescreen iPhone.

Prompt awal:

> Sesi 9: pasang PWA sesuai SPEC 6.1. Manifest, service worker pakai next-pwa, meta tag iOS. Bikin juga icon 192 dan 512 sederhana.

Selesai kalau:
- [ ] Di iPhone: Safari → Share → Add to Home Screen berhasil
- [ ] Buka dari ikon → fullscreen, tanpa address bar
- [ ] Alur quiz jalan normal dari mode standalone

---

## Sesi 10 — Rapikan

**Tujuan:** enak dipakai tiap hari.

Prompt awal:

> Sesi 10: rapikan tampilan. Fokus ke tiga hal: (1) semua tombol utama terjangkau jempol, (2) tidak ada layar yang bikin bingung saat dipakai satu tangan, (3) loading state jelas. Jangan tambah fitur baru.

Selesai kalau:
- [ ] Sudah dipakai satu sesi penuh di HP tanpa merasa terganggu
- [ ] Sudah di-deploy ke Vercel

---

# ⏸ BERHENTI — Pakai 2 minggu

**Ini bagian terpenting dari seluruh rencana ini.**

Selama 2 minggu, cuma lakukan dua hal: tambah kata, dan review tiap hari. Jangan ngoding.

Catat apa saja yang terasa aneh:

- [ ] Ada kata yang definisinya membingungkan?
- [ ] Kalimat contohnya natural, atau kaku?
- [ ] Distraktornya terlalu gampang ditebak?
- [ ] Jumlah soal per sesi terasa pas?
- [ ] Sering kena 🐢 padahal merasa langsung tahu? → ambang detik perlu dinaikkan
- [ ] Kata baru terasa nyampah, atau malah kurang?

Setelah 2 minggu, jalankan query ini di Supabase untuk kalibrasi ambang detik:

```sql
SELECT level,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms) AS median,
       percentile_cont(0.75) WITHIN GROUP (ORDER BY duration_ms) AS p75
FROM reviews
WHERE result IN ('correct','slow')
GROUP BY level;
```

Set `SLOW_THRESHOLD` tiap level ke sekitar **p75**-nya. Artinya: sekitar seperempat jawaban benar akan ditandai lambat — proporsi yang sehat.

---

# FASE 2 — V1

Lengkapi bagian inti yang belum ada.

## Sesi 11 — Level 3 & 4

> Sesi 11: tambahkan soal level 3 (cloze pilihan ganda) dan level 4 (ketik manual) sesuai SPEC 2.2, 2.6. Termasuk fuzzy matching, tombol Hint dengan aturan lengkap, dan rotasi kalimat berdasarkan used_count.

- [ ] Cloze tampil dengan kalimat yang benar
- [ ] Ketik manual + hint pola huruf
- [ ] Typo 1 huruf tetap dihitung benar
- [ ] Hint mengurangi jadi 🐢
- [ ] Kata < 6 huruf cuma dapat 1 hint

## Sesi 12 — Distraktor dari deck

> Sesi 12: untuk level 3 dan 4, ambil distraktor dari kata lain di deck dengan POS sama (SPEC 2.4). Sesuaikan bentuk kata dengan field `form`. Fallback ke distractor_words kalau kandidat kurang dari 3.

- [ ] Distraktor level 3 berasal dari kata sendiri
- [ ] Bentuk kata cocok (relegated, bukan relegate)

## Sesi 13 — My words & Word detail

> Sesi 13: bikin layar My words (SPEC 4.8) dan Word detail (4.9). Search, filter chip, sorting toggle, menu Delete dan Reset progress.

- [ ] Search dan filter jalan
- [ ] Sorting A–Z ↔ Newest
- [ ] Delete permanen dengan konfirmasi

## Sesi 14 — Hard Mode

> Sesi 14: implementasi Hard Mode sesuai SPEC 3.7. Unlock dinamis, semua soal level 4, benar tidak berpengaruh, salah berpengaruh penuh, rem maksimum 2 turun level per sesi.

- [ ] Terkunci kalau eligible < 10
- [ ] Benar tidak mengubah due_date
- [ ] Rem 2 turun level berfungsi

## Sesi 15 — Practice more

> Sesi 15: tombol Practice more di layar selesai sesi (SPEC 3.6). Tarik dari sisa due lalu acak.

- [ ] Bisa main berkali-kali
- [ ] Tidak ada duplikat dalam satu sesi

---

# FASE 3 — V2

Bikin app-nya nempel jadi kebiasaan.

## Sesi 16 — Streak & Stats
> Sesi 16: layar Stats sesuai SPEC 4.10. Streak, best streak, ringkasan, level breakdown, accuracy 30 hari.

- [ ] Streak akurat (syarat: sesi habis sampai soal terakhir)
- [ ] Level breakdown sesuai isi deck

## Sesi 17 — Calendar
> Sesi 17: layar Calendar sesuai SPEC 4.11. Kalender bulanan, navigasi tombol ‹ ›, gradasi per jumlah sesi.

- [ ] Navigasi bulan benar, tombol mati di batas
- [ ] Gradasi sesuai jumlah sesi

## Sesi 18 — Indikator tunggakan
> Sesi 18: indikator "N words waiting" dengan tiga tingkat ambang sesuai SPEC 4.2.

- [ ] Ambang relatif ke jatah harian
- [ ] Nada informatif, bukan menghukum

## Sesi 19 — Regenerate kalimat
> Sesi 19: dua tombol regenerate sesuai SPEC 1.6. Satuan di feedback dan Word detail, borongan di Stats dengan konfirmasi dan progress bar.

- [ ] Ganti satu kalimat berfungsi
- [ ] Borongan punya batas 50 dan jalan di background

---

# FASE 4 — V3

Yang paling banyak kerjaan. Ditaruh terakhir karena paling mudah menimbulkan bug.

## Sesi 20–22 — Offline-first
> Sesi 20: pindahkan sumber data utama ke IndexedDB sesuai SPEC 6.4. Server jadi cadangan. Bikin layer sinkronisasi dengan last-write-wins.

- [ ] Buka app dalam mode pesawat → tetap bisa main
- [ ] Jawaban tersinkron setelah online
- [ ] Add word tetap menolak saat offline (ini disengaja)

> ⚠️ Ini perubahan arsitektur, bukan penambahan fitur. Commit dulu sebelum mulai, dan siap-siap butuh 2–3 sesi.

## Sesi 23 — Notifikasi
> Sesi 23: Web Push sesuai SPEC 6.3. VAPID key, tabel push_subscriptions, Vercel Cron harian.

- [ ] Notifikasi masuk di iPhone
- [ ] Isinya akurat (jumlah kata menunggu / streak)

---

# Kebiasaan yang bikin hasilnya jauh lebih baik

**Satu sesi Claude Code = satu nomor di atas.** Jangan gabung. Sesi yang kepanjangan bikin konteksnya penuh dan kualitasnya turun.

**Selalu minta rencana dulu.** Tambahkan "jelaskan rencana dulu, jangan bikin file" di prompt pertama. Lebih murah mengoreksi rencana daripada mengoreksi 15 file.

**Commit tiap sesi selesai.** Kalau sesi berikutnya merusak sesuatu, gampang balik.
```bash
git add . && git commit -m "sesi 6: quiz level 1-2"
```

**Jalankan `/init` setelah Sesi 2.** Claude Code akan bikin `CLAUDE.md` berisi catatan struktur project yang otomatis kebaca tiap sesi.

**Kalau nyangkut lebih dari 30 menit,** hentikan sesi, mulai sesi baru, dan jelaskan masalahnya dari awal. Sesi yang sudah muter-muter jarang keluar dari lubangnya.

**Tes di HP, bukan cuma di browser laptop.** Layar sempit dan jempol itu kondisi sebenarnya. Buka URL Vercel dari iPhone tiap selesai sesi.

---

# Kalau semuanya lancar

| | Kapan |
|---|---|
| Fase 0 | Hari 1 |
| V0 selesai | Minggu 3–4 |
| Mulai dipakai harian | Minggu 4 |
| V1 selesai | Minggu 7 |
| V2 selesai | Minggu 9 |
| V3 selesai | Minggu 11 |

Realistisnya lebih lama, dan itu wajar. Yang penting sampai akhir Fase 1 — setelah itu app-nya sudah berguna tiap hari, dan sisanya cuma penyempurnaan.
