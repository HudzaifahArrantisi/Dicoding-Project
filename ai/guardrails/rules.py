"""
Aturan Domain & Batasan Operasional Inventaris Daisuki B2B.
Source of Truth: CLAUDE.md & packages/shared/src/index.ts
"""

OFFICIAL_PRODUCTS = [
    "Seblak Jadul Instan",
    "Basreng Daun Jeruk",
    "Makaroni Daun Jeruk",
    "Keripik Pisang Rasa Coklat",
]

ALLOWED_ORDER_STATUSES = [
    "diproses",
    "disetujui",
    "dalam_pengiriman",
    "selesai",
    "ditolak",
    "dibatalkan",
]

# Ambang batas status stok relatif terhadap buffer minimal (par_level)
# > 50% = aman, > 20% to 50% = waspada, <= 20% = kritis
STOCK_THRESHOLDS = {
    "AMAN_MIN_RATIO": 0.5,
    "WASPADA_MIN_RATIO": 0.2,
}

FORBIDDEN_TERMS_REPRESENTING_CEILING = [
    "kapasitas rak",
    "kapasitas maksimal",
    "maksimal stok",
    "max stock",
    "plafon stok",
    "/40",
    "sisa stok / par",
]

MUTATION_CLAIM_VERBS = [
    "sudah mengubah",
    "telah mengubah",
    "sudah menambah",
    "telah menambah",
    "sudah membuat",
    "telah membuat",
    "sudah mengajukan",
    "telah mengajukan",
    "sudah menyetujui",
    "telah menyetujui",
    "sudah membatalkan",
    "telah membatalkan",
]


def calculate_stock_status(current_qty: int, par_level: int) -> str:
    """Menghitung status stok sesuai aturan resmi shared package."""
    if par_level <= 0:
        return "aman"
    ratio = current_qty / par_level
    if ratio > STOCK_THRESHOLDS["AMAN_MIN_RATIO"]:
        return "aman"
    if ratio > STOCK_THRESHOLDS["WASPADA_MIN_RATIO"]:
        return "waspada"
    return "kritis"
