-- ========================================================
-- COMPLETE SUPABASE SCHEMA & MIGRATION FOR AGRICULTURAL SYSTEM
-- Run this script in your Supabase SQL Editor:
-- Supabase Dashboard -> "SQL Editor" -> "New query" -> Paste & Run
-- ========================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CLEAN UP UNRELATED & OBSOLETE SCHEMAS
-- Safely drop old dealer_sales and dealer_registers whether they are tables or views
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT c.relname, c.relkind 
    FROM pg_class c 
    JOIN pg_namespace n ON n.oid = c.relnamespace 
    WHERE n.nspname = 'public' AND c.relname IN ('dealer_sales', 'dealer_registers')
  ) LOOP
    IF r.relkind = 'v' THEN
      EXECUTE 'DROP VIEW public.' || quote_ident(r.relname) || ' CASCADE';
    ELSIF r.relkind = 'r' THEN
      EXECUTE 'DROP TABLE public.' || quote_ident(r.relname) || ' CASCADE';
    END IF;
  END LOOP;
END $$;

-- 2. DEALERS TABLE (Form 4 & Authentication)
CREATE TABLE IF NOT EXISTS public.dealers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_number TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL, -- Stored password for dealer direct login
  dealer_name TEXT NOT NULL,
  market_name TEXT NOT NULL,
  union_name TEXT NOT NULL,
  upazila TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Prune unrequired columns if table already existed
ALTER TABLE public.dealers DROP COLUMN IF EXISTS status;
ALTER TABLE public.dealers DROP COLUMN IF EXISTS updated_at;

-- 3. FARMERS INFO TABLE (Form 1)
CREATE TABLE IF NOT EXISTS public.farmers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE SET NULL,
  farmer_name TEXT NOT NULL,
  -- Address
  village TEXT NOT NULL,
  block TEXT NOT NULL, -- '1', '2', or '3'
  ward TEXT NOT NULL,
  union_name TEXT NOT NULL,
  upazila TEXT NOT NULL,
  -- Identification (Unique)
  nid TEXT NOT NULL UNIQUE,
  mobile TEXT NOT NULL UNIQUE,
  -- Land Info
  land_area NUMERIC NOT NULL, -- in Decimal
  land_type TEXT NOT NULL, -- 'Khotian vukto', 'Borga', 'PF land'
  -- Conditional: Khotian vukto
  khotian_no TEXT,
  -- Conditional: Borga
  borga_owner_name TEXT,
  borga_owner_mobile TEXT,
  borga_owner_nid TEXT,
  borga_type TEXT, -- 'Regular', 'irregular'
  -- Conditional: PF land
  pf_owner_name TEXT,
  pf_owner_mobile TEXT,
  pf_owner_nid TEXT,
  -- Crop produced
  crop_type TEXT NOT NULL, -- 'Paddy (Aus)', 'Paddy (Aman)', 'Paddy (Boro)', 'Vegetable', 'Others'
  crop_other_details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. UNIFIED TRANSACTIONS TABLE
-- Records Opening Stock, Received Stock, and Issued Stock (sales to farmers & distributions)
-- Stock register calculation: Closing Stock = Opening Stock + Received - Issued
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE CASCADE NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  fertilizer_name TEXT NOT NULL, -- 'Urea', 'TSP', 'MoP', 'DAP'
  transaction_type TEXT NOT NULL, -- 'OPENING', 'RECEIVED', 'ISSUED'
  reference_no TEXT, -- e.g. 'Opening Balance', Challan No, Voucher No, Memo No
  customer_id UUID REFERENCES public.farmers(id) ON DELETE SET NULL, -- Customer / Farmer reference
  received_qty NUMERIC NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
  issued_qty NUMERIC NOT NULL DEFAULT 0 CHECK (issued_qty >= 0),
  remarks TEXT, -- e.g. 'Initial stock balance'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure customer_id exists
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.farmers(id) ON DELETE SET NULL;

-- Safely drop dependent view first before dropping columns
DROP VIEW IF EXISTS public."Transaction" CASCADE;

-- Delete unrequired / redundant columns from transactions
ALTER TABLE public.transactions DROP COLUMN IF EXISTS contributor;
ALTER TABLE public.transactions DROP COLUMN IF EXISTS customer;
ALTER TABLE public.transactions DROP COLUMN IF EXISTS register_serial_no;
ALTER TABLE public.transactions DROP COLUMN IF EXISTS quantity_kg;

