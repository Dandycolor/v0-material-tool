"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import type React from "react"
import useSWR from "swr"

import { PBRViewer, type PBRViewerRef } from "@/components/pbr-viewer"
import { Loader2 } from "lucide-react"
import { ModelSearch } from "@/components/model-search"
import { InflateCanvas } from "@/components/inflate-canvas"

// Knopika design system
import { Icon, IconButton, Range, Field, Switch, SwitchRow, ColorField, Segmented, PanelHead, Caption, Tile, IconWeightContext } from "@/components/knopika/kk"
import { LightRig } from "@/components/knopika/light-rig"
import { usePanelDrag } from "@/components/knopika/drag"
import { OrbitRig, RotatePanel } from "@/components/knopika/orbit-rig"
import { THEME_DEFAULT, GROUNDS, TUNER_ROWS, FONTS_DISPLAY, FONTS_UI, fmtRow, themeVars, exportCss, exportJson, type KnopikaTheme } from "@/lib/knopika/theme"
import { WEIGHTS } from "@/lib/knopika/icons"
import { BLOB_DEFAULT, type BlobSettings, type BlobBase } from "@/lib/blob"
import { LAYERED_DEFAULT, LAYERED_PALETTES, type LayeredSettings } from "@/lib/layered-material"
import { installUISounds, setSoundEnabled, UISound } from "@/lib/knopika/sounds"

interface IconifyIcon {
  id: string // format: "prefix:name" e.g. "mdi:flower"
  prefix: string
  name: string
  preview_url: string
}

interface IconSearchResponse {
  icons?: IconifyIcon[]
  error?: string
  total?: number
}

const SVG_PATHS = {
  // Basic shapes
  star: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M50 5 L61 39 L97 39 L68 61 L79 95 L50 73 L21 95 L32 61 L3 39 L39 39 Z" fill="black"/>
  </svg>`,
  heart: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M50 88 C20 60 5 40 5 25 C5 10 20 5 35 5 C45 5 50 15 50 15 C50 15 55 5 65 5 C80 5 95 10 95 25 C95 40 80 60 50 88 Z" fill="black"/>
  </svg>`,
  circle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="45" fill="black"/>
  </svg>`,
  square: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect x="10" y="10" width="80" height="80" fill="black"/>
  </svg>`,
  roundedSquare: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect x="10" y="10" width="80" height="80" rx="20" ry="20" fill="black"/>
  </svg>`,
  triangle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <polygon points="50,5 95,90 5,90" fill="black"/>
  </svg>`,
  diamond: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <polygon points="50,5 95,50 50,95 5,50" fill="black"/>
  </svg>`,
  hexagon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <polygon points="50,5 93,27.5 93,72.5 50,95 7,72.5 7,27.5" fill="black"/>
  </svg>`,
  pentagon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <polygon points="50,5 97,38 79,95 21,95 3,38" fill="black"/>
  </svg>`,
  octagon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <polygon points="30,5 70,5 95,30 95,70 70,95 30,95 5,70 5,30" fill="black"/>
  </svg>`,
  // Decorative shapes
  flower: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="25" r="18" fill="black"/>
    <circle cx="75" cy="40" r="18" fill="black"/>
    <circle cx="68" cy="70" r="18" fill="black"/>
    <circle cx="32" cy="70" r="18" fill="black"/>
    <circle cx="25" cy="40" r="18" fill="black"/>
    <circle cx="50" cy="50" r="15" fill="black"/>
  </svg>`,
  clover: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="25" r="20" fill="black"/>
    <circle cx="75" cy="50" r="20" fill="black"/>
    <circle cx="50" cy="75" r="20" fill="black"/>
    <circle cx="25" cy="50" r="20" fill="black"/>
  </svg>`,
  gear: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M50 10 L55 10 L58 20 L68 15 L72 19 L67 29 L77 32 L77 37 L67 40 L72 50 L77 53 L77 58 L67 61 L72 71 L68 75 L58 70 L55 80 L50 80 L45 80 L42 70 L32 75 L28 71 L33 61 L23 58 L23 53 L33 50 L28 40 L23 37 L23 32 L33 29 L28 19 L32 15 L42 20 L45 10 Z" fill="black"/>
    <circle cx="50" cy="50" r="15" fill="white"/>
  </svg>`,
  cross: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <polygon points="35,10 65,10 65,35 90,35 90,65 65,65 65,90 35,90 35,65 10,65 10,35 35,35" fill="black"/>
  </svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect x="40" y="10" width="20" height="80" fill="black"/>
    <rect x="10" y="40" width="80" height="20" fill="black"/>
  </svg>`,
  asterisk: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect x="45" y="10" width="10" height="80" fill="black"/>
    <rect x="45" y="10" width="10" height="80" fill="black" transform="rotate(60 50 50)"/>
    <rect x="45" y="10" width="10" height="80" fill="black" transform="rotate(120 50 50)"/>
  </svg>`,
  infinity: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M25 50 C25 35 35 30 45 35 C55 40 50 50 50 50 C50 50 55 60 65 55 C75 50 75 35 65 30 C55 25 45 35 45 50 C45 65 35 70 25 65 C15 60 15 45 25 40 C35 35 45 45 50 50" fill="none" stroke="black" strokeWidth="12" strokeLinecap="round"/>
  </svg>`,
  cloud: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="30" cy="60" r="20" fill="black"/>
    <circle cx="50" cy="45" r="25" fill="black"/>
    <circle cx="75" cy="55" r="18" fill="black"/>
    <rect x="25" y="55" width="55" height="25" fill="black"/>
  </svg>`,
  // Arrows and symbols
  arrow: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <polygon points="50,10 85,50 65,50 65,90 35,90 35,50 15,50" fill="black"/>
  </svg>`,
  chevron: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <polygon points="50,20 85,55 75,65 50,40 25,65 15,55" fill="black"/>
  </svg>`,
  bolt: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <polygon points="60,5 25,55 45,55 40,95 75,45 55,45" fill="black"/>
  </svg>`,
  // Complex shapes
  puzzle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M20 20 L45 20 C45 10 55 10 55 20 L80 20 L80 45 C90 45 90 55 80 55 L80 80 L55 80 C55 90 45 90 45 80 L20 80 L20 55 C10 55 10 45 20 45 Z" fill="black"/>
  </svg>`,
  shield: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M50 5 L90 20 L90 50 C90 75 50 95 50 95 C50 95 10 75 10 50 L10 20 Z" fill="black"/>
  </svg>`,
  badge: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <polygon points="50,5 61,35 95,35 68,55 79,85 50,68 21,85 32,55 5,35 39,35" fill="black"/>
  </svg>`,
  moon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M70 15 C40 15 20 40 20 65 C20 85 40 95 60 95 C80 95 95 80 95 60 C95 45 85 35 75 30 C90 45 85 70 65 80 C45 90 25 75 25 55 C25 35 45 20 70 15 Z" fill="black"/>
  </svg>`,
  halfCircle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M10 50 A40 40 0 0 1 90 50 Z" fill="black"/>
  </svg>`,
  ring: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="45" fill="black"/>
    <circle cx="50" cy="50" r="25" fill="white"/>
  </svg>`,
  waves: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M5 35 Q25 20 50 35 Q75 50 95 35 L95 50 Q75 65 50 50 Q25 35 5 50 Z" fill="black"/>
    <path d="M5 55 Q25 40 50 55 Q75 70 95 55 L95 70 Q75 85 50 70 Q25 55 5 70 Z" fill="black"/>
  </svg>`,
  v0: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M20 20 L50 80 L80 20 M85 70 A15 15 0 1 1 85 40 A15 15 0 1 1 85 70" fill="none" stroke="black" strokeWidth="8"/>
  </svg>`,
}

const SHAPE_CATEGORIES = {
  basic: {
    name: "Basic",
    shapes: ["circle", "square", "roundedSquare", "triangle", "diamond", "hexagon", "pentagon", "octagon"],
  },
  decorative: {
    name: "Decorative",
    shapes: ["star", "heart", "flower", "clover", "gear", "cross", "plus", "asterisk", "cloud"],
  },
  symbols: {
    name: "Symbols",
    shapes: ["arrow", "chevron", "bolt", "infinity", "moon", "halfCircle", "ring", "waves"],
  },
  complex: {
    name: "Complex",
    shapes: ["puzzle", "shield", "badge", "v0"],
  },
}

const SHAPE_NAMES: Record<string, string> = {
  star: "Star",
  heart: "Heart",
  circle: "Circle",
  square: "Square",
  roundedSquare: "Rounded",
  triangle: "Triangle",
  diamond: "Diamond",
  hexagon: "Hexagon",
  pentagon: "Pentagon",
  octagon: "Octagon",
  flower: "Flower",
  clover: "Clover",
  gear: "Gear",
  cross: "Cross",
  plus: "Plus",
  asterisk: "Asterisk",
  infinity: "Infinity",
  cloud: "Cloud",
  arrow: "Arrow",
  chevron: "Chevron",
  bolt: "Bolt",
  puzzle: "Puzzle",
  shield: "Shield",
  badge: "Badge",
  moon: "Moon",
  halfCircle: "Half Circle",
  ring: "Ring",
  waves: "Waves",
  v0: "v0 Logo",
}

// Custom material color and texture options
const CUSTOM_COLORS = [
  { id: "white", name: "White", color: "#ffffff" },
  { id: "black", name: "Black", color: "#1a1a1a" },
  { id: "red", name: "Red", color: "#e63946" },
  { id: "orange", name: "Orange", color: "#f77f00" },
  { id: "yellow", name: "Yellow", color: "#fcbf49" },
  { id: "green", name: "Green", color: "#2a9d8f" },
  { id: "blue", name: "Blue", color: "#457b9d" },
  { id: "purple", name: "Purple", color: "#7b2cbf" },
]

const CUSTOM_TEXTURES = {
  normal: [
    { id: "normal-1", name: "Paint", url: "/images/custom/normal-1.jpg" },
    { id: "normal-2", name: "Smooth", url: "/images/custom/normal-2.jpg" },
    { id: "normal-3", name: "Drops", url: "/images/custom/normal-3.jpg" },
    { id: "normal-4", name: "Brushed", url: "/images/custom/normal-4.jpg" },
    { id: "normal-5", name: "Grid", url: "/images/custom/normal-5.jpg" },
    { id: "normal-6", name: "Crystals", url: "/images/custom/normal-6.jpg" },
    { id: "normal-7", name: "Waves", url: "/images/custom/normal-7.jpg" },
  ],
  roughness: [
    { id: "rough-1", name: "Smudges", url: "/images/custom/roughness-1.jpg" },
    { id: "rough-2", name: "Scratches", url: "/images/custom/roughness-2.jpg" },
    { id: "rough-3", name: "Matte", url: "/images/custom/roughness-3.jpg" },
    { id: "rough-4", name: "Glossy", url: "/images/custom/roughness-4.jpg" },
  ],
  metalness: [
    { id: "metal-1", name: "Fingerprints", url: "/images/custom/metalness-1.jpg" },
    { id: "metal-2", name: "Scratches", url: "/images/custom/metalness-2.jpg" },
    { id: "metal-3", name: "Dust", url: "/images/custom/metalness-3.jpg" },
    { id: "metal-4", name: "Clean", url: "/images/custom/metalness-4.jpg" },
  ],
}

