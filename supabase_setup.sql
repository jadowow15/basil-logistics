-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    full_name TEXT,
    role TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist if table was already created
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;
-- Update Role constraints
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('CEO', 'Admin', 'HR', 'Reception', 'Design', 'Production', 'Dispatch'));

-- 2. Clients Table
CREATE TABLE IF NOT EXISTS clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clients viewable by all staff" ON clients;
CREATE POLICY "Clients viewable by all staff" ON clients FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Clients managed by Admin/CEO/Reception" ON clients;
CREATE POLICY "Clients managed by Admin/CEO/Reception" ON clients FOR ALL 
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('CEO', 'Admin', 'Reception', 'HR')));

-- 3. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    client_name TEXT NOT NULL,
    client_phone TEXT,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    expected_delivery_date TEXT,
    status TEXT DEFAULT 'Pending',
    workflow_stage INTEGER DEFAULT 1,
    
    reception_initiated_by TEXT,
    reception_role TEXT,
    reception_phone TEXT,
    reception_comment TEXT,
    reception_date TEXT,
    
    design_info TEXT,
    design_comment TEXT,
    design_initiated_by TEXT,
    design_date TEXT,
    
    production_info TEXT,
    production_comment TEXT,
    production_initiated_by TEXT,
    production_date TEXT,
    
    dispatch_info TEXT,
    dispatch_comment TEXT,
    delivery_comment TEXT,
    dispatch_initiated_by TEXT,
    dispatch_date TEXT,
    
    truck_details TEXT,
    driver_info TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist (Idempotent)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS truck_details TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_info TEXT;

-- 3. RLS Setup
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 4. Policies (Idempotent Setup)
DROP POLICY IF EXISTS "Profiles viewable by all" ON profiles;
CREATE POLICY "Profiles viewable by all" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Profiles updated by self" ON profiles;
CREATE POLICY "Profiles updated by self" ON profiles FOR UPDATE 
    USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('CEO', 'Admin', 'HR')));

DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
CREATE POLICY "Admins can delete profiles" ON profiles FOR DELETE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('CEO', 'Admin', 'HR')));

DROP POLICY IF EXISTS "CEO & Admin full access" ON orders;
CREATE POLICY "CEO & Admin full access" ON orders FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('CEO', 'Admin', 'HR')));

DROP POLICY IF EXISTS "Authenticated users view orders" ON orders;
CREATE POLICY "Authenticated users view orders" ON orders FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Departments update orders" ON orders;
CREATE POLICY "Departments update orders" ON orders FOR UPDATE
    USING (auth.uid() IS NOT NULL);

-- 5. Trigger for profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, full_name, role)
    VALUES (
        new.id, 
        new.email, 
        COALESCE(new.raw_user_meta_data->>'full_name', 'New Employee'), 
        COALESCE(new.raw_user_meta_data->>'role', 'Reception')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
-- Update Orders Table with necessary tracking columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS produced_quantity INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS handed_to_stock_total INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS handed_to_dispatch_total INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_comment TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_comment TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_date TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_initiated_by TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS produced_date TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS produced_initiated_by TEXT;

-- Delivery Proof / Waybill
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_proof_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_proof_uploaded_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_proof_uploaded_by TEXT;

-- Audit Tracking for modifications
ALTER TABLE orders ADD COLUMN IF NOT EXISTS modification_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMPTZ DEFAULT NOW();

-- Stage Specific Timestamps
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stage_1_entry_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stage_1_exit_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stage_2_entry_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stage_2_exit_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stage_3_entry_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stage_3_exit_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stage_4_entry_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stage_4_exit_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stage_5_entry_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stage_5_exit_at TIMESTAMPTZ;

-- Ensure Realtime is enabled for core tables
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE clients;

-- Payment Tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status_comment TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;

