/* Off-main-thread extrusion: triangulation (earcut) and bevel rings for big SVGs take
   hundreds of ms; running them here keeps sliders and the 3D view smooth. */
import { extrudeFlatShapes, type ExtrudeParams, type FlatShape } from "./core"

self.onmessage = (e: MessageEvent<{ id: number; shapes: FlatShape[]; params: ExtrudeParams }>) => {
  const { id, shapes, params } = e.data
  try {
    const r = extrudeFlatShapes(shapes, params)
    if (!r) return (self as any).postMessage({ id, result: null })
    ;(self as any).postMessage({ id, result: r }, [r.position.buffer, r.normal.buffer, r.uv.buffer])
  } catch (err) {
    ;(self as any).postMessage({ id, error: String(err) })
  }
}
