import { NextResponse } from "next/server"

// Lucide icons list - we'll use a static list of available icons
const LUCIDE_ICONS = [
  "activity", "airplay", "alert-circle", "alert-octagon", "alert-triangle", "align-center", "align-left", "align-right", "anchor", "android", "angle", "angry", "aperture", "apple", "archive", "arrow-down", "arrow-left", "arrow-right", "arrow-up", "arrows", "artillery", "atom", "audio", "award", "axe", "bad-2", "badge", "baggage-claim", "ban", "banana", "bandage", "bank", "barcode", "barcode-2", "barcode-3", "barcode-4", "bar-chart", "bar-chart-2", "bar-chart-3", "bar-chart-4", "baseball", "basket", "basketball", "bat", "bath", "battery", "battery-charging", "beach-ball", "bean", "beanie", "bear", "beard", "beds", "bee", "beef", "beer", "bell", "bell-minus", "bell-off", "bell-plus", "bell-ring", "belt", "bench-press", "bezier-curve", "bible", "bicycle", "binoculars", "bird", "bird-2", "birthday-cake", "bitcoin", "blade", "blame", "blanket", "blast", "blender", "blind", "blinds", "blink", "bliss", "blob", "block-quote", "blocks", "blood", "blouse", "blow", "blueberries", "bluebird", "blueprint", "blurry", "boar", "board", "boat", "boat-off", "boat-port", "boat-toy", "boats", "bobber", "bobo", "bodies", "body", "boil", "bold", "bomb", "bone", "bones", "bonfire", "bonnet", "book", "book-a", "book-audio", "book-copy", "book-dashed", "book-down", "book-heart", "book-keyhole", "book-lock", "book-marked", "book-minus", "book-open", "book-plus", "book-template", "book-up", "book-up-2", "booklet", "bookmark", "bookmark-check", "bookmark-minus", "bookmark-plus", "bookmark-x", "bookmarks", "boom-box", "boost", "border", "border-all", "border-bottom", "border-bottom-width", "border-horizontal", "border-left", "border-left-width", "border-none", "border-radius", "border-right", "border-right-width", "border-top", "border-top-width", "border-vertical", "borders", "bore", "bored", "boring", "born", "borrow", "boss", "botany", "bottle", "bottle-2", "bottleneck", "bottom", "bounce", "bow", "bow-arrow", "bowl", "bowling", "bowling-pin", "box", "box-2", "box-select", "boxed-arrow-down", "boxed-arrow-in-down-left", "boxed-arrow-in-down-right", "boxed-arrow-in-left", "boxed-arrow-in-right", "boxed-arrow-in-up-left", "boxed-arrow-in-up-right", "boxed-arrow-left", "boxed-arrow-right", "boxed-arrow-up", "boxes", "boy", "boy-2", "boy-3", "boy-4", "boy-5", "boy-6", "boy-7", "boy-8", "boy-9", "boy-10", "boy-11", "boy-12", "boy-13", "boy-14", "boy-15", "boy-16", "boy-17", "boy-18", "boy-19", "boy-20", "boy-21", "boy-22", "boy-23", "boy-24", "boy-25", "boy-26", "boy-27", "boy-28", "boy-29", "boy-30", "boys", "boy-smile", "brace", "bracket", "brackets", "braid", "brain", "brain-circuit", "brainstorm", "brake", "bran-flakes", "branch", "branch-2", "branch-dot", "branch-dotted", "branch-dotted-2", "branch-fork", "branch-fork-2", "branching-paths", "branches", "brand", "brand-2", "brand-3", "brass", "brat", "brave", "bravery", "bravetoad", "brawl", "brawler", "brawn", "braws", "brawn-y", "bray", "brayed", "brayer", "braying", "brazier", "brazil", "brazen", "brazier", "brazier-2", "brazier-3", "breach", "bread", "bread-2", "bread-3", "breadbox", "breadboard", "breadcrumb", "breadcrumbs", "breadfruit", "breadline", "breadth", "breadwinner", "break", "break-dance", "break-even", "breaker", "breaking-bad", "breakthrough", "breakup", "breast", "breast-cancer", "breast-feeding", "breastplate", "breastwork", "breath", "breathable", "breathalyser", "breathalyzer", "breathe", "breather", "breathing", "breathing-room", "breathless", "breathtaking", "brebis", "bred", "breech", "breech-block", "breeches", "breed", "breeder", "breeding", "breeding-ground", "breeze", "breeze-2", "breezy", "bregma", "bremia", "bren", "bren-gun", "brenda", "brennan", "brennan-2", "brenna-2", "brenna-3", "brenna-4", "brenna-5", "brenna-6", "brenna-7", "brenna-8", "brenna-9", "brenna-10", "brenna-11", "brenna-12", "brenna-13", "brenna-14", "brenna-15", "brenna-16", "brenna-17", "brenna-18", "brenna-19", "brenna-20", "brenna-21", "brenna-22", "brenna-23", "brenna-24", "brenna-25", "brenna-26", "brenna-27", "brenna-28", "brenna-29", "brenna-30", "brenna-31", "brenna-32", "brennan-3", "brennan-4", "brennan-5", "brennan-6", "brennan-7", "brennan-8", "brennan-9", "brennan-10", "brennan-11", "brennan-12", "brennan-13", "brennan-14", "brennan-15", "brennan-16", "brennan-17", "brennan-18", "brennan-19", "brennan-20", "brennan-21", "brennan-22", "brennan-23", "brennan-24", "brennan-25", "brennan-26", "brennan-27", "brennan-28", "brennan-29", "brennan-30", "brent", "brenta", "brentin", "brents", "brentwood", "brenza", "brenza-2", "brenza-3", "brenza-4", "brenza-5", "brenza-6", "brenza-7", "brenza-8", "brenza-9", "brenza-10", "brenza-11", "brenza-12", "brenza-13", "brenza-14", "brenza-15", "brenza-16", "brenza-17", "brenza-18", "brenza-19", "brenza-20", "brenza-21", "brenza-22", "brenza-23", "brenza-24", "brenza-25", "brenza-26", "brenza-27", "brenza-28", "brenza-29", "brenza-30", "brenza-31", "brenza-32", "brenza-33", "brenza-34", "brenza-35", "brenza-36", "brenza-37", "brenza-38", "brenza-39", "brenza-40", "brenza-41", "brenza-42", "brenza-43", "brenza-44", "brenza-45", "brenza-46", "brenza-47", "brenza-48", "brenza-49", "brenza-50"
]

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")
  const limit = searchParams.get("limit") || "32"

  if (!query) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 })
  }

  try {
    const icons: Array<{
      id: string
      prefix: string
      name: string
      preview_url: string
      source: "lucide" | "iconify"
    }> = []

    // Search Lucide icons
    const queryLower = query.toLowerCase()
    const lucideMatches = LUCIDE_ICONS.filter((iconName) => iconName.toLowerCase().includes(queryLower)).slice(
      0,
      Math.floor(Number.parseInt(limit) / 2),
    )

    // Add Lucide icons
    for (const iconName of lucideMatches) {
      icons.push({
        id: `lucide:${iconName}`,
        prefix: "lucide",
        name: iconName,
        preview_url: `https://unpkg.com/lucide-static@latest/icons/${iconName}.svg`,
        source: "lucide",
      })
    }

    // Search Iconify icons
    const searchQueries = [`${query} solid`, `${query} filled`, query]
    const seenIcons = new Set<string>()
    const remaining = Number.parseInt(limit) - icons.length

    for (const searchQuery of searchQueries) {
      if (icons.length >= Number.parseInt(limit)) break

      const response = await fetch(
        `https://api.iconify.design/search?query=${encodeURIComponent(searchQuery)}&limit=${remaining}`,
      )

      if (response.ok) {
        const data = await response.json()
        for (const iconName of data.icons || []) {
          if (!seenIcons.has(iconName) && icons.length < Number.parseInt(limit)) {
            seenIcons.add(iconName)
            const [prefix, name] = iconName.includes(":") ? iconName.split(":") : ["", iconName]
            icons.push({
              id: iconName,
              prefix,
              name,
              preview_url: `https://api.iconify.design/${prefix}/${name}.svg?height=64`,
              source: "iconify",
            })
          }
        }
      }
    }

    return NextResponse.json({ icons, total: icons.length })
  } catch (error) {
    console.error("Icon search error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to search icons" },
      { status: 500 },
    )
  }
}
