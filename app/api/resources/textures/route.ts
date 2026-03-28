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
      .from("textures")
      .select("*")
      .order("category")

    if (error) throw error

    return Response.json(data)
  } catch (error) {
    console.error("Error fetching textures:", error)
    return Response.json(
      { error: "Failed to fetch textures" },
      { status: 500 }
    )
  }
}