const MATERIAL_PRESETS = {
  plastic: {
    name: "Scratched Plastic",
    baseColor: "/images/plastic017b-1k-jpg-color.jpg",
    normalMap: "/images/plastic017b-1k-jpg-normalgl.jpg",
    roughnessMap: "/images/plastic017b-1k-jpg-roughness.jpg",
    displacementMap: "/images/plastic017b-1k-jpg-displacement.jpg",
    metalnessMap: null,
    metalness: 0,
    roughness: 1,
    normalScale: 1,
    displacementScale: 0.1,
    defaultTint: "#00ff88",
    useHueShift: false,
    transmission: 0,
    ior: 1.5,
    thickness: 0.5,
    attenuationDistance: 2.0,
    attenuationColor: "#ffffff",
    clearcoat: 0,
    clearcoatRoughness: 0.1,
    clearcoatNormalScale: 1.0,
    glassColor: "#ffffff",
    glassColorIntensity: 0,
    iridescence: 0,
    iridescenceIOR: 1.3,
    iridescenceThicknessMin: 100,
    iridescenceThicknessMax: 400,
    reflectivity: 0.5,
    envMapIntensity: 1.0,
    normalRepeat: 1,
  },
  paint: {
    name: "Chipped Paint",
    baseColor: "/images/paint001-1k-jpg-color.jpg",
    normalMap: "/images/paint001-1k-jpg-normalgl.jpg",
    roughnessMap: "/images/paint001-1k-jpg-roughness.jpg",
    displacementMap: "/images/paint001-1k-jpg-displacement.jpg",
    aoMap: "/images/paint001-1k-jpg-ao.jpg",
    metalnessMap: null,
    metalness: 0,
    roughness: 0.8,
    normalScale: 1.0,
    displacementScale: 0.05,
    defaultTint: "#ff5722",
    useHueShift: true,
    transmission: 0,
    ior: 1.5,
    thickness: 0.5,
    attenuationDistance: 2.0,
    attenuationColor: "#ffffff",
    clearcoat: 0,
    clearcoatRoughness: 0.1,
    clearcoatNormalScale: 1.0,
    glassColor: "#ffffff",
    glassColorIntensity: 0,
    iridescence: 0,
    iridescenceIOR: 1.3,
    iridescenceThicknessMin: 100,
    iridescenceThicknessMax: 400,
    reflectivity: 0.5,
    envMapIntensity: 1.0,
    normalRepeat: 1,
  },
  sponge: {
    name: "Sponge",
    baseColor: "/images/sponge003-1k-jpg-color.jpg",
    normalMap: "/images/sponge003-1k-jpg-normalgl.jpg",
    roughnessMap: "/images/sponge003-1k-jpg-roughness.jpg",
    displacementMap: "/images/sponge003-1k-jpg-displacement.jpg",
    aoMap: "/images/sponge003-1k-jpg-ao.jpg",
    metalnessMap: null,
    metalness: 0,
    roughness: 0.9,
    normalScale: 1.2,
    displacementScale: 0.08,
    defaultTint: "#7ac943",
    useHueShift: true,
    transmission: 0,
    ior: 1.5,
    thickness: 0.5,
    attenuationDistance: 2.0,
    attenuationColor: "#ffffff",
    clearcoat: 0,
    clearcoatRoughness: 0.1,
    clearcoatNormalScale: 1.0,
    glassColor: "#ffffff",
    glassColorIntensity: 0,
    iridescence: 0,
    iridescenceIOR: 1.3,
    iridescenceThicknessMin: 100,
    iridescenceThicknessMax: 400,
    reflectivity: 0.5,
    envMapIntensity: 1.0,
    normalRepeat: 1,
  },
  // </CHANGE>
  tactilePaving: {
    name: "Tactile Paving",
    baseColor: "/images/tactilepaving003-1k-jpg-color.jpg",
    normalMap: "/images/tactilepaving003-1k-jpg-normalgl.jpg",
    roughnessMap: "/images/tactilepaving003-1k-jpg-roughness.jpg",
    displacementMap: "/images/tactilepaving003-1k-jpg-displacement.jpg",
    metalnessMap: null,
    metalness: 0,
    roughness: 0.7,
    normalScale: 1.5,
    displacementScale: 0.15,
    defaultTint: "#f4d03f",
    useHueShift: true,
    transmission: 0,
    ior: 1.5,
    thickness: 0.5,
    attenuationDistance: 2.0,
    attenuationColor: "#ffffff",
    clearcoat: 0,
    clearcoatRoughness: 0.1,
    clearcoatNormalScale: 1.0,
    glassColor: "#ffffff",
    glassColorIntensity: 0,
    iridescence: 0,
    iridescenceIOR: 1.3,
    iridescenceThicknessMin: 100,
    iridescenceThicknessMax: 400,
    reflectivity: 0.5,
    envMapIntensity: 1.0,
    normalRepeat: 1,
  },
  terrazzo: {
    name: "Terrazzo",
    baseColor: "/images/terrazzo-color.jpg",
    normalMap: "/images/terrazzo-normal.jpg",
    roughnessMap: "/images/terrazzo-roughness.jpg",
    displacementMap: "/images/terrazzo-displacement.jpg",
    metalnessMap: null,
    metalness: 0.1,
    roughness: 0.7,
    normalScale: 1,
    displacementScale: 0,
    defaultTint: "#ffffff",
    useHueShift: false,
    transmission: 0,
    ior: 1.5,
    thickness: 0.5,
    attenuationDistance: 2.0,
    attenuationColor: "#ffffff",
    clearcoat: 0,
    clearcoatRoughness: 0.1,
    clearcoatNormalScale: 1.0,
    glassColor: "#ffffff",
    glassColorIntensity: 0,
    iridescence: 0,
    iridescenceIOR: 1.3,
    iridescenceThicknessMin: 100,
    iridescenceThicknessMax: 400,
    reflectivity: 0.5,
    envMapIntensity: 1.0,
    normalRepeat: 1,
  },
  paintedMetal: {
    name: "Painted Metal",
    baseColor: "/images/painted-metal-color.jpg",
    normalMap: "/images/painted-metal-normal.jpg",
    roughnessMap: "/images/painted-metal-roughness.jpg",
    displacementMap: "/images/painted-metal-displacement.jpg",
    metalnessMap: "/images/painted-metal-metalness.jpg",
    metalness: 0.3,
    roughness: 0.8,
    normalScale: 0.5,
    displacementScale: 0,
    defaultTint: "#ffffff",
    useHueShift: true,
    transmission: 0,
    ior: 1.5,
    thickness: 0.5,
    attenuationDistance: 2.0,
    attenuationColor: "#ffffff",
    clearcoat: 0,
    clearcoatRoughness: 0.1,
    clearcoatNormalScale: 1.0,
    glassColor: "#ffffff",
    glassColorIntensity: 0,
    iridescence: 0,
    iridescenceIOR: 1.3,
    iridescenceThicknessMin: 100,
    iridescenceThicknessMax: 400,
    reflectivity: 0.5,
    envMapIntensity: 1.0,
    normalRepeat: 1,
  },
  glazedTerracotta: {
    name: "Glazed Terracotta",
    baseColor: "/images/glazed-terracotta-color.jpg",
    normalMap: "/images/glazed-terracotta-normal.jpg",
    roughnessMap: "/images/glazed-terracotta-roughness.jpg",
    displacementMap: "/images/glazed-terracotta-displacement.jpg",
    metalnessMap: null,
    metalness: 0.1,
    roughness: 0.6,
    normalScale: 0.8,
    displacementScale: 0,
    defaultTint: "#ffffff",
    useHueShift: true,
    transmission: 0,
    ior: 1.5,
    thickness: 0.5,
    attenuationDistance: 2.0,
    attenuationColor: "#ffffff",
    clearcoat: 0,
    clearcoatRoughness: 0.1,
    clearcoatNormalScale: 1.0,
    glassColor: "#ffffff",
    glassColorIntensity: 0,
    iridescence: 0,
    iridescenceIOR: 1.3,
    iridescenceThicknessMin: 100,
    iridescenceThicknessMax: 400,
    reflectivity: 0.5,
    envMapIntensity: 1.0,
    normalRepeat: 1,
  },
  goldenMetal: {
    name: "Golden Metal",
    baseColor: "/images/golden-metal-color.jpg",
    normalMap: "/images/golden-metal-normal.jpg",
    roughnessMap: "/images/golden-metal-roughness.jpg",
    displacementMap: "/images/golden-metal-displacement.jpg",
    metalnessMap: "/images/golden-metal-metalness.jpg",
    metalness: 1.0,
    roughness: 0.3,
    normalScale: 1.0,
    displacementScale: 0,
    defaultTint: "#ffffff",
    useHueShift: false,
    transmission: 0,
    ior: 1.5,
    thickness: 0.5,
    attenuationDistance: 2.0,
    attenuationColor: "#ffffff",
    clearcoat: 0,
    clearcoatRoughness: 0.1,
    clearcoatNormalScale: 1.0,
    glassColor: "#ffffff",
    glassColorIntensity: 0,
    iridescence: 0,
    iridescenceIOR: 1.3,
    iridescenceThicknessMin: 100,
    iridescenceThicknessMax: 400,
    reflectivity: 0.5,
    envMapIntensity: 1.0,
    normalRepeat: 1,
  },
  silverSteel: {
    name: "Silver Steel",
    baseColor: "/images/silver-steel-color.jpg",
    normalMap: "/images/silver-steel-normal.jpg",
    roughnessMap: "/images/silver-steel-roughness.jpg",
    displacementMap: "/images/silver-steel-displacement.jpg",
    metalnessMap: "/images/silver-steel-metalness.jpg",
    metalness: 1.0,
    roughness: 0.25,
    normalScale: 1.0,
    displacementScale: 0,
    defaultTint: "#ffffff",
    useHueShift: false,
    transmission: 0,
    ior: 1.5,
    thickness: 0.5,
    attenuationDistance: 2.0,
    attenuationColor: "#ffffff",
    clearcoat: 0,
    clearcoatRoughness: 0.1,
    clearcoatNormalScale: 1.0,
    glassColor: "#ffffff",
    glassColorIntensity: 0,
    iridescence: 0,
    iridescenceIOR: 1.3,
    iridescenceThicknessMin: 100,
    iridescenceThicknessMax: 400,
    reflectivity: 0.5,
    envMapIntensity: 1.0,
    normalRepeat: 1,
  },
  dirtyGlass: {
    name: "Dirty Glass",
    baseColor: null,
    normalMap: "/images/dirty-glass-normal.jpg",
    roughnessMap: "/images/dirty-glass-roughness.jpg",
    displacementMap: "/images/dirty-glass-height.jpg",
    metalnessMap: "/images/dirty-glass-metallic.jpg",
    opacityMap: "/images/dirty-glass-opacity.jpg",
    refractionMap: "/images/dirty-glass-refraction.jpg",
    reflectionMap: "/images/dirty-glass-reflection.jpg",
    refractionGlossinessMap: "/images/dirty-glass-refraction-glossiness.jpg",
    glossinessMap: "/images/dirty-glass-glossiness.jpg",
    emissiveMap: "/images/dirty-glass-emissive.jpg",
    diffuseMap: "/images/dirty-glass-diffuse.jpg",
    aoMap: "/images/dirty-glass-ao.jpg",
    invertedIORMap: "/images/dirty-glass-inverted-ior.jpg",
    metalness: 0,
    roughness: 0.1,
    normalScale: 1.0,
    displacementScale: 0,
    defaultTint: "#ffffff",
    useHueShift: false,
    transmission: 0.98,
    ior: 1.52,
    thickness: 0.5,
    attenuationDistance: 2.0,
    attenuationColor: "#ffffff",
    clearcoat: 0.5,
    clearcoatRoughness: 0.1,
    clearcoatNormalScale: 1.0,
    glassColor: "#ffffff",
    glassColorIntensity: 0,
    iridescence: 0,
    iridescenceIOR: 1.3,
    iridescenceThicknessMin: 100,
    iridescenceThicknessMax: 400,
    reflectivity: 0.5,
    envMapIntensity: 1.0,
    normalRepeat: 1,
  },
  scratchedGlass: {
    name: "Scratched Glass",
    baseColor: null,
    normalMap: "/images/scratched-glass-normal.jpg",
    roughnessMap: "/images/scratched-glass-roughness.jpg",
    displacementMap: "/images/scratched-glass-height.jpg",
    metalnessMap: "/images/scratched-glass-metallic.jpg",
    opacityMap: "/images/scratched-glass-opacity.jpg",
    refractionMap: "/images/scratched-glass-refraction.jpg",
    reflectionMap: "/images/scratched-glass-reflection.jpg",
    refractionGlossinessMap: "/images/scratched-glass-refraction-glossiness.jpg",
    glossinessMap: "/images/scratched-glass-glossiness.jpg",
    emissiveMap: "/images/scratched-glass-emissive.jpg",
    diffuseMap: "/images/scratched-glass-diffuse.jpg",
    aoMap: "/images/scratched-glass-ao.jpg",
    invertedIORMap: "/images/scratched-glass-inverted-ior.jpg",
    metalness: 0,
    roughness: 0.1,
    normalScale: 1.0,
    displacementScale: 0,
    defaultTint: "#ffffff",
    useHueShift: false,
    transmission: 0.98,
    ior: 1.52,
    thickness: 0.5,
    attenuationDistance: 2.0,
    attenuationColor: "#ffffff",
    clearcoat: 0.5,
    clearcoatRoughness: 0.1,
    clearcoatNormalScale: 1.0,
    glassColor: "#ffffff",
    glassColorIntensity: 0,
    iridescence: 0,
    iridescenceIOR: 1.3,
    iridescenceThicknessMin: 100,
    iridescenceThicknessMax: 400,
    reflectivity: 0.5,
    envMapIntensity: 1.0,
    normalRepeat: 1,
  },
  clearGlass: {
    name: "Clear Glass",
    baseColor: null,
    normalMap: "/images/plastic017b-1k-jpg-normalgl.jpg",
    roughnessMap: "/images/plastic017b-1k-jpg-roughness.jpg",
    displacementMap: null,
    metalnessMap: null,
    metalness: 0,
    roughness: 0.05,
    normalScale: 0.3,
    displacementScale: 0,
    defaultTint: "#ffffff",
    useHueShift: false,
    transmission: 1,
    ior: 1.5,
    thickness: 0.5,
    attenuationDistance: 100,
    attenuationColor: "#ffffff",
    clearcoat: 1,
    clearcoatRoughness: 0,
    clearcoatNormalScale: 1.0,
    glassColor: "#ffffff",
    glassColorIntensity: 0,
    iridescence: 0,
    iridescenceIOR: 1.3,
    iridescenceThicknessMin: 100,
    iridescenceThicknessMax: 400,
    reflectivity: 0.5,
    envMapIntensity: 1.5,
    normalRepeat: 1,
  },
}

