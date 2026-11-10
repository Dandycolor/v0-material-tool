"use client"

/* Inflate (sketch) input: draw right in the 3D view on the shape's XY plane.
   - a stroke that ends near its start closes into a filled shape (a ring shows when it will snap)
   - open strokes become bands of the current width
   - steadied input, live line preview until the inflated mesh arrives
   - ring cursor = band width; Space held = orbit; Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z redo */

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { Line2 } from "three/examples/jsm/lines/Line2.js"
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js"
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js"
import { sketch } from "@/lib/sketch/store"

const MAXP = 8000

export function SketchGeometry() {
  const geo = useSyncExternalStore(sketch.subscribe, () => sketch.get().geometry, () => sketch.get().geometry)
  return <primitive object={geo} attach="geometry" />
}
export function useSketchDrawing() {
  return useSyncExternalStore(sketch.subscribe, () => sketch.get().drawing, () => true)
}

const closeDist = (w: number) => Math.max(0.07, w * 1.6)

export function SketchDrawer({ active, dark = false }: { active: boolean; dark?: boolean }) {
  const { gl, camera } = useThree()
  const group = useRef<THREE.Group>(null)
  // stroke preview: a fat screen-space line (2.5 px) in the theme's ink colour
  const line = useMemo(() => {
    const m = new LineMaterial({ color: 0x111111, linewidth: 2.5, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false })
    const l = new Line2(new LineGeometry(), m)
    l.userData.kkHelper = true
    l.userData.ownMat = m
    l.renderOrder = 999
    l.frustumCulled = false
    l.visible = false
    return l
  }, [])
  const lineDirty = useRef(false)
  const mk = (g: THREE.BufferGeometry, color: string, opacity: number) => {
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, side: THREE.DoubleSide }))
    m.userData.kkHelper = true
    m.userData.ownMat = m.material
    m.renderOrder = 999
    return m
  }
  const cursor = useMemo(() => [mk(new THREE.CircleGeometry(1, 48), "#ffffff", 0.18), mk(new THREE.RingGeometry(0.9, 1, 64), "#111111", 0.85)], [])
  const snap = useMemo(() => mk(new THREE.RingGeometry(0.8, 1, 48), "#2bd47a", 0.95), [])
  // ink / paper follow the background: light lines on a dark ground and the other way round
  useEffect(() => {
    const ink = dark ? 0xf4f1ec : 0x111111
    const paper = dark ? 0x111111 : 0xffffff
    // (own materials, never whatever the mesh happens to wear)
    ;(line.userData.ownMat as LineMaterial).color.setHex(ink)
    ;(cursor[0].userData.ownMat as THREE.MeshBasicMaterial).color.setHex(paper)
    ;(cursor[1].userData.ownMat as THREE.MeshBasicMaterial).color.setHex(ink)
  }, [dark, line, cursor])
  useEffect(
    () => () => {
      ;[line, ...cursor, snap].forEach((o: any) => (o.geometry.dispose(), (o.userData.ownMat || o.material).dispose()))
    },
    [line, cursor, snap],
  )
  const st = useRef({ on: false, pts: [] as number[], sm: null as THREE.Vector2 | null, waitMesh: false, hoverOn: false, hover: new THREE.Vector2(), near: false })
  const cursorGroup = useRef<THREE.Group>(null)

  useEffect(() => {
    if (!active) return
    const el = gl.domElement
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const inv = new THREE.Matrix4()
    const plane = new THREE.Plane()
    const hit = new THREE.Vector3()
    // pointer → local XY (z = 0) of the shape
    const toPlane = (e: PointerEvent, out: THREE.Vector2) => {
      const g = group.current
      if (!g) return false
      const r = el.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      inv.copy(g.matrixWorld).invert()
      const o = ray.ray.origin.clone().applyMatrix4(inv)
      const d = ray.ray.direction.clone().transformDirection(inv)
      plane.set(new THREE.Vector3(0, 0, 1), 0)
      if (!new THREE.Ray(o, d).intersectPlane(plane, hit)) return false
      out.set(hit.x, hit.y)
      return true
    }
    const push = (x: number, y: number) => {
      const s = st.current
      const n = s.pts.length / 2
      if (n >= MAXP - 1) return
      s.pts.push(x, y)
      lineDirty.current = true
    }
    const p2 = new THREE.Vector2()
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !sketch.get().drawing) return
      if (!toPlane(e, p2)) return
      e.preventDefault()
      e.stopPropagation()
      el.setPointerCapture?.(e.pointerId)
      const s = st.current
      s.on = true
      s.pts = []
      s.waitMesh = false
      s.near = false
      s.sm = p2.clone()
      push(p2.x, p2.y)
    }
    const onMove = (e: PointerEvent) => {
      const s = st.current
      const r = el.getBoundingClientRect()
      s.hoverOn = (e.target as Element) === el && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
      if (!toPlane(e, p2)) return
      if (!s.on || !s.sm) {
        s.hover.copy(p2)
        return
      }
      s.sm.lerp(p2, 1 - sketch.get().settings.steady * 0.85)
      s.hover.copy(s.sm)
      const n = s.pts.length
      const lx = s.pts[n - 2], ly = s.pts[n - 1]
      const step = Math.max(sketch.get().settings.width * 0.2, 0.006)
      if (Math.hypot(s.sm.x - lx, s.sm.y - ly) < step) return
      push(s.sm.x, s.sm.y)
      // will it close?
      const w = sketch.get().settings.width
      let L = 0
      for (let i = 2; i < s.pts.length; i += 2) L += Math.hypot(s.pts[i] - s.pts[i - 2], s.pts[i + 1] - s.pts[i - 1])
      s.near = L > closeDist(w) * 4 && Math.hypot(s.sm.x - s.pts[0], s.sm.y - s.pts[1]) < closeDist(w)
    }
    const onUp = () => {
      const s = st.current
      if (!s.on) return
      s.on = false
      const w = sketch.get().settings.width
      let pts = s.pts
      const closed = s.near
      if (closed) {
        // drop the tail that overlaps the start
        while (pts.length > 6 && Math.hypot(pts[pts.length - 2] - pts[0], pts[pts.length - 1] - pts[1]) < w * 0.4) pts = pts.slice(0, -2)
        s.pts = pts.concat([pts[0], pts[1]])
        lineDirty.current = true
      }
      s.near = false
      s.waitMesh = true
      sketch.addStroke({ p: pts.map((v) => Math.round(v * 1e5) / 1e5), closed, w })
    }
    let spaceOrbit = false
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault()
        if (e.shiftKey) sketch.redoStroke()
        else sketch.undo()
      }
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault()
        spaceOrbit = sketch.get().drawing
        if (spaceOrbit) sketch.setDrawing(false)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && spaceOrbit) {
        spaceOrbit = false
        sketch.setDrawing(true)
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
  }, [active, gl, camera, line])

  const cur = useRef("")
  useFrame(() => {
    const s = st.current
    const b = sketch.get()
    const c = active ? (b.drawing ? "crosshair" : "grab") : ""
    if (c !== cur.current) {
      cur.current = c
      gl.domElement.style.cursor = c
    }
    const cg = cursorGroup.current
    if (cg) {
      cg.visible = active && b.drawing && (s.hoverOn || s.on)
      cg.position.set(s.hover.x, s.hover.y, 0)
      cg.scale.setScalar(b.settings.width / 2)
    }
    snap.visible = active && s.on && s.near
    if (s.pts.length) snap.position.set(s.pts[0], s.pts[1], 0)
    snap.scale.setScalar(closeDist(b.settings.width))
    if (s.waitMesh && !b.busy) {
      s.waitMesh = false
      line.visible = false
    }
    if (lineDirty.current) {
      lineDirty.current = false
      const n = s.pts.length / 2
      if (n >= 2) {
        const xyz = new Float32Array(n * 3)
        for (let i = 0; i < n; i++) {
          xyz[i * 3] = s.pts[i * 2]
          xyz[i * 3 + 1] = s.pts[i * 2 + 1]
        }
        line.geometry.dispose()
        line.geometry = new LineGeometry()
        ;(line.geometry as LineGeometry).setPositions(xyz)
        line.computeLineDistances()
        line.visible = true
      }
    }
    if (!active && line.visible) line.visible = false
  })

  return (
    <group ref={group}>
      <primitive object={line} />
      <primitive object={snap} />
      <group ref={cursorGroup} visible={false}>
        {cursor.map((m, i) => (
          <primitive key={i} object={m} />
        ))}
      </group>
    </group>
  )
}
