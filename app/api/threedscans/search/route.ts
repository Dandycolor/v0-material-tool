export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q") || "character"
    const limit = searchParams.get("limit") || "24"

    // Используем Sketchfab API - это реальный сервис с настоящими GLB моделями
    const sketchfabUrl = new URL("https://api.sketchfab.com/v3/search")
    sketchfabUrl.searchParams.append("type", "models")
    sketchfabUrl.searchParams.append("q", query)
    sketchfabUrl.searchParams.append("count", limit)
    sketchfabUrl.searchParams.append("downloadable", "true")

    const response = await fetch(sketchfabUrl.toString(), {
      headers: {
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      console.log("[v0] Sketchfab API error:", response.status)
      return Response.json({ results: [] }, { status: 200 })
    }

    const data = await response.json()

    // Преобразуем ответ Sketchfab в наш формат
    const transformedModels = (data.results || []).map((item: any) => ({
      id: item.uid,
      name: item.name,
      thumbnail: item.thumbnails?.images?.[0]?.url || "",
      glbUrl: item.model?.url || `https://sketchfab.com/models/${item.uid}/download`,
      author: item.user?.username || "Sketchfab",
      url: `https://sketchfab.com/models/${item.uid}`,
    }))

    return Response.json({
      results: transformedModels,
      total: data.results?.length || 0,
    })
  } catch (error) {
    console.error("[v0] Ошибка загрузки Sketchfab:", error)
    return Response.json({ results: [] }, { status: 200 })
  }
}
