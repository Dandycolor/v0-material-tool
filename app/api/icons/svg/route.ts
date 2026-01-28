import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const icon = searchParams.get("icon") // format: "prefix:name" e.g. "mdi:flower"

  if (!icon) {
    return NextResponse.json({ error: "Icon parameter is required" }, { status: 400 })
  }

  try {
    // Fetch SVG directly from Iconify
    const response = await fetch(`https://api.iconify.design/${icon.replace(":", "/")}.svg`)

    if (!response.ok) {
      throw new Error(`Failed to fetch SVG: ${response.status}`)
    }

    let svg = await response.text()

    // Convert stroke-based icons to filled versions
    svg = preprocessSVGForExtrusion(svg)

    return NextResponse.json({ svg, icon })
  } catch (error) {
    console.error("Iconify SVG fetch error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch SVG" }, { status: 500 })
  }
}

function preprocessSVGForExtrusion(svg: string): string {
  // Replace currentColor with black for consistency
  svg = svg.replace(/currentColor/g, "#000000")

  // Check if this is a stroke-based icon (has stroke but fill="none")
  const hasStroke = /stroke=["'][^"'none]+["']/.test(svg) || /stroke-width=["'][^"'0]+["']/.test(svg)
  const hasFillNone = /fill=["']none["']/.test(svg)

  if (hasStroke && hasFillNone) {
    // This is a stroke-based icon - convert strokes to fills
    // Strategy: Remove fill="none" and add fill with the stroke color, remove stroke

    // Extract stroke color if present
    const strokeColorMatch = svg.match(/stroke=["']([^"']+)["']/)
    const strokeColor = strokeColorMatch ? strokeColorMatch[1] : "#000000"

    // Replace fill="none" with the stroke color
    svg = svg.replace(/fill=["']none["']/g, `fill="${strokeColor}"`)

    // Remove stroke attributes to avoid double rendering
    svg = svg.replace(/\s*stroke=["'][^"']*["']/g, "")
    svg = svg.replace(/\s*stroke-width=["'][^"']*["']/g, "")
    svg = svg.replace(/\s*stroke-linecap=["'][^"']*["']/g, "")
    svg = svg.replace(/\s*stroke-linejoin=["'][^"']*["']/g, "")
    svg = svg.replace(/\s*stroke-miterlimit=["'][^"']*["']/g, "")
  }

  // Ensure all paths have a fill if not specified
  // Add default fill to elements that don't have one
  svg = svg.replace(/<(path|circle|rect|polygon|ellipse)([^>]*?)(\s*\/?>)/g, (match, tag, attrs, closing) => {
    // Check if fill is already specified
    if (/fill=/.test(attrs)) {
      return match
    }
    // Add default black fill
    return `<${tag}${attrs} fill="#000000"${closing}`
  })

  // Remove any remaining fill="none" that might prevent rendering
  // But only on path elements, not on the root svg
  svg = svg.replace(/(<(?:path|circle|rect|polygon|ellipse)[^>]*)\s+fill=["']none["']/g, '$1 fill="#000000"')

  return svg
}
