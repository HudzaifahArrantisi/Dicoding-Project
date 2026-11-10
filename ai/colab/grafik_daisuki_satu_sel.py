"""Paste this whole file into one Google Colab cell, then upload both JSON files."""

import json

import matplotlib.pyplot as plt


def draw_bar(ax, labels, values, title, xlabel, color="#334155"):
    if not labels:
        ax.text(0.5, 0.5, "Belum ada data", ha="center", va="center", transform=ax.transAxes)
        ax.set_title(title)
        ax.set_axis_off()
        return
    order = sorted(range(len(labels)), key=lambda index: values[index])
    ax.barh([labels[index] for index in order], [values[index] for index in order], color=color)
    ax.set_title(title)
    ax.set_xlabel(xlabel)
    ax.grid(axis="x", alpha=0.2)
    ax.set_axisbelow(True)


def build_charts(facts, regional):
    products = facts["central_warehouse"]["products"]
    best_products = facts["top_selling_products"]
    best_partners = facts["top_performers_partners"]
    most_logs = facts.get("top_log_partners", [])
    regions = facts["regional_hotspots"]
    risk_regions = regional["regional_rankings"]

    fig, axes = plt.subplots(3, 2, figsize=(16, 16))
    draw_bar(axes[0, 0], [row["name"] for row in products],
             [row["central_stock"] for row in products], "Stok gudang pusat per produk", "Stok (pcs)")
    draw_bar(axes[0, 1], [row["product_name"] for row in best_products],
             [row["weekly_units"] for row in best_products], "Produk paling laku, 7 hari", "Konsumsi tercatat (pcs)")
    draw_bar(axes[1, 0], [row["partner_name"] for row in best_partners],
             [row["weekly_units"] for row in best_partners], "Mitra dengan konsumsi terbesar", "Konsumsi tercatat (pcs)")
    draw_bar(axes[1, 1], [row["partner_name"] for row in most_logs],
             [row["log_count"] for row in most_logs], "Mitra paling banyak log stok", "Jumlah log, 7 hari")
    draw_bar(axes[2, 0], [row["region"] for row in regions],
             [row["weekly_units"] for row in regions], "Aktivitas konsumsi per wilayah", "Konsumsi tercatat (pcs)")

    risk_color = {"ZONA_MERAH": "#b91c1c", "ZONA_KUNING": "#a16207", "ZONA_HIJAU": "#15803d"}
    if risk_regions:
        ordered = sorted(risk_regions, key=lambda row: row["peak_stockout_probability"])
        axes[2, 1].barh(
            [row["regency_name"] for row in ordered],
            [row["peak_stockout_probability"] for row in ordered],
            color=[risk_color.get(row["regional_zone"], "#64748b") for row in ordered],
        )
        axes[2, 1].set_xlabel("Probabilitas risiko puncak (%)")
        axes[2, 1].grid(axis="x", alpha=0.2)
        axes[2, 1].set_axisbelow(True)
    else:
        axes[2, 1].text(0.5, 0.5, "Belum ada data", ha="center", va="center", transform=axes[2, 1].transAxes)
        axes[2, 1].set_axis_off()
    axes[2, 1].set_title("Risiko kehabisan stok per wilayah")

    fig.suptitle("Analisis operasional Daisuki", fontsize=18, fontweight="bold")
    fig.tight_layout()
    return fig


if __name__ == "__main__":
    from google.colab import files

    print("Unggah dua berkas dari data/mainbrain/context_embeddings: weekly_operational_facts.json dan regional_stockout_insights.json")
    uploaded = files.upload()
    names = ("weekly_operational_facts.json", "regional_stockout_insights.json")
    missing = [name for name in names if name not in uploaded]
    if missing:
        raise ValueError("Berkas belum diunggah: " + ", ".join(missing))

    facts = json.loads(uploaded[names[0]].decode("utf-8"))
    regional = json.loads(uploaded[names[1]].decode("utf-8"))
    print("Snapshot dibuat:", facts["metadata"]["generated_at"])
    print("Stok pusat:", facts["central_warehouse"]["total_stock_units"], "pcs")
    print("Konsumsi jaringan 7 hari:", facts["network_sales"]["total_sold_7d"], "pcs")
    if facts.get("top_log_partners"):
        leader = facts["top_log_partners"][0]
        print("Mitra paling banyak log:", leader["partner_name"], "-", leader["log_count"], "log")
    build_charts(facts, regional)
    plt.show()
