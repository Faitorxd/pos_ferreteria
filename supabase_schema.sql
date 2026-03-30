-- ==============================================================================
-- 0. LIMPIEZA INICIAL (Borrado seguro en caso de reejecución)
-- ==============================================================================

-- Remover triggers y funciones vinculados
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;

-- Remover tablas (CASCADE eliminará automáticamente las políticas de seguridad vinculadas)
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ==============================================================================
-- 1. EXTENSIONES Y TABLAS DEL SISTEMA POS
-- ==============================================================================

-- Habilitar la extensión para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crear tabla de perfiles (profiles) vinculada a auth.users de Supabase
CREATE TABLE profiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  email TEXT,
  role TEXT DEFAULT 'empleado' CHECK (role IN ('admin', 'empleado')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: Categorías
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: Productos
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barcode TEXT UNIQUE, -- Código de barras único por producto
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  stock INT NOT NULL DEFAULT 0,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: Ventas
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Saber quién vendió
  total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'completed', -- 'completed', 'cancelled', 'pending'
  payment_method TEXT, -- 'cash', 'card', 'transfer'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: Detalle de Ventas
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 2. RUTINAS Y  ROLES DE USUARIO (Auth)
-- ==============================================================================

-- Habilitar Seguridad (RLS) en la tabla profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura/escritura para Perfiles
CREATE POLICY "Perfiles públicos visibles por todos" ON profiles FOR SELECT USING (true);
CREATE POLICY "Los usuarios pueden actualizar su propio perfil" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Función automatizada (Trigger) para crear un perfil cada vez que un usuario se registre
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insertamos por defecto como 'empleado'
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'empleado');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Definir el Trigger que reacciona a los registros nuevos
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ==============================================================================
-- 3. POLÍTICAS RLS TEMPORALES PARA EL DESARROLLO (Desbloqueo de Tablas)
-- ==============================================================================

-- Habilitamos RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Creamos políticas públicas para que el frontend pueda leer y escribir libremente en esta fase MVP
CREATE POLICY "Acceso público total categories" ON categories FOR ALL USING (true);
CREATE POLICY "Acceso público total products" ON products FOR ALL USING (true);
CREATE POLICY "Acceso público total sales" ON sales FOR ALL USING (true);
CREATE POLICY "Acceso público total sale_items" ON sale_items FOR ALL USING (true);


-- ==============================================================================
-- 4. ALMACENAMIENTO DE IMÁGENES (STORAGE BUCKETS)
-- ==============================================================================

-- Crear el depósito (bucket) para las fotos si no existe
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas para el Bucket (Permitir TODO por fase MVP)
CREATE POLICY "Permitir lectura publica product-images" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'product-images' );

CREATE POLICY "Permitir insercion local product-images" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'product-images' );

CREATE POLICY "Permitir actualizacion local product-images" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'product-images' );
