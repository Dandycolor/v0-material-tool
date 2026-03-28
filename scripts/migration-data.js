/**
 * Migration script to populate initial resources in the database
 * Run this script after setting up Supabase database schema
 */

// Sample material presets that can be saved to database
const materialsData = [
  {
    name: "Glossy Red",
    description: "Shiny red metallic material",
    type: "pbr",
    metalness: 0.1,
    roughness: 0.2,
    color: "#ff0000"
  },
  {
    name: "Brushed Steel",
    description: "Brushed steel with moderate reflection",
    type: "pbr",
    metalness: 0.8,
    roughness: 0.6,
    color: "#cccccc"
  },
  {
    name: "Gold",
    description: "Polished gold with high reflectance",
    type: "pbr",
    metalness: 1.0,
    roughness: 0.2,
    color: "#ffd700"
  },
  {
    name: "Glass",
    description: "Clear glass material",
    type: "pbr",
    metalness: 0,
    roughness: 0.1,
    transmission: 0.95,
    ior: 1.5
  },
  {
    name: "Ceramic",
    description: "Smooth ceramic material",
    type: "pbr",
    metalness: 0,
    roughness: 0.3,
    color: "#f5f5f5"
  }
]

// Sample matcap presets
const matcapsData = [
  {
    name: "Clay",
    description: "Soft clay matcap for organic shapes",
    url: "/matcaps/clay.jpg",
    category: "organic"
  },
  {
    name: "Porcelain",
    description: "Smooth porcelain-like matcap",
    url: "/matcaps/porcelain.jpg",
    category: "ceramic"
  },
  {
    name: "Skin",
    description: "Human skin matcap",
    url: "/matcaps/skin.jpg",
    category: "organic"
  },
  {
    name: "Plastic",
    description: "Plastic surface matcap",
    url: "/matcaps/plastic.jpg",
    category: "synthetic"
  }
]

// Sample texture categories
const texturesData = [
  {
    name: "Marble",
    category: "stone",
    type: "color_map",
    url: "/textures/marble_color.jpg"
  },
  {
    name: "Marble Normal",
    category: "stone",
    type: "normal_map",
    url: "/textures/marble_normal.jpg"
  },
  {
    name: "Wood",
    category: "wood",
    type: "color_map",
    url: "/textures/wood_color.jpg"
  },
  {
    name: "Rust",
    category: "metal",
    type: "color_map",
    url: "/textures/rust_color.jpg"
  }
]

// Sample 3D icons metadata
const icons3dData = [
  { name: "Star", category: "shapes", fileName: "star.fbx", status: "ready" },
  { name: "Heart", category: "shapes", fileName: "heart.fbx", status: "ready" },
  { name: "Rocket", category: "objects", fileName: "rocket.fbx", status: "ready" },
  { name: "Trophy", category: "objects", fileName: "trophy.fbx", status: "ready" },
  { name: "Diamond", category: "shapes", fileName: "diamond.fbx", status: "ready" },
]

console.log("Migration data prepared:")
console.log(`- ${materialsData.length} materials`)
console.log(`- ${matcapsData.length} matcaps`)
console.log(`- ${texturesData.length} textures`)
console.log(`- ${icons3dData.length} 3D icons`)
console.log("\nTo use this data with Supabase:")
console.log("1. Insert into pbr_materials table")
console.log("2. Insert into matcaps table")
console.log("3. Insert into textures table")
console.log("4. Insert into icons_3d table")
console.log("\nNote: This script prepares data for insertion via Supabase client in admin panel")

module.exports = { materialsData, matcapsData, texturesData, icons3dData }
