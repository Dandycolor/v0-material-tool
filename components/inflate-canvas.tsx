"use client"

import { useRef, useState, useEffect, useCallback } from 'react'
import { Field, Switch as KSwitch } from '@/components/knopika/kk'
import type { Point2D } from '@/lib/inflate-geometry'
import { Upload, Trash2, Undo2 } from 'lucide-react'

interface InflateCanvasProps {
  onContourChange: (contour: Point2D[]) => void
  width?: number
  height?: number
}

export function InflateCanvas({
  onContourChange,
  width = 400,
  height = 400,
}: InflateCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentPath, setCurrentPath] = useState<Point2D[]>([])
  const [history, setHistory] = useState<Point2D[][]>([])
  const [brushSize, setBrushSize] = useState(4)
  const [mirrorMode, setMirrorMode] = useState(false)

  // Draw the canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Knopika tokens from the surrounding panel (fallbacks keep the old dark look)
    const cs = getComputedStyle(canvas)
    const tok = (n: string, f: string) => cs.getPropertyValue(n).trim() || f
    const C = {
      bg: tok('--panel', '#1a1a1a'),
      grid: tok('--panel-raised', '#2a2a2a'),
      axis: tok('--panel-line', '#3a3a3a'),
      ink: tok('--paper', '#00d4ff'),
      start: tok('--ground', '#00ff88'),
      end: tok('--signal-red', '#ff4444'),
      muted: tok('--panel-muted', '#666'),
    }

    // Clear canvas
    ctx.fillStyle = C.bg
    ctx.fillRect(0, 0, width, height)

    // Draw grid
    ctx.strokeStyle = C.grid
    ctx.lineWidth = 1
    const gridSize = 20
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // Draw center lines for mirror mode
    if (mirrorMode) {
      ctx.strokeStyle = C.axis
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(width / 2, 0)
      ctx.lineTo(width / 2, height)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Draw current path
    if (currentPath.length > 1) {
      ctx.strokeStyle = C.ink
      ctx.lineWidth = brushSize
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      
      ctx.beginPath()
      ctx.moveTo(currentPath[0].x, currentPath[0].y)
      for (let i = 1; i < currentPath.length; i++) {
        ctx.lineTo(currentPath[i].x, currentPath[i].y)
      }
      ctx.stroke()

      // Draw mirrored path
      if (mirrorMode) {
        ctx.globalAlpha = 0.5; ctx.strokeStyle = C.ink
        ctx.beginPath()
        ctx.moveTo(width - currentPath[0].x, currentPath[0].y)
        for (let i = 1; i < currentPath.length; i++) {
          ctx.lineTo(width - currentPath[i].x, currentPath[i].y)
        }
        ctx.stroke()
      }

      // Draw start/end points
      ctx.globalAlpha = 1; ctx.fillStyle = C.start
      ctx.beginPath()
      ctx.arc(currentPath[0].x, currentPath[0].y, 6, 0, Math.PI * 2)
      ctx.fill()

      if (currentPath.length > 2) {
        ctx.fillStyle = C.end
        const last = currentPath[currentPath.length - 1]
        ctx.beginPath()
        ctx.arc(last.x, last.y, 6, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Draw instructions
    if (currentPath.length === 0) {
      ctx.fillStyle = C.muted
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Draw a closed shape', width / 2, height / 2 - 10)
      ctx.fillText('or load an SVG file', width / 2, height / 2 + 10)
    }
  }, [currentPath, width, height, brushSize, mirrorMode])

  useEffect(() => {
    draw()
  }, [draw])

  // Handle mouse events
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>): Point2D => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    
    const rect = canvas.getBoundingClientRect()
    const scaleX = width / rect.width
    const scaleY = height / rect.height
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    const pos = getMousePos(e)
    setCurrentPath([pos])
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    
    const pos = getMousePos(e)
    const last = currentPath[currentPath.length - 1]
    
    // Only add point if moved enough distance (reduced from 3 to 2 for smoother curves)
    const dist = Math.sqrt((pos.x - last.x) ** 2 + (pos.y - last.y) ** 2)
    if (dist > 2) {
      // Interpolate points between last and current for smoother path
      const steps = Math.ceil(dist / 1.5) // More interpolation steps
      let newPoints: Point2D[] = []
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        newPoints.push({
          x: last.x + (pos.x - last.x) * t,
          y: last.y + (pos.y - last.y) * t,
        })
      }
      setCurrentPath(prev => [...prev, ...newPoints])
    }
  }

  const handleMouseUp = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    
    // Close the path if enough points
    if (currentPath.length >= 3) {
      let finalContour = [...currentPath]
      
      // Apply mirror if enabled
      if (mirrorMode && finalContour.length > 0) {
        // Create mirrored version and merge
        const mirrored = finalContour.map(p => ({ x: width - p.x, y: p.y })).reverse()
        finalContour = [...finalContour, ...mirrored]
      }
      
      // Save to history
      setHistory(prev => [...prev, finalContour])
      onContourChange(finalContour)
    }
  }

  const handleMouseLeave = () => {
    if (isDrawing) {
      handleMouseUp()
    }
  }

  // Touch events for mobile
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const touch = e.touches[0]
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const scaleX = width / rect.width
    const scaleY = height / rect.height
    const pos = {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY,
    }
    
    setIsDrawing(true)
    setCurrentPath([pos])
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    e.preventDefault()
    
    const touch = e.touches[0]
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const scaleX = width / rect.width
    const scaleY = height / rect.height
    const pos = {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY,
    }
    
    const last = currentPath[currentPath.length - 1]
    const dist = Math.sqrt((pos.x - last.x) ** 2 + (pos.y - last.y) ** 2)
    if (dist > 2) {
      // Interpolate for smoother touch drawing
      const steps = Math.ceil(dist / 1.5)
      let newPoints: Point2D[] = []
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        newPoints.push({
          x: last.x + (pos.x - last.x) * t,
          y: last.y + (pos.y - last.y) * t,
        })
      }
      setCurrentPath(prev => [...prev, ...newPoints])
    }
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    handleMouseUp()
  }

  // Clear canvas
  const handleClear = () => {
    setCurrentPath([])
    setHistory([])
    onContourChange([])
  }

  // Undo last action
  const handleUndo = () => {
    if (history.length > 0) {
      const newHistory = [...history]
      newHistory.pop()
      setHistory(newHistory)
      
      if (newHistory.length > 0) {
        const lastContour = newHistory[newHistory.length - 1]
        setCurrentPath(lastContour)
        onContourChange(lastContour)
      } else {
        setCurrentPath([])
        onContourChange([])
      }
    }
  }

  // Load SVG file
  const handleLoadSVG = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.svg,image/svg+xml'
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      
      try {
        const text = await file.text()
        const parser = new DOMParser()
        const doc = parser.parseFromString(text, 'image/svg+xml')
        
        // Find path elements
        const pathElements = doc.querySelectorAll('path')
        if (pathElements.length === 0) {
          console.warn('[v0] No path elements found in SVG')
          return
        }
        
        // Get the first path's d attribute
        const d = pathElements[0].getAttribute('d')
        if (!d) return
        
        // Parse path and convert to contour
        const points = parseSVGPath(d)
        if (points.length >= 3) {
          // Scale to fit canvas
          const scaled = scaleContourToCanvas(points, width, height)
          setCurrentPath(scaled)
          setHistory(prev => [...prev, scaled])
          onContourChange(scaled)
        }
      } catch (error) {
        console.error('[v0] Error loading SVG:', error)
      }
    }
    
    input.click()
  }

  return (
    <div className="kk-inflate-ui">
      <div className="kk-inflate-canvas">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
        {isDrawing && <span className="kk-inflate-badge">Drawing…</span>}
      </div>

      <div className="kk-row" style={{ gap: 6 }}>
        <button type="button" className="kk-pill kk-grow" onClick={handleClear}>
          <Trash2 className="kk-licon" />
          Clear
        </button>
        <button type="button" className="kk-pill kk-grow" onClick={handleUndo} disabled={history.length === 0}>
          <Undo2 className="kk-licon" />
          Undo
        </button>
        <button type="button" className="kk-pill kk-grow" onClick={handleLoadSVG}>
          <Upload className="kk-licon" />
          Load SVG
        </button>
      </div>

      <Field icon="pen" label="Brush size" value={brushSize} min={1} max={12} step={1} format={(v) => `${v}px`} onChange={setBrushSize} />
      <div className="kk-switchrow">
        <span>Mirror drawing</span>
        <KSwitch label="Mirror drawing" on={mirrorMode} onChange={setMirrorMode} />
      </div>
      {currentPath.length > 0 && <p className="hint2">{currentPath.length} points</p>}
    </div>
  )
}