const MATCAP_PRESETS = {
  kunzite: {
    name: "Kunzite",
    matcap: "/matcaps/kunzite.png",
  },
  pearl1: {
    name: "Pearl Iridescent",
    matcap: "/matcaps/pearl-1.png",
  },
  pearl2: {
    name: "Pearl Dark",
    matcap: "/matcaps/pearl-2.png",
  },
  pearl3: {
    name: "Pearl Soft",
    matcap: "/matcaps/pearl-3.png",
  },
  pearl4: {
    name: "Pearl Pink",
    matcap: "/matcaps/pearl-4.png",
  },
  negative: {
    name: "Negative",
    matcap: "/matcaps/negative.png",
  },
  metal: {
    name: "Metal Scratched",
    matcap: "/matcaps/metal.png",
  },
  metal2: {
    name: "Metal Polished",
    matcap: "/matcaps/metal-2.png",
  },
  spiral: {
    name: "Spiral Glass",
    matcap: "/matcaps/spiral.png",
  },
  skin: {
    name: "Skin Light",
    matcap: "/matcaps/skin.png",
  },
  skin2: {
    name: "Skin Fair",
    matcap: "/matcaps/skin-2.png",
  },
  skin3: {
    name: "Skin Medium",
    matcap: "/matcaps/skin-3.png",
  },
  skin4: {
    name: "Skin Tan",
    matcap: "/matcaps/skin-4.png",
  },
  skin5: {
    name: "Skin Deep",
    matcap: "/matcaps/skin-5.png",
  },
  softGold: {
    name: "Soft Gold",
    matcap: "/matcaps/soft-gold.png",
  },
  zoisite: {
    name: "Zoisite Amber",
    matcap: "/matcaps/zoisite.png",
  },
  chrome1: {
    name: "Chrome Studio",
    matcap: "/matcaps/chrome-1.png",
  },
  chrome2: {
    name: "Chrome Clean",
    matcap: "/matcaps/chrome-2.png",
  },
  chrome3: {
    name: "Chrome Rainbow",
    matcap: "/matcaps/chrome-3.png",
  },
  chrome4: {
    name: "Chrome Iridescent",
    matcap: "/matcaps/chrome-4.png",
  },
  gold: {
    name: "Gold",
    matcap: "/matcaps/gold.png",
  },
  copper: {
    name: "Copper",
    matcap: "/matcaps/copper.png",
  },
  blood: {
    name: "Blood Red",
    matcap: "/matcaps/blood.png",
  },
  blueShine: {
    name: "Blue Shine",
    matcap: "/matcaps/blue-shine.png",
  },
  blueRefl: {
    name: "Blue Metallic",
    matcap: "/matcaps/blue-refl.png",
  },
  cyberpunk: {
    name: "Cyberpunk",
    matcap: "/matcaps/cyberpunk.png",
  },
  nebula: {
    name: "Nebula",
    matcap: "/matcaps/nebula.jpg",
  },
  oilBubble: {
    name: "Oil Bubble",
    matcap: "/matcaps/oil-bubble.jpg",
  },
  steelHorizon: {
    name: "Steel Horizon",
    matcap: "/matcaps/steel-horizon.png",
  },
  forestGlow: {
    name: "Forest Glow",
    matcap: "/matcaps/forest-glow.png",
  },
  skyEarth: {
    name: "Sky Earth",
    matcap: "/matcaps/sky-earth.png",
  },
  sunsetTeal: {
    name: "Sunset Teal",
    matcap: "/matcaps/sunset-teal.png",
  },
  terracottaGloss: {
    name: "Terracotta Gloss",
    matcap: "/matcaps/terracotta-gloss.png",
  },
  obsidian: {
    name: "Obsidian",
    matcap: "/matcaps/obsidian.png",
  },
  roseVelvet: {
    name: "Rose Velvet",
    matcap: "/matcaps/rose-velvet.png",
  },
  darkSteel: {
    name: "Dark Steel",
    matcap: "/matcaps/dark-steel.png",
  },
  sandDune: {
    name: "Sand Dune",
    matcap: "/matcaps/sand-dune.png",
  },
  crimsonMist: {
    name: "Crimson Mist",
    matcap: "/matcaps/crimson-mist.png",
  },
  iceFire: {
    name: "Ice Fire",
    matcap: "/matcaps/ice-fire.png",
  },
  silverSplit: {
    name: "Silver Split",
    matcap: "/matcaps/silver-split.png",
  },
}

interface MaterialSettings {
  colorMap: string | null
  normalMap: string | null
  roughnessMap: string | null
  metalnessMap: string | null
  displacementMap: string | null
  normalScale: number
  roughness: number
  metalness: number
  displacementScale: number
  colorTint: string
  hueShift: number
  useHueShift: boolean
  transmission: number
  ior: number
  thickness: number
  attenuationDistance: number
  attenuationColor: string
  opacityMap: string | null
  useOpacityMap: boolean
  clearcoat: number
  clearcoatRoughness: number
  clearcoatNormalScale: number
  glassColor: string
  glassColorIntensity: number
  iridescence: number
  iridescenceIOR: number
  iridescenceThicknessMin: number
  iridescenceThicknessMax: number
  reflectivity: number
  envMapIntensity: number
  normalRepeat: number
  useNormalMap?: boolean // Added for clarity
  useRoughnessMap?: boolean // Added for clarity
  useDisplacementMap?: boolean // Added for clarity
  useMetalnessMap?: boolean // Added for clarity
  useBaseColor?: boolean // Added for clarity
  textureScale: number
}

