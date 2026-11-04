/* Knopika UI sounds: synthesized clicks, blips and swooshes (an original, Switch-like feel).
   Nothing is downloaded — everything is generated with WebAudio on demand. */

type Snd = {
  tap: () => void
  on: () => void
  off: () => void
  pick: (i?: number) => void
  open: () => void
  close: () => void
  tick: (v: number) => void
}

let ctx: AudioContext | null = null
let master: GainNode | null = null
let enabled = true
let last = 0

function ac() {
  if (typeof window === "undefined") return null
  // browsers only allow audio after a user gesture; don't create a context before that
  if ((navigator as any).userActivation && !(navigator as any).userActivation.hasBeenActive) return null
  if (!ctx) {
    const C = window.AudioContext || (window as any).webkitAudioContext
    if (!C) return null
    ctx = new C()
    master = ctx.createGain()
    master.gain.value = 0.5
    const comp = ctx.createDynamicsCompressor()
    master.connect(comp)
    comp.connect(ctx.destination)
  }
  if (ctx.state === "suspended") ctx.resume()
  return ctx
}

function tone(f0: number, f1: number, dur: number, type: OscillatorType = "sine", vol = 0.2, delay = 0) {
  const c = ac()
  if (!c || !enabled || !master) return
  const t = c.currentTime + delay
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g)
  g.connect(master)
  o.start(t)
  o.stop(t + dur + 0.02)
}

function click(vol = 0.25, hp = 2500) {
  const c = ac()
  if (!c || !enabled || !master) return
  const n = Math.floor(c.sampleRate * 0.012)
  const b = c.createBuffer(1, n, c.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4)
  const s = c.createBufferSource()
  const f = c.createBiquadFilter()
  const g = c.createGain()
  f.type = "highpass"
  f.frequency.value = hp
  g.gain.value = vol
  s.buffer = b
  s.connect(f)
  f.connect(g)
  g.connect(master)
  s.start(c.currentTime)
}

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26]

export const UISound: Snd = {
  tap: () => {
    click(0.18, 3000)
    tone(1400, 1100, 0.045, "sine", 0.08)
  },
  on: () => {
    click(0.2, 2500)
    tone(880, 880, 0.06, "triangle", 0.12)
    tone(1320, 1320, 0.09, "triangle", 0.12, 0.055)
  },
  off: () => {
    click(0.2, 2500)
    tone(1100, 1100, 0.06, "triangle", 0.11)
    tone(740, 740, 0.09, "triangle", 0.1, 0.055)
  },
  pick: (i = 0) => {
    const f = 523.25 * Math.pow(2, SCALE[i % SCALE.length] / 12)
    click(0.15, 3500)
    tone(f, f, 0.16, "sine", 0.16)
    tone(f * 2, f * 2, 0.08, "triangle", 0.04)
  },
  open: () => {
    tone(420, 980, 0.14, "sine", 0.13)
    click(0.12, 4000)
    tone(1320, 1320, 0.07, "triangle", 0.06, 0.11)
  },
  close: () => {
    tone(900, 380, 0.13, "sine", 0.11)
    click(0.1, 3000)
  },
  tick: (v: number) => {
    const t = performance.now()
    if (t - last < 45) return
    last = t
    tone(600 + v * 900, 600 + v * 900, 0.025, "square", 0.025)
  },
}

export function setSoundEnabled(on: boolean) {
  enabled = on
}

/** Wires sounds to a UI root by delegation: taps, group picks, toggles, sliders, panels and gizmo drags.
    Returns a cleanup function. */
export function installUISounds(root: HTMLElement, soundButton: () => HTMLElement | null) {
  const isGroupBtn = (b: Element) => b.getAttribute("role") === "radio" || !!b.closest(".tray-shapes,.mat-sw,.tgrounds,.kk-row:has(> .bgdot),.gaxis,.modes,#modes")

  const onDown = (e: PointerEvent) => {
    const b = (e.target as HTMLElement).closest("button,.bgdot,a.kk-ibtn,.kk-drop") as HTMLElement | null
    if (!b || !root.contains(b) || b === soundButton()) return
    if (b.closest(".sun-giz2")) return
    if (b.hasAttribute("aria-pressed") && !isGroupBtn(b)) return // toggles: handled by the observer
    if (b.matches(".kk-switch")) return
    if (isGroupBtn(b)) {
      const item = (b.closest(".kk-tile") as HTMLElement) || b
      const sibs = Array.from(item.parentElement?.children || [])
      UISound.pick(Math.max(0, sibs.indexOf(item)))
      return
    }
    UISound.tap()
  }
  const onInput = (e: Event) => {
    const el = e.target as HTMLInputElement
    if (el.type !== "range") return
    const v = (+el.value - +el.min) / (+el.max - +el.min || 1)
    UISound.tick(v)
  }
  const onMove = (e: PointerEvent) => {
    const el = (e.target as HTMLElement).closest(".sun-giz2") as HTMLElement | null
    if (el && el.hasPointerCapture?.(e.pointerId)) UISound.tick((e.clientX % 400) / 400)
  }
  const mo = new MutationObserver((list) => {
    list.forEach((m) => {
      if (m.type === "attributes") {
        const el = m.target as HTMLElement
        if (el === soundButton() || isGroupBtn(el)) return
        const now = el.getAttribute(m.attributeName!) === "true"
        const was = m.oldValue === "true"
        if (now !== was) (now ? UISound.on : UISound.off)()
      } else {
        const isPanel = (n: Node) => n instanceof HTMLElement && n.classList.contains("kk-panel")
        if (Array.from(m.addedNodes).some(isPanel)) UISound.open()
        else if (Array.from(m.removedNodes).some(isPanel)) UISound.close()
      }
    })
  })
  mo.observe(root, { subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ["aria-pressed"] })
  root.addEventListener("pointerdown", onDown, true)
  root.addEventListener("input", onInput, true)
  root.addEventListener("pointermove", onMove, true)
  return () => {
    mo.disconnect()
    root.removeEventListener("pointerdown", onDown, true)
    root.removeEventListener("input", onInput, true)
    root.removeEventListener("pointermove", onMove, true)
  }
}
