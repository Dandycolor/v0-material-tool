"use client"

/* Custom HDRI in the 3D view: rasterise the light studio, PMREM it, use it as scene.environment.
   HighlightPicker: "place highlight" — click on the model and the selected light moves to the
   direction that reflects into the eye at that point (the KeyShot trick). */

import { useEffect, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { customEnv, rasterEnv, lonLatFromDir, ENV_W, ENV_H, useCustomEnv } from "@/lib/custom-env"

export function CustomEnvironment({ rotation = 0 }: { rotation?: number }) {
  const { gl, scene } = useThree()
  const { env } = useCustomEnv()
  const pmrem = useRef<THREE.PMREMGenerator | null>(null)
  const rt = useRef<THREE.WebGLRenderTarget | null>(null)
  const tex = useRef<THREE.DataTexture | null>(null)
  const dirty = useRef(true)
  const rotRef = useRef(0)

  useEffect(() => {
    pmrem.current = new THREE.PMREMGenerator(gl)
    const data = new Float32Array(ENV_W * ENV_H * 4)
    const t = new THREE.DataTexture(data, ENV_W, ENV_H, THREE.RGBAFormat, THREE.FloatType)
    t.mapping = THREE.EquirectangularReflectionMapping
    t.colorSpace = THREE.LinearSRGBColorSpace
    t.magFilter = THREE.LinearFilter
    t.minFilter = THREE.LinearFilter
    t.generateMipmaps = false
    tex.current = t
    dirty.current = true
    return () => {
      if (rt.current && scene.environment === rt.current.texture) scene.environment = null
      rt.current?.dispose()
      rt.current = null
      t.dispose()
      pmrem.current?.dispose()
      pmrem.current = null
    }
  }, [gl, scene])

  useEffect(() => {
    dirty.current = true
  }, [env])
  rotRef.current = ((env.rotation * Math.PI) / 180) + rotation

  // rebuild at most once per frame, only when something changed
  useFrame(() => {
    if (scene.environmentRotation.y !== rotRef.current) scene.environmentRotation.set(0, rotRef.current, 0)
    if (!dirty.current || !pmrem.current || !tex.current) {
      if (rt.current && scene.environment !== rt.current.texture) scene.environment = rt.current.texture
      return
    }
    dirty.current = false
    ;(tex.current.image.data as Float32Array).set(rasterEnv(customEnv.get().env))
    tex.current.needsUpdate = true
    const next = pmrem.current.fromEquirectangular(tex.current)
    const old = rt.current
    rt.current = next
    scene.environment = next.texture
    old?.dispose()
  }, -1)

  return null
}

export function HighlightPicker({ rotation = 0 }: { rotation?: number }) {
  const { gl, camera, scene } = useThree()
  const { picking, env } = useCustomEnv()
  const rotRef = useRef(0)
  rotRef.current = ((env.rotation * Math.PI) / 180) + rotation

  useEffect(() => {
    if (!picking) return
    const el = gl.domElement
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const nm = new THREE.Matrix3()
    let dragging = false
    const place = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      const targets: THREE.Object3D[] = []
      scene.traverse((o: any) => {
        if (o.isMesh && o.visible && !o.userData.kkHelper && !o.isInstancedMesh && o.geometry?.attributes?.position) targets.push(o)
      })
      const hits = ray.intersectObjects(targets, false)
      const hit = hits.find((h) => h.face)
      if (!hit || !hit.face) return false
      const n = hit.face.normal.clone().applyMatrix3(nm.getNormalMatrix(hit.object.matrixWorld)).normalize()
      const v = hit.point.clone().sub(ray.ray.origin).normalize()
      if (n.dot(v) > 0) n.negate()
      const refl = v.clone().sub(n.clone().multiplyScalar(2 * v.dot(n)))
      // into environment space (the environment is rotated about Y)
      refl.applyAxisAngle(new THREE.Vector3(0, 1, 0), -rotRef.current)
      const [lon, lat] = lonLatFromDir(refl.x, refl.y, refl.z)
      const s = customEnv.get()
      const id = s.selected ?? customEnv.addLight()
      customEnv.setLight(id, { lon: Math.round(lon * 10) / 10, lat: Math.round(lat * 10) / 10, on: true })
      return true
    }
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      if (place(e)) {
        dragging = true
        e.preventDefault()
        e.stopPropagation()
        el.setPointerCapture?.(e.pointerId)
      }
    }
    const move = (e: PointerEvent) => {
      if (dragging) place(e)
    }
    const up = () => (dragging = false)
    const key = (e: KeyboardEvent) => e.key === "Escape" && customEnv.setPicking(false)
    el.addEventListener("pointerdown", down, { capture: true })
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    window.addEventListener("keydown", key)
    el.style.cursor = "crosshair"
    return () => {
      el.removeEventListener("pointerdown", down, { capture: true } as any)
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      window.removeEventListener("keydown", key)
      el.style.cursor = ""
    }
  }, [picking, gl, camera, scene])
  return null
}

/** orbit is paused while placing highlights (so a drag moves the light, not the camera) */
export function useHighlightPicking() {
  return useCustomEnv().picking
}