-- Re-create alias view for 'Transaction'
CREATE OR REPLACE VIEW public."Transaction" AS SELECT * FROM public.transactions;

-- 5. CONTRIBUTORS TABLE (Add Contributor - Admin Managed)
CREATE TABLE IF NOT EXISTS public.contributors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  mobile TEXT,
  designation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Prune unrequired columns from contributors
ALTER TABLE public.contributors DROP COLUMN IF EXISTS status;
ALTER TABLE public.contributors DROP COLUMN IF EXISTS updated_at;

-- 6. RAW FARMER LIST (Reference Table for Auto-fill in Add Farmer)
CREATE TABLE IF NOT EXISTS public."Raw-farmer-list" (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  farmer_name TEXT NOT NULL,
  village TEXT,
  block TEXT, -- '1', '2', or '3'
  ward TEXT,
  union_name TEXT,
  upazila TEXT DEFAULT 'Ukhiya',
  nid TEXT,
  mobile TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_raw_farmer_nid ON public."Raw-farmer-list" (nid);
CREATE INDEX IF NOT EXISTS idx_raw_farmer_mobile ON public."Raw-farmer-list" (mobile);
CREATE OR REPLACE VIEW public.raw_farmer_list AS SELECT * FROM public."Raw-farmer-list";

-- 7. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Raw-farmer-list" ENABLE ROW LEVEL SECURITY;

-- 8. PERMISSIVE POLICIES FOR SYSTEM ACCESS
DROP POLICY IF EXISTS "Public all dealers" ON public.dealers;
CREATE POLICY "Public all dealers" ON public.dealers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public all farmers" ON public.farmers;
CREATE POLICY "Public all farmers" ON public.farmers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public all transactions" ON public.transactions;
CREATE POLICY "Public all transactions" ON public.transactions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public all contributors" ON public.contributors;
CREATE POLICY "Public all contributors" ON public.contributors FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public all raw farmers" ON public."Raw-farmer-list";
CREATE POLICY "Public all raw farmers" ON public."Raw-farmer-list" FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 9. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_dealers_reg ON public.dealers (registration_number);
CREATE INDEX IF NOT EXISTS idx_contributors_username ON public.contributors (username);
CREATE INDEX IF NOT EXISTS idx_farmers_nid ON public.farmers (nid);
CREATE INDEX IF NOT EXISTS idx_farmers_mobile ON public.farmers (mobile);
CREATE INDEX IF NOT EXISTS idx_farmers_geo ON public.farmers (upazila, union_name, block, ward);
CREATE INDEX IF NOT EXISTS idx_transactions_dealer ON public.transactions (dealer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON public.transactions (customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions (transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions (transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_fertilizer ON public.transactions (fertilizer_name);

-- 10. INITIAL SAMPLE DATA
INSERT INTO public.dealers (registration_number, password, dealer_name, market_name, union_name, upazila)
VALUES ('DLR-001', 'dealer123', 'M/S Rahman Traders', 'Ukhiya Sadar Bazar', 'Raja Palong', 'Ukhiya')
ON CONFLICT (registration_number) DO NOTHING;

INSERT INTO public."Raw-farmer-list" (farmer_name, village, block, ward, union_name, upazila, nid, mobile)
VALUES 
  ('Abdul Jalil', 'Rajapalong', '1', 'Ward 1', 'Raja Palong', 'Ukhiya', '1982123456789', '01819123456'),
  ('Nurul Islam', 'Sonarpara', '2', 'Ward 3', 'Jalia Palong', 'Ukhiya', '1975987654321', '01712987654'),
  ('Mohammad Hossain', 'Balukhali', '3', 'Ward 5', 'Palong Khali', 'Ukhiya', '1990456123789', '01611223344'),
  ('Kamal Uddin', 'Ratnapalong', '1', 'Ward 2', 'Ratna Palong', 'Ukhiya', '1988334455667', '01918765432'),
  ('Zahir Ahmed', 'Holdiapalong', '2', 'Ward 4', 'Holdia Palong', 'Ukhiya', '1984556677889', '01822334455')
ON CONFLICT DO NOTHING;

-- 11. Reload Supabase PostgREST schema cache
NOTIFY pgrst, 'reload schema';
