"use client"

/* Post chain: ambient occlusion (N8AO), bloom and chromatic aberration.
   While any of them is on it takes over rendering: scene (tone mapped as usual) → [N8AO] →
   [bloom + chromatic aberration] → screen. PNG export renders through the same chain (renderFrame). */

import { useEffect, useMemo } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { EffectComposer, RenderPass, EffectPass, BloomEffect, ChromaticAberrationEffect } from "postprocessing"
import { N8AOPostPass } from "n8ao"

export interface AOSettings {
  enabled: boolean
  intensity: number // 0…6
  radius: number // world units (the scene is ≈ 2 units across)
  falloff: number // 0.1…2
  color: string // shadow colour (black = classic; a tint keeps colourful materials clean)
}
export const AO_DEFAULT: AOSettings = { enabled: false, intensity: 3.5, radius: 0.35, falloff: 0.6, color: "#000000" }

export interface PostSettings {
  bloom: boolean
  bloomIntensity: number // 0…3
  bloomThreshold: number // 0…1 (luminance that starts to glow)
  bloomRadius: number // 0…1
  chroma: boolean
  chromaAmount: number // 0…1
}
export const POST_DEFAULT: PostSettings = { bloom: false, bloomIntensity: 1, bloomThreshold: 0.45, bloomRadius: 0.6, chroma: false, chromaAmount: 0.3 }

/** three tone-maps and sRGB-encodes only for the screen or an XR target (whose texture colour space
    is the output space) — make a buffer pose as one */
function asScreen(t: any) {
  if (!t) return
  t.isXRRenderTarget = true
  t.texture.colorSpace = THREE.SRGBColorSpace
}

/** export hook: render one frame the way the screen does (with the post chain when it is on) */
let chainRender: (() => void) | null = null
export function renderFrame(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  if (chainRender) chainRender()
  else gl.render(scene, camera)
}

export function AmbientOcclusion({ settings, post = POST_DEFAULT }: { settings: AOSettings; post?: PostSettings }) {
  if (!settings.enabled && !post.bloom && !post.chroma) return null
  return <PostChain ao={settings} post={post} />
}


function PostChain({ ao: aoS, post }: { ao: AOSettings; post: PostSettings }) {
  const { gl, scene, camera, size } = useThree()
  const dpr = useThree((s) => s.viewport.dpr)
  const chain = useMemo(() => {
    const composer = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: 4 })
    composer.addPass(new RenderPass(scene, camera))
    let ao: N8AOPostPass | null = null
    if (aoS.enabled) {
      const w = Math.floor(size.width * dpr), h = Math.floor(size.height * dpr)
      ao = new N8AOPostPass(scene, camera, w, h)
      ao.configuration.gammaCorrection = false
      ao.configuration.halfRes = false
      // clean, not grainy: more samples, a tight depth-aware denoise, temporal accumulation while still
      ao.configuration.aoSamples = 32
      ao.configuration.denoiseSamples = 8
      ao.configuration.denoiseRadius = 5
      ao.configuration.denoiseIterations = 2
      ao.configuration.accumulate = true
      // ignore the tiny self-occlusion of bumpy surfaces (scans, normal-rich meshes) that reads as dirt
      ao.configuration.biasOffset = 0.02
      ao.configuration.biasMultiplier = 0.4
      composer.addPass(ao)
    }
    let bloom: BloomEffect | null = null
    let chroma: ChromaticAberrationEffect | null = null
    const effects = []
    if (post.bloom) {
      bloom = new BloomEffect({ mipmapBlur: true, luminanceSmoothing: 0.2 })
      effects.push(bloom)
    }
    if (post.chroma) {
      chroma = new ChromaticAberrationEffect({ radialModulation: true, modulationOffset: 0.25 })
      effects.push(chroma)
    }
    let fx: EffectPass | null = null
    if (effects.length) {
      fx = new EffectPass(camera, ...effects)
      composer.addPass(fx)
    }
    // render the scene display-ready (tone mapped + sRGB, like the normal path): three only does that
    // for the screen or an XR target, so the composer's buffers pose as one
    composer.setSize(size.width, size.height, false)
    asScreen(composer.inputBuffer)
    asScreen(composer.outputBuffer)
    return { composer, ao, bloom, chroma, fx }
    // rebuilt (not resized) on size / pixel-ratio / camera change and when a pass is switched
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera, size.width, size.height, dpr, aoS.enabled, post.bloom, post.chroma])

  // the composer switches the renderer's autoClear off; put it back when the chain goes away,
  // otherwise the normal render never clears and the last frame stays "frozen"
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
    if (!chain.ao) return
    const c = chain.ao.configuration
    c.intensity = aoS.intensity
    c.aoRadius = aoS.radius
    c.distanceFalloff = aoS.falloff
    // the chain works on display-ready (sRGB) values: pass the picked colour as-is
    c.color = new THREE.Color().set(aoS.color).convertLinearToSRGB()
  }, [chain, aoS.intensity, aoS.radius, aoS.falloff, aoS.color])
  useEffect(() => {
    if (chain.bloom) {
      chain.bloom.intensity = post.bloomIntensity
      chain.bloom.luminanceMaterial.threshold = post.bloomThreshold
      ;(chain.bloom as any).mipmapBlurPass.radius = 0.2 + post.bloomRadius * 0.75
    }
    if (chain.chroma) {
      const a = post.chromaAmount * 0.006
      chain.chroma.offset.set(a, a * 0.6)
    }
  }, [chain, post.bloomIntensity, post.bloomThreshold, post.bloomRadius, post.chromaAmount])

  useEffect(() => {
    chainRender = () => {
      if (chain.fx) chain.fx.fullscreenMaterial.encodeOutput = false
      chain.composer.render()
    }
    return () => {
      chainRender = null
    }
  }, [chain])

  // priority 1: this frame callback renders instead of the default render
  useFrame((_, delta) => {
    // the buffers already hold display (sRGB) values: no second encode at the end
    if (chain.fx) chain.fx.fullscreenMaterial.encodeOutput = false
    chain.composer.render(delta)
  }, 1)
  return null
}

