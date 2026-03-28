// ── Core domain types for Polya ──
// These types are designed to be Supabase-compatible (jsonb for config fields)

export type MaterialType =
  | "pbr"
  | "matcap"
  | "gradient"
  | "wireframe"
  | "toon"
  | "custom_shader"

export type GeometryType =
  | "sphere"
  | "box"
  | "torus"
  | "torusknot"
  | "plane"
  | "svg"
  | "gltf"

// ── PBR material config ──
export interface PBRConfig {
  colorTint: string
  roughness: number
  metalness: number
  normalScale: number
  displacementScale: number
  transmission: number
  ior: number
  thickness: number
  clearcoat: number
  clearcoatRoughness: number
  iridescence: number
  iridescenceIOR: number
  envMapIntensity: number
  textureScale: number
  // map urls (null = not set)
  colorMap: string | null
  normalMap: string | null
  roughnessMap: string | null
  metalnessMap: string | null
  displacementMap: string | null
}

// ── Gradient shader config ──
export interface GradientConfig {
  type: "radial" | "linear"
  color1: string
  color2: string
  color3: string
  use3Colors: boolean
  intensity: number
  distortion: number
  angle: number
  noise: number
}

// ── Matcap config ──
export interface MatcapConfig {
  textureUrl: string
  hueShift: number
}

// ── Custom shader config ──
export interface CustomShaderConfig {
  vertexShader: string
  fragmentShader: string
  uniforms: Record<string, { type: string; value: unknown }>
}

// ── Toon config ──
export interface ToonConfig {
  color: string
  steps: number
}

// ── Wireframe config ──
export interface WireframeConfig {
  color: string
  opacity: number
  linewidth: number
}

export type MaterialConfig =
  | { type: "pbr"; config: PBRConfig }
  | { type: "matcap"; config: MatcapConfig }
  | { type: "gradient"; config: GradientConfig }
  | { type: "custom_shader"; config: CustomShaderConfig }
  | { type: "toon"; config: ToonConfig }
  | { type: "wireframe"; config: WireframeConfig }

// ── Material record (DB row shape) ──
export interface Material {
  id: string
  name: string
  slug: string
  type: MaterialType
  enabled: boolean
  config: MaterialConfig["config"]
  thumbnail_url: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

// ── Model record ──
export interface Model {
  id: string
  name: string
  slug: string
  glb_url: string
  thumbnail_url: string | null
  categories: string[]
  author: string | null
  enabled: boolean
  created_at: string
}

// ── Preset record ──
export interface Preset {
  id: string
  name: string
  material_id: string
  model_id: string | null
  params: Record<string, unknown>
  thumbnail_url: string | null
  created_at: string
}

// ── Lighting settings (viewer state, not persisted separately) ──
export interface LightingSettings {
  envMap: string
  envIntensity: number
  envRotation: number
  directionalIntensity: number
  ambientIntensity: number
  exposure: number
}

// ── Viewer state ──
export interface ViewerState {
  activeMaterialId: string | null
  activeModelId: string | null
  renderMode: MaterialType
  showGrid: boolean
  showWireframeOverlay: boolean
  lighting: LightingSettings
}
