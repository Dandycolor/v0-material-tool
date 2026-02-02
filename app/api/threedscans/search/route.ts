export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q") || ""
    const limit = searchParams.get("limit") || "24"

    // Since threedscans.com doesn't have a public API, we'll provide a curated list
    // or link to their website. For now, return a message to the user.
    // In future, you could:
    // 1. Scrape threedscans.com (if allowed by their terms)
    // 2. Use Sketchfab API instead (https://sketchfab.com/developers)
    // 3. Use another 3D model API like Thingiverse

    // Curated list of popular 3D scan URLs from threedscans.com
    const curatedScans = [
      {
        id: "1",
        name: "Head Scan 01",
        thumbnail: "https://via.placeholder.com/300x300?text=Head+Scan",
        glbUrl: "https://d3r52jhqvzsekc.cloudfront.net/models/scan/1.glb",
        author: "threedscans.com",
      },
      {
        id: "2",
        name: "Face Scan 01",
        thumbnail: "https://via.placeholder.com/300x300?text=Face+Scan",
        glbUrl: "https://d3r52jhqvzsekc.cloudfront.net/models/scan/2.glb",
        author: "threedscans.com",
      },
      {
        id: "3",
        name: "Object Scan 01",
        thumbnail: "https://via.placeholder.com/300x300?text=Object",
        glbUrl: "https://d3r52jhqvzsekc.cloudfront.net/models/scan/3.glb",
        author: "threedscans.com",
      },
    ]

    // Filter by query if provided
    const filteredScans = query
      ? curatedScans.filter(
          (scan) =>
            scan.name.toLowerCase().includes(query.toLowerCase()) ||
            scan.author.toLowerCase().includes(query.toLowerCase())
        )
      : curatedScans

    return Response.json({
      results: filteredScans.slice(0, parseInt(limit)),
      total: filteredScans.length,
    })
  } catch (error) {
    console.error("Error processing threedscans request:", error)
    return Response.json(
      { error: "Failed to fetch 3D scans", results: [] },
      { status: 200 }
    )
  }
}
