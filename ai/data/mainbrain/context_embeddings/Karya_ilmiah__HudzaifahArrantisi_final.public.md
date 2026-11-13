# Brain Knowledge: Karya Ilmiah Hudzaifah Ar-Rantisi — Analisis Sentimen Masyarakat Terhadap Kebijakan Pemerintah Menggunakan Pendekatan Natural Language Processing Metode SGD Logistic Regression
> **Sumber Dokumen**: `Karya ilmiah_ HudzaifahArrantisi_final.pdf`
> **Jurnal**: JATISI (Jurnal Teknik Informatika dan Sistem Informasi)
> **Penulis**: Hudzaifah Ar-Rantisi (Teknik Informatika, Sekolah Tinggi Teknologi Terpadu Nurul Fikri)
> **Tipe Dokumen**: Artikel Jurnal / Karya Ilmiah Penelitian NLP

---

## Ringkasan Eksekutif & Abstrak Penelitian

**Judul Penelitian**: Analisis Sentimen Masyarakat Terhadap Kebijakan Pemerintah Menggunakan Pendekatan Natural Language Processing Metode SGD Logistic Regression.

Penelitian karya ilmiah oleh **Hudzaifah Ar-Rantisi** ini menganalisis sentimen masyarakat Indonesia terhadap berbagai kebijakan publik pemerintah (mulai dari kepemimpinan Prabowo-Gibran, Omnibus Law Cipta Kerja, program Danantara, Makan Bergizi Gratis / MBG, hingga kebijakan efisiensi anggaran 2025) menggunakan pendekatan **Natural Language Processing (NLP)** dengan algoritma **SGD (Stochastic Gradient Descent) Logistic Regression** dan ekstraksi fitur **TF-IDF Vectorizer berbasis character n-grams (char_wb)**.

Data penelitian dikumpulkan melalui teknik *web scraping* menggunakan skrip `scan_link.py` sebanyak **481 komentar** (terdiri dari **247 komentar** topik Kebijakan Prabowo di YouTube dan **234 komentar** topik Makan Bergizi Gratis / MBG). Data diproses melalui pipeline *pre-processing* meliputi *cleaning*, normalisasi kata *slang*, *stopword removal*, dan *stemming* bahasa Indonesia menggunakan **PySastrawi**. Pelabelan sentimen menggunakan 2 kelas biner (**positif** dan **negatif**).

Hasil pengujian membuktikan bahwa model **SGD Logistic Regression** mencapai **akurasi 86.27%** dengan rata-rata **5-Fold Cross-Validation sebesar 86.63% ± 2.49%**, meningkat signifikan dibandingkan model baseline sebelumnya (**ComplementNB**) yang hanya mencapai akurasi **54.17%**. Secara keseluruhan, dari 481 komentar yang dianalisis, mayoritas sentimen publik didominasi oleh **sentimen negatif sebesar 82.74% (398 komentar)** dan **sentimen positif sebesar 17.26% (83 komentar)**.

---

## Tabel 1 & Metodologi Penelitian (Dataset & Pipeline NLP)

**Tabel 1. Dataset Penelitian dan Sumber Data**

| Sumber Topik Data | Platform | Jumlah Komentar | Metode Pengumpulan |
| :--- | :--- | :--- | :--- |
| **Kebijakan Prabowo** | YouTube | 247 komentar | Web Scraping (`scan_link.py`) |
| **MBG (Makan Bergizi Gratis)** | YouTube / TikTok | 234 komentar | Web Scraping (`scan_link.py`) |
| **Total Dataset** | **Gabungan** | **481 komentar** | **Pipeline NLP Terstruktur** |

**Tahapan Pipeline Metodologi Penelitian**:
1. **Pengumpulan Data (Data Collection)**: Web scraping 481 komentar opini masyarakat terkait Kebijakan Prabowo (247 komentar) dan Program Makan Bergizi Gratis / MBG (234 komentar).
2. **Preprocessing Data**: Pembersihan teks (*cleaning* URL, simbol, angka), *case folding*, normalisasi kata tidak baku (*slang*), penghapusan kata umum (*stopword removal*), dan *stemming* menggunakan pustaka **PySastrawi**.
3. **Pelabelan Sentimen**: Klasifikasi ke dalam 2 kelas sentimen utama yaitu **Positif** dan **Negatif**.
4. **Ekstraksi Fitur**: Transformasi teks menggunakan **TF-IDF Vectorizer** berbasis *character n-grams* untuk menangani variasi morfologi dan kata tidak baku bahasa Indonesia.
5. **Pemodelan & Evaluasi**: Klasifikasi menggunakan **SGD Logistic Regression** yang dievaluasi dengan metrik *Accuracy* dan **5-Fold Cross-Validation**, serta dibandingkan terhadap model *Complement Naive Bayes (ComplementNB)*.

---

## Tabel 2. Hasil Evaluasi Performa Model SGD Logistic Regression

Model **SGD Logistic Regression** menunjukkan performa akurasi dan stabilitas generalisasi yang jauh mengungguli model sebelumnya (**ComplementNB** yang hanya mencapai **54.17%**):

| Metrik Evaluasi / Pengujian | Nilai Performa | Keterangan |
| :--- | :--- | :--- |
| **Accuracy (Akurasi Utama Model SGD Logistic Regression)** | **86.27%** | Melampaui model ComplementNB (54.17%) sebesar +32.10% |
| **Cross-Validation (Rata-rata 5-Fold)** | **86.63% ± 2.49%** | Standar deviasi rendah (±2.49%), generalisasi model stabil |
| **Fold 1** | **89.47%** | Akurasi tertinggi pada pengujian lintas lipatan |
| **Fold 2** | **84.21%** | Akurasi terendah bersama Fold 4 |
| **Fold 3** | **86.84%** | Konsisten di atas rata-rata |
| **Fold 4** | **84.21%** | Stabil dalam rentang wajar |
| **Fold 5** | **88.42%** | Performa tinggi pada lipatan terakhir |
| **Model Pembanding (Baseline ComplementNB)** | **54.17%** | Akurasi model sebelum optimasi SGD Logistic Regression |

