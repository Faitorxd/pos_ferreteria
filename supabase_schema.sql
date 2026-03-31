-- ==============================================================================
-- 0. LIMPIEZA INICIAL (Borrado seguro en caso de reejecución)
-- ==============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;

DROP TABLE IF EXISTS accounts_payable CASCADE;
DROP TABLE IF EXISTS purchase_items CASCADE;
DROP TABLE IF EXISTS purchases CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS payment_receipts CASCADE;
DROP TABLE IF EXISTS accounts_receivable CASCADE;
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS branches CASCADE;

-- ==============================================================================
-- 1. EXTENSIONES Y TABLAS CORE
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sedes
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Perfiles de Usuario
CREATE TABLE profiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  email TEXT,
  role TEXT DEFAULT 'empleado' CHECK (role IN ('admin', 'empleado')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Categorías
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Productos
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  barcode TEXT,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  stock INT NOT NULL DEFAULT 0,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(barcode, branch_id)
);

-- ==============================================================================
-- 2. TABLAS FASE 1 ERP: CLIENTES Y CARTERA
-- ==============================================================================

-- Clientes
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL, -- Cédula o NIT
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  credit_limit DECIMAL(10,2) NOT NULL DEFAULT 0.00, -- Límite de crédito permitido (Regla Comercial)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(document_id, branch_id)
);

-- Ventas (Modificado)
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL, -- Cliente asociado
  total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'completed', -- 'completed', 'cancelled', 'credit'
  payment_method TEXT, -- 'cash', 'card', 'transfer', 'credit'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Detalle de Venta
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cuentas por Cobrar (Cartera)
CREATE TABLE accounts_receivable (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  total_amount DECIMAL(10,2) NOT NULL,
  paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid'
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recibos de Caja (Abonos a Cartera)
CREATE TABLE payment_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  account_receivable_id UUID REFERENCES accounts_receivable(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Cajero que recibe el pago
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Egresos (Gastos / Caja Menor)
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Usuario que registró el gasto
  amount DECIMAL(10,2) NOT NULL,
  category TEXT NOT NULL DEFAULT 'other', -- 'services', 'payroll', 'inventory', 'other'
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ==============================================================================
-- 2.5 TABLAS FASE 4 ERP: PROVEEDORES Y COMPRAS (KARDEX)
-- ==============================================================================

-- Proveedores
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL, -- NIT
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(document_id, branch_id)
);

-- Compras a Proveedores / Traslados
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL, -- Puede ser Null si es traslado interno
  total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  type TEXT NOT NULL, -- 'contado', 'credito', 'traslado'
  invoice_ref TEXT, -- Numero de factura física o guía de traslado
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Detalle de Compras (Kardex Entry)
CREATE TABLE purchase_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  purchase_id UUID REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL DEFAULT 1,
  unit_cost DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cuentas por Pagar a Proveedores
CREATE TABLE accounts_payable (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE RESTRICT,
  purchase_id UUID REFERENCES purchases(id) ON DELETE CASCADE,
  total_amount DECIMAL(10,2) NOT NULL,
  paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid'
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ==============================================================================
-- 3. INSERCIÓN DE DATOS INICIALES
-- ==============================================================================

INSERT INTO branches (id, name, address) 
VALUES ('00000000-0000-0000-0000-000000000000', 'Sede Principal', 'Dirección Principal')
ON CONFLICT DO NOTHING;

-- Crear un cliente por defecto "Consumidor Final" asociado a la sede principal
INSERT INTO customers (id, branch_id, document_id, name, credit_limit) 
VALUES ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', '222222222222', 'Consumidor Final', 0)
ON CONFLICT DO NOTHING;


-- ==============================================================================
-- 4. AUTENTICACIÓN
-- ==============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Perfiles públicos visibles por todos" ON profiles FOR SELECT USING (true);
CREATE POLICY "Los usuarios pueden actualizar su propio perfil" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Nueva Política: Los administradores pueden gestionar a qué sucursal pertenece un empleado
CREATE POLICY "Admins gestionan perfiles" ON profiles FOR UPDATE USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, branch_id)
  VALUES (new.id, new.email, 'empleado', '00000000-0000-0000-0000-000000000000');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ==============================================================================
-- 5. POLÍTICAS RLS (MULTI-TENANT ISOLATION)
-- ==============================================================================

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts_receivable ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts_payable ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso lectura branches" ON branches FOR SELECT USING (true);
CREATE POLICY "Admins gestionan branches" ON branches
  FOR ALL USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );

-- Macro de seguridad generalizada para TODAS las tablas de operaciones
-- Las políticas verifican que el branch_id del registro coincida con el branch_id del usuario logueado en la tabla perfiles

-- Categories
CREATE POLICY "Acceso a categories sede propia" ON categories USING (branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid()));
-- Products
CREATE POLICY "Acceso a products sede propia" ON products USING (branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid()));
-- Ventas y Detalle
CREATE POLICY "Acceso a sales sede propia" ON sales USING (branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Acceso a sale_items sede propia" ON sale_items USING (branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid()));
-- Clientes
CREATE POLICY "Acceso a customers sede propia" ON customers USING (branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid()));
-- Cartera y Recibos
CREATE POLICY "Acceso a accounts_receivable sede propia" ON accounts_receivable USING (branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Acceso a payment_receipts sede propia" ON payment_receipts USING (branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid()));
-- Egresos
CREATE POLICY "Acceso a expenses sede propia" ON expenses USING (branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid()));
-- Compras y Proveedores
CREATE POLICY "Acceso a suppliers sede propia" ON suppliers USING (branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Acceso a purchases sede propia" ON purchases USING (branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Acceso a purchase_items sede propia" ON purchase_items USING (branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Acceso a accounts_payable sede propia" ON accounts_payable USING (branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid()));


-- ==============================================================================
-- 6. ALMACENAMIENTO (STORAGE)
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Permitir lectura publica product-images" ON storage.objects;
DROP POLICY IF EXISTS "Permitir insercion local product-images" ON storage.objects;
DROP POLICY IF EXISTS "Permitir actualizacion local product-images" ON storage.objects;

CREATE POLICY "Permitir lectura publica product-images" ON storage.objects FOR SELECT USING ( bucket_id = 'product-images' );
CREATE POLICY "Permitir insercion local product-images" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'product-images' );
CREATE POLICY "Permitir actualizacion local product-images" ON storage.objects FOR UPDATE USING ( bucket_id = 'product-images' );
