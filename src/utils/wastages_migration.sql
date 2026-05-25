-- ============================================================
-- WASTAGES TABLE MIGRATION
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.wastages (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
  order_id       TEXT        REFERENCES public.orders(id) ON DELETE SET NULL,
  material_name  TEXT        NOT NULL,
  quantity_kg    NUMERIC(12, 3) NOT NULL CHECK (quantity_kg > 0),
  price_per_kg   NUMERIC(12, 2) NOT NULL CHECK (price_per_kg > 0),
  total_cost     NUMERIC(14, 2) GENERATED ALWAYS AS (quantity_kg * price_per_kg) STORED,
  notes          TEXT,
  recorded_by    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS wastages_recorded_date_idx ON public.wastages (recorded_date);
CREATE INDEX IF NOT EXISTS wastages_order_id_idx     ON public.wastages (order_id);

-- Row Level Security
ALTER TABLE public.wastages ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view wastages
CREATE POLICY "wastages_select_policy"
  ON public.wastages FOR SELECT
  TO authenticated
  USING (true);

-- Allow Production, Admin, CEO to insert
CREATE POLICY "wastages_insert_policy"
  ON public.wastages FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow Admin and CEO to delete
CREATE POLICY "wastages_delete_policy"
  ON public.wastages FOR DELETE
  TO authenticated
  USING (true);

-- Enable Realtime for the wastages table
-- (Run in Supabase Dashboard → Database → Replication → Tables → enable for "wastages")
-- Or via SQL:
ALTER PUBLICATION supabase_realtime ADD TABLE public.wastages;
