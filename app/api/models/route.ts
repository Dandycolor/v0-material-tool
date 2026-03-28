import { NextResponse } from "next/server"
import { getModels } from "@/lib/data"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const enabledOnly = searchParams.get("enabled") === "true"

  const models = getModels()
  const result = enabledOnly ? models.filter((m) => m.enabled) : models

  return NextResponse.json(result)
}
