export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q") || ""
    const limit = searchParams.get("limit") || "24"

    // Call threedscans API from server-side
    const url = new URL("https://api.threedscans.com/v1/search")
    if (query) {
      url.searchParams.append("q", query)
    }
    url.searchParams.append("limit", limit)

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    })

    if (!response.ok) {
      throw new Error(`threedscans API returned ${response.status}`)
    }

    const data = await response.json()
    return Response.json(data)
  } catch (error) {
    console.error("Error fetching from threedscans:", error)
    return Response.json(
      { error: "Failed to fetch from threedscans", results: [] },
      { status: 200 } // Return 200 with empty results to avoid client errors
    )
  }
}
