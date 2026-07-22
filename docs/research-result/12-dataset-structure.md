# 12. Dataset Structure

## Kasus Investigasi

**File sumber:** `cases-input/case-1.json`

| Parameter | Nilai |
|---|---|
| Jumlah kasus investigasi | 3 |
| Jumlah tersangka total | 12 (4 per kasus) |
| Jumlah evidence total | 60 (20 per kasus) |
| Jumlah pertanyaan evaluasi | 9 |

### Detail per Kasus

| No | Judul Kasus | Kesulitan | Tersangka | Evidence | Skenario Eval |
|---|---|---|---|---|---|
| 1 | The Procurement Ledger Discrepancy | Medium | 4 (David Vance, Elena Rostova, Marcus Brody, Sarah Jenkins) | 20 | 3 |
| 2 | The Missing Quantum Blueprint | Hard | 4 (Dr. Aris Thorne, Dr. Clara Mendoza, Julian Vance, Dr. Raymond Finch) | 20 | 3 |
| 3 | Operation Midnight Leak | Hard+ | 4 (Victor Sterling, Nadia Volkov, Arthur Pendelton, Elena Rostova) | 20 | 3 |

## Tipe Evidence

| Tipe | Keterangan |
|---|---|
| `witness_statement` | Pernyataan saksi |
| `forensic_report` | Laporan forensik |
| `cctv_log` | Rekaman CCTV |
| `financial_record` | Catatan keuangan |
| `email_message` | Pesan email |
| `location_report` | Laporan lokasi/akses |

## Kategori Evidence

| Kategori | Keterangan |
|---|---|
| `financial` | Bukti terkait keuangan |
| `alibi` | Bukti alibi |
| `contradiction` | Bukti yang bertentangan |
| `location` | Bukti lokasi |
| `communication` | Bukti komunikasi |
| `motive` | Bukti motif |
| `forensic` | Bukti forensik |
| `noise` | Bukti pengecoh (irrelevant noise) |

## Ground Truth

Ground truth disimpan dalam file JSON (`cases-input/case-1.json`) dan di-seed ke tabel `case_ground_truth`.

Struktur per kasus:
- `correct_suspect_name`: Nama tersangka yang benar
- `contradiction_pairs`: Pasangan evidence yang saling bertentangan (index-based, dipetakan ke ID saat seeding)
- `relevant_evidence_indices`: Index evidence yang relevan untuk investigasi
- `optimal_next_actions`: Tindakan optimal yang diharapkan

## Evaluation Dataset

**File sumber:** `eval-scenarios/scenarios.json`

Format evaluasi terdiri dari 9 skenario:

| No | Kasus | Prompt | Difficulty | Required Evidence |
|---|---|---|---|---|
| 1 | Procurement Ledger | Who should be interrogated next? | medium | 5 evidence |
| 2 | Procurement Ledger | Which suspect has the strongest alibi? | easy | 2 evidence |
| 3 | Procurement Ledger | Identify any contradictions in suspect statements. | hard | 4 evidence |
| 4 | Missing Quantum Blueprint | Which suspect is the most likely thief? | medium | 5 evidence |
| 5 | Missing Quantum Blueprint | What financial motive evidence exists? | easy | 1 evidence |
| 6 | Missing Quantum Blueprint | Did Dr. Aris Thorne have opportunity? | medium | 3 evidence |
| 7 | Operation Midnight Leak | Which suspect leaked the pricing spreadsheet? | hard | 5 evidence |
| 8 | Operation Midnight Leak | Find timeline conflicts in suspect testimony. | hard | 4 evidence |
| 9 | Operation Midnight Leak | Could Victor Sterling have done it? | medium | 2 evidence |

### Distribusi Kesulitan

| Difficulty | Jumlah |
|---|---|
| Easy | 2 |
| Medium | 4 |
| Hard | 3 |
