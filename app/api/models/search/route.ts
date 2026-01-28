import { NextResponse } from "next/server"

// Базовый URL вашего GitHub репозитория (raw файлы)
const GITHUB_REPO_URL = process.env.NEXT_PUBLIC_MODELS_REPO_URL || "https://raw.githubusercontent.com/Dandycolor/3d-models-catalog/main/models/models.json"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q") || ""
  
  try {
    // Загружаем каталог моделей из GitHub
    const catalogUrl = GITHUB_REPO_URL
    
    const response = await fetch(catalogUrl, {
      headers: {
        "Accept": "application/json",
      },
      // Кэшируем на 5 минут
      next: { revalidate: 300 }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch models catalog: ${response.status}`)
    }

    const catalog = await response.json()
    let models = catalog.models || []

    // Фильтруем модели по поисковому запросу
    if (query.trim()) {
      const searchLower = query.toLowerCase()
      models = models.filter((model: any) => {
        const nameMatch = model.name?.toLowerCase().includes(searchLower)
        const categoryMatch = model.category?.toLowerCase().includes(searchLower)
        const tagsMatch = model.tags?.some((tag: string) => 
          tag.toLowerCase().includes(searchLower)
        )
        return nameMatch || categoryMatch || tagsMatch
      })
    }

    // Модели уже должны иметь полные URL в models.json
    const modelsWithFullUrls = models.map((model: any) => ({
      id: model.id,
      name: model.name,
      author: model.author || "Unknown",
      thumbnail: model.thumbnail,
      glbUrl: model.glbUrl,
      categories: model.categories || [],
    }))

    return NextResponse.json({
      models: modelsWithFullUrls,
      total: modelsWithFullUrls.length,
    })
  } catch (error) {
    console.error("Error loading models:", error)
    return NextResponse.json(
      { 
        error: "Failed to load models",
        models: [], 
        total: 0 
      },
      { status: 200 }
    )
  }
}
