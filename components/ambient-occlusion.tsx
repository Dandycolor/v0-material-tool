"use client"

/* Ambient occlusion (N8AO, screen space): darkens creases, window recesses, the feet of columns —
   wherever little ambient light can reach. Takes over rendering while on: scene (tone mapped as usual) →
   N8AO → screen. PNG export renders through the same chain (see renderFrame). */

import { useEffect, useMemo } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { EffectComposer, RenderPass } from "postprocessing"
import { N8AOPostPass } from "n8ao"

export interface AOSettings {
  enabled: boolean
  intensity: number // 0…6
  radius: number // world units (the scene is ≈ 2 units across)
  falloff: number // 0.1…2
}
export const AO_DEFAULT: AOSettings = { enabled: false, intensity: 3.5, radius: 0.35, falloff: 0.6 }

/** three tone-maps and sRGB-encodes only for the screen or an XR target (whose texture colour space
    is the output space) — make a buffer pose as one */
function asScreen(t: any) {
  if (!t) return
  t.isXRRenderTarget = true
  t.texture.colorSpace = THREE.SRGBColorSpace
}

/** export hook: render one frame the way the screen does (with AO when it is on) */
let aoRender: (() => void) | null = null
export function renderFrame(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  if (aoRender) aoRender()
  else gl.render(scene, camera)
}

export function AmbientOcclusion({ settings }: { settings: AOSettings }) {
  if (!settings.enabled) return null
  return <AOChain settings={settings} />
}

function AOChain({ settings }: { settings: AOSettings }) {
  const { gl, scene, camera, size } = useThree()
  const dpr = useThree((s) => s.viewport.dpr)
  const chain = useMemo(() => {
    const composer = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: 4 })
    composer.addPass(new RenderPass(scene, camera))
    const w = Math.floor(size.width * dpr), h = Math.floor(size.height * dpr)
    const ao = new N8AOPostPass(scene, camera, w, h)
    ao.configuration.gammaCorrection = false
    ao.configuration.halfRes = false
    ao.configuration.aoSamples = 16
    ao.configuration.denoiseSamples = 8
    ao.configuration.denoiseRadius = 12
    composer.addPass(ao)
    // render the scene display-ready (tone mapped + sRGB, exactly like the normal path): three only
    // does that for the screen or an XR target, so the composer's buffers pose as one. The background
    // and dots then look identical, and AO darkens the final colours.
    composer.setSize(size.width, size.height, false)
    asScreen(composer.inputBuffer)
    asScreen(composer.outputBuffer)
    return { composer, ao }
    // rebuilt (not resized) on any size / pixel-ratio / camera change: resizing a live N8AO chain
    // left its AO buffers out of step with the image (a shifted, scaled "ghost" of the model)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera, size.width, size.height, dpr])

  // the composer switches the renderer's autoClear off; put it back when AO goes off, otherwise the
  // normal render never clears and the last AO frame stays "frozen" under the new one
  useEffect(
    () => () => {
      chain.composer.dispose()
      gl.autoClear = true
      gl.setRenderTarget(null)
      gl.clear()
    },
    [chain, gl],
  )
  useEffect(() => {
    const c = chain.ao.configuration
    c.intensity = settings.intensity
    c.aoRadius = settings.radius
    c.distanceFalloff = settings.falloff
    c.color = new THREE.Color(0, 0, 0)
  }, [chain, settings.intensity, settings.radius, settings.falloff])

  useEffect(() => {
    aoRender = () => chain.composer.render()
    return () => {
      aoRender = null
    }
  }, [chain])

  // priority 1: this frame callback renders instead of the default render
  useFrame((_, delta) => chain.composer.render(delta), 1)
  return null
}
