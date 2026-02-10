import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")
  const limit = searchParams.get("limit") || "32"

  if (!query) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 })
  }

  try {
    // Priority order: prefer filled/solid variants from best libraries for extrusion
    // Best for extrusion: filled icons from mdi, fa, tabler, phosphor, bi
    const preferredLibraries = ["mdi", "fa", "tabler", "ph", "bi", "eva"]
    const searchQueries = [
      `${query} solid`,
      `${query} filled`,
      query
    ]

    const allIcons: string[] = []
    const seenIcons = new Set<string>()
    const iconsByLibrary: { [key: string]: string[] } = {}

    // Initialize library arrays
    for (const lib of preferredLibraries) {
      iconsByLibrary[lib] = []
    }

    for (const searchQuery of searchQueries) {
      if (allIcons.length >= Number.parseInt(limit)) break

      const response = await fetch(
        `https://api.iconify.design/search?query=${encodeURIComponent(searchQuery)}&limit=${limit * 2}`,
      )

      if (response.ok) {
        const data = await response.json()
        for (const iconName of data.icons || []) {
          if (!seenIcons.has(iconName) && allIcons.length < Number.parseInt(limit)) {
            const prefix = iconName.split(":")[0]
            
            // Prioritize preferred libraries
            if (preferredLibraries.includes(prefix)) {
              seenIcons.add(iconName)
              allIcons.push(iconName)
              if (iconsByLibrary[prefix]) {
                iconsByLibrary[prefix].push(iconName)
              }
            }
          }
        }
      }
    }

    // If we don't have enough icons from preferred libraries, add others
    if (allIcons.length < Number.parseInt(limit)) {
      for (const searchQuery of searchQueries) {
        if (allIcons.length >= Number.parseInt(limit)) break

        const response = await fetch(
          `https://api.iconify.design/search?query=${encodeURIComponent(searchQuery)}&limit=${limit}`,
        )

        if (response.ok) {
          const data = await response.json()
          for (const iconName of data.icons || []) {
            const prefix = iconName.split(":")[0]
            if (!seenIcons.has(iconName) && !preferredLibraries.includes(prefix) && allIcons.length < Number.parseInt(limit)) {
              seenIcons.add(iconName)
              allIcons.push(iconName)
            }
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