export default function MaterialTool() {
  const [geometrySettings, setGeometrySettings] = useState({
    type: "sphere" as "sphere" | "extruded" | "model",
    primitiveType: "sphere" as "sphere" | "cone" | "torus" | "torusKnot" | "capsule" | "blob",
    blob: { ...BLOB_DEFAULT } as BlobSettings, // Blob Forge primitive
    svgPath: SVG_PATHS.star,
    // Remove selectedShape tracking for NounProject
    // selectedShape: "star" as keyof typeof SVG_PATHS,
    selectedShape: "star", // Keep for now, will be null/custom for non-standard shapes
    thickness: 4,
    bevelSize: 0.9,
    bevelSegments: 18,
    bevelQuality: 78,
    textureScale: 1.0, // Added textureScale for sphere
    // 3D mode opens with the Stanford Bunny (Stanford 3D Scanning Repository), as a tribute
    modelUrl: "/models/stanford-bunny.glb" as string | null,
    modelName: "Stanford Bunny" as string | null,
    inflationAmount: 0, // 0 = no inflation, 1 = max inflation
    inflateSphereEnabled: true, // Inflate Sphere Position ON/OFF
    inflateSpherePosition: [0, 0, 0] as [number, number, number], // X, Y, Z центра сферы
    inflateSphereRadius: 0.5, // Радиус сферы влияния (меньшее значение для локального эффекта)
    flatBase: false, // Flat Base toggle
    deformEnabled: false, // Enable deform для extruded SVG
    usePotteryMode: false, // Pottery wheel/lathe mode
    latheSegments: 32, // Number of segments around the axis for lathe geometry
    latheAxis: 'center' as 'center' | 'left' | 'right' | 'top' | 'bottom', // Axis position for pottery wheel mode
    // Inflate mode settings (for "inflate" type)
    inflateContour: [] as { x: number; y: number }[],
    inflateVolume: 100,
    inflateBothSides: true,
    inflateSmoothing: 3,
    inflateGridResolution: 150,
    inflateSharpRidge: false,
    inflateRidgeSharpness: 5,
  })

  const [materialSettings, setMaterialSettings] = useState<MaterialSettings>({
    colorMap: null,
    normalMap: null,
    roughnessMap: null,
    metalnessMap: null,
    displacementMap: null,
    normalScale: 1.0,
    roughness: 0.5,
    metalness: 0.0,
    displacementScale: 0.02,
    colorTint: "#ffffff",
    hueShift: 0,
    useHueShift: true,
    transmission: 0,
    ior: 1.5,
    thickness: 0.5,
    attenuationDistance: 2.0,
    attenuationColor: "#ffffff",
    opacityMap: null,
    useOpacityMap: false,
    clearcoat: 0,
    clearcoatRoughness: 0.1,
    clearcoatNormalScale: 1.0,
    glassColor: "#ffffff",
    glassColorIntensity: 0,
    iridescence: 0,
    iridescenceIOR: 1.3,
    iridescenceThicknessMin: 100,
    iridescenceThicknessMax: 400,
    reflectivity: 0.5,
    envMapIntensity: 1.0,
    normalRepeat: 1,
    textureScale: 1.0,
  })

  const [lightingSettings, setLightingSettings] = useState({
    envMap: "studio",
    envIntensity: 1,
    envRotation: 0,
    directionalIntensity: 0.5,
    ambientIntensity: 0.3,
    exposure: 1,
  })

  // Add render mode and matcap state after lightingSettings state
  const [renderMode, setRenderMode] = useState<"pbr" | "matcap">("pbr")
  const [selectedMatcap, setSelectedMatcap] = useState("kunzite")
  const [matcapTexture, setMatcapTexture] = useState("/matcaps/kunzite.png")
  const [matcapHueShift, setMatcapHueShift] = useState(0)
  
  // Matcap advanced settings - Normal Map & Rim Light
  const [matcapSettings, setMatcapSettings] = useState({
    normalMap: "",
    normalIntensity: 1.0,
    normalRepeat: 1.0,
    rimIntensity: 0,
    rimPower: 3,
    rimColor: "#ffffff",
  })

  const [showModelSearch, setShowModelSearch] = useState(false)
  const [showIconSearch, setShowIconSearch] = useState(false)
  const [modelLoadError, setModelLoadError] = useState<string | null>(null)

  const [openSections, setOpenSections] = useState({
    geometry: true,
    baseColor: true,
    normalMap: true,
    roughness: true,
    displacement: true,
    metalness: true,
    environment: true,
    lights: true,
    deform: false,
  })

  const [selectedPreset, setSelectedPreset] = useState<keyof typeof MATERIAL_PRESETS | "custom">("plastic")
  const [activeTab, setActiveTab] = useState("material") // tabs are gone: the material panel is always the context
  const [materialTypeTab, setMaterialTypeTab] = useState<"pbr" | "custom" | "gradient" | "matcap" | "layered">(
    selectedPreset === "custom" ? "custom" : "pbr"
  )
  const [backgroundColor, setBackgroundColor] = useState("#9724f5") // Knopika "Violet" ground
  const [showGrid, setShowGrid] = useState(false)
  const [showRotateControls, setShowRotateControls] = useState(false)
  
  // Custom material selections
  const [customMaterial, setCustomMaterial] = useState({
    baseColor: CUSTOM_COLORS[0].color,
    normal: CUSTOM_TEXTURES.normal[0].url,
    roughness: CUSTOM_TEXTURES.roughness[0].url,
    metalness: CUSTOM_TEXTURES.metalness[0].url,
  })
  
  // Layered material (Blob Forge): gradient layer over matcap "holes"
  const [layered, setLayered] = useState<LayeredSettings>({ ...LAYERED_DEFAULT })
  const setLay = (u: Partial<LayeredSettings>) => setLayered((p) => ({ ...p, ...u }))

  // Gradient settings
  const [showGradient, setShowGradient] = useState(false)
  const [gradientSettings, setGradientSettings] = useState({
    enabled: false,
    type: "radial" as "radial" | "linear",
    color1: "#ff0080",
    color2: "#ff8c00",
    color3: "#ffffff",
    useThreeColors: false,
    intensity: 1,
    distortion: 0.5,
    angle: 0,
  })

  useEffect(() => {
    // Switch render mode based on active tab or material type tab
    if (activeTab === "material") {
      if (materialTypeTab === "matcap") {
        setRenderMode("matcap")
      } else {
        setRenderMode("pbr")
      }
      
      // Sync selectedPreset with materialTypeTab
      if (materialTypeTab === "custom" && selectedPreset !== "custom") {
        setSelectedPreset("custom")
      } else if (materialTypeTab === "pbr" && selectedPreset === "custom") {
        // Switch to first available preset when leaving custom mode
        const firstPresetKey = Object.keys(MATERIAL_PRESETS)[0]
        setSelectedPreset(firstPresetKey)
      } else if (materialTypeTab === "gradient") {
        // When gradient is selected, ensure selectedPreset is NOT "custom"
        // to avoid conflict between custom PBR and gradient
        if (selectedPreset === "custom") {
          const firstPresetKey = Object.keys(MATERIAL_PRESETS)[0]
          setSelectedPreset(firstPresetKey)
        }
      }
      
      // Layered (gradient + matcap holes) is its own material mode
      setLayered((prev) => ({ ...prev, enabled: materialTypeTab === "layered" }))
      // Auto-enable/disable gradient based on tab selection
      if (materialTypeTab === "gradient") {
        setGradientSettings(prev => ({ ...prev, enabled: true }))
      } else {
        setGradientSettings(prev => ({ ...prev, enabled: false }))
      }
    } else if (activeTab === "lighting") {
      setRenderMode("pbr")
    }
  }, [activeTab, materialTypeTab])

  // Replace Noun Project API state with Iconify
  // Noun Project API state
  // const [nounProjectApiKey, setNounProjectApiKey] = useState("")
  // const [searchTerm, setSearchTerm] = useState("")
  // const [icons, setIcons] = useState<NounProjectIcon[]>([])
  // const [loadingIcons, setLoadingIcons] = useState(false)
  // const [error, setError] = useState<string | null>(null)

  const [iconSearchQuery, setIconSearchQuery] = useState("")
  const [iconSearchInput, setIconSearchInput] = useState("")
  const [selectedIcon, setSelectedIcon] = useState<IconifyIcon | null>(null)
  const [loadingIcons, setLoadingIcons] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [iconSearchResults, setIconSearchResults] = useState<IconSearchResponse | undefined>(undefined)
  const [isSearchingIcons, setIsSearchingIcons] = useState(false)

  useEffect(() => {
    if (!iconSearchQuery) {
      setIconSearchResults(undefined)
      return
    }

    const fetchIcons = async () => {
      setIsSearchingIcons(true)
      try {
        const response = await fetch(`/api/icons/search?q=${encodeURIComponent(iconSearchQuery)}&limit=24`)
        if (!response.ok) throw new Error('Failed to fetch icons')
        const data = await response.json()
        setIconSearchResults(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching icons')
      } finally {
        setIsSearchingIcons(false)
      }
    }

    const debounceTimer = setTimeout(fetchIcons, 300)
    return () => clearTimeout(debounceTimer)
  }, [iconSearchQuery])
  // }, [iconSearchResults])

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const handleIconSearch = useCallback((value: string) => {
    setIconSearchInput(value)
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      setIconSearchQuery(value)
    }, 500)
  }, [])

  const viewerRef = useRef<PBRViewerRef>(null)

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const handleSVGUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === "image/svg+xml") {
      const reader = new FileReader()
      reader.onload = (e) => {
        const svgContent = e.target?.result as string
        setGeometrySettings({ ...geometrySettings, svgPath: svgContent, svgSource: "upload", type: "extruded", selectedShape: "custom" }) // Set selectedShape to custom
        setMaterialSettings((prev) => ({ ...prev, useDisplacementMap: false, displacementScale: 0 }))
      }
      reader.readAsText(file)
    }
  }

  // Remove Noun Project icon search function
  // Search Noun Project icons
  // const searchNounProjectIcons = useCallback(async () => {
  //   if (!searchTerm) return
  //   setLoadingIcons(true)
  //   setError(null)
  //   setIcons([])

  //   try {
  //     const response = await fetch(`/api/nounproject/search?q=${encodeURIComponent(searchTerm)}&limit=20`)
  //     if (!response.ok) {
  //       throw new Error(`API request failed with status ${response.status}`)
  //     }
  //     const data = await response.json()

  //     if (data.error) {
  //       throw new Error(data.error)
  //     }
  //     if (data.icons) {
  //       console.log("[v0] Loaded icons:", data.icons.length, "icons, first icon svg:", data.icons[0]?.icon_url)
  //       setIcons(data.icons)
  //     }
  //   } catch (err: any) {
  //     setError(err.message || "Failed to fetch icons")
  //     console.error("[v0] Error fetching Noun Project icons:", err)
  //   } finally {
  //     setLoadingIcons(false)
  //   }
  // }, [searchTerm])

  // Update handleSelectNounIcon to handle Iconify icons
  // const handleSelectNounIcon = useCallback(async (icon: NounProjectIcon) => {
  //   console.log("[v0] Selected icon:", icon.id, "has svg:", !!icon.svg, "icon_url:", icon.icon_url)
  //   setSelectedNounIcon(icon)

  //   // If SVG is included in search results, use it directly
  //   if (icon.svg) {
  //     console.log("[v0] Using inline SVG from icon")
  //     setGeometrySettings((prev) => ({
  //       ...prev,
  //       svgPath: icon.svg!,
  //       selectedShape: null, // Clear selected shape as it's a custom import
  //       type: "extruded",
  //     }))
  //     setMaterialSettings((prev) => ({
  //       ...prev,
  //       useDisplacementMap: false,
  //       displacementScale: 0,
  //     }))
  //     return
  //   }

  //   // Otherwise fetch the full icon data
  //   try {
  //     console.log("[v0] Fetching full icon data for id:", icon.id)
  //     setLoadingIcons(true) // Show loader while fetching SVG
  //     const response = await fetch(`/api/nounproject/icon/${icon.id}`)
  //     if (!response.ok) throw new Error(`Failed to fetch icon SVG: ${response.statusText}`)
  //     const data = await response.json()
  //     console.log("[v0] Icon API response:", JSON.stringify(data).substring(0, 500))

  //     const svgContent = data.icon?.svg || data.svg
  //     if (svgContent) {
  //       console.log("[v0] Got SVG content, length:", svgContent.length)
  //       setGeometrySettings((prev) => ({
  //         ...prev,
  //         svgPath: svgContent,
  //         selectedShape: null, // Clear selected shape
  //         type: "extruded",
  //       }))
  //       setMaterialSettings((prev) => ({
  //         ...prev,
  //         useDisplacementMap: false,
  //         displacementScale: 0,
  //       }))
  //     } else {
  //       console.error("[v0] No SVG in response:", data)
  //       setError("Could not retrieve SVG data for the selected icon.")
  //     }
  //   } catch (error) {
  //     console.error("[v0] Failed to fetch icon SVG:", error)
  //     setError("Failed to load SVG icon.")
  //   } finally {
  //     setLoadingIcons(false)
  //   }
  // }, []) // Dependencies are correct here

  const handleSelectIcon = useCallback(async (icon: IconifyIcon) => {
    console.log("[v0] Selected Iconify icon:", icon.id)
    setSelectedIcon(icon)
    setLoadingIcons(true)
    setError(null)

    try {
      // Fetch SVG content from the backend API
      const response = await fetch(`/api/icons/svg?icon=${encodeURIComponent(icon.id)}`) // Updated API endpoint
      if (!response.ok) {
        throw new Error(`Failed to fetch SVG: ${response.statusText}`)
      }
      const data = await response.json()
      const svgContent = data.svg

      if (svgContent) {
        console.log("[v0] Got SVG content from Iconify, length:", svgContent.length)
        setGeometrySettings((prev) => ({
          ...prev,
          svgPath: svgContent,
          svgSource: "iconify",
          selectedShape: "custom", // Indicate that it's a custom shape from an external source
          type: "extruded",
        }))
        setMaterialSettings((prev) => ({
          ...prev,
          useDisplacementMap: false,
          displacementScale: 0,
        }))
      } else {
        console.error("[v0] No SVG in Iconify response:", data)
        setError("Could not retrieve SVG data for the selected icon.")
      }
    } catch (err) {
      console.error("[v0] Failed to fetch Iconify SVG:", err)
      setError("Failed to load SVG icon.")
    } finally {
      setLoadingIcons(false)
    }
  }, []) // Dependencies are correct here

  // Find the preset change handler and add new properties
  const handlePresetChange = (presetKey: string) => {
    const preset = MATERIAL_PRESETS[presetKey as keyof typeof MATERIAL_PRESETS]
    if (preset) {
      setSelectedPreset(presetKey as keyof typeof MATERIAL_PRESETS)
      setMaterialSettings({
        ...materialSettings,
        colorMap: preset.baseColor,
        normalMap: preset.normalMap,
        roughnessMap: preset.roughnessMap,
        displacementMap: preset.displacementMap,
        metalnessMap: preset.metalnessMap,
        metalness: preset.metalness,
        roughness: preset.roughness,
        normalScale: preset.normalScale,
        displacementScale: preset.displacementScale,
        colorTint: preset.defaultTint || "#ffffff",
        useHueShift: preset.useHueShift !== false,
        transmission: preset.transmission || 0,
        ior: preset.ior || 1.5,
        thickness: preset.thickness || 0.5,
        attenuationDistance: preset.attenuationDistance || 2.0,
        attenuationColor: preset.attenuationColor || "#ffffff",
        opacityMap: preset.opacityMap || null,
        useOpacityMap: !!preset.opacityMap,
        clearcoat: preset.clearcoat || 0,
        clearcoatRoughness: preset.clearcoatRoughness || 0.1,
        // Merge new defaults for glass presets
        glassColor: preset.glassColor || "#ffffff",
        glassColorIntensity: preset.glassColorIntensity || 0,
        iridescence: preset.iridescence || 0,
        iridescenceIOR: preset.iridescenceIOR || 1.3,
        iridescenceThicknessMin: preset.iridescenceThicknessMin || 100,
        iridescenceThicknessMax: preset.iridescenceThicknessMax || 400,
        textureScale: materialSettings.textureScale, // Keep existing textureScale
      })
    }
  }

  useEffect(() => {
    if (selectedPreset === "custom") {
      // Apply custom material with solid color
      setMaterialSettings((prev) => ({
        ...prev,
        colorMap: null, // No texture, use solid color
        colorTint: customMaterial.baseColor,
        normalMap: customMaterial.normal,
        roughnessMap: customMaterial.roughness,
        metalnessMap: customMaterial.metalness,
        displacementMap: null,
        transmission: 0,
        useHueShift: false,
        useBaseColor: false,
      }))
    } else if (selectedPreset && MATERIAL_PRESETS[selectedPreset as keyof typeof MATERIAL_PRESETS]) {
      const preset = MATERIAL_PRESETS[selectedPreset as keyof typeof MATERIAL_PRESETS]
      setMaterialSettings((prev) => ({
        colorMap: preset.baseColor,
        normalMap: preset.normalMap,
        roughnessMap: preset.roughnessMap,
        metalnessMap: preset.metalnessMap,
        displacementMap: preset.displacementMap,
        normalScale: preset.normalScale,
        roughness: preset.roughness,
        metalness: preset.metalness,
        displacementScale: preset.displacementScale,
        colorTint: preset.defaultTint || "#ffffff",
        hueShift: 0,
        useHueShift: preset.useHueShift !== false,
        transmission: preset.transmission || 0,
        ior: preset.ior || 1.5,
        thickness: preset.thickness || 0.5,
        attenuationDistance: preset.attenuationDistance || 2.0,
        attenuationColor: preset.attenuationColor || "#ffffff",
        opacityMap: preset.opacityMap || null,
        useOpacityMap: !!preset.opacityMap,
        clearcoat: preset.clearcoat || 0,
        clearcoatRoughness: preset.clearcoatRoughness || 0.1,
        glassColor: preset.glassColor || "#ffffff",
        glassColorIntensity: preset.glassColorIntensity || 0,
        iridescence: preset.iridescence || 0,
        iridescenceIOR: preset.iridescenceIOR || 1.3,
        iridescenceThicknessMin: preset.iridescenceThicknessMin || 100,
        iridescenceThicknessMax: preset.iridescenceThicknessMax || 400,
        textureScale: prev.textureScale,
      }))
    }
  }, [selectedPreset, customMaterial])

  // Add export button in top-left corner
  const handleExportPNG = () => {
    if (viewerRef.current) {
      viewerRef.current.exportPNG()
    }
  }

  // Remove handleIconSelect for Noun Project
  // Handle selecting an icon from Noun Project
  // const handleIconSelect = (icon: NounProjectIcon) => {
  //   // Fetch the SVG content if not already present
  //   const fetchSvg = async () => {
  //     if (icon.svg) {
  //       setGeometrySettings({ ...geometrySettings, svgPath: icon.svg, type: "extruded", selectedShape: "custom" })
  //       setMaterialSettings((prev) => ({ ...prev, useDisplacementMap: false, displacementScale: 0 }))
  //     } else {
  //       try {
  //         setLoadingIcons(true) // Show loader while fetching SVG
  //         const response = await fetch(`/api/nounproject/svg?id=${icon.id}&apiKey=${nounProjectApiKey}`)
  //         if (!response.ok) throw new Error("Failed to fetch SVG")
  //         const svgData: { svg: string } = await response.json()
  //         setGeometrySettings({ ...geometrySettings, svgPath: svgData.svg, type: "extruded", selectedShape: "custom" })
  //         setMaterialSettings((prev) => ({ ...prev, useDisplacementMap: false, displacementScale: 0 }))
  //       } catch (err) {
  //         console.error("Error fetching SVG:", err)
  //         setError("Failed to load SVG icon.")
  //       } finally {
  //         setLoadingIcons(false)
  //       }
  //     }
  //   }
  //   fetchSvg()
  // }

  // ---------- Knopika shell state ----------
  const [panel, setPanel] = useState<"material" | "light" | "rotate" | "theme" | null>("material")
  const [sourceOpen, setSourceOpen] = useState(false)
  const [theme, setTheme] = useState<KnopikaTheme>(THEME_DEFAULT)
  const [isPhone, setIsPhone] = useState(false)
  const [matSetOpen, setMatSetOpen] = useState(true)
  const [showDots, setShowDots] = useState(true)
  const [soundOn, setSoundOn] = useState(true)
  const rootRef = useRef<HTMLDivElement>(null)
  const soundBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    try {
      if (localStorage.getItem("polya-sound") === "off") setSoundOn(false)
      if (localStorage.getItem("polya-dots") === "off") setShowDots(false)
    } catch {}
    if (!rootRef.current) return
    return installUISounds(rootRef.current, () => soundBtnRef.current)
  }, [])
  useEffect(() => {
    setSoundEnabled(soundOn)
    try {
      localStorage.setItem("polya-sound", soundOn ? "on" : "off")
      localStorage.setItem("polya-dots", showDots ? "on" : "off")
    } catch {}
  }, [soundOn, showDots])

  useEffect(() => {
    try {
      const raw = localStorage.getItem("polya-knopika-theme")
      if (raw) setTheme({ ...THEME_DEFAULT, ...JSON.parse(raw) })
      const bg = localStorage.getItem("polya-knopika-ground")
      if (bg && /^#[0-9a-f]{6}$/i.test(bg)) setBackgroundColor(bg)
    } catch {}
    const mq = window.matchMedia("(max-width: 720px)")
    const upd = () => setIsPhone(mq.matches)
    upd()
    mq.addEventListener("change", upd)
    return () => mq.removeEventListener("change", upd)
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem("polya-knopika-theme", JSON.stringify(theme))
      localStorage.setItem("polya-knopika-ground", backgroundColor)
    } catch {}
  }, [theme, backgroundColor])

  // the rotate gizmo lives in the 3D view; the Rotate panel simply switches it on
  useEffect(() => {
    setShowRotateControls(panel === "rotate")
  }, [panel])

  const [tStatus, setTStatus] = useState("Saved in this browser.")
  const [tOut, setTOut] = useState<string | null>(null)
  const [tDemo, setTDemo] = useState(62)
  const tOutRef = useRef<HTMLTextAreaElement>(null)
  const copyOut = (text: string, msg: string) => {
    setTOut(text)
    const fallback = () => {
      setTStatus("Clipboard unavailable — the text is selected, copy it manually.")
      setTimeout(() => tOutRef.current?.select(), 0)
    }
    try {
      navigator.clipboard.writeText(text).then(() => setTStatus(msg), fallback)
    } catch {
      fallback()
    }
  }

  // draggable windows (desktop only); docked ones snap back next to their parent
  const drag = usePanelDrag(!isPhone)
  const win = (id: string, cls: string, dock = false) => {
    const b = drag.bind(id, { dock })
    return { ...b, className: `${cls} ${b.className}` }
  }

  const setT = <K extends keyof KnopikaTheme>(k: K, v: KnopikaTheme[K]) => setTheme((t) => ({ ...t, [k]: v }))
  const tv = themeVars(backgroundColor, theme)
  const togglePanel = (p: "material" | "light" | "rotate" | "theme") => setPanel((cur) => (cur === p ? "material" : p))

  const onGeoChangeFromViewer = useCallback((updates: Partial<typeof geometrySettings>) => setGeometrySettings((g) => ({ ...g, ...updates })), [])
  const setGeo = (u: Partial<typeof geometrySettings>) => setGeometrySettings({ ...geometrySettings, ...u })
  const setMat = (u: Partial<MaterialSettings>) => setMaterialSettings({ ...materialSettings, ...u })
  const setLight = (u: Partial<typeof lightingSettings>) => setLightingSettings({ ...lightingSettings, ...u })

  const geoType = geometrySettings.type as string
  const pickMode = (t: "sphere" | "extruded" | "model" | "inflate") => {
    if (t === geoType) {
      if (t !== "sphere") setSourceOpen((o) => !o)
      return
    }
    if (t === "extruded") {
      setGeometrySettings({ ...geometrySettings, type: "extruded" })
      setMaterialSettings((prev) => ({ ...prev, useDisplacementMap: false, displacementScale: 0 }))
    } else {
      setGeometrySettings({ ...geometrySettings, type: t as any })
    }
    setSourceOpen(t !== "sphere")
  }

  const MODES = [
    { t: "sphere", icon: "circle", label: "Primitives" },
    { t: "extruded", icon: "pen", label: "Vector" },
    { t: "model", icon: "cube", label: "3D model" },
    { t: "inflate", icon: "inflate", label: "Inflate" },
  ] as const
  const PRIMS: { type: "sphere" | "cone" | "torus" | "torusKnot" | "capsule"; label: string; svg: React.ReactNode }[] = [
    { type: "sphere", label: "Sphere", svg: <circle cx="12" cy="12" r="8.5" /> },
    { type: "cone", label: "Cone", svg: <path d="M12 3.5 19.5 18.5c0 1.4-3.4 2.5-7.5 2.5s-7.5-1.1-7.5-2.5z" /> },
    { type: "torus", label: "Torus", svg: <path fillRule="evenodd" stroke="none" d="M2.5 12a9.5 6.5 0 1 0 19 0 9.5 6.5 0 1 0-19 0zm5.5 0a4 2.2 0 1 0 8 0 4 2.2 0 1 0-8 0z" /> },
    { type: "torusKnot", label: "Knot", svg: <path fill="none" strokeWidth="3" strokeLinecap="round" d="M7 9c2.5-5 10-3 8.5 2.5S8 19 6.5 15s4-9 8-6 2.5 9-2 9.5" /> },
    { type: "capsule", label: "Capsule", svg: <rect x="7" y="2.8" width="10" height="18.4" rx="5" /> },
    { type: "blob", label: "Blob", svg: <path d="M12.6 3.2c3.9-.4 7.6 2.4 8 6.3.5 4.3-2.1 6.9-4.5 9.2-2.2 2.1-5.6 2.6-8.3 1.2-3.1-1.6-4.9-4.6-4.6-8.1.3-4.3 5.2-8.2 9.4-8.6z" /> },
  ]
  const blob = { ...BLOB_DEFAULT, ...(geometrySettings.blob || {}) }
  const setBlob = (u: Partial<BlobSettings>) => setGeometrySettings((g) => ({ ...g, blob: { ...BLOB_DEFAULT, ...(g.blob || {}), ...u } }))
  const BLOB_BASES: { v: BlobBase; label: string }[] = [
    { v: "ico", label: "Ico" },
    { v: "sphere", label: "Sphere" },
    { v: "torus", label: "Torus" },
    { v: "knot", label: "Knot" },
    { v: "box", label: "Box" },
  ]
  const curPrim = PRIMS.find((p) => p.type === geometrySettings.primitiveType) || PRIMS[0]
  const curMode = MODES.find((m) => m.t === geoType) || MODES[0]

  const isGlass = selectedPreset === "dirtyGlass" || selectedPreset === "scratchedGlass" || selectedPreset === "clearGlass"
  const presetName =
    selectedPreset === "custom" ? "Custom material" : MATERIAL_PRESETS[selectedPreset as keyof typeof MATERIAL_PRESETS]?.name || "Material"
  const GLASS_THUMB = "radial-gradient(circle at 34% 30%, #ffffff 0 12%, #cfe8ff 26%, #7fa7c9 62%, #3d5a75)"
  const pickMaterial = (fn: () => void) => {
    fn()
    setMatSetOpen(true)
  }
  const matInfo = (() => {
    if (materialTypeTab === "matcap") {
      const m = MATCAP_PRESETS[selectedMatcap as keyof typeof MATCAP_PRESETS]
      return { title: m?.name || "Matcap", desc: "Baked lighting in a sphere texture — PBR lighting is off.", thumb: `center / cover url("${m?.matcap}")` }
    }
    if (materialTypeTab === "gradient")
      return {
        title: gradientSettings.type === "radial" ? "Radial gradient" : "Linear gradient",
        desc: "Procedural shading with its own light — PBR lighting is off.",
        thumb: `radial-gradient(circle at 40% 35%, ${gradientSettings.color1}, ${gradientSettings.color2})`,
      }
    if (materialTypeTab === "layered")
      return {
        title: LAYERED_PALETTES.find((p) => p.colors[0] === layered.colorA && p.colors[1] === layered.colorB && p.colors[2] === layered.colorC)?.name || "Layered",
        desc: "Gradient layer with matcap showing through noise holes.",
        thumb: `radial-gradient(circle at 35% 30%, ${layered.colorA}, ${layered.colorB} 55%, ${layered.colorC})`,
      }
    if (materialTypeTab === "custom")
      return { title: "Custom material", desc: "Solid colour with your own normal, roughness and metalness maps.", thumb: customMaterial.baseColor }
    const p = MATERIAL_PRESETS[selectedPreset as keyof typeof MATERIAL_PRESETS]
    return {
      title: presetName,
      desc: isGlass ? "Transmissive glass — refraction, attenuation and iridescence." : "PBR texture set with colour, normal and roughness maps.",
      thumb: p?.baseColor ? `center / cover url("${p.baseColor}")` : GLASS_THUMB,
    }
  })()
  const MAT_TABS = [
    { v: "pbr", icon: "drop", label: "PBR presets" },
    { v: "custom", icon: "palette", label: "Custom PBR" },
    { v: "gradient", icon: "layers", label: "Gradient" },
    { v: "matcap", icon: "eye", label: "Matcap" },
    { v: "layered", icon: "spark", label: "Layered" },
  ] as const

  // bottom bar pill with an ink slider
  const GP = (p: { icon: string; label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }) => (
    <label className="kk-pillgroup gp" title={p.label} key={p.label}>
      <Icon name={p.icon} />
      <Range ink label={p.label} value={p.value} min={p.min} max={p.max} step={p.step} onChange={p.onChange} format={p.fmt} />
      <output>{p.fmt ? p.fmt(p.value) : p.step < 1 ? p.value.toFixed(p.step < 0.1 ? 2 : 1) : p.value}</output>
    </label>
  )
  const GT = (p: { icon: string; label: string; on: boolean; onChange: (v: boolean) => void }) => (
    <span className="kk-pillgroup gtog" key={p.label}>
      <button type="button" className={`kk-ibtn kk-ibtn--ground ${p.on ? "is-on" : ""}`} aria-pressed={p.on} title={p.label} aria-label={p.label} onClick={() => p.onChange(!p.on)}>
        <Icon name={p.icon} />
      </button>
      <span className="gtog-l">{p.label}</span>
    </span>
  )

  const stageClass = [
    "stage",
    "kk-root",
    panel === "light" ? "lightmode" : "",
    panel === "rotate" ? "rotmode" : "",
    isPhone && panel ? "sheet-open" : "",
    sourceOpen ? "src-open" : "",
  ].join(" ")

  return (
    <IconWeightContext.Provider value={theme.iconWeight}>
      <div
        className={`wrap polya ${tv.dark ? "kk-ground-dark" : ""} ${theme.style === "expressive" ? "kk-expressive" : ""} ${theme.style === "block" ? "kk-block" : ""} ${theme.caps ? "caps" : ""}`}
        data-xp-shape={theme.shape}
        ref={rootRef}
        style={tv.vars as React.CSSProperties}
      >
        <div className={stageClass}>
          {/* 3D view fills the whole ground */}
          <div className="viewer">
            <PBRViewer
              ref={viewerRef}
              geometrySettings={geometrySettings}
              materialSettings={materialSettings}
              lightingSettings={lightingSettings}
              renderMode={renderMode}
              matcapTexture={renderMode === "matcap" ? MATCAP_PRESETS[selectedMatcap]?.matcap : undefined}
              matcapHueShift={matcapHueShift}
              matcapSettings={matcapSettings}
              backgroundColor={backgroundColor}
              dotGrid={showDots}
              layeredSettings={layered}
              dotColor={tv.vars["--on-ground-faint"]}
              showGrid={showGrid}
              showRotateControls={showRotateControls}
              gradientSettings={gradientSettings}
              customMaterial={customMaterial}
              onModelLoadError={setModelLoadError}
              onGeometrySettingsChange={onGeoChangeFromViewer}
            />
          </div>

          {panel === "light" && renderMode === "pbr" && (
            <LightRig
              angle={lightingSettings.envRotation}
              onAngle={(a) => setLightingSettings((l) => ({ ...l, envRotation: a }))}
              intensity={lightingSettings.directionalIntensity}
              onIntensity={(v) => setLightingSettings((l) => ({ ...l, directionalIntensity: v }))}
            />
          )}

          {panel === "rotate" && <OrbitRig />}

          <div className="brand">
            <span className="logo" role="img" aria-label="pólya" />
          </div>

          {/* top centre: light, rotate, background, grid */}
          <div className="topc">
            <button type="button" className={`kk-spark light-btn ${panel === "light" ? "is-on" : ""}`} aria-label="Lighting" aria-expanded={panel === "light"} data-tip onClick={() => togglePanel("light")}>
              <Icon name="sun" />
              <span className="tip">Light</span>
            </button>
            <button type="button" className={`kk-spark light-btn ${panel === "rotate" ? "is-on" : ""}`} aria-label="Rotate model" aria-expanded={panel === "rotate"} data-tip onClick={() => togglePanel("rotate")}>
              <Icon name="orbit" />
              <span className="tip">Rotate</span>
            </button>
            <div className="kk-pillgroup" aria-label="Background">
              <Icon name="image" />
              <div className="kk-row" style={{ gap: 7 }}>
                {GROUNDS.slice(0, 5).map((g) => (
                  <button
                    key={g.hex}
                    type="button"
                    className={`bgdot ${backgroundColor.toLowerCase() === g.hex ? "is-on" : ""}`}
                    style={{ ["--c" as string]: g.hex }}
                    aria-label={`Background: ${g.name}`}
                    title={g.name}
                    onClick={() => setBackgroundColor(g.hex)}
                  />
                ))}
                <label
                  className={`bgdot bgpick ${GROUNDS.slice(0, 5).some((g) => g.hex === backgroundColor.toLowerCase()) ? "" : "is-on"}`}
                  style={{ ["--c" as string]: "conic-gradient(#f33,#fb3,#3c9,#3bf,#c4e,#f33)" }}
                  title="Custom colour"
                >
                  <input type="color" value={backgroundColor} aria-label="Custom background colour" onChange={(e) => setBackgroundColor(e.target.value)} />
                </label>
              </div>
            </div>
            <div className="kk-pillgroup" style={{ padding: "0 6px" }}>
              <IconButton variant="ground" icon="dots" label="Dot grid" on={showDots} pressed={showDots} onClick={() => setShowDots(!showDots)} />
              <IconButton variant="ground" icon="grid" label="Floor grid" on={showGrid} pressed={showGrid} onClick={() => setShowGrid(!showGrid)} />
            </div>
          </div>

          <div className="topr">
            <a className="kk-ibtn kk-ibtn--ground" href="https://buildin.ai/sava/share/4745d01a-eba4-43a4-bcbe-bd42cb780ac7?code=11A3SR" target="_blank" rel="noopener noreferrer" title="About pólya" aria-label="About pólya">
              <Icon name="info" />
            </a>
            <button
              ref={soundBtnRef}
              type="button"
              className={`kk-ibtn kk-ibtn--ground ${soundOn ? "is-on" : ""}`}
              aria-pressed={soundOn}
              aria-label="Interface sounds"
              title={soundOn ? "Sounds on" : "Sounds off"}
              onClick={() => {
                const next = !soundOn
                setSoundEnabled(next)
                setSoundOn(next)
                if (next) UISound.on()
              }}
            >
              <Icon name="speaker" />
            </button>
            <IconButton variant="ground" icon="sliders" label="Theme" on={panel === "theme"} onClick={() => togglePanel("theme")} />
            <button type="button" className="kk-pill kk-pill--ink" id="export" onClick={handleExportPNG} title="Export PNG with transparent background">
              <Icon name="download" />
              Export PNG
            </button>
          </div>

          {/* left: geometry tray */}
          <div className="kk-tray kk-tray--dark tray">
            <div className="kk-btngroup kk-btngroup--v" style={{ display: "grid", gap: 6, justifyItems: "center" }} id="modes">
              {MODES.map((m) => (
                <IconButton key={m.t} variant="ground" icon={m.icon} label={m.label} on={geoType === m.t} onClick={() => pickMode(m.t)} />
              ))}
            </div>
            {geoType === "sphere" && (
              <>
                <hr />
                <div className="tray-shapes">
                  {PRIMS.map((p) => (
                    <button
                      key={p.type}
                      type="button"
                      className={geometrySettings.primitiveType === p.type ? "is-on" : ""}
                      aria-label={p.label}
                      title={p.label}
                      onClick={() => setGeo({ primitiveType: p.type })}
                    >
                      <svg className="kk-shape" viewBox="0 0 24 24">
                        {p.svg}
                      </svg>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* left: shape source (icons / SVG, 3D model, inflate drawing) */}
          {sourceOpen && geoType !== "sphere" && (
            <div {...win("src", "kk-panel srcpanel", true)} aria-label="Shape source">
              <PanelHead eyebrow={`Shape · ${curMode.label}`}>
                <IconButton size="sm" icon="close" label="Close" onClick={() => setSourceOpen(false)} />
              </PanelHead>

              {geoType === "extruded" && (
                <>
                  <div className="kk-card">
                    <Caption title="Icons" desc="Search Iconify and extrude any icon." />
                    <label className="kk-search">
                      <Icon name="search" />
                      <input type="text" placeholder="search icons…" value={iconSearchInput} onChange={(e) => handleIconSearch(e.target.value)} aria-label="Search icons" />
                      {iconSearchInput && (
                        <button
                          type="button"
                          className="kk-ibtn kk-ibtn--sm"
                          aria-label="Clear"
                          onClick={() => {
                            setIconSearchInput("")
                            setIconSearchQuery("")
                          }}
                        >
                          <Icon name="close" />
                        </button>
                      )}
                    </label>
                    {isSearchingIcons && (
                      <p className="hint2 kk-center">
                        <Loader2 className="kk-spin" /> Searching…
                      </p>
                    )}
                    {iconSearchResults?.icons && iconSearchResults.icons.length > 0 && (
                      <>
                        <div className="icon-grid">
                          {iconSearchResults.icons.map((icon) => (
                            <button key={icon.id} type="button" className={selectedIcon?.id === icon.id ? "is-on" : ""} onClick={() => handleSelectIcon(icon)} title={`${icon.name} (${icon.prefix})`}>
                              <img src={icon.preview_url || "/placeholder.svg"} alt={icon.name} loading="lazy" />
                            </button>
                          ))}
                        </div>
                        <p className="hint2">Icons from Iconify · {iconSearchResults.total} found</p>
                      </>
                    )}
                    {iconSearchQuery && !isSearchingIcons && iconSearchResults?.icons?.length === 0 && <p className="hint2">No icons found for “{iconSearchQuery}”</p>}
                    {loadingIcons && (
                      <p className="hint2 kk-center">
                        <Loader2 className="kk-spin" /> Loading SVG…
                      </p>
                    )}
                    {error && <p className="kk-error">{error}</p>}
                  </div>
                  <label className="kk-card kk-drop">
                    <input type="file" accept=".svg" onChange={handleSVGUpload} hidden />
                    <span className="kk-ibtn kk-ibtn--sm">
                      <Icon name="upload" />
                    </span>
                    <span className="mcap">
                      <b>Upload SVG</b>
                      <span className="kk-desc">Click to browse your files</span>
                    </span>
                  </label>
                </>
              )}

              {geoType === "model" && (
                <div className="kk-card">
                  <Caption title={geometrySettings.modelName || "No model loaded"} desc={geometrySettings.modelUrl === "/models/stanford-bunny.glb" ? "Stanford 3D Scanning Repository, 1994 — the classic test model of computer graphics." : geometrySettings.modelName ? "Currently loaded model" : "Pick a GLB / GLTF model from the library."} />
                  <button type="button" className="kk-pill kk-pill--wide" onClick={() => setShowModelSearch(true)}>
                    <Icon name="search" />
                    Search 3D models
                  </button>
                  {modelLoadError && <p className="kk-error">{modelLoadError}</p>}
                </div>
              )}

              {geoType === "inflate" && (
                <>
                  <div className="kk-card kk-inflate">
                    <Caption title="Draw a contour" desc="Draw or load an SVG — it inflates like a balloon." />
                    <InflateCanvas onContourChange={(contour) => setGeometrySettings((g) => ({ ...g, inflateContour: contour }))} width={400} height={400} />
                  </div>
                  <div className="kk-card">
                    <span className="tlabel">EXPORT MESH</span>
                    <div className="kk-row" style={{ gap: 6 }}>
                      <button type="button" className="kk-pill kk-grow" onClick={() => viewerRef.current?.exportSTL()}>
                        <Icon name="download" />
                        STL
                      </button>
                      <button type="button" className="kk-pill kk-grow" onClick={() => viewerRef.current?.exportOBJ()}>
                        <Icon name="download" />
                        OBJ
                      </button>
                      <button type="button" className="kk-pill kk-grow" onClick={() => viewerRef.current?.exportGLB()}>
                        <Icon name="download" />
                        GLB
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* right: material */}
          {panel === "material" && (
            <div className={`kk-panel matcard enter ${matSetOpen ? "has-settings" : ""}`} aria-label="Material">
              <PanelHead eyebrow={`Material · ${MAT_TABS.find((t) => t.v === materialTypeTab)?.label}`}>
                <IconButton size="sm" icon="sliders" label="Material settings" on={matSetOpen} pressed={matSetOpen} onClick={() => setMatSetOpen(!matSetOpen)} />
                <IconButton size="sm" icon="close" label="Close" onClick={() => setPanel(null)} />
              </PanelHead>
              <div className="kk-row moderow">
                <div className="kk-row kk-btngroup modes">
                  {MAT_TABS.map((t) => (
                    <IconButton key={t.v} size="sm" icon={t.icon} label={t.label} on={materialTypeTab === t.v} onClick={() => setMaterialTypeTab(t.v)} />
                  ))}
                </div>
              </div>

              {/* library: the main types of the current mode */}
              <Caption title={matInfo.title} desc={matInfo.desc} />
              {materialTypeTab === "pbr" && (
                <div className="mat-lib">
                  {Object.entries(MATERIAL_PRESETS).map(([key, preset]) => (
                    <Tile key={key} round image={preset.baseColor || undefined} color={GLASS_THUMB} title={preset.name} on={selectedPreset === key} onClick={() => pickMaterial(() => handlePresetChange(key))} />
                  ))}
                </div>
              )}
              {materialTypeTab === "custom" && (
                <div className="mat-lib">
                  {CUSTOM_COLORS.map((c) => (
                    <Tile key={c.id} round color={`radial-gradient(circle at 34% 30%, #ffffff66 0 10%, transparent 42%), ${c.color}`} title={c.name} on={customMaterial.baseColor === c.color} onClick={() => pickMaterial(() => setCustomMaterial((prev) => ({ ...prev, baseColor: c.color })))} />
                  ))}
                </div>
              )}
              {materialTypeTab === "gradient" && (
                <div className="mat-lib">
                  {(["radial", "linear"] as const).map((t) => (
                    <Tile
                      key={t}
                      round
                      color={
                        t === "radial"
                          ? `radial-gradient(circle at 40% 35%, ${gradientSettings.color1}, ${gradientSettings.color2})`
                          : `linear-gradient(135deg, ${gradientSettings.color1}, ${gradientSettings.color2})`
                      }
                      title={t === "radial" ? "Radial" : "Linear"}
                      on={gradientSettings.type === t}
                      onClick={() => pickMaterial(() => setGradientSettings((prev) => ({ ...prev, type: t })))}
                    />
                  ))}
                </div>
              )}
              {materialTypeTab === "layered" && (
                <div className="mat-lib">
                  {LAYERED_PALETTES.map((p) => (
                    <Tile
                      key={p.name}
                      round
                      color={`radial-gradient(ellipse 34% 26% at 66% 72%, #101014 0 45%, #b9b9c0 70%, transparent 100%), radial-gradient(circle at 30% 28%, #ffffff66 0 7%, transparent 26%), linear-gradient(135deg, ${p.colors[0]}, ${p.colors[1]} 55%, ${p.colors[2]})`}
                      title={p.name}
                      on={layered.colorA === p.colors[0] && layered.colorB === p.colors[1] && layered.colorC === p.colors[2]}
                      onClick={() => pickMaterial(() => setLay({ colorA: p.colors[0], colorB: p.colors[1], colorC: p.colors[2] }))}
                    />
                  ))}
                </div>
              )}
              {materialTypeTab === "matcap" && (
                <div className="mat-lib">
                  {Object.entries(MATCAP_PRESETS).map(([key, preset]) => (
                    <Tile
                      key={key}
                      round
                      image={preset.matcap}
                      title={preset.name}
                      on={selectedMatcap === key}
                      onClick={() =>
                        pickMaterial(() => {
                          setSelectedMatcap(key)
                          setMatcapTexture(preset.matcap)
                          setRenderMode("matcap")
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* settings of the selected material, opens next to the library */}
          {panel === "material" && matSetOpen && (
            <div {...win("matset", "kk-panel matset enter", true)} aria-label="Material settings">
              <PanelHead eyebrow="Material settings">
                <IconButton size="sm" icon="close" label="Close settings" onClick={() => setMatSetOpen(false)} />
              </PanelHead>
              <div className="matsel">
                <span className="matsel-thumb" style={{ ["--c" as string]: matInfo.thumb }} aria-hidden="true" />
                <Caption title={matInfo.title} desc={matInfo.desc} />
              </div>

              {materialTypeTab === "custom" && (
                <>
                  <div className="kk-card">
                    <ColorField label="Base color" value={customMaterial.baseColor} onChange={(v) => setCustomMaterial((prev) => ({ ...prev, baseColor: v }))} />
                  </div>
                  <div className="kk-card">
                    {(["normal", "roughness", "metalness"] as const).map((kind) => (
                      <div className="maprow" key={kind}>
                        <span className="tlabel">{kind === "normal" ? "NORMAL MAP" : kind === "roughness" ? "ROUGHNESS" : "METALNESS"}</span>
                        <div className="mat-sw mat-sw--4">
                          {CUSTOM_TEXTURES[kind].map((tex) => (
                            <Tile key={tex.id} image={tex.url} title={tex.name} on={customMaterial[kind] === tex.url} onClick={() => setCustomMaterial((prev) => ({ ...prev, [kind]: tex.url }))} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {materialTypeTab === "gradient" && (
                <>
                  <div className="kk-card">
                    <span className="tlabel">COLORS</span>
                    <ColorField label="Primary" value={gradientSettings.color1} onChange={(v) => setGradientSettings((prev) => ({ ...prev, color1: v }))} />
                    <ColorField label="Secondary" value={gradientSettings.color2} onChange={(v) => setGradientSettings((prev) => ({ ...prev, color2: v }))} />
                    <div className="kk-switchrow">
                      <span>Use 3 colors</span>
                      <Switch label="Use 3 colors" on={gradientSettings.useThreeColors} onChange={(v) => setGradientSettings((prev) => ({ ...prev, useThreeColors: v }))} />
                    </div>
                    {gradientSettings.useThreeColors && <ColorField label="Tertiary" value={gradientSettings.color3} onChange={(v) => setGradientSettings((prev) => ({ ...prev, color3: v }))} />}
                    <div
                      className="kk-colorbar"
                      style={{
                        ["--c" as string]: `linear-gradient(90deg, ${gradientSettings.color1}, ${gradientSettings.color2}${gradientSettings.useThreeColors ? `, ${gradientSettings.color3}` : ""})`,
                      }}
                    />
                  </div>
                  <div className="kk-card">
                    <Field icon="sun" label="Intensity" value={gradientSettings.intensity} min={0} max={2} step={0.1} onChange={(v) => setGradientSettings((prev) => ({ ...prev, intensity: v }))} />
                    <Field icon="wave" label="Distortion" value={gradientSettings.distortion} min={0} max={1} step={0.1} onChange={(v) => setGradientSettings((prev) => ({ ...prev, distortion: v }))} />
                    {gradientSettings.type === "linear" && (
                      <Field
                        icon="angle"
                        label="Angle"
                        value={gradientSettings.angle || 0}
                        min={0}
                        max={Math.PI * 2}
                        step={0.1}
                        format={(v) => `${Math.round((v * 180) / Math.PI)}°`}
                        onChange={(v) => setGradientSettings((prev) => ({ ...prev, angle: v }))}
                      />
                    )}
                    <Field icon="snow" label="Noise" value={(gradientSettings as any).noise || 0} min={0} max={2} step={0.1} onChange={(v) => setGradientSettings((prev) => ({ ...prev, noise: v }) as any)} />
                  </div>
                </>
              )}

              {materialTypeTab === "layered" && (
                <>
                  <div className="kk-card">
                    <span className="tlabel">GRADIENT LAYER</span>
                    <ColorField label="Color A" value={layered.colorA} onChange={(v) => setLay({ colorA: v })} />
                    <ColorField label="Color B" value={layered.colorB} onChange={(v) => setLay({ colorB: v })} />
                    <ColorField label="Color C" value={layered.colorC} onChange={(v) => setLay({ colorC: v })} />
                    <div className="kk-colorbar" style={{ ["--c" as string]: `linear-gradient(90deg, ${layered.colorA}, ${layered.colorB}, ${layered.colorC})` }} />
                    <Segmented
                      value={layered.axis}
                      onChange={(v) => setLay({ axis: v })}
                      options={[
                        { v: "x", label: "X axis" },
                        { v: "y", label: "Y axis" },
                        { v: "z", label: "Z axis" },
                      ]}
                    />
                    <Field icon="wave" label="Gradient softness" value={layered.softness} min={0} max={1} step={0.01} onChange={(v) => setLay({ softness: v })} />
                    <Field icon="sun" label="Ambient light" value={layered.ambient} min={0} max={1} step={0.01} onChange={(v) => setLay({ ambient: v })} />
                  </div>
                  <div className="kk-card">
                    <span className="tlabel">MATCAP LAYER</span>
                    <div className="mat-lib mat-lib--sm">
                      {Object.entries(MATCAP_PRESETS).map(([key, preset]) => (
                        <Tile key={key} round image={preset.matcap} title={preset.name} on={layered.matcap === preset.matcap} onClick={() => setLay({ matcap: preset.matcap })} />
                      ))}
                    </div>
                    <Segmented
                      value={layered.blend}
                      onChange={(v) => setLay({ blend: v })}
                      options={[
                        { v: "replace", label: "Replace" },
                        { v: "modulate", label: "Modulate" },
                      ]}
                    />
                    <Field icon="bulb" label="Matcap intensity" value={layered.intensity} min={0} max={2} step={0.01} onChange={(v) => setLay({ intensity: v })} />
                  </div>
                  <div className="kk-card">
                    <Caption title="Hole mask" desc="Patches of matcap inside the gradient." />
                    <Field icon="circle" label="Coverage" value={layered.coverage} min={0} max={1} step={0.01} onChange={(v) => setLay({ coverage: v })} />
                    <Field icon="width" label="Hole scale" value={layered.holeScale} min={0} max={2} step={0.01} onChange={(v) => setLay({ holeScale: v })} />
                    <Field icon="drop" label="Hole softness" value={layered.holeSoftness} min={0} max={0.5} step={0.01} onChange={(v) => setLay({ holeSoftness: v })} />
                    <Field icon="layers" label="Mask detail" value={layered.maskDetail} min={1} max={5} step={1} onChange={(v) => setLay({ maskDetail: v })} />
                    <Field icon="snow" label="Mask blur" value={layered.maskBlur} min={0} max={1} step={0.01} onChange={(v) => setLay({ maskBlur: v })} />
                    <div className="kk-switchrow">
                      <span>Invert mask</span>
                      <Switch label="Invert mask" on={layered.invert} onChange={(v) => setLay({ invert: v })} />
                    </div>
                  </div>
                  <div className="kk-card">
                    <Field icon="spark" label="Grain" value={layered.grain} min={0} max={1} step={0.01} onChange={(v) => setLay({ grain: v })} />
                  </div>
                </>
              )}

              {materialTypeTab === "matcap" && (
                <>
                  <div className="kk-card">
                    <Field icon="hue" label="Hue shift" value={matcapHueShift} min={0} max={360} step={1} format={(v) => `${Math.round(v)}°`} onChange={setMatcapHueShift} />
                  </div>
                  <div className="kk-card">
                    <span className="tlabel">NORMAL MAP</span>
                    <div className="mat-lib">
                      <Tile round title="No normal map" color="var(--panel-line)" on={matcapSettings.normalMap === ""} onClick={() => setMatcapSettings({ ...matcapSettings, normalMap: "" })}>
                        <Icon name="close" />
                      </Tile>
                      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                        <Tile
                          key={i}
                          round
                          image={`/images/custom/normal-${i}.jpg`}
                          title={`Normal ${i}`}
                          on={matcapSettings.normalMap === `/images/custom/normal-${i}.jpg`}
                          onClick={() => setMatcapSettings({ ...matcapSettings, normalMap: `/images/custom/normal-${i}.jpg` })}
                        />
                      ))}
                    </div>
                    {matcapSettings.normalMap && (
                      <>
                        <Field icon="layers" label="Intensity" value={matcapSettings.normalIntensity} min={0} max={3} step={0.05} onChange={(v) => setMatcapSettings({ ...matcapSettings, normalIntensity: v })} />
                        <Field icon="grid" label="Repeat" value={matcapSettings.normalRepeat} min={0.5} max={10} step={0.5} onChange={(v) => setMatcapSettings({ ...matcapSettings, normalRepeat: v })} />
                      </>
                    )}
                  </div>
                  <div className="kk-card">
                    <Caption title="Rim lighting" desc="Edge glow for extra depth." />
                    <ColorField label="Rim color" value={matcapSettings.rimColor} onChange={(v) => setMatcapSettings({ ...matcapSettings, rimColor: v })} />
                    <Field icon="sun" label="Intensity" value={matcapSettings.rimIntensity} min={0} max={2} step={0.05} onChange={(v) => setMatcapSettings({ ...matcapSettings, rimIntensity: v })} />
                    <Field icon="radiate" label="Power" value={matcapSettings.rimPower} min={1} max={10} step={0.5} onChange={(v) => setMatcapSettings({ ...matcapSettings, rimPower: v })} />
                  </div>
                </>
              )}

              {(materialTypeTab === "pbr" || materialTypeTab === "custom") && (
                <>
                  <div className="kk-card" id="matSurface">
                    <Field icon="layers" label="Normal scale" value={materialSettings.normalScale} min={0} max={3} step={0.1} onChange={(v) => setMat({ normalScale: v })} />
                    <Field icon="snow" label="Roughness" value={materialSettings.roughness} min={0} max={1} step={0.01} onChange={(v) => setMat({ roughness: v })} />
                    {geoType === "sphere" && (
                      <Field icon="height" label="Displacement" value={materialSettings.displacementScale} min={0} max={1} step={0.01} onChange={(v) => setMat({ displacementScale: v })} />
                    )}
                    {selectedPreset !== "dirtyGlass" && selectedPreset !== "scratchedGlass" && (
                      <Field icon="dial" label="Metalness" value={materialSettings.metalness} min={0} max={1} step={0.01} onChange={(v) => setMat({ metalness: v })} />
                    )}
                    <Field icon="grid" label="Texture scale" hint="Tiling of the textures" value={materialSettings.textureScale} min={0.1} max={10} step={0.1} onChange={(v) => setMat({ textureScale: v })} />
                  </div>

                  {materialSettings.transmission === 0 && (
                    <div className="kk-card" id="matBase">
                      <SwitchRow
                        title="Base color"
                        desc={materialSettings.useHueShift ? "Shifts texture colors by rotating the hue." : "Tints the texture with a colour. Switch on for hue shifting."}
                        on={materialSettings.useHueShift}
                        onChange={(v) => setMat({ useHueShift: v })}
                      />
                      {materialSettings.useHueShift ? (
                        <div className="hue-field">
                          <Field icon="hue" label="Hue shift" value={materialSettings.hueShift} min={0} max={360} step={1} format={(v) => `${Math.round(v)}°`} onChange={(v) => setMat({ hueShift: v })} />
                          <div
                            className="kk-colorbar"
                            style={{ ["--c" as string]: `linear-gradient(to right, hsl(${materialSettings.hueShift},70%,50%), hsl(${(materialSettings.hueShift + 30) % 360},70%,50%))` }}
                          />
                        </div>
                      ) : (
                        <>
                          <ColorField label="Color tint" value={materialSettings.colorTint} onChange={(v) => setMat({ colorTint: v })} />
                          <div className="kk-colorbar" style={{ ["--c" as string]: materialSettings.colorTint }} />
                        </>
                      )}
                    </div>
                  )}

                  {isGlass && (
                    <>
                      <div className="kk-card">
                        <Caption title="Glass" desc="Transmission and refraction." />
                        <Field icon="drop" label="Transmission" value={materialSettings.transmission} min={0} max={1} step={0.01} onChange={(v) => setMat({ transmission: v })} />
                        <Field icon="eye" label="IOR" value={materialSettings.ior} min={1} max={2.5} step={0.01} onChange={(v) => setMat({ ior: v })} />
                        <Field icon="width" label="Thickness" hint="Simulated volume depth" value={materialSettings.thickness} min={0} max={10} step={0.1} onChange={(v) => setMat({ thickness: v })} />
                      </div>
                      <div className="kk-card">
                        <Caption title="Attenuation" desc="How light is absorbed while passing through." />
                        <Field icon="radiate" label="Distance" hint="Higher = clearer" value={materialSettings.attenuationDistance} min={0.1} max={10} step={0.1} onChange={(v) => setMat({ attenuationDistance: v })} />
                        <ColorField label="Tint color" value={materialSettings.attenuationColor} onChange={(v) => setMat({ attenuationColor: v })} />
                      </div>
                      <div className="kk-card">
                        <Caption title="Clearcoat" desc="Outer glossy layer — improves rendering on complex shapes." />
                        <Field icon="spark" label="Intensity" value={materialSettings.clearcoat} min={0} max={1} step={0.01} onChange={(v) => setMat({ clearcoat: v })} />
                        <Field icon="snow" label="Roughness" value={materialSettings.clearcoatRoughness} min={0} max={1} step={0.01} onChange={(v) => setMat({ clearcoatRoughness: v })} />
                      </div>
                      <div className="kk-card">
                        <Caption title="Glass color" desc="Colour tint on the glass surface." />
                        <Field icon="palette" label="Intensity" value={materialSettings.glassColorIntensity} min={0} max={1} step={0.01} onChange={(v) => setMat({ glassColorIntensity: v })} />
                        {materialSettings.glassColorIntensity > 0 && <ColorField label="Color" value={materialSettings.glassColor} onChange={(v) => setMat({ glassColor: v })} />}
                      </div>
                      <div className="kk-card">
                        <Caption title="Iridescence" desc="Thin-film rainbow, like soap bubbles or oil on water." />
                        <Field icon="hue" label="Intensity" value={materialSettings.iridescence} min={0} max={1} step={0.01} onChange={(v) => setMat({ iridescence: v })} />
                        {materialSettings.iridescence > 0 && (
                          <>
                            <Field icon="eye" label="Film IOR" value={materialSettings.iridescenceIOR} min={1} max={2.5} step={0.01} onChange={(v) => setMat({ iridescenceIOR: v })} />
                            <Field icon="minus" label="Thickness min" value={materialSettings.iridescenceThicknessMin} min={0} max={800} step={10} format={(v) => `${Math.round(v)}nm`} onChange={(v) => setMat({ iridescenceThicknessMin: v })} />
                            <Field icon="plus" label="Thickness max" value={materialSettings.iridescenceThicknessMax} min={0} max={1200} step={10} format={(v) => `${Math.round(v)}nm`} onChange={(v) => setMat({ iridescenceThicknessMax: v })} />
                          </>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
          {panel === null && (
            <button type="button" className="kk-spark matopen" aria-label="Open material" title="Material" onClick={() => setPanel("material")}>
              <Icon name="palette" />
            </button>
          )}

          {/* right: lighting */}
          {panel === "light" && (
            <div {...win("light", "kk-panel sunbar enter")} aria-label="Lighting">
              <PanelHead eyebrow="Light · Environment">
                <IconButton size="sm" icon="close" label="Close lighting" onClick={() => setPanel("material")} />
              </PanelHead>
              {renderMode !== "pbr" || materialTypeTab === "gradient" || materialTypeTab === "layered" ? (
                <div className="kk-card">
                  <Caption
                    title="PBR lighting is off"
                    desc={materialTypeTab === "gradient" ? "Gradient materials use their own shading and don't support PBR lighting." : "Matcap materials use baked lighting and can't be adjusted."}
                  />
                </div>
              ) : (
                <>
                  <div className="kk-row" style={{ flexWrap: "wrap", gap: 5 }}>
                    {(["studio", "sunset", "dawn", "warehouse", "forest"] as const).map((env) => (
                      <button key={env} type="button" className={`kk-pill envpill ${lightingSettings.envMap === env ? "is-on" : ""}`} onClick={() => setLight({ envMap: env })}>
                        {env[0].toUpperCase() + env.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div className="kk-card">
                    <Field
                      icon="orbit"
                      label="Direction"
                      value={lightingSettings.envRotation}
                      min={0}
                      max={Math.PI * 2}
                      step={0.01}
                      format={(v) => `${Math.round((v * 180) / Math.PI)}°`}
                      onChange={(v) => setLight({ envRotation: v })}
                    />
                    <Field icon="sun" label="Key light" value={lightingSettings.directionalIntensity} min={0} max={5} step={0.1} onChange={(v) => setLight({ directionalIntensity: v })} />
                    <Field icon="drop" label="Ambient fill" value={lightingSettings.ambientIntensity} min={0} max={2} step={0.05} onChange={(v) => setLight({ ambientIntensity: v })} />
                  </div>
                  <div className="kk-card">
                    <Field icon="image" label="HDRI intensity" value={lightingSettings.envIntensity} min={0} max={5} step={0.1} onChange={(v) => setLight({ envIntensity: v })} />
                    <Field icon="bulb" label="Exposure" value={lightingSettings.exposure} min={0.1} max={5} step={0.1} onChange={(v) => setLight({ exposure: v })} />
                  </div>
                  <p className="hint2">
                    <b>Drag the sun</b> around the object to turn the light. Scroll over it to change the key light.
                  </p>
                </>
              )}
            </div>
          )}

          {/* right: rotate */}
          {panel === "rotate" && <RotatePanel onClose={() => setPanel("material")} win={win("rotate", "kk-panel rotbar enter")} />}

          {/* right: theme tuner */}
          {panel === "theme" && (
            <div {...win("theme", "kk-panel tunerbar enter")} aria-label="Theme">
              <PanelHead eyebrow="Theme · Knopika">
                <IconButton
                  size="sm"
                  icon="undo"
                  label="Reset theme"
                  onClick={() => {
                    setTheme(THEME_DEFAULT)
                    setBackgroundColor(GROUNDS[0].hex)
                    setTStatus("Theme reset to the base style.")
                    setTOut(null)
                  }}
                />
                <IconButton size="sm" icon="close" label="Close theme" onClick={() => setPanel("material")} />
              </PanelHead>

              <div className="tprev" aria-hidden="true">
                <button type="button" className="kk-play" tabIndex={-1}>
                  <Icon name="play" />
                </button>
                <button type="button" className="kk-spark" tabIndex={-1}>
                  <Icon name="sun" />
                </button>
                <span className="kk-pillgroup">
                  <Icon name="minus" />
                  100%
                  <Icon name="plus" />
                </span>
                <span className="kk-ibtn kk-ibtn--ground is-on">
                  <Icon name="grid" />
                </span>
                <label className="kk-pillgroup" style={{ width: 170 }}>
                  <Icon name="speaker" />
                  <Range ink label="Example slider" value={tDemo} min={0} max={100} onChange={setTDemo} />
                </label>
              </div>

              <div className="kk-card">
                <span className="tlabel">COMPONENT STYLE</span>
                <Segmented
                  value={theme.style}
                  onChange={(v) => setT("style", v)}
                  options={[
                    { v: "classic", label: "Classic" },
                    { v: "expressive", label: "Expressive" },
                    { v: "block", label: "Block" },
                  ]}
                />
                {theme.style === "expressive" && (
                  <>
                    <span className="tlabel">ACCENT SHAPE</span>
                    <Segmented
                      value={theme.shape}
                      onChange={(v) => setT("shape", v)}
                      options={[
                        { v: "cookie", label: "Cookie" },
                        { v: "sunny", label: "Sunny" },
                        { v: "clover", label: "Clover" },
                        { v: "squircle", label: "Squircle" },
                      ]}
                    />
                  </>
                )}
              </div>

              <div className="kk-card">
                <span className="tlabel">GROUND &amp; PANELS</span>
                <div className="tgrounds">
                  {GROUNDS.map((g) => (
                    <button
                      key={g.hex}
                      type="button"
                      className={`bgdot ${backgroundColor.toLowerCase() === g.hex ? "is-on" : ""}`}
                      style={{ ["--c" as string]: g.hex }}
                      aria-label={g.name}
                      title={g.name}
                      onClick={() => setBackgroundColor(g.hex)}
                    />
                  ))}
                  <label
                    className={`bgdot bgpick ${GROUNDS.some((g) => g.hex === backgroundColor.toLowerCase()) ? "" : "is-on"}`}
                    style={{ ["--c" as string]: "conic-gradient(#f33,#fb3,#3c9,#3bf,#c4e,#f33)" }}
                    title="Custom colour"
                  >
                    <input type="color" value={backgroundColor} aria-label="Custom ground colour" onChange={(e) => setBackgroundColor(e.target.value)} />
                  </label>
                </div>
                <ColorField label="Ground" value={backgroundColor} onChange={setBackgroundColor} />
                <Segmented
                  value={theme.tint ? "1" : "0"}
                  onChange={(v) => setT("tint", v === "1")}
                  options={[
                    { v: "1", label: "Ground tint" },
                    { v: "0", label: "Black" },
                  ]}
                />
                <Field icon="drop" label="Panel depth" value={theme.depth} min={60} max={100} step={1} format={(v) => (v / 100).toFixed(2)} onChange={(v) => setT("depth", v)} />
                <Field icon="circle" label="Window outline" value={theme.edge} min={0} max={100} step={5} format={(v) => (v ? `${v}%` : "none")} onChange={(v) => setT("edge", v)} />
              </div>

              {(
                [
                  ["radius", "RADII"],
                  ["size", "SIZES"],
                  ["space", "SPACING"],
                  ["icon", "ICONS"],
                ] as const
              ).map(([group, title]) => (
                <div className="kk-card" key={group}>
                  <span className="tlabel">{title}</span>
                  {TUNER_ROWS[group].map((r) => (
                    <Field
                      key={r.k}
                      icon={r.icon}
                      label={r.label}
                      value={theme[r.k] as number}
                      min={r.min}
                      max={r.max}
                      step={r.step}
                      format={(v) => (r.k === "iconWeight" ? WEIGHTS[v] : fmtRow(r, v))}
                      onChange={(v) => setT(r.k, (r.k === "radiusPill" && v >= 41 ? 999 : v) as never)}
                    />
                  ))}
                </div>
              ))}

              <div className="kk-card">
                <span className="tlabel">FONTS</span>
                <label className="kk-select">
                  <select value={theme.display} aria-label="Display font" onChange={(e) => setT("display", e.target.value)}>
                    {Object.keys(FONTS_DISPLAY).map((n) => (
                      <option key={n} value={n}>
                        Display · {n}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevron" />
                </label>
                <label className="kk-select">
                  <select
                    value={theme.ui}
                    aria-label="Interface font"
                    onChange={(e) => {
                      const v = e.target.value
                      setTheme((t) => ({ ...t, ui: v, caps: v === "F5.6" ? true : t.caps }))
                    }}
                  >
                    {Object.keys(FONTS_UI).map((n) => (
                      <option key={n} value={n}>
                        Interface · {n}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevron" />
                </label>
                <Segmented
                  value={theme.caps ? "1" : "0"}
                  onChange={(v) => setT("caps", v === "1")}
                  options={[
                    { v: "0", label: "As written" },
                    { v: "1", label: "CAPS" },
                  ]}
                />
                <Field icon="width" label="Caps tracking" value={theme.track} min={0} max={16} step={1} format={(v) => `${(v / 100).toFixed(2)}em`} onChange={(v) => setT("track", v)} />
              </div>

              <div className="kk-card">
                <span className="tlabel">EXPORT</span>
                <div className="kk-row" style={{ gap: 6, flexWrap: "wrap" }}>
                  <button type="button" className="kk-pill" onClick={() => copyOut(exportCss(backgroundColor, theme), "CSS variables copied.")}>
                    <Icon name="copy" />
                    CSS
                  </button>
                  <button type="button" className="kk-pill" onClick={() => copyOut(exportJson(backgroundColor, theme, WEIGHTS), "tokens.json copied.")}>
                    <Icon name="copy" />
                    tokens.json
                  </button>
                </div>
                {tOut !== null && <textarea className="tout" readOnly value={tOut} aria-label="Export" ref={tOutRef} />}
                <p className="tstatus">{tStatus}</p>
              </div>
              <div className="kk-card">
                <span className="tlabel">WINDOWS</span>
                <p className="hint2">Drag windows by their header. Material settings and the Shape panel snap back to their place when dropped near it.</p>
                <button type="button" className="kk-pill" disabled={!drag.anyMoved} onClick={() => drag.reset()}>
                  <Icon name="undo" />
                  Reset window positions
                </button>
              </div>
            </div>
          )}

          {/* bottom: geometry parameters */}
          <div className="geobar">
            <span className="gname" role="img" aria-label={geoType === "sphere" ? curPrim.label : curMode.label} title={geoType === "sphere" ? curPrim.label : curMode.label}>
              {geoType === "sphere" ? (
                <svg className="kk-shape" viewBox="0 0 24 24">
                  {curPrim.svg}
                </svg>
              ) : (
                <Icon name={curMode.icon} />
              )}
            </span>

            {geoType === "sphere" && geometrySettings.primitiveType !== "blob" && <span className="kk-pillgroup glabel">{curPrim.label}</span>}

            {geoType === "sphere" && geometrySettings.primitiveType === "blob" && (
              <>
                <span className="kk-pillgroup gseed" title="Seed">
                  <span className="gseed-l">seed</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={blob.seed}
                    aria-label="Seed"
                    onChange={(e) => {
                      const v = parseInt(e.target.value.replace(/\D/g, "") || "0", 10)
                      setBlob({ seed: Math.min(99999, v) })
                    }}
                  />
                  <button type="button" className="kk-ibtn kk-ibtn--ground" aria-label="Random seed" title="Random seed" onClick={() => setBlob({ seed: Math.floor(Math.random() * 99999) })}>
                    <Icon name="shuffle" />
                  </button>
                </span>
                <span className="kk-pillgroup gaxis">
                  {BLOB_BASES.map((b) => (
                    <button key={b.v} type="button" className={`kk-pill ${blob.base === b.v ? "is-on" : ""}`} onClick={() => setBlob({ base: b.v })}>
                      {b.label}
                    </button>
                  ))}
                </span>
                {GP({ icon: "height", label: "Amplitude", value: blob.amplitude, min: 0, max: 1, step: 0.01, onChange: (v) => setBlob({ amplitude: v }) })}
                {GP({ icon: "wave", label: "Frequency", value: blob.frequency, min: 0.1, max: 3, step: 0.05, onChange: (v) => setBlob({ frequency: v }) })}
                {GP({ icon: "layers", label: "Detail", value: blob.octaves, min: 1, max: 6, step: 1, onChange: (v) => setBlob({ octaves: v }) })}
                <span className="sep" />
                {GT({ icon: "play", label: "Morph", on: blob.animate, onChange: (v) => setBlob({ animate: v }) })}
                {blob.animate && GP({ icon: "refresh", label: "Morph speed", value: blob.speed, min: 0.05, max: 2, step: 0.05, onChange: (v) => setBlob({ speed: v }) })}
              </>
            )}

            {geoType === "model" && (
              <button type="button" className="kk-pillgroup glabel gbtn" onClick={() => setShowModelSearch(true)}>
                <Icon name="search" />
                {geometrySettings.modelName || "Choose a model"}
              </button>
            )}

            {geoType === "extruded" && (
              <>
                {GP({ icon: "width", label: "Thickness", value: geometrySettings.thickness, min: 1, max: 100, step: 1, onChange: (v) => setGeo({ thickness: v }) })}
                {GP({ icon: "angle", label: "Bevel", value: geometrySettings.bevelSize, min: 0, max: 10, step: 0.1, onChange: (v) => setGeo({ bevelSize: v }) })}
                {GP({ icon: "meter", label: "Bevel segments", value: geometrySettings.bevelSegments, min: 1, max: 20, step: 1, onChange: (v) => setGeo({ bevelSegments: v }) })}
                {GP({ icon: "spark", label: "Curve quality", value: geometrySettings.bevelQuality, min: 1, max: 100, step: 1, onChange: (v) => setGeo({ bevelQuality: v }) })}
                {GP({ icon: "grid", label: "Texture scale", value: geometrySettings.textureScale, min: 0.1, max: 5, step: 0.05, onChange: (v) => setGeo({ textureScale: v }) })}
                <span className="sep" />
                {GT({
                  icon: "refresh",
                  label: "Pottery",
                  on: geometrySettings.usePotteryMode,
                  onChange: (checked) => setGeo({ usePotteryMode: checked, ...(checked ? { useInflateMode: false } : {}) } as any),
                })}
                {geometrySettings.usePotteryMode && (
                  <>
                    <span className="kk-pillgroup gaxis">
                      {(["center", "right", "bottom"] as const).map((axis, i) => (
                        <button key={axis} type="button" className={`kk-pill ${geometrySettings.latheAxis === axis ? "is-on" : ""}`} onClick={() => setGeo({ latheAxis: axis })}>
                          {["Center", "Pos 1", "Pos 2"][i]}
                        </button>
                      ))}
                    </span>
                    {GP({ icon: "orbit", label: "Lathe segments", value: geometrySettings.latheSegments, min: 16, max: 64, step: 4, onChange: (v) => setGeo({ latheSegments: v }) })}
                  </>
                )}
              </>
            )}

            {geoType === "inflate" && (
              <>
                {GP({ icon: "inflate", label: "Volume", value: geometrySettings.inflateVolume ?? 100, min: 10, max: 200, step: 5, onChange: (v) => setGeo({ inflateVolume: v }) })}
                {!geometrySettings.inflateSharpRidge &&
                  GP({ icon: "wave", label: "Smoothing", value: geometrySettings.inflateSmoothing ?? 3, min: 0, max: 10, step: 1, onChange: (v) => setGeo({ inflateSmoothing: v }) })}
                {GP({ icon: "grid", label: "Grid resolution", value: geometrySettings.inflateGridResolution ?? 150, min: 40, max: 240, step: 5, onChange: (v) => setGeo({ inflateGridResolution: v }) })}
                <span className="sep" />
                {GT({ icon: "mirror", label: "Double sided", on: geometrySettings.inflateBothSides ?? true, onChange: (v) => setGeo({ inflateBothSides: v }) })}
                {GT({ icon: "star", label: "Sharp ridge", on: geometrySettings.inflateSharpRidge ?? false, onChange: (v) => setGeo({ inflateSharpRidge: v }) })}
                {geometrySettings.inflateSharpRidge &&
                  GP({ icon: "angle", label: "Ridge sharpness", value: geometrySettings.inflateRidgeSharpness ?? 5, min: 1, max: 10, step: 1, onChange: (v) => setGeo({ inflateRidgeSharpness: v }) })}
              </>
            )}
          </div>
        </div>

        {showModelSearch && (
          <ModelSearch
            onSelect={(model) => {
              const modelUrl = model.glbUrl || model.gltfUrl
              if (modelUrl) {
                setGeometrySettings({
                  ...geometrySettings,
                  modelUrl,
                  modelName: model.name,
                })
              }
            }}
            onClose={() => setShowModelSearch(false)}
          />
        )}
      </div>
    </IconWeightContext.Provider>
  )
}
