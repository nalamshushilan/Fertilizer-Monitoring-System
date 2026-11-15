-- ========================================================
-- CLEANUP SCRIPT: DELETE UNREQUIRED COLUMNS FROM DATABASE
-- ========================================================
-- How to apply this migration:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Select your project (qnzrrfisftejsygiiwza)
-- 3. In the left navigation, click "SQL Editor" -> "New query"
-- 4. Paste this complete script and click "Run" (green button)
-- ========================================================

-- 1. Temporarily drop the alias view to allow column drops on public.transactions
DROP VIEW IF EXISTS public."Transaction" CASCADE;

-- 2. Drop unrequired / redundant columns from 'public.transactions'
-- - 'contributor': Unused legacy column (always 'Blank')
-- - 'customer': Unnormalized redundant text duplicate of farmer name (farmer linked via customer_id)
-- - 'register_serial_no': Redundant duplicate of 'reference_no'
-- - 'quantity_kg': Redundant duplicate (amounts are stored in 'received_qty' and 'issued_qty')
ALTER TABLE public.transactions DROP COLUMN IF EXISTS contributor;
ALTER TABLE public.transactions DROP COLUMN IF EXISTS customer;
ALTER TABLE public.transactions DROP COLUMN IF EXISTS register_serial_no;
ALTER TABLE public.transactions DROP COLUMN IF EXISTS quantity_kg;

-- 3. Drop unrequired columns from 'public.dealers'
-- - 'status': Unused status flag (all dealers are active)
-- - 'updated_at': Unused timestamp (no triggers or update tracking)
ALTER TABLE public.dealers DROP COLUMN IF EXISTS status;
ALTER TABLE public.dealers DROP COLUMN IF EXISTS updated_at;

-- 4. Drop unrequired columns from 'public.contributors'
-- - 'status': Unused status flag
-- - 'updated_at': Unused timestamp
ALTER TABLE public.contributors DROP COLUMN IF EXISTS status;
ALTER TABLE public.contributors DROP COLUMN IF EXISTS updated_at;

-- 5. Re-create the clean alias view for 'Transaction'
CREATE OR REPLACE VIEW public."Transaction" AS SELECT * FROM public.transactions;

-- 6. Reload Supabase PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
