/* Off-main-thread brush meshing (SDF splat + Surface Nets). */
import { meshStrokes, type BrushMeshParams, type BrushStroke } from "./core"

self.onmessage = (e: MessageEvent<{ id: number; strokes: BrushStroke[]; params: BrushMeshParams }>) => {
  const { id, strokes, params } = e.data
  try {
    const r = meshStrokes(strokes, params)
    if (!r) return (self as any).postMessage({ id, result: null })
    ;(self as any).postMessage({ id, result: r }, [r.position.buffer, r.normal.buffer, r.index.buffer])
  } catch (err) {
    ;(self as any).postMessage({ id, error: String(err) })
  }
}
