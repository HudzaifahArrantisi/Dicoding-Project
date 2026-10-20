-- Keep one current allocation per partner and product for model upserts.
WITH ranked_recommendations AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY partner_id, product_id
    ORDER BY generated_at DESC, id DESC
  ) AS row_number
  FROM restock_recommendations
)
DELETE FROM restock_recommendations
WHERE id IN (SELECT id FROM ranked_recommendations WHERE row_number > 1);

CREATE UNIQUE INDEX IF NOT EXISTS restock_recommendations_partner_product_uidx
  ON restock_recommendations (partner_id, product_id);

-- AI jobs publish admin stock alerts using the existing low_stock notification type.
GRANT SELECT, INSERT, UPDATE ON restock_recommendations TO ai_job;
GRANT SELECT, INSERT ON stock_logs, partner_stocks, partners, products TO ai_job;

CREATE POLICY ai_manage_restock_recommendations
  ON restock_recommendations
  FOR ALL
  TO ai_job
  USING (true)
  WITH CHECK (true);
