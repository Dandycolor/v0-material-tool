/* Off-main-thread sketch inflate meshing. */
import { meshSketch, type SketchParams, type SketchStroke } from "./core"

self.onmessage = (e: MessageEvent<{ id: number; strokes: SketchStroke[]; params: SketchParams }>) => {
  const { id, strokes, params } = e.data
  try {
    const r = meshSketch(strokes, params)
    if (!r) return (self as any).postMessage({ id, result: null })
    ;(self as any).postMessage({ id, result: r }, [r.position.buffer, r.normal.buffer, r.index.buffer])
  } catch (err) {
    ;(self as any).postMessage({ id, error: String(err) })
  }
}
