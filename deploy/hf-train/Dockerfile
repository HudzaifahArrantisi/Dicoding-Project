FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/ai \
    DAISUKI_ANALYSIS_RUN_ID=""

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Layout harus mengikuti struktur repo: run_context.py memakai parents[2] dan
# csv_handoff.py memakai parents[1] untuk menemukan folder data.
COPY ai/ ./ai/
COPY data-science/ ./data-science/
COPY run-pipeline.sh .

RUN chmod +x run-pipeline.sh

CMD ["./run-pipeline.sh"]
