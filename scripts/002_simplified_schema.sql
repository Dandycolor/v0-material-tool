-- Simplified resources schema for admin management
-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS textures CASCADE;
DROP TABLE IF EXISTS icons_3d CASCADE;
DROP TABLE IF EXISTS matcaps CASCADE;
DROP TABLE IF EXISTS pbr_materials CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- ============================================================================
-- PBR MATERIALS TABLE
-- ============================================================================
CREATE TABLE pbr_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  
  -- PBR texture URLs (relative paths like /pbr/scratched-plastic/color.jpg)
  color_map_url TEXT,
  normal_map_url TEXT,
  roughness_map_url TEXT,
  metalness_map_url TEXT,
  ao_map_url TEXT,
  
  -- Material properties
  base_color TEXT DEFAULT '#ffffff',
  metalness REAL DEFAULT 0.0,
  roughness REAL DEFAULT 0.5,
  normal_scale REAL DEFAULT 1.0,
  ior REAL DEFAULT 1.5,
  transmission REAL DEFAULT 0.0,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- MATCAP TEXTURES TABLE
-- ============================================================================
CREATE TABLE matcaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  
  -- Matcap texture URL
  texture_url TEXT NOT NULL,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CUSTOM TEXTURES TABLE (individual texture maps for custom materials)
-- ============================================================================
CREATE TABLE textures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  
  -- Texture URL and type
  texture_url TEXT NOT NULL,
  texture_type TEXT NOT NULL CHECK (texture_type IN ('normal', 'roughness', 'metalness', 'color', 'ao', 'height')),
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3D ICONS TABLE
-- ============================================================================
CREATE TABLE icons_3d (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  
  -- Model file URLs
  fbx_url TEXT,
  glb_url TEXT,
  thumbnail_url TEXT,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_pbr_materials_active ON pbr_materials(is_active);
CREATE INDEX idx_pbr_materials_sort ON pbr_materials(sort_order);
CREATE INDEX idx_matcaps_active ON matcaps(is_active);
CREATE INDEX idx_matcaps_sort ON matcaps(sort_order);
CREATE INDEX idx_textures_active ON textures(is_active);
CREATE INDEX idx_textures_type ON textures(texture_type);
CREATE INDEX idx_icons_3d_active ON icons_3d(is_active);

-- ============================================================================
-- ROW LEVEL SECURITY (simplified - allow all for now)
-- ============================================================================
ALTER TABLE pbr_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE matcaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE textures ENABLE ROW LEVEL SECURITY;
ALTER TABLE icons_3d ENABLE ROW LEVEL SECURITY;

-- Allow public read
CREATE POLICY "Allow public read pbr_materials" ON pbr_materials FOR SELECT USING (true);
CREATE POLICY "Allow public read matcaps" ON matcaps FOR SELECT USING (true);
CREATE POLICY "Allow public read textures" ON textures FOR SELECT USING (true);
CREATE POLICY "Allow public read icons_3d" ON icons_3d FOR SELECT USING (true);

-- Allow all write operations (for development - tighten in production)
CREATE POLICY "Allow all insert pbr_materials" ON pbr_materials FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update pbr_materials" ON pbr_materials FOR UPDATE USING (true);
CREATE POLICY "Allow all delete pbr_materials" ON pbr_materials FOR DELETE USING (true);

CREATE POLICY "Allow all insert matcaps" ON matcaps FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update matcaps" ON matcaps FOR UPDATE USING (true);
CREATE POLICY "Allow all delete matcaps" ON matcaps FOR DELETE USING (true);

CREATE POLICY "Allow all insert textures" ON textures FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update textures" ON textures FOR UPDATE USING (true);
CREATE POLICY "Allow all delete textures" ON textures FOR DELETE USING (true);

CREATE POLICY "Allow all insert icons_3d" ON icons_3d FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update icons_3d" ON icons_3d FOR UPDATE USING (true);
CREATE POLICY "Allow all delete icons_3d" ON icons_3d FOR DELETE USING (true);

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

CREATE TRIGGER update_pbr_materials_updated_at BEFORE UPDATE ON pbr_materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matcaps_updated_at BEFORE UPDATE ON matcaps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_textures_updated_at BEFORE UPDATE ON textures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_icons_3d_updated_at BEFORE UPDATE ON icons_3d
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