// ============================================================================
// Helper Functions
// ============================================================================

function parseSVGPath(d: string): Point2D[] {
  const points: Point2D[] = []
  const commands = d.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi) || []
  
  let currentX = 0
  let currentY = 0
  let startX = 0
  let startY = 0
  
  for (const cmd of commands) {
    const type = cmd[0].toUpperCase()
    const isRelative = cmd[0] === cmd[0].toLowerCase()
    const args = cmd.slice(1).trim().split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n))
    
    switch (type) {
      case 'M':
        if (isRelative) {
          currentX += args[0]
          currentY += args[1]
        } else {
          currentX = args[0]
          currentY = args[1]
        }
        startX = currentX
        startY = currentY
        points.push({ x: currentX, y: currentY })
        break
        
      case 'L':
        for (let i = 0; i < args.length; i += 2) {
          if (isRelative) {
            currentX += args[i]
            currentY += args[i + 1]
          } else {
            currentX = args[i]
            currentY = args[i + 1]
          }
          points.push({ x: currentX, y: currentY })
        }
        break
        
      case 'H':
        if (isRelative) {
          currentX += args[0]
        } else {
          currentX = args[0]
        }
        points.push({ x: currentX, y: currentY })
        break
        
      case 'V':
        if (isRelative) {
          currentY += args[0]
        } else {
          currentY = args[0]
        }
        points.push({ x: currentX, y: currentY })
        break
        
      case 'Z':
        currentX = startX
        currentY = startY
        break
        
      case 'C':
        for (let i = 0; i < args.length; i += 6) {
          const x1 = isRelative ? currentX + args[i] : args[i]
          const y1 = isRelative ? currentY + args[i + 1] : args[i + 1]
          const x2 = isRelative ? currentX + args[i + 2] : args[i + 2]
          const y2 = isRelative ? currentY + args[i + 3] : args[i + 3]
          const x3 = isRelative ? currentX + args[i + 4] : args[i + 4]
          const y3 = isRelative ? currentY + args[i + 5] : args[i + 5]
          
          for (let t = 0.1; t <= 1; t += 0.1) {
            const mt = 1 - t
            const x = mt * mt * mt * currentX + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3
            const y = mt * mt * mt * currentY + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3
            points.push({ x, y })
          }
          
          currentX = x3
          currentY = y3
        }
        break
        
      case 'Q':
        for (let i = 0; i < args.length; i += 4) {
          const x1 = isRelative ? currentX + args[i] : args[i]
          const y1 = isRelative ? currentY + args[i + 1] : args[i + 1]
          const x2 = isRelative ? currentX + args[i + 2] : args[i + 2]
          const y2 = isRelative ? currentY + args[i + 3] : args[i + 3]
          
          for (let t = 0.1; t <= 1; t += 0.1) {
            const mt = 1 - t
            const x = mt * mt * currentX + 2 * mt * t * x1 + t * t * x2
            const y = mt * mt * currentY + 2 * mt * t * y1 + t * t * y2
            points.push({ x, y })
          }
          
          currentX = x2
          currentY = y2
        }
        break
    }
  }
  
  return points
}

function scaleContourToCanvas(
  points: Point2D[],
  canvasWidth: number,
  canvasHeight: number,
  padding: number = 40
): Point2D[] {
  if (points.length === 0) return []
  
  // Find bounding box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  
  const width = maxX - minX
  const height = maxY - minY
  if (width <= 0 || height <= 0) return points
  
  const availWidth = canvasWidth - padding * 2
  const availHeight = canvasHeight - padding * 2
  const scale = Math.min(availWidth / width, availHeight / height)
  
  const offsetX = (canvasWidth - width * scale) / 2
  const offsetY = (canvasHeight - height * scale) / 2
  
  return points.map(p => ({
    x: (p.x - minX) * scale + offsetX,
    y: (p.y - minY) * scale + offsetY,
  }))
}

export default InflateCanvas
