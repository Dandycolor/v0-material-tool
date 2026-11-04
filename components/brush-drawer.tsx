"use client"

/* 3D brush input. Lives inside the rotation group, so strokes are stored in the shape's own space:
   rotate the shape between strokes and the next one lands on a fresh camera-facing plane.
   - a stroke starts on the painted surface under the cursor (beads sit half-sunk and merge),
     or on the plane through the shape's centre
   - input is steadied (lazy brush), spaced by radius, pen pressure scales the bead
   - while drawing, an instanced preview of beads shows the stroke; it stays until the mesher
     (worker) delivers the merged mesh
   - Space held = orbit; Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z redo */

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { brush } from "@/lib/brush/store"

const MAX = 6000

export function BrushGeometry() {
  const geo = useBrushGeometry()
  return <primitive object={geo} attach="geometry" />
}

function useBrushGeometry() {
  return useSyncExternalStore(brush.subscribe, () => brush.get().geometry, () => brush.get().geometry)
}
export function useBrushDrawing() {
  return useSyncExternalStore(brush.subscribe, () => brush.get().drawing, () => true)
}

export function BrushDrawer({ active }: { active: boolean }) {
  const { gl, camera, scene } = useThree()
  const group = useRef<THREE.Group>(null)
  const inst = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => new THREE.SphereGeometry(1, 20, 14), [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e9e4dc", roughness: 0.45 }), [])
  const st = useRef<{
    on: boolean
    pts: number[]
    n: THREE.Vector3
    plane: THREE.Plane
    sm: THREE.Vector3 | null
    count: number
    waitMesh: boolean
  }>({ on: false, pts: [], n: new THREE.Vector3(), plane: new THREE.Plane(), sm: null, count: 0, waitMesh: false })

  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat])

  useEffect(() => {
    if (!active) return
    const el = gl.domElement
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const inv = new THREE.Matrix4()
    const hit = new THREE.Vector3()
    const tmp = new THREE.Vector3()
    const m4 = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const zAxis = new THREE.Vector3(0, 0, 1)
    const scl = new THREE.Vector3()

    const setRay = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
    }
    const toLocal = (v: THREE.Vector3) => {
      inv.copy(group.current!.matrixWorld).invert()
      return v.applyMatrix4(inv)
    }
    const radius = (e: PointerEvent) => {
      const s = brush.get().settings
      const p = e.pointerType === "pen" && e.pressure > 0 ? 0.25 + e.pressure * 1.1 : 1
      return s.size * p
    }
    const putInstance = (i: number, x: number, y: number, z: number, r: number) => {
      const s = st.current
      const puff = brush.get().settings.puff
      q.setFromUnitVectors(zAxis, s.n)
      m4.compose(tmp.set(x, y, z), q, scl.set(r, r, r * puff))
      inst.current!.setMatrixAt(i, m4)
    }
    const addPoint = (p: THREE.Vector3, r: number) => {
      const s = st.current
      const n = s.pts.length / 4
      if (n >= MAX) return
      s.pts.push(p.x, p.y, p.z, r)
      putInstance(n, p.x, p.y, p.z, r)
      inst.current!.count = n + 1
      inst.current!.instanceMatrix.needsUpdate = true
      inst.current!.visible = true
    }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !brush.get().drawing || !group.current || !inst.current) return
      e.preventDefault()
      e.stopPropagation()
      el.setPointerCapture?.(e.pointerId)
      setRay(e)
      const camDir = camera.getWorldDirection(new THREE.Vector3())
      // start on the paint under the cursor, otherwise on the plane through the shape's centre
      let start: THREE.Vector3 | null = null
      const target = scene.getObjectByName("inflated-geometry") as THREE.Mesh | undefined
      if (target && brush.get().strokes.length) {
        const h = ray.intersectObject(target, false)[0]
        if (h) start = h.point.clone()
      }
      if (!start) {
        const c = new THREE.Vector3().setFromMatrixPosition(group.current.matrixWorld)
        st.current.plane.setFromNormalAndCoplanarPoint(camDir, c)
      } else st.current.plane.setFromNormalAndCoplanarPoint(camDir, start)
      if (!ray.ray.intersectPlane(st.current.plane, hit)) return
      // plane normal in local space
      inv.copy(group.current.matrixWorld).invert()
      st.current.n.copy(camDir).negate().transformDirection(inv)
      st.current.on = true
      st.current.pts = []
      st.current.waitMesh = false
      st.current.sm = hit.clone()
      addPoint(toLocal(hit.clone()), radius(e))
    }
    const onMove = (e: PointerEvent) => {
      const s = st.current
      if (!s.on || !s.sm) return
      setRay(e)
      if (!ray.ray.intersectPlane(s.plane, hit)) return
      // steady the hand: the pen pulls a point on a string
      const k = 1 - brush.get().settings.smooth * 0.88
      s.sm.lerp(hit, k)
      const p = toLocal(s.sm.clone())
      const n = s.pts.length
      const r = radius(e)
      const lx = s.pts[n - 4], ly = s.pts[n - 3], lz = s.pts[n - 2]
      const d = Math.hypot(p.x - lx, p.y - ly, p.z - lz)
      const step = Math.max(r * 0.3, 0.004)
      if (d < step) return
      // fill long jumps so the bead stays continuous
      const parts = Math.min(40, Math.floor(d / step))
      for (let i = 1; i <= parts; i++) {
        const t = i / parts
        addPoint(tmp.set(lx + (p.x - lx) * t, ly + (p.y - ly) * t, lz + (p.z - lz) * t).clone(), r)
      }
    }
    const onUp = () => {
      const s = st.current
      if (!s.on) return
      s.on = false
      const pts = s.pts
      const cnt = pts.length / 4
      if (!cnt) return
      // taper: thinner ends over ~4 radii of arc length
      const taper = brush.get().settings.taper
      if (taper > 0 && cnt > 2) {
        const arc = [0]
        for (let i = 1; i < cnt; i++) arc.push(arc[i - 1] + Math.hypot(pts[i * 4] - pts[i * 4 - 4], pts[i * 4 + 1] - pts[i * 4 - 3], pts[i * 4 + 2] - pts[i * 4 - 2]))
        const L = arc[cnt - 1]
        for (let i = 0; i < cnt; i++) {
          const r = pts[i * 4 + 3]
          const len = Math.min(L * 0.45, r * 4)
          const e = Math.min(arc[i], L - arc[i])
          const f = len > 0 ? Math.min(1, e / len) : 1
          const sm = f * f * (3 - 2 * f)
          pts[i * 4 + 3] = r * (1 - taper * 0.65 * (1 - sm))
          putInstance(i, pts[i * 4], pts[i * 4 + 1], pts[i * 4 + 2], pts[i * 4 + 3])
        }
        inst.current!.instanceMatrix.needsUpdate = true
      }
      s.waitMesh = true
      brush.addStroke({ p: pts.map((v) => Math.round(v * 1e5) / 1e5), n: [s.n.x, s.n.y, s.n.z] })
    }
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault()
        if (e.shiftKey) brush.redoStroke()
        else brush.undo()
      }
      if (e.code === "Space" && !e.repeat && e.type === "keydown") {
        e.preventDefault()
        spaceOrbit = brush.get().drawing
        if (spaceOrbit) brush.setDrawing(false)
      }
    }
    let spaceOrbit = false
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && spaceOrbit) {
        spaceOrbit = false
        brush.setDrawing(true)
      }
    }
    el.addEventListener("pointerdown", onDown)
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    window.addEventListener("keydown", onKey)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      el.removeEventListener("pointerdown", onDown)
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("keyup", onKeyUp)
      el.style.cursor = ""
    }
  }, [active, gl, camera, scene])

  // cursor + hide the preview once the merged mesh has arrived
  const cursor = useRef("")
  useFrame(() => {
    const s = st.current
    const b = brush.get()
    const c = active ? (b.drawing ? "crosshair" : "grab") : ""
    if (c !== cursor.current) {
      cursor.current = c
      gl.domElement.style.cursor = c
    }
    if (s.waitMesh && !b.busy && inst.current) {
      s.waitMesh = false
      inst.current.count = 0
      inst.current.visible = false
    }
  })

  return (
    <group ref={group}>
      <instancedMesh ref={inst} args={[geo, mat, MAX]} count={0} visible={false} frustumCulled={false} />
    </group>
  )
}
