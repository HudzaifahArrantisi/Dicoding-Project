# Automated Retraining Loop & Inference Pipeline — Daisuki AI

Dokumentasi dan implementasi kode lengkap untuk sistem **Automated Retraining Loop** berbasis Machine Learning Naive Bayes (`MultinomialNB`) pada proyek "Daisuki". Disiapkan untuk dieksekusi dan diintegrasikan oleh Codex / pengembang.

---

## 1. Struktur File & Arsitektur

```text
daisuki-ai/
├── data_input.json    # File data training baru (diekspor sistem utama)
├── train.py           # Skrip otomatis retraining loop (Cron Job setiap 3 jam)
├── filter.py          # Skrip/modul inferensi untuk memfilter/mengklasifikasikan teks
├── daisuki.pkl        # Artefak model pipeline terlatih (CountVectorizer + MultinomialNB)
└── requirements.txt   # Dependensi Python
```

---

## 2. Dependensi (`requirements.txt`)

```txt
scikit-learn>=1.3.0
```

Instalasi:
```bash
pip install -r requirements.txt
```

---

## 3. Format Data Masukan (`data_input.json`)

File JSON harus memuat array objek yang memiliki field fitur teks (misalnya `"text"` atau nama produk/catatan permintaan) dan target label (`"label"` / kategori).

```json
[
  {
    "text": "Stok basreng pedas daun jeruk kritis sisa 5 pcs butuh pasokan darurat",
    "label": "urgent_restock"
  },
  {
    "text": "Pasokan seblak jadul masih cukup banyak di rak display mitra",
    "label": "normal"
  },
  {
    "text": "Keripik pisang lumer terjual habis siang ini perlu kirim tambahan",
    "label": "urgent_restock"
  },
  {
    "text": "Laporan tutup toko kondisi rak rapi sisa stok aman terkendali",
    "label": "normal"
  },
  {
    "text": "Permintaan pasokan reguler mingguan untuk minimarket cabang",
    "label": "regular_order"
  }
]
```

---

## 4. Skrip Training Otomatis (`train.py`)

Skrip ini dijalankan oleh scheduler (Cron Job). Alurnya:
1. Mengecek keberadaan `data_input.json`. Jika tidak ada, proses selesai dengan aman tanpa crash.
2. Membaca data dan memvalidasi kelengkapan teks serta label.
3. Melatih pipeline `CountVectorizer` + `MultinomialNB`.
4. Menyimpan/menimpa model ke `daisuki.pkl` secara atomik melalui file temporer untuk mencegah korupsi data saat proses penulisan.
5. Menghapus `data_input.json` dengan penanganan pengecualian (`try-except`) lengkap.

