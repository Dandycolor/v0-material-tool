"use client"

import { useRef, useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import type { Point2D } from '@/lib/inflate-geometry'
import { Upload, Trash2, Undo2, Pencil } from 'lucide-react'

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

    // Clear canvas
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, width, height)

    // Draw grid
    ctx.strokeStyle = '#2a2a2a'
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
      ctx.strokeStyle = '#3a3a3a'
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(width / 2, 0)
      ctx.lineTo(width / 2, height)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Draw current path
    if (currentPath.length > 1) {
      ctx.strokeStyle = '#00d4ff'
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
        ctx.strokeStyle = '#00d4ff80'
        ctx.beginPath()
        ctx.moveTo(width - currentPath[0].x, currentPath[0].y)
        for (let i = 1; i < currentPath.length; i++) {
          ctx.lineTo(width - currentPath[i].x, currentPath[i].y)
        }
        ctx.stroke()
      }

      // Draw start/end points
      ctx.fillStyle = '#00ff88'
      ctx.beginPath()
      ctx.arc(currentPath[0].x, currentPath[0].y, 6, 0, Math.PI * 2)
      ctx.fill()

      if (currentPath.length > 2) {
        ctx.fillStyle = '#ff4444'
        const last = currentPath[currentPath.length - 1]
        ctx.beginPath()
        ctx.arc(last.x, last.y, 6, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Draw instructions
    if (currentPath.length === 0) {
      ctx.fillStyle = '#666'
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
    <div className="space-y-4">
      {/* Canvas */}
      <div 
        className="relative rounded-lg overflow-hidden border border-neutral-700"
        style={{ aspectRatio: '1/1' }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full h-full cursor-crosshair touch-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
        
        {/* Overlay hint */}
        {isDrawing && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-cyan-600/80 rounded text-xs text-white">
            Drawing...
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleClear}
          className="flex-1 gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Clear
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleUndo}
          disabled={history.length === 0}
          className="flex-1 gap-2"
        >
          <Undo2 className="w-4 h-4" />
          Undo
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleLoadSVG}
          className="flex-1 gap-2"
        >
          <Upload className="w-4 h-4" />
          Load SVG
        </Button>
      </div>

      {/* Options */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-zinc-500">Brush Size</Label>
          <span className="text-xs text-white font-mono">{brushSize}px</span>
        </div>
        <Slider
          value={[brushSize]}
          onValueChange={([value]) => setBrushSize(value)}
          min={1}
          max={12}
          step={1}
          className="w-full"
        />

        <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-neutral-900/50">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-zinc-400" />
            <Label className="text-xs text-zinc-400">Mirror Drawing</Label>
          </div>
          <Switch
            checked={mirrorMode}
            onCheckedChange={setMirrorMode}
            className="data-[state=checked]:bg-cyan-600 scale-90"
          />
        </div>
      </div>

      {/* Point count */}
      {currentPath.length > 0 && (
        <div className="text-xs text-zinc-500 text-center">
          {currentPath.length} points
        </div>
      )}
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
