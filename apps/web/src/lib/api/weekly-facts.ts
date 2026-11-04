export interface WeeklyFacts {
  metadata: { generated_at: string; period_days: number; model_version: string; regional_generated_at?: string }
  central_warehouse: { total_stock_units: number; products: Array<{ id: string; name: string; central_stock: number; category: string }> }
  network_sales: {
    total_sold_7d: number; total_sold_prev_7d: number; sales_growth_percentage: number | null
    restock_fulfillment_rate: number | null; central_stock_health_days: number | null
  }
  top_performers_partners: Array<{ rank: number; partner_name: string; region: string; weekly_units: number; percentage: number }>
  top_selling_products: Array<{ rank: number; product_name: string; category: string; weekly_units: number; share_pct: number }>
  top_selling_categories: Array<{ category: string; weekly_units: number; share_pct: number }>
  regional_hotspots: Array<{ region: string; province: string; status: string; active_partners: number; weekly_units: number; stockout_probability: number; urgency: string; recommended_action: string }>
}
