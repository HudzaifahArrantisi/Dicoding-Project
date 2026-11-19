# Brain Knowledge: Referensi 3 — Analisis Sentimen Cuitan di Media Sosial X Tentang Program Makan Bergizi Gratis dengan Metode NLP
> **Sumber Dokumen**: `refrensi 3.pdf`
> **Jurnal**: JITET (Jurnal Informatika dan Teknik Elektro Terapan), Vol. 13, No. 3, Juli 2025
> **Penulis**: Rizal Abror Munir & Apriade Voutama (Universitas Singaperbangsa Karawang / UNSIKA)
> **Tipe Dokumen**: Artikel Jurnal Referensi NLP

---

## Ringkasan Penelitian & Metodologi (Referensi 3)

**Judul**: Analisis Sentimen Cuitan di Media Sosial X Tentang Program Makan Bergizi Gratis dengan Metode NLP.
**Objek Kebijakan**: Program **Makan Bergizi Gratis (MBG)**.
**Dataset**: **1.500 tweet** dari media sosial X yang dikumpulkan menggunakan perangkat `tweet-harvest`.
**Metode NLP & Model**:
- Tahapan preprocessing teks, ekstraksi fitur **TF-IDF**, dan pengelompokan **K-Means Clustering** (3 klaster).
- Evaluasi perbandingan klasifikasi antara **Support Vector Machine (SVM)** dan **BERT**.

## Tabel Hasil Evaluasi Sentimen Program Makan Bergizi Gratis di X (Referensi 3)

| Metrik / Komponen Penelitian | Hasil Temuan | Keterangan |
| :--- | :--- | :--- |
| **Total Data Cuitan (X / Twitter)** | **1.500 tweet** | Dikumpulkan melalui `tweet-harvest` dengan kata kunci Makan Bergizi Gratis |
| **Kecenderungan Sentimen Mayoritas** | **Dominan Negatif** | Sorotan masyarakat terhadap kesiapan anggaran, distribusi logistik, dan kualitas menu |
| **Akurasi Model SVM** | **92.0%** | Unggul dan stabil dalam mengklasifikasikan teks pendek media sosial |
| **Perbandingan dengan BERT** | **SVM Lebih Unggul** | SVM + TF-IDF lebih tangguh dibanding BERT pada ukuran sampel menengah dengan kelas timpang |
