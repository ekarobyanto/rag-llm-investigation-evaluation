# Kebocoran Data Perusahaan dalam Bahasa Indonesia

## Dataset revisi ID v3

Gunakan pasangan `cases-input/id-ID/case-1.v3.json` dan `eval-scenarios/scenario-v3.id.json`. Kasus *Kebocoran Data Perusahaan (ID v3)* memuat 150 dokumen dalam lima batch. Indeks bukti berbasis nol dan urutannya mengikuti kelima batch. Setiap skenario mencantumkan pertanyaan, jawaban acuan, dan indeks dokumen yang mendukung rincian yang ditanyakan. Daftar ini menjadi label untuk evaluasi retrieval. Dua pasangan kontradiksi langsung adalah [61, 62] dan [61, 64]. Label tingkat kesulitan mengikuti pembagian v2 dan belum dikalibrasi ulang.

Validasi berkas secara luring dari direktori utama repo:

```sh
node scripts/validate-scenarios.mjs eval-scenarios/scenario-v3.id.json cases-input/id-ID/case-1.v3.json
```

Saat menjalankan eksperimen, arahkan `DATABASE_URL` ke database eksperimen kosong yang telah dimigrasi, set `EVAL_SCENARIO_FILE=scenario-v3.id.json` pada proses seed dan aplikasi, lalu jalankan `npm run seed`. Seed memerlukan kunci API untuk membuat embedding. Simpan hasil dengan penanda ID v3. Konfigurasi indeks dan kueri full-text pada cabang ini menggunakan kamus PostgreSQL `english`, termasuk untuk teks Indonesia. Catat pilihan kamus dalam konfigurasi eksperimen.

## Adaptasi awal

`case-1.json` merupakan adaptasi Bahasa Indonesia dari kasus dalam `../case-1.json`, bukan kasus dengan alur cerita baru. Nama perusahaan utama dan beberapa nama tempat atau layanan diganti dengan sebutan umum. Nama tersangka, mata uang, tanggal, serta zona waktu yang disebutkan tetap mengikuti sumber.

- Judul adaptasi: **Kebocoran Data Perusahaan**.
- Kunci kasus: `nexus_data_breach`.
- Jumlah: 5 tersangka dan 150 butir bukti dengan urutan yang sama seperti sumber, termasuk pernyataan tetangga Marcus Chen pada indeks 18.
- Deskripsi, profil, isi bukti, dan penjelasan kontradiksi diterjemahkan.
- Kunci JSON, nama tersangka, `type`, `category`, `difficulty_weight`, indeks bukti dalam kunci jawaban, dan kode tindakan dipertahankan sesuai sumber.
- Akun layanan, alamat IP, nomor penerbangan, serta teks kueri pencarian asli dipertahankan; kueri pencarian diberi terjemahan dalam tanda kurung. Domain surel Marcus Chen diganti menjadi `company.com` secara konsisten.

## Batas terjemahan

Teks naratif menggunakan istilah yang konsisten, antara lain `surel`, `peramban`, `aplikasi perpesanan`, `rumah pintar`, dan `transportasi daring`. Istilah teknis yang lazim serta nama produk dan teks kueri pencarian asli tetap dipertahankan. Penyuntingan bahasa mencakup deskripsi kasus, profil, dan isi bukti; angka, urutan bukti, metadata, serta referensi kunci jawaban tidak diubah dalam penyuntingan ini.

Label profil yang mengungkap jawaban, termasuk penanda pelaku, telah dihapus. Waktu dalam penjelasan kontradiksi pertama diselaraskan dengan bukti indeks 3, yaitu pukul 05:35. Adaptasi ini tidak menambahkan zona waktu yang tidak disebutkan oleh sumber ataupun memperkuat kesimpulan alibi; perubahan ini bukan audit menyeluruh atas seluruh fakta dan label sumber.

## Pemetaan indeks bukti

Semua indeks berbasis nol dan sama persis dengan indeks sumber 0–149. Pasangan kontradiksi Viktor Petrov menggunakan indeks 61 dan 62. Daftar bukti relevan dalam kunci jawaban adalah `[0, 1, 4, 5, 6, 7, 11, 13, 19, 20]`.

## Status pemuatan

Berkas ini merupakan salinan terpisah untuk ditinjau dan belum dimuat ke basis data. Pemuat kasus saat ini hanya membaca berkas JSON langsung di `cases-input`, sehingga subdirektori `id-ID` tidak dimuat otomatis.

Skenario evaluasi belum diterjemahkan. Skenario berbahasa Inggris tetap mengacu pada kasus sumber dan tidak diubah untuk adaptasi ini. Sebelum salinan ini digunakan untuk evaluasi Bahasa Indonesia, siapkan pertanyaan dan jawaban acuan terjemahan dengan `caseTitle` yang sama persis dengan judul adaptasi, pertahankan indeks sumber pada `requiredEvidenceIndices` dan `expectedContradictions`, lalu sesuaikan pemilihan berkas kasus dan konfigurasi bahasa retrieval serta respons model. Tinjau kembali jawaban acuan agar sesuai dengan perubahan istilah dan nama dalam adaptasi ini. Jangan mengubah urutan bukti saat menyiapkan skenario tersebut.
