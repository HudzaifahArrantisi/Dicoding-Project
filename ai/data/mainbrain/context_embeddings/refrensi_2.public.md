# Brain Knowledge: Referensi 2 — Analisis Sentimen Publik Terhadap Danantara di Media Sosial X Menggunakan NLP dan Pembelajaran Mesin
> **Sumber Dokumen**: `refrensi 2.pdf`
> **Jurnal**: JOISIE (Journal Of Information System And Informatics Engineering), Vol. 9, No. 1, Juni 2025
> **Penulis**: Muhamad Fazri & Apriade Voutama (Universitas Singaperbangsa Karawang / UNSIKA)
> **Tipe Dokumen**: Artikel Jurnal Referensi NLP

---

## Ringkasan Penelitian & Metodologi (Referensi 2)

**Judul**: Analisis Sentimen Publik Terhadap Danantara di Media Sosial X Menggunakan NLP dan Pembelajaran Mesin.
**Objek Kebijakan**: Pembentukan Badan Pengelola Investasi **Daya Anagata Nusantara (Danantara)**.
**Dataset**: **2.009 tweet** bahasa Indonesia dari platform X (Twitter).
**Metode NLP & Model**:
- Pelabelan semi-supervised menggunakan **K-Means Clustering** dan ekstraksi fitur **TF-IDF**.
- Perbandingan algoritma klasifikasi **Support Vector Machine (SVM)** dengan model deep learning **BERT**.

## Tabel Hasil Distribusi Sentimen & Performa Model Danantara (Referensi 2)

| Indikator Evaluasi | Nilai / Persentase | Keterangan |
| :--- | :--- | :--- |
| **Sentimen Negatif** | **87.0%** | Dominasi kekhawatiran publik terhadap tata kelola dan transparansi dana investasi |
| **Sentimen Positif** | **9.4%** | Dukungan terhadap potensi akselerasi investasi nasional |
| **Sentimen Netral** | **3.6%** | Unggahan informatif atau berita tanpa kecenderungan opini |
| **Akurasi Model SVM + TF-IDF** | **98.0%** | Performa sangat tinggi pada dataset tidak seimbang (imbalanced data) |
| **Akurasi Model BERT** | **25.0%** | Mengalami penurunan akurasi akibat ketimpangan distribusi kelas ekstrem tanpa augmentasi |
