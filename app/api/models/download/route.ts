import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 })
  }

  try {
    const apiKey = process.env.POLY_PIZZA_API_KEY
    
    // Проксируем загрузку GLB файла для обхода CORS
    const response = await fetch(url, {
      headers: {
        "Accept": "*/*",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ...(apiKey && { "x-auth-token": apiKey }),
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status}`)
    }

    const buffer = await response.arrayBuffer()
    
    // Определяем имя файла из URL
    const filename = url.split('/').pop() || "model.glb"
    
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "model/gltf-binary",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("[v0] Download error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to download model" },
      { status: 500 }
    )
  }
}
