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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (!process.env.NOUNPROJECT_API_KEY || !process.env.NOUNPROJECT_API_SECRET) {
    return NextResponse.json({ error: "API credentials not configured" }, { status: 500 })
  }

  try {
    // Pattern: https://static.thenounproject.com/svg/{id}.svg
    const svgUrl = `https://static.thenounproject.com/svg/${id}.svg`

    console.log("[v0] Trying SVG URL:", svgUrl)

    const svgResponse = await fetch(svgUrl)

    if (svgResponse.ok) {
      const svgContent = await svgResponse.text()

      // Verify it's actual SVG content
      if (svgContent.includes("<svg") || svgContent.includes("<?xml")) {
        console.log("[v0] Successfully fetched SVG from CDN")
        return NextResponse.json({
          svg: svgContent,
          id: id,
        })
      }
    }

    console.log("[v0] CDN SVG not available, status:", svgResponse.status)

    const iconUrl = `${NOUN_PROJECT_API}/icon/${id}`

    const requestData = {
      url: iconUrl,
      method: "GET",
    }

    const authHeader = oauth.toHeader(oauth.authorize(requestData))

    const iconResponse = await fetch(iconUrl, {
      method: "GET",
      headers: {
        Authorization: authHeader.Authorization,
      },
    })

    if (!iconResponse.ok) {
      const errorText = await iconResponse.text()
      console.error("[v0] Noun Project icon fetch error:", iconResponse.status, errorText)
      return NextResponse.json({ error: `API error: ${iconResponse.status}` }, { status: iconResponse.status })
    }

    const iconData = await iconResponse.json()

    // Log all available fields for debugging
    console.log("[v0] Icon data fields:", Object.keys(iconData.icon || {}))

    // Try various possible SVG URL fields
    const possibleSvgUrl =
      iconData.icon?.icon_url ||
      iconData.icon?.svg_url ||
      iconData.icon?.preview_url ||
      iconData.icon?.preview_url_84 ||
      iconData.icon?.preview_url_42

    if (possibleSvgUrl && possibleSvgUrl.endsWith(".svg")) {
      const svgFetchResponse = await fetch(possibleSvgUrl)
      if (svgFetchResponse.ok) {
        const svgContent = await svgFetchResponse.text()
        return NextResponse.json({
          svg: svgContent,
          id: id,
          attribution: iconData.icon?.attribution,
        })
      }
    }

    return NextResponse.json(
      {
        error: "SVG not available for free tier. The Noun Project requires a paid subscription for SVG downloads.",
        thumbnail_url: iconData.icon?.thumbnail_url,
        attribution: iconData.icon?.attribution,
      },
      { status: 403 },
    )
  } catch (error) {
    console.error("[v0] Noun Project icon error:", error)
    return NextResponse.json({ error: "Failed to fetch icon" }, { status: 500 })
  }
}
