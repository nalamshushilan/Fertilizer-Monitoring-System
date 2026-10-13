-- ========================================================
-- COMPLETE SUPABASE SCHEMA & MIGRATION FOR AGRICULTURAL SYSTEM
-- Run this script in your Supabase SQL Editor:
-- Supabase Dashboard -> "SQL Editor" -> "New query" -> Paste & Run
-- ========================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CLEAN UP PREVIOUS INCOMPATIBLE SCHEMAS (SAFELY RECREATE FOR NEW SCHEMA)
-- Since previous tables had older schema columns and foreign keys,
-- dropping and recreating ensures all required columns exist cleanly.
DROP TABLE IF EXISTS public.dealer_registers CASCADE;
DROP TABLE IF EXISTS public.dealer_sales CASCADE;
DROP TABLE IF EXISTS public.farmers CASCADE;
DROP TABLE IF EXISTS public.dealers CASCADE;

-- 2. DEALERS TABLE (Form 4 & Authentication)
CREATE TABLE public.dealers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_number TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL, -- Stored password for dealer direct login
  dealer_name TEXT NOT NULL,
  market_name TEXT NOT NULL,
  union_name TEXT NOT NULL,
  upazila TEXT NOT NULL,
  status TEXT DEFAULT 'active' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. FARMERS INFO TABLE (Form 1)
CREATE TABLE public.farmers (
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

-- 4. DEALER SALES INFO TABLE (Form 2)
CREATE TABLE public.dealer_sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE CASCADE NOT NULL,
  farmer_id UUID REFERENCES public.farmers(id) ON DELETE SET NULL,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  register_serial_no TEXT NOT NULL,
  fertilizer_name TEXT NOT NULL, -- 'Urea', 'TSP', 'MoP', 'DAP'
  quantity_kg NUMERIC NOT NULL CHECK (quantity_kg > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. DEALER REGISTER (STOCK OPENING / CLOSING STATUS) TABLE (Form 3)
CREATE TABLE public.dealer_registers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE CASCADE NOT NULL,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status_type TEXT NOT NULL, -- 'Opening', 'Closing'
  fertilizer_name TEXT NOT NULL, -- 'Urea', 'TSP', 'MoP', 'DAP'
  quantity_kg NUMERIC NOT NULL CHECK (quantity_kg >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. CONTRIBUTORS TABLE (Add Contributor - Admin Managed)
CREATE TABLE IF NOT EXISTS public.contributors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  mobile TEXT,
  designation TEXT,
  status TEXT DEFAULT 'active' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributors ENABLE ROW LEVEL SECURITY;

-- 8. PERMISSIVE POLICIES FOR SYSTEM ACCESS
DROP POLICY IF EXISTS "Public all dealers" ON public.dealers;
CREATE POLICY "Public all dealers" ON public.dealers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public all farmers" ON public.farmers;
CREATE POLICY "Public all farmers" ON public.farmers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public all sales" ON public.dealer_sales;
CREATE POLICY "Public all sales" ON public.dealer_sales FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public all registers" ON public.dealer_registers;
CREATE POLICY "Public all registers" ON public.dealer_registers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public all contributors" ON public.contributors;
CREATE POLICY "Public all contributors" ON public.contributors FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 9. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_dealers_reg ON public.dealers (registration_number);
CREATE INDEX IF NOT EXISTS idx_contributors_username ON public.contributors (username);
CREATE INDEX IF NOT EXISTS idx_farmers_nid ON public.farmers (nid);
CREATE INDEX IF NOT EXISTS idx_farmers_mobile ON public.farmers (mobile);
CREATE INDEX IF NOT EXISTS idx_farmers_geo ON public.farmers (upazila, union_name, block, ward);
CREATE INDEX IF NOT EXISTS idx_sales_dealer ON public.dealer_sales (dealer_id);
CREATE INDEX IF NOT EXISTS idx_registers_dealer ON public.dealer_registers (dealer_id);

-- 10. INITIAL SAMPLE DEALER (For instant local testing: Login with Reg: DLR-001 / Pass: dealer123)
INSERT INTO public.dealers (registration_number, password, dealer_name, market_name, union_name, upazila)
VALUES ('DLR-001', 'dealer123', 'M/S Rahman Traders', 'Sadar Bazar', 'Sonapur', 'Sadar')
ON CONFLICT (registration_number) DO NOTHING;
