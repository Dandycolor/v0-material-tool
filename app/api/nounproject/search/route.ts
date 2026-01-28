import { type NextRequest, NextResponse } from "next/server"
import OAuth from "oauth-1.0a"
import crypto from "crypto"

const NOUN_PROJECT_API = "https://api.thenounproject.com/v2"

// OAuth 1.0a configuration
const oauth = new OAuth({
  consumer: {
    key: process.env.NOUNPROJECT_API_KEY || "",
    secret: process.env.NOUNPROJECT_API_SECRET || "",
  },
  signature_method: "HMAC-SHA1",
  hash_function(base_string, key) {
    return crypto.createHmac("sha1", key).update(base_string).digest("base64")
  },
})

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q")
  const limit = searchParams.get("limit") || "20"

  if (!query) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 })
  }

  if (!process.env.NOUNPROJECT_API_KEY || !process.env.NOUNPROJECT_API_SECRET) {
    return NextResponse.json({ error: "API credentials not configured" }, { status: 500 })
  }

  try {
    const url = `${NOUN_PROJECT_API}/icon?query=${encodeURIComponent(query)}&limit=${limit}&include_svg=1`

    const requestData = {
      url,
      method: "GET",
    }

    const authHeader = oauth.toHeader(oauth.authorize(requestData))

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authHeader.Authorization,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Noun Project API error:", response.status, errorText)
      return NextResponse.json({ error: `API error: ${response.status}` }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Noun Project fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch icons" }, { status: 500 })
  }
}
