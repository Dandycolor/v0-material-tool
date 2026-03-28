import { NextResponse } from "next/server"
import { getMaterials } from "@/lib/data"

// GET /api/materials — returns all materials
// When Supabase is connected, replace getMaterials() with a Supabase query:
//   const supabase = createClient()
//   const { data } = await supabase.from('materials').select('*')
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const enabledOnly = searchParams.get("enabled") === "true"

  const materials = getMaterials()
  const result = enabledOnly ? materials.filter((m) => m.enabled) : materials

  return NextResponse.json(result)
}
