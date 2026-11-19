#!/usr/bin/env bash
# Pipeline training Daisuki untuk Hugging Face Jobs.
#
# Menjalankan tujuh job Python yang sama seperti yang dulu dipanggil
# apps/api/src/lib/analysis-runs.ts lewat Bun.spawn, lalu mengunggah
# daisuki.pkl hasil training ke repo model.
#
# Wajib diisi:
#   DAISUKI_ANALYSIS_RUN_ID  UUID run dari tabel analysis_runs
#   DATABASE_URL             kredensial Neon (pakai role ai_job, bukan owner)
# Opsional:
#   HF_MODEL_REPO            misal username/daisuki-model, untuk unggah hasil
#   HF_TOKEN                 token tulis ke repo model

set -euo pipefail

if [[ -z "${DAISUKI_ANALYSIS_RUN_ID:-}" ]]; then
  echo "GAGAL: DAISUKI_ANALYSIS_RUN_ID belum diisi." >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "GAGAL: DATABASE_URL belum diisi." >&2
  exit 1
fi

STAGE="ai/data/private/runs/${DAISUKI_ANALYSIS_RUN_ID}"
STEP=0

run_step() {
  STEP=$((STEP + 1))
  echo ""
  echo "── Langkah ${STEP}/7: $1"
  python "$2"
}

run_step "Risiko Naive Bayes"        ai/jobs/regional_stockout_naive_bayes.py
run_step "Evaluasi historis model"   ai/jobs/evaluate_stockout.py
run_step "Pratinjau alokasi"         ai/jobs/smart_allocation.py
run_step "Fakta dashboard dan RAG"   ai/jobs/weekly_facts_aggregator.py

# train.py di mode produksi dipicu oleh DAISUKI_ANALYSIS_RUN_ID, bukan oleh flag.
# Semua argumen manualnya ditolak saat env ini terisi.
run_step "Training daisuki.pkl"      ai/retraining/train.py

run_step "Grafik konsumsi"           ai/retraining/chart_data.py
run_step "Validasi hasil"            ai/jobs/validate_stage.py

MODEL_PATH="${STAGE}/daisuki.pkl"
if [[ ! -f "${MODEL_PATH}" ]]; then
  echo "" >&2
  echo "GAGAL: ${MODEL_PATH} tidak terbentuk. Pipeline selesai tanpa model." >&2
  exit 1
fi

MODEL_SIZE=$(du -h "${MODEL_PATH}" | cut -f1)
echo ""
echo "── Model terbentuk: ${MODEL_PATH} (${MODEL_SIZE})"

if [[ -z "${HF_MODEL_REPO:-}" ]]; then
  echo "HF_MODEL_REPO kosong: model TIDAK diunggah. Penyimpanan job bersifat sementara,"
  echo "jadi hasil ini akan hilang. Isi HF_MODEL_REPO agar tersimpan permanen."
  exit 0
fi

echo "── Mengunggah model ke ${HF_MODEL_REPO}"
python - <<'PY'
import os
from huggingface_hub import HfApi

repo = os.environ["HF_MODEL_REPO"]
token = os.environ.get("HF_TOKEN") or None
run_id = os.environ["DAISUKI_ANALYSIS_RUN_ID"]
model_file = f"ai/data/private/runs/{run_id}/daisuki.pkl"

api = HfApi(token=token)
api.create_repo(repo_id=repo, repo_type="model", private=True, exist_ok=True)
api.upload_file(
    path_or_fileobj=model_file,
    path_in_repo="daisuki.pkl",
    repo_id=repo,
    repo_type="model",
    commit_message=f"Model dari run {run_id}",
)
api.upload_file(
    path_or_fileobj=model_file,
    path_in_repo=f"versions/{run_id}/daisuki.pkl",
    repo_id=repo,
    repo_type="model",
    commit_message=f"Arsip versi run {run_id}",
)
print(f"Terunggah ke {repo}: daisuki.pkl dan versions/{run_id}/daisuki.pkl")
PY

echo ""
echo "Selesai. Panggil POST /reload pada Space agar model baru dipakai."
