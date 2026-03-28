-- Resources schema for PBR materials, matcaps, textures, and 3D icons

-- ============================================================================
-- CATEGORIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('material', 'matcap', 'texture', 'icon3d')),
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PBR MATERIALS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS pbr_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  thumbnail_url TEXT,
  
  -- PBR texture URLs
  color_map_url TEXT,
  normal_map_url TEXT,
  roughness_map_url TEXT,
  metalness_map_url TEXT,
  ao_map_url TEXT,
  height_map_url TEXT,
  
  -- Material properties
  base_color TEXT DEFAULT '#ffffff',
  metalness REAL DEFAULT 0.0,
  roughness REAL DEFAULT 0.5,
  normal_scale REAL DEFAULT 1.0,
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- MATCAP TEXTURES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS matcaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  
  -- Matcap texture URL
  texture_url TEXT NOT NULL,
  thumbnail_url TEXT,
  
  -- Optional normal map for matcap
  normal_map_url TEXT,
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3D ICONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS icons_3d (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  
  -- Model file URLs (support multiple formats)
  fbx_url TEXT,
  glb_url TEXT,
  gltf_url TEXT,
  
  -- Preview
  thumbnail_url TEXT,
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  file_size_bytes INTEGER,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STANDALONE TEXTURES TABLE (for individual texture uploads)
-- ============================================================================
CREATE TABLE IF NOT EXISTS textures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  
  -- Texture URL and type
  texture_url TEXT NOT NULL,
  texture_type TEXT NOT NULL CHECK (texture_type IN ('color', 'normal', 'roughness', 'metalness', 'ao', 'height', 'other')),
  thumbnail_url TEXT,
  
  -- Dimensions
  width INTEGER,
  height INTEGER,
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  is_seamless BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ADMIN USERS (simple admin check via user metadata)
-- ============================================================================
-- Note: We'll use Supabase auth.users with user_metadata.is_admin = true

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_pbr_materials_category ON pbr_materials(category_id);
CREATE INDEX IF NOT EXISTS idx_pbr_materials_active ON pbr_materials(is_active);
CREATE INDEX IF NOT EXISTS idx_pbr_materials_featured ON pbr_materials(is_featured);

CREATE INDEX IF NOT EXISTS idx_matcaps_category ON matcaps(category_id);
CREATE INDEX IF NOT EXISTS idx_matcaps_active ON matcaps(is_active);

CREATE INDEX IF NOT EXISTS idx_icons_3d_category ON icons_3d(category_id);
CREATE INDEX IF NOT EXISTS idx_icons_3d_active ON icons_3d(is_active);

CREATE INDEX IF NOT EXISTS idx_textures_category ON textures(category_id);
CREATE INDEX IF NOT EXISTS idx_textures_type ON textures(texture_type);
CREATE INDEX IF NOT EXISTS idx_textures_active ON textures(is_active);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pbr_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE matcaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE icons_3d ENABLE ROW LEVEL SECURITY;
ALTER TABLE textures ENABLE ROW LEVEL SECURITY;

-- Public read access for active resources
CREATE POLICY "Public read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public read pbr_materials" ON pbr_materials FOR SELECT USING (is_active = true);
CREATE POLICY "Public read matcaps" ON matcaps FOR SELECT USING (is_active = true);
CREATE POLICY "Public read icons_3d" ON icons_3d FOR SELECT USING (is_active = true);
CREATE POLICY "Public read textures" ON textures FOR SELECT USING (is_active = true);

-- Admin write access (check user_metadata.is_admin)
CREATE POLICY "Admin insert categories" ON categories FOR INSERT 
  WITH CHECK ((SELECT (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean));
CREATE POLICY "Admin update categories" ON categories FOR UPDATE 
  USING ((SELECT (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean));
CREATE POLICY "Admin delete categories" ON categories FOR DELETE 
  USING ((SELECT (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean));

CREATE POLICY "Admin insert pbr_materials" ON pbr_materials FOR INSERT 
  WITH CHECK ((SELECT (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean));
CREATE POLICY "Admin update pbr_materials" ON pbr_materials FOR UPDATE 
  USING ((SELECT (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean));
CREATE POLICY "Admin delete pbr_materials" ON pbr_materials FOR DELETE 
  USING ((SELECT (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean));

CREATE POLICY "Admin insert matcaps" ON matcaps FOR INSERT 
  WITH CHECK ((SELECT (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean));
CREATE POLICY "Admin update matcaps" ON matcaps FOR UPDATE 
  USING ((SELECT (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean));
CREATE POLICY "Admin delete matcaps" ON matcaps FOR DELETE 
  USING ((SELECT (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean));

CREATE POLICY "Admin insert icons_3d" ON icons_3d FOR INSERT 
  WITH CHECK ((SELECT (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean));
CREATE POLICY "Admin update icons_3d" ON icons_3d FOR UPDATE 
  USING ((SELECT (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean));
CREATE POLICY "Admin delete icons_3d" ON icons_3d FOR DELETE 
  USING ((SELECT (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean));

CREATE POLICY "Admin insert textures" ON textures FOR INSERT 
  WITH CHECK ((SELECT (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean));
CREATE POLICY "Admin update textures" ON textures FOR UPDATE 
  USING ((SELECT (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean));
CREATE POLICY "Admin delete textures" ON textures FOR DELETE 
  USING ((SELECT (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean));

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pbr_materials_updated_at BEFORE UPDATE ON pbr_materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matcaps_updated_at BEFORE UPDATE ON matcaps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_icons_3d_updated_at BEFORE UPDATE ON icons_3d
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_textures_updated_at BEFORE UPDATE ON textures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