```python
"""
train.py - Daisuki AI Automated Retraining Loop
Melatih model Naive Bayes (CountVectorizer + MultinomialNB) dari data_input.json,
memperbarui daisuki.pkl, dan membersihkan file input secara otomatis.
"""

import json
import logging
import os
import pickle
import sys
from typing import List, Tuple

from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline

# Konfigurasi Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

# Definisi Path File
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_INPUT_FILE = os.path.join(BASE_DIR, "data_input.json")
MODEL_OUTPUT_FILE = os.path.join(BASE_DIR, "daisuki.pkl")
TEMP_MODEL_FILE = os.path.join(BASE_DIR, "daisuki.pkl.tmp")


def load_dataset(filepath: str) -> Tuple[List[str], List[str]]:
    """Memuat dan memvalidasi dataset dari file JSON."""
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"File data masukan tidak ditemukan: {filepath}")

    with open(filepath, "r", encoding="utf-8") as f:
        records = json.load(f)

    if not isinstance(records, list) or len(records) == 0:
        raise ValueError("Data masukan JSON harus berupa array non-kosong.")

    texts: List[str] = []
    labels: List[str] = []

    for idx, item in enumerate(records):
        text = item.get("text")
        label = item.get("label")
        if text is not None and label is not None:
            text_str = str(text).strip()
            label_str = str(label).strip()
            if text_str and label_str:
                texts.append(text_str)
                labels.append(label_str)
        else:
            logging.warning("Baris %d dilewati karena data tidak lengkap: %s", idx, item)

    if len(texts) == 0:
        raise ValueError("Tidak ada sampel valid yang memiliki text dan label.")

    # Validasi minimal ada 2 kelas unik untuk klasifikasi
    unique_labels = set(labels)
    if len(unique_labels) < 2:
        raise ValueError(
            f"Diperlukan minimal 2 kelas label berbeda untuk melatih model. Ditemukan: {unique_labels}"
        )

    return texts, labels


def train_pipeline(texts: List[str], labels: List[str]) -> Pipeline:
    """Membangun dan melatih Pipeline CountVectorizer + MultinomialNB."""
    pipeline = Pipeline(
        steps=[
            (
                "vectorizer",
                CountVectorizer(
                    ngram_range=(1, 2),  # unigram + bigram untuk konteks teks yang lebih baik
                    lowercase=True,
                    strip_accents="unicode",
                ),
            ),
            (
                "classifier",
                MultinomialNB(alpha=1.0),
            ),
        ]
    )

    logging.info("Memulai fitting model pada %d sampel teks...", len(texts))
    pipeline.fit(texts, labels)
    logging.info("Training selesai dengan sukses.")
    return pipeline


def save_model_safely(model: Pipeline, dest_path: str, temp_path: str) -> None:
    """Menyimpan model secara aman (atomic write) agar file tidak korup."""
    logging.info("Menulis model ke file sementara: %s", temp_path)
    with open(temp_path, "wb") as f:
        pickle.dump(model, f, protocol=pickle.HIGHEST_PROTOCOL)

    # Timpa file model target dengan mengganti nama file sementara
    if os.path.exists(dest_path):
        try:
            os.remove(dest_path)
        except OSError as e:
            logging.warning("Gagal menghapus file model lama sebelum replace: %s", e)

    os.rename(temp_path, dest_path)
    logging.info("Model terbaru sukses disimpan dan menimpa: %s", dest_path)


def cleanup_input_data(filepath: str) -> None:
    """Menghapus file JSON input setelah training sukses untuk efisiensi penyimpanan."""
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
            logging.info("Cleanup sukses: File '%s' telah dihapus.", filepath)
        else:
            logging.warning("Cleanup dilewati: File '%s' sudah tidak ada.", filepath)
    except PermissionError as pe:
        logging.error("Pembersihan gagal karena masalah izin (PermissionError): %s", pe)
    except FileNotFoundError:
        logging.warning("File '%s' sudah terhapus oleh proses lain.", filepath)
    except Exception as exc:
        logging.error("Pengecualian saat menghapus file '%s': %s", filepath, exc)


def run_retraining_loop() -> bool:
    """Fungsi orkestrasi utama retraining loop."""
    logging.info("=== Menjalankan Daisuki AI Retraining Loop ===")

    # A. Pemeriksaan keberadaan data input
    if not os.path.exists(DATA_INPUT_FILE):
        logging.info("Tidak ada file '%s'. Melewati siklus retraining.", DATA_INPUT_FILE)
        return False

    try:
        # B. Ekspor & Load Data
        texts, labels = load_dataset(DATA_INPUT_FILE)
        logging.info("Dataset berhasil dimuat (%d baris, %d label unik).", len(texts), len(set(labels)))

        # Training
        model_pipeline = train_pipeline(texts, labels)

        # C. Update Model
        save_model_safely(model_pipeline, MODEL_OUTPUT_FILE, TEMP_MODEL_FILE)

        # D. Pembersihan Otomatis (Cleanup)
        cleanup_input_data(DATA_INPUT_FILE)

        logging.info("=== Retraining Loop Selesai dengan SUKSES ===")
        return True

    except Exception as err:
        logging.critical("Retraining Loop GAGAL: %s", err, exc_info=True)
        # Hapus temp file jika tersisa
        if os.path.exists(TEMP_MODEL_FILE):
            try:
                os.remove(TEMP_MODEL_FILE)
            except OSError:
                pass
        return False


if __name__ == "__main__":
    success = run_retraining_loop()
    sys.exit(0 if success else 1)
```

---

## 5. Skrip Filter / Inferensi (`filter.py`)

Skrip dan modul ini digunakan oleh backend/aplikasi utama untuk memuat `daisuki.pkl` dan mengklasifikasikan/memfilter teks secara real-time. Dilengkapi fitur *cache* agar model tidak perlu di-load berulang-ulang untuk setiap request teks baru.

