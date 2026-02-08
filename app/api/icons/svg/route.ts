import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const icon = searchParams.get("icon") // format: "prefix:name" e.g. "mdi:flower"

  if (!icon) {
    return NextResponse.json({ error: "Icon parameter is required" }, { status: 400 })
  }

  try {
    let svg: string
    const [prefix, iconName] = icon.includes(":") ? icon.split(":") : ["", icon]

    // Fetch from Iconify - supports: mdi, fa, tabler, ph, bi, eva, and many others
    const response = await fetch(`https://api.iconify.design/${prefix}/${iconName}.svg`)

    if (!response.ok) {
      // Fallback: try to find similar icon in Material Design Icons
      if (prefix !== "mdi") {
        console.warn(`[v0] Icon ${icon} not found, trying Material Design Icons fallback`)
        const fallbackResponse = await fetch(`https://api.iconify.design/mdi/${iconName}.svg`)
        
        if (!fallbackResponse.ok) {
          throw new Error(`Icon not found in ${prefix} or Material Design Icons`)
        }
        
        svg = await fallbackResponse.text()
      } else {
        throw new Error(`Failed to fetch icon: ${response.status}`)
      }
    } else {
      svg = await response.text()
    }

    // Preprocess SVG for extrusion
    svg = preprocessSVGForExtrusion(svg)

    return NextResponse.json({ svg, icon })
  } catch (error) {
    console.error("Icon SVG fetch error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch SVG" }, { status: 500 })
  }
}

function preprocessSVGForExtrusion(svg: string): string {
  // Replace currentColor with black for consistency
  svg = svg.replace(/currentColor/g, "#000000")

  // Extract stroke color and width for stroke-to-fill conversion
  const strokeColorMatch = svg.match(/stroke=["']([^"']+)["']/)
  const strokeColor = strokeColorMatch ? strokeColorMatch[1] : "#000000"
  const strokeWidthMatch = svg.match(/stroke-width=["']([^"']+)["']/)
  const strokeWidth = strokeWidthMatch ? parseFloat(strokeWidthMatch[1]) : 2

  // Check if this is primarily a stroke-based icon
  const hasStroke = /stroke=["'][^"'none]+["']/.test(svg) || /stroke-width=["'][^"'0]+["']/.test(svg)
  const hasFillNone = /fill=["']none["']/.test(svg)

  if (hasStroke && hasFillNone) {
    // Convert polyline elements to paths with fill
    svg = svg.replace(/<polyline([^>]*?)points=["']([^"']+)["']([^>]*?)>/g, (match, before, points, after) => {
      // Convert points string to path
      const pointsArray = points
        .trim()
        .split(/[\s,]+/)
        .map((p) => parseFloat(p))

      let pathData = ""
      for (let i = 0; i < pointsArray.length; i += 2) {
        const cmd = i === 0 ? "M" : "L"
        pathData += `${cmd}${pointsArray[i]},${pointsArray[i + 1]} `
      }

      return `<path d="${pathData}" fill="${strokeColor}" stroke="none"/>`
    })

    // Convert line elements to paths
    svg = svg.replace(/<line([^>]*?)x1=["']([^"']+)["']([^>]*?)y1=["']([^"']+)["']([^>]*?)x2=["']([^"']+)["']([^>]*?)y2=["']([^"']+)["']([^>]*?)>/g, (match, ...parts) => {
      const x1 = parseFloat(parts[1])
      const y1 = parseFloat(parts[3])
      const x2 = parseFloat(parts[5])
      const y2 = parseFloat(parts[7])

      // Create a small rectangle along the line to represent it as a filled shape
      const angle = Math.atan2(y2 - y1, x2 - x1)
      const dx = (strokeWidth / 2) * Math.sin(angle)
      const dy = (strokeWidth / 2) * Math.cos(angle)

      const pathData = `M${x1 + dx},${y1 - dy} L${x2 + dx},${y2 - dy} L${x2 - dx},${y2 + dy} L${x1 - dx},${y1 + dy} Z`
      return `<path d="${pathData}" fill="${strokeColor}" stroke="none"/>`
    })

    // Replace fill="none" with actual stroke color
    svg = svg.replace(/fill=["']none["']/g, `fill="${strokeColor}"`)

    // Remove stroke attributes since we've converted to fills
    svg = svg.replace(/\s*stroke=["'][^"']*["']/g, "")
    svg = svg.replace(/\s*stroke-width=["'][^"']*["']/g, "")
    svg = svg.replace(/\s*stroke-linecap=["'][^"']*["']/g, "")
    svg = svg.replace(/\s*stroke-linejoin=["'][^"']*["']/g, "")
    svg = svg.replace(/\s*stroke-miterlimit=["'][^"']*["']/g, "")
  }

  // Ensure all path, circle, rect, polygon, ellipse elements have a fill
  svg = svg.replace(/<(path|circle|rect|polygon|ellipse|polyline)([^>]*?)(\s*\/?>)/g, (match, tag, attrs, closing) => {
    // Skip if already has fill
    if (/fill=/.test(attrs)) {
      return match
    }
    // Add default black fill
    return `<${tag}${attrs} fill="#000000"${closing}`
  })

  // Replace any remaining fill="none" on drawable elements
  svg = svg.replace(
    /(<(?:path|circle|rect|polygon|ellipse|polyline)[^>]*)\s+fill=["']none["']/g,
    '$1 fill="#000000"'
  )

  return svg
}