---

## Tabel 3, Tabel 4, & Tabel 5. Hasil Distribusi Sentimen Masyarakat per Topik Kebijakan

Hasil klasifikasi sentimen pada kedua topik kebijakan pemerintah menunjukkan dominasi sentimen negatif yang konsisten:

**Tabel 3 & 4 & 5. Rekapitulasi Distribusi Sentimen Seluruh Data (Kebijakan Prabowo & MBG)**

| Topik Kebijakan Pemerintah | Sentimen Positif (Jumlah & %) | Sentimen Negatif (Jumlah & %) | Total Komentar | Temuan Utama |
| :--- | :--- | :--- | :--- | :--- |
| **Kebijakan Prabowo** (Tabel 3) | **41 komentar (16.60%)** | **206 komentar (83.40%)** | **247 komentar (100%)** | Mayoritas (83.40%) bernada kritis terhadap kebijakan ekonomi & implementasi program |
| **MBG / Makan Bergizi Gratis** (Tabel 4) | **42 komentar (17.95%)** | **192 komentar (82.05%)** | **234 komentar (100%)** | Mayoritas (82.05%) menyoroti efektivitas anggaran, distribusi, dan kualitas pelaksanaan |
| **Total Gabungan Seluruh Data** (Tabel 5) | **83 komentar (17.26%)** | **398 komentar (82.74%)** | **481 komentar (100%)** | Dominasi sentimen negatif sebesar 82.74% secara konsisten pada kedua topik |

**Kesimpulan & Saran Karya Ilmiah Hudzaifah Ar-Rantisi**:
1. **Keunggulan Metode**: Kombinasi **SGD Logistic Regression + TF-IDF character n-grams** berhasil mencapai akurasi **86.27%** (5-Fold CV **86.63% ± 2.49%**), jauh lebih akurat dibanding *ComplementNB* (**54.17%**).
2. **Dominasi Sentimen Publik**: Dari total **481 komentar**, sebanyak **82.74% (398 komentar)** bersentimen negatif dan **17.26% (83 komentar)** bersentimen positif, baik pada topik Kebijakan Prabowo (**83.40% negatif**) maupun Makan Bergizi Gratis / MBG (**82.05% negatif**).
3. **Rekomendasi Penelitian Selanjutnya**: Memperluas cakupan data ke Instagram, TikTok, dan X/Twitter dengan periode longitudinal, menambahkan kelas sentimen **netral**, serta mengeksplorasi model *deep learning* seperti **IndoBERT** atau **RoBERTa-Indonesian** dengan teknik penyeimbangan data **SMOTE**.

---

## Ringkasan Perbandingan 5 Jurnal Referensi Pendukung dalam Studi Literatur

Dalam karya ilmiah ini, ditinjau pula 5 jurnal referensi utama terkait analisis sentimen kebijakan pemerintah menggunakan NLP:

| Referensi | Penulis & Tahun | Topik Kebijakan | Metode NLP & Model | Dataset | Hasil Utama & Akurasi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Referensi 1** | Iim Abdurrohim & Alkautsar Rahman | Omnibus Law Cipta Kerja | RNN - LSTM & Aspect-Based Sentiment Analysis (ABSA) | 75.000 komentar online | 51% negatif, 29% netral, 20% positif (isu buruh 79% negatif, lingkungan 67% negatif, investasi 48% positif) |
| **Referensi 2** | Muhamad Fazri & Apriade Voutama (2025) | Danantara di Media Sosial X | Semi-supervised K-Means + TF-IDF + SVM vs BERT | 2.009 tweet bahasa Indonesia | Sentimen 87.0% negatif, 9.4% positif, 3.6% netral; akurasi **SVM 98%** vs BERT 25% |
| **Referensi 3** | Rizal Abror Munir & Apriade Voutama | Program Makan Bergizi Gratis (MBG) di X | K-Means Clustering + SVM vs BERT | 1.500 tweet (`tweet-harvest`) | Mayoritas sentimen negatif; akurasi **SVM 92%** mengungguli BERT pada data tidak seimbang |
| **Referensi 4** | Vina Agustina & Asti Herliana (2025) | Kebijakan Efisiensi Anggaran 2025 (Inpres No. 1/2025 Rp 306,69 T) | Text Mining, TF-IDF + Naive Bayes | 1.614 tweet Twitter/X | Mayoritas sentimen negatif **74.53%** dengan akurasi model **Naive Bayes 93.01%** |
| **Referensi 5** | Sahrial Ihsani Ishak dkk. (2025) | Pemerintahan Prabowo–Gibran di Portal Berita | IndoBERT (klasifikasi sentimen) + LDA (Topic Modeling) | 195 artikel berita (Antara & Detik) | Mayoritas pemberitaan ekonomi & kebijakan publik bernada kritis/negatif |
| **Penelitian Ini** | **Hudzaifah Ar-Rantisi** | **Kebijakan Prabowo & Makan Bergizi Gratis (MBG)** | **TF-IDF Character N-Grams + SGD Logistic Regression** | **481 komentar (247 Prabowo, 234 MBG)** | **Akurasi 86.27% (5-Fold CV 86.63% ± 2.49%), Sentimen 82.74% negatif & 17.26% positif** |