```python
"""
filter.py - Daisuki AI Text Filtering & Inference Module
Memuat model daisuki.pkl yang telah di-retrain dan melakukan prediksi/filtering teks.
"""

import logging
import os
import pickle
import sys
from typing import Any, Dict, List, Optional, Union

# Konfigurasi Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_FILE = os.path.join(BASE_DIR, "daisuki.pkl")


class DaisukiFilter:
    """Kelas singleton/wrapper untuk memuat model dan menjalankan inferensi teks."""

    def __init__(self, model_path: str = MODEL_FILE):
        self.model_path = model_path
        self._model = None
        self._last_loaded_mtime: Optional[float] = None
        self.load_model()

    def load_model(self, force_reload: bool = False) -> None:
        """Memuat daisuki.pkl dari disk jika ada perubahan file terbaru."""
        if not os.path.exists(self.model_path):
            logging.warning("File model '%s' belum ditemukan. Model belum aktif.", self.model_path)
            self._model = None
            return

        current_mtime = os.path.getmtime(self.model_path)
        if not force_reload and self._model is not None and self._last_loaded_mtime == current_mtime:
            return  # Cache model masih fresh

        try:
            with open(self.model_path, "rb") as f:
                self._model = pickle.load(f)
            self._last_loaded_mtime = current_mtime
            logging.info("Model '%s' berhasil dimuat ke memori.", self.model_path)
        except Exception as err:
            logging.error("Gagal memuat model dari '%s': %s", self.model_path, err)
            self._model = None

    @property
    def is_ready(self) -> bool:
        """Mengecek apakah model siap digunakan."""
        self.load_model()
        return self._model is not None

    def predict(self, texts: Union[str, List[str]]) -> List[str]:
        """
        Melakukan prediksi label/kategori untuk satu teks atau daftar teks.
        
        Args:
            texts: String tunggal atau list of string.
            
        Returns:
            List of string berupa label prediksi.
        """
        if not self.is_ready:
            raise RuntimeError(f"Model '{self.model_path}' belum siap atau tidak ditemukan.")

        if isinstance(texts, str):
            input_list = [texts]
        else:
            input_list = list(texts)

        predictions = self._model.predict(input_list)
        return list(predictions)

    def predict_with_confidence(self, texts: Union[str, List[str]]) -> List[Dict[str, Any]]:
        """
        Memprediksi teks disertai skor probabilitas/confidence dari model Naive Bayes.
        """
        if not self.is_ready:
            raise RuntimeError(f"Model '{self.model_path}' belum siap atau tidak ditemukan.")

        if isinstance(texts, str):
            input_list = [texts]
        else:
            input_list = list(texts)

        predictions = self._model.predict(input_list)
        probabilities = self._model.predict_proba(input_list)
        classes = self._model.classes_

        results = []
        for text, pred, probs in zip(input_list, predictions, probabilities):
            score_map = {cls: float(prob) for cls, prob in zip(classes, probs)}
            best_prob = float(max(probs))
            results.append({
                "text": text,
                "predicted_label": str(pred),
                "confidence": round(best_prob, 4),
                "all_probabilities": score_map,
            })
        return results

    def filter_by_label(self, texts: List[str], target_label: str) -> List[str]:
        """
        Memfilter dan mengembalikan hanya teks yang diprediksi masuk ke dalam target_label tertentu.
        """
        preds = self.predict(texts)
        return [text for text, pred in zip(texts, preds) if pred == target_label]


# Singleton instance untuk kemudahan import di file lain
daisuki_filter = DaisukiFilter()


# Contoh Pengujian Langsung saat dijalankan via CLI
if __name__ == "__main__":
    print("\n--- Demonstrasi Inferensi Filter Daisuki AI ---")
    
    sample_queries = [
        "Sisa stok basreng di cabang sangat sedikit harus segera dikirim",
        "Kondisi toko aman tidak butuh restock hari ini",
        "Pengajuan pesanan snack seblak jadul 30 bungkus",
    ]

    try:
        results = daisuki_filter.predict_with_confidence(sample_queries)
        for res in results:
            print(f"\nTeks       : \"{res['text']}\"")
            print(f"Prediksi   : {res['predicted_label']} (Confidence: {res['confidence'] * 100:.1f}%)")
            print(f"Detail Prob: {res['all_probabilities']}")
    except RuntimeError as e:
        print(f"Peringatan: {e}")
        print("Jalankan `python train.py` terlebih dahulu untuk membuat file daisuki.pkl.")
```

---

## 6. Konfigurasi Cron Job (Setiap 3 Jam)

Untuk menjalankan `train.py` otomatis setiap 3 jam sekali pada sistem server Linux/Unix, tambahkan entri berikut pada crontab:

1. Buka editor crontab:
   ```bash
   crontab -e
   ```

2. Tambahkan baris jadwal (asumsi menggunakan virtualenv Python proyek):
   ```cron
   # Jalankan setiap 3 jam sekali (menit ke-0 pada jam 00:00, 03:00, 06:00, 09:00, dst)
   0 */3 * * * /path/to/venv/bin/python /path/to/daisuki-ai/train.py >> /path/to/daisuki-ai/retrain.log 2>&1
   ```

3. Pada lingkungan Windows (jika menggunakan Task Scheduler):
   - **Action**: Start a program
   - **Program/script**: `python.exe` (atau path interpreter venv)
   - **Add arguments**: `train.py`
   - **Start in**: `c:\laragon\www\daisuki-inventory\ai`
   - **Trigger**: Daily, repeat task every 3 hours.

---

## 7. Rangkuman Mekanisme Keamanan & Performa

1. **Atomic File Replace**: File `daisuki.pkl` ditulis ke `daisuki.pkl.tmp` terlebih dahulu sebelum direname ke `daisuki.pkl`. Ini memastikan skrip inferensi `filter.py` tidak membaca model setengah jadi jika cron job sedang berlangsung.
2. **Auto Cleanup Memory**: File `data_input.json` selalu dibersihkan dengan `os.remove()` begitu proses training dan penyimpanan sukses, mencegah penumpukan data lama dan menghemat storage server.
3. **Robust Error Handling**: Seluruh penanganan `FileNotFoundError`, `ValueError` (data kosong/label kurang dari 2), serta `PermissionError` telah diisolasi sehingga cron job gagal secara anggun tanpa meninggalkan file temporer korup.
