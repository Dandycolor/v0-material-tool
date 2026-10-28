"use client"

/* Knopika React primitives. Markup and class names match the Knopika design-system bundle
   (kk-* classes in app/knopika.css), so Classic / Expressive / Block styles apply unchanged. */

import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react"
import { ICONS, IX, SHAPES } from "@/lib/knopika/icons"

export const IconWeightContext = createContext(3)

export function Icon({ name, className = "" }: { name: string; className?: string }) {
  const w = useContext(IconWeightContext)
  const ix = IX[name]
  if (ix)
    return (
      <svg className={`kk-icon kk-icon--ix ${className}`} viewBox="0 0 24 24" aria-hidden="true">
        <path d={ix[Math.max(0, Math.min(6, w))]} />
      </svg>
    )
  return (
    <svg
      className={`kk-icon ${className}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[name] || ICONS.circle }}
    />
  )
}

export function Shape({ name }: { name: string }) {
  return <svg className="kk-shape" viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SHAPES[name] || SHAPES.square }} />
}

type BtnProps = {
  icon: string
  label: string
  on?: boolean
  onClick?: () => void
  variant?: "panel" | "ground"
  size?: "sm" | "md"
  className?: string
  title?: string
  pressed?: boolean
}
export function IconButton({ icon, label, on, onClick, variant = "panel", size = "md", className = "", title, pressed }: BtnProps) {
  return (
    <button
      type="button"
      className={`kk-ibtn ${variant === "ground" ? "kk-ibtn--ground" : ""} ${size === "sm" ? "kk-ibtn--sm" : ""} ${on ? "is-on" : ""} ${className}`}
      aria-label={label}
      title={title ?? label}
      aria-pressed={pressed}
      onClick={onClick}
    >
      <Icon name={icon} />
    </button>
  )
}

const fmtDefault = (v: number, step: number) => (step < 1 ? v.toFixed(step < 0.1 ? 2 : 1) : String(Math.round(v)))

type RangeProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  ink?: boolean
  format?: (v: number) => string
  style?: CSSProperties
}
/** Slider: the wrapper carries --p so Expressive (wave) and Block (tile) variants render from the same markup. */
export function Range({ label, value, min, max, step = 1, onChange, ink, format, style }: RangeProps) {
  const p = `${(((value - min) / (max - min || 1)) * 100).toFixed(2)}%`
  const f = format ? format(value) : fmtDefault(value, step)
  return (
    <span className="kk-rwrap" style={{ ["--p" as string]: p, ...style }}>
      <span className="kk-rwave" />
      <span className="kk-rfill" />
      <span className="kk-rlabel">
        <b>{label}</b>
        <i>{f}</i>
      </span>
      <input
        className={`kk-range ${ink ? "kk-range--ink" : ""}`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        style={{ ["--p" as string]: p }}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </span>
  )
}

/** Labelled slider row: icon · label · value, track underneath. */
export function Field({ icon, hint, ...r }: RangeProps & { icon: string; hint?: string }) {
  const f = r.format ? r.format(r.value) : fmtDefault(r.value, r.step ?? 1)
  return (
    <div className="frow" title={hint}>
      <span>
        <Icon name={icon} />
      </span>
      <div className="top">
        <span>{r.label}</span>
        <b>{f}</b>
      </div>
      <Range {...r} />
    </div>
  )
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" className="kk-switch" aria-pressed={on} aria-label={label} onClick={() => onChange(!on)} />
}

export function SwitchRow({ title, desc, on, onChange }: { title: string; desc?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="mcap">
      <div className="kk-switchrow">
        <b>{title}</b>
        <Switch on={on} onChange={onChange} label={title} />
      </div>
      {desc && <p className="kk-desc">{desc}</p>}
    </div>
  )
}

/** Colour field: native swatch · caption · HEX capsule (accepts typing). */
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [txt, setTxt] = useState(value.replace("#", ""))
  useEffect(() => setTxt(value.replace("#", "")), [value])
  return (
    <label className="kk-colorfield">
      <input type="color" value={value} aria-label={label} onChange={(e) => onChange(e.target.value)} />
      <span>{label}</span>
      <span className="kk-hex">
        <i>#</i>
        <input
          type="text"
          value={txt}
          maxLength={7}
          spellCheck={false}
          pattern="#?[0-9a-fA-F]{6}"
          aria-label={`${label} HEX`}
          onChange={(e) => {
            const v = e.target.value.replace("#", "")
            setTxt(v)
            if (/^[0-9a-fA-F]{6}$/.test(v)) onChange(`#${v.toLowerCase()}`)
          }}
        />
      </span>
    </label>
  )
}

/** Connected segmented group of pills (single choice). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className = "",
}: {
  value: T
  options: { v: T; label: ReactNode; title?: string }[]
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={`tseg kk-btngroup ${className}`} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          title={o.title}
          className={`kk-pill ${value === o.v ? "is-on" : ""}`}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function PanelHead({ eyebrow, children }: { eyebrow: ReactNode; children?: ReactNode }) {
  return (
    <div className="kk-row kk-row--between phead">
      <div style={{ minWidth: 0 }} className="kk-eyebrow">
        {eyebrow}
      </div>
      <div className="kk-row" style={{ gap: 4 }}>
        {children}
      </div>
    </div>
  )
}

export function Caption({ title, desc }: { title: ReactNode; desc?: ReactNode }) {
  return (
    <div className="mcap">
      <b>{title}</b>
      {desc && <p className="kk-desc">{desc}</p>}
    </div>
  )
}

/** Image / colour tile for presets and textures. */
export function Tile({
  on,
  onClick,
  title,
  image,
  color,
  round,
  children,
}: {
  on?: boolean
  onClick: () => void
  title: string
  image?: string
  color?: string
  round?: boolean
  children?: ReactNode
}) {
  const bg = image ? `center / cover no-repeat url("${image}")` : color
  return (
    <span className="kk-tile">
      <button
        type="button"
        className={`kk-swatch ${on ? "is-on" : ""} ${round ? "is-round" : ""}`}
        style={{ ["--c" as string]: bg }}
        title={title}
        aria-label={title}
        aria-pressed={!!on}
        onClick={onClick}
      >
        {children}
      </button>
    </span>
  )
}
