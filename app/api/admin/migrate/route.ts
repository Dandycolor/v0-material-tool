import { createClient } from "@supabase/supabase-js"

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return Response.json(
        { error: "Missing Supabase configuration" },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { resourceType } = await request.json()

    let result = { inserted: 0, skipped: 0 }

    if (resourceType === "materials" || !resourceType) {
      const materialsData = [
        { name: "Glossy Red", description: "Shiny red metallic", type: "pbr", metalness: 0.1, roughness: 0.2 },
        { name: "Brushed Steel", description: "Brushed steel", type: "pbr", metalness: 0.8, roughness: 0.6 },
        { name: "Gold", description: "Polished gold", type: "pbr", metalness: 1.0, roughness: 0.2 },
        { name: "Glass", description: "Clear glass", type: "pbr", transmission: 0.95, ior: 1.5 },
        { name: "Ceramic", description: "Smooth ceramic", type: "pbr", roughness: 0.3 },
      ]

      const { count, error } = await supabase
        .from("pbr_materials")
        .insert(materialsData)

      if (error) {
        console.error("Materials insert error:", error)
        result.skipped += materialsData.length
      } else {
        result.inserted += materialsData.length
      }
    }

    if (resourceType === "matcaps" || !resourceType) {
      const matcapsData = [
        { name: "Clay", description: "Soft clay", category: "organic", url: "/matcaps/clay.jpg" },
        { name: "Porcelain", description: "Smooth porcelain", category: "ceramic", url: "/matcaps/porcelain.jpg" },
        { name: "Skin", description: "Human skin", category: "organic", url: "/matcaps/skin.jpg" },
        { name: "Plastic", description: "Plastic surface", category: "synthetic", url: "/matcaps/plastic.jpg" },
      ]

      const { count, error } = await supabase
        .from("matcaps")
        .insert(matcapsData)

      if (error) {
        console.error("Matcaps insert error:", error)
        result.skipped += matcapsData.length
      } else {
        result.inserted += matcapsData.length
      }
    }

    if (resourceType === "textures" || !resourceType) {
      const texturesData = [
        { name: "Marble", category: "stone", type: "color_map", url: "/textures/marble_color.jpg" },
        { name: "Wood", category: "wood", type: "color_map", url: "/textures/wood_color.jpg" },
        { name: "Rust", category: "metal", type: "color_map", url: "/textures/rust_color.jpg" },
      ]

      const { count, error } = await supabase
        .from("textures")
        .insert(texturesData)

      if (error) {
        console.error("Textures insert error:", error)
        result.skipped += texturesData.length
      } else {
        result.inserted += texturesData.length
      }
    }

    return Response.json(result)
  } catch (error) {
    console.error("Migration error:", error)
    return Response.json(
      { error: "Migration failed" },
      { status: 500 }
    )
  }
}
