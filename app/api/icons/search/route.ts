import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")
  const limit = searchParams.get("limit") || "32"

  if (!query) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 })
  }

  try {
    const searchQueries = [`${query} solid`, `${query} filled`, query]

    const allIcons: string[] = []
    const seenIcons = new Set<string>()

    for (const searchQuery of searchQueries) {
      if (allIcons.length >= Number.parseInt(limit)) break

      const response = await fetch(
        `https://api.iconify.design/search?query=${encodeURIComponent(searchQuery)}&limit=${limit}`,
      )

      if (response.ok) {
        const data = await response.json()
        for (const iconName of data.icons || []) {
          if (!seenIcons.has(iconName) && allIcons.length < Number.parseInt(limit)) {
            seenIcons.add(iconName)
            allIcons.push(iconName)
          }
        }
      }
    }

    // Transform response to our format
    const icons = allIcons.map((iconName: string) => {
      const [prefix, name] = iconName.includes(":") ? iconName.split(":") : ["", iconName]
      return {
        id: iconName,
        prefix,
        name,
        preview_url: `https://api.iconify.design/${prefix}/${name}.svg?height=64`,
      }
    })

    return NextResponse.json({ icons, total: icons.length })
  } catch (error) {
    console.error("Iconify search error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to search icons" },
      { status: 500 },
    )
  }
}
