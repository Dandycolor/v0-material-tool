import { createClient } from "@supabase/supabase-js"

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return Response.json(
        { error: "Missing Supabase configuration" },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data, error } = await supabase
      .from("icons_3d")
      .select("*")
      .eq("status", "ready")
      .order("category")

    if (error) throw error

    return Response.json(data)
  } catch (error) {
    console.error("Error fetching 3D icons:", error)
    return Response.json(
      { error: "Failed to fetch 3D icons" },
      { status: 500 }
    )
  }
}
