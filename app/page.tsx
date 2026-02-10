"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import type React from "react"
import useSWR from "swr"

import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PBRViewer, type PBRViewerRef } from "@/components/pbr-viewer"
import { MatcapPreview } from "@/components/matcap-preview"
import { ChevronDown, ChevronUp, Upload, Download, Search, Loader2, X, Info } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { ModelSearch } from "@/components/model-search"

// Import MaterialPreview component
import { MaterialPreview } from "@/components/material-preview"

import { LightRotationControl } from "@/components/light-rotation-control"

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
    primitiveType: "sphere" as "sphere" | "cone" | "torus" | "torusKnot" | "capsule",
    svgPath: SVG_PATHS.star,
    // Remove selectedShape tracking for NounProject
    // selectedShape: "star" as keyof typeof SVG_PATHS,
    selectedShape: "star", // Keep for now, will be null/custom for non-standard shapes
    thickness: 4,
    bevelSize: 0.9,
    bevelSegments: 18,
    bevelQuality: 78,
    textureScale: 1.0, // Added textureScale for sphere
    modelUrl: null as string | null,
    modelName: null as string | null,
    inflationAmount: 0, // 0 = no inflation, 1 = max inflation
    inflateSphereEnabled: true, // Inflate Sphere Position ON/OFF
    inflateSpherePosition: [0, 0, 0] as [number, number, number], // X, Y, Z центра сферы
    inflateSphereRadius: 0.5, // Радиус сферы влияния (меньшее значение для локального эффекта)
    flatBase: false, // Flat Base toggle
    deformEnabled: false, // Enable deform для extruded SVG
    usePotteryMode: false, // Pottery wheel/lathe mode
    latheSegments: 32, // Number of segments around the axis for lathe geometry
    latheAxis: 'center' as 'center' | 'left' | 'right' | 'top' | 'bottom', // Axis position for pottery wheel mode
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
  const [activeTab, setActiveTab] = useState("geometry")
  const [materialTypeTab, setMaterialTypeTab] = useState<"pbr" | "custom" | "gradient" | "matcap">(
    selectedPreset === "custom" ? "custom" : "pbr"
  )
  const [backgroundColor, setBackgroundColor] = useState("#1a1a1a")
  const [showGrid, setShowGrid] = useState(false)
  const [showRotateControls, setShowRotateControls] = useState(false)
  
  // Custom material selections
  const [customMaterial, setCustomMaterial] = useState({
    baseColor: CUSTOM_COLORS[0].color,
    normal: CUSTOM_TEXTURES.normal[0].url,
    roughness: CUSTOM_TEXTURES.roughness[0].url,
    metalness: CUSTOM_TEXTURES.metalness[0].url,
  })
  
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

  return (
    <div className="h-screen w-full bg-[#121212]">
      <div className="w-full h-full">
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
          showGrid={showGrid}
          showRotateControls={showRotateControls}
          gradientSettings={gradientSettings}
          customMaterial={customMaterial}
          onModelLoadError={setModelLoadError}
          onGeometrySettingsChange={(updates) => 
            setGeometrySettings({ ...geometrySettings, ...updates })
          }
        />
      </div>

      <button
        onClick={handleExportPNG}
        className="fixed top-4 left-4 z-50 flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] hover:bg-[#353535] text-white text-sm rounded-lg border border-[#404040] transition-all shadow-lg"
        title="Export PNG with transparent background"
      >
        <Download className="w-4 h-4" />
        Export PNG
      </button>

      <div className="fixed top-0 right-0 h-screen w-[340px] border-l border-[#2a2a2a] bg-[#1a1a1a] overflow-y-auto z-50">
        <div className="py-5 space-y-4">
          <div className="pb-4 flex items-center justify-between px-4">
            <img src="/logo-polya.png" alt="pólya" className="h-24 mx-[30px]" />
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value)}>
            <TabsList className="flex w-full bg-transparent p-0 px-4 mb-5 gap-1">
              <TabsTrigger
                value="geometry"
                className="text-zinc-500 text-sm py-2 px-4 rounded-lg data-[state=active]:bg-[#2d2d2d] data-[state=active]:text-white hover:text-zinc-300 transition-colors"
              >
                Geometry
              </TabsTrigger>
              <TabsTrigger
                value="material"
                className="text-zinc-500 text-sm py-2 px-4 rounded-lg data-[state=active]:bg-[#2d2d2d] data-[state=active]:text-white hover:text-zinc-300 transition-colors"
              >
                Material
              </TabsTrigger>
              <TabsTrigger
                value="lighting"
                className="text-zinc-500 text-sm py-2 px-4 rounded-lg data-[state=active]:bg-[#2d2d2d] data-[state=active]:text-white hover:text-zinc-300 transition-colors"
              >
                Lighting
              </TabsTrigger>
            </TabsList>

            <TabsContent value="geometry">
              <div className="space-y-4 px-4">
                {/* Geometry Settings */}
                <div className="flex flex-col gap-6">
                  <div className="grid grid-cols-3 gap-6">
                    <div className="flex flex-col items-center gap-3">
                      <button
                        onClick={() => {
                          setGeometrySettings({ ...geometrySettings, type: "sphere" })
                        }}
                        className={`w-24 h-24 flex items-center justify-center rounded-lg border-2 transition-all overflow-hidden ${
                          geometrySettings.type === "sphere"
                            ? "border-white bg-[#1f1f1f]"
                            : "border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#3a3a3a]"
                        }`}
                      >
                        <img
                          src="/geometry-modes/primitives.png"
                          alt="Primitives"
                          className="w-full h-full object-cover"
                        />
                      </button>
                      <span className="text-xs font-normal text-zinc-500">Primitives</span>
                    </div>

                    <div className="flex flex-col items-center gap-3">
                      <button
                        onClick={() => {
                          setGeometrySettings({ ...geometrySettings, type: "extruded" })
                          setMaterialSettings((prev) => ({
                            ...prev,
                            useDisplacementMap: false,
                            displacementScale: 0,
                          }))
                        }}
                        className={`w-24 h-24 flex items-center justify-center rounded-lg border-2 transition-all overflow-hidden ${
                          geometrySettings.type === "extruded"
                            ? "border-white bg-[#1f1f1f]"
                            : "border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#3a3a3a]"
                        }`}
                      >
                        <img
                          src="/geometry-modes/vector.png"
                          alt="Vector"
                          className="w-full h-full object-cover"
                        />
                      </button>
                      <span className="text-xs font-normal text-zinc-500">Vector</span>
                    </div>

                    <div className="flex flex-col items-center gap-3">
                      <button
                        onClick={() => {
                          setGeometrySettings({ ...geometrySettings, type: "model" })
                        }}
                        className={`w-24 h-24 flex items-center justify-center rounded-lg border-2 transition-all overflow-hidden ${
                          geometrySettings.type === "model"
                            ? "border-white bg-[#1f1f1f]"
                            : "border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#3a3a3a]"
                        }`}
                      >
                        <img
                          src="/geometry-modes/3d.png"
                          alt="3D"
                          className="w-full h-full object-cover"
                        />
                      </button>
                      <span className="text-xs font-normal text-zinc-500">3D</span>
                    </div>
                  </div>

                  {geometrySettings.type === "sphere" && (
                    <div className="space-y-3">
                      <Label className="text-xs text-zinc-500">Primitive Shapes</Label>
                      <div className="grid grid-cols-5 gap-3">
                        {[
                          { type: "sphere", label: "Sphere" },
                          { type: "cone", label: "Cone" },
                          { type: "torus", label: "Torus" },
                          { type: "torusKnot", label: "Knot" },
                          { type: "capsule", label: "Capsule" },
                        ].map((primitive) => (
                          <button
                            key={primitive.type}
                            onClick={() => {
                              setGeometrySettings({ ...geometrySettings, primitiveType: primitive.type as any })
                            }}
                            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                              geometrySettings.primitiveType === primitive.type
                                ? "bg-blue-600 text-white"
                                : "bg-[#2a2a2a] text-zinc-400 hover:bg-[#333333] hover:text-white"
                            }`}
                          >
                            {primitive.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {geometrySettings.type === "extruded" && (
                    <>
                      <div className="pt-4 space-y-3">
                        <Label className="text-xs text-zinc-500">Search Icons (Iconify)</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                          <Input
                            type="text"
                            placeholder="search icons..."
                            value={iconSearchInput}
                            onChange={(e) => handleIconSearch(e.target.value)}
                            className="pl-10 bg-[#2a2a2a] border-[#3a3a3a] text-white placeholder:text-zinc-600 rounded-lg w-full"
                          />
                          {iconSearchInput && (
                            <button
                              onClick={() => {
                                setIconSearchInput("")
                                setIconSearchQuery("")
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Search Results */}
                        {isSearchingIcons && (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                          </div>
                        )}

                        {iconSearchResults?.icons && iconSearchResults.icons.length > 0 && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto p-1">
                              {iconSearchResults.icons.map((icon) => (
                                <button
                                  key={icon.id}
                                  onClick={() => handleSelectIcon(icon)}
                                  className={`aspect-square rounded-lg p-2 flex items-center justify-center transition-all hover:scale-105 relative group ${
                                    selectedIcon?.id === icon.id
                                      ? "bg-[#00b8c4] ring-2 ring-[#00d4e0]"
                                      : "bg-[#2a2a2a] hover:bg-[#353535]"
                                  }`}
                                  title={`${icon.name} (${icon.source})`}
                                >
                                  <img
                                    src={icon.preview_url || "/placeholder.svg"}
                                    alt={icon.name}
                                    className="w-10 h-10 invert"
                                    loading="lazy"
                                  />
                                </button>
                              ))}
                            </div>
                            <p className="text-xs text-zinc-500 text-center">
                              Icons from Iconify ({iconSearchResults.total} found)
                            </p>
                          </div>
                        )}

                        {iconSearchQuery && !isSearchingIcons && iconSearchResults?.icons?.length === 0 && (
                          <p className="text-xs text-zinc-500 text-center py-4">
                            No icons found for "{iconSearchQuery}"
                          </p>
                        )}

                        {loadingIcons && (
                          <div className="flex items-center justify-center py-2">
                            <Loader2 className="w-4 h-4 text-white animate-spin mr-2" />
                            <span className="text-xs text-zinc-500">Loading SVG...</span>
                          </div>
                        )}

                        {error && <p className="text-xs text-red-400 text-center py-2">{error}</p>}

                        {/* SVG Upload */}
                        <div className="pt-4">
                          <div className="border-2 border-dashed border-[#3a3a3a] rounded-lg p-3 text-center hover:border-zinc-500 transition-colors bg-[#252525]">
                            <input
                              type="file"
                              accept=".svg"
                              onChange={handleSVGUpload}
                              className="hidden"
                              id="svg-upload-inline"
                            />
                            <label htmlFor="svg-upload-inline" className="cursor-pointer flex items-center justify-center gap-3">
                              <Upload className="w-5 h-5 text-zinc-500" />
                              <div className="text-left">
                                <p className="text-sm text-white">Drag & drop SVG files</p>
                                <p className="text-xs text-zinc-500">or click to browse</p>
                              </div>
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-[#2a2a2a]/50 my-3 hidden" />

                      <div className="pt-4 space-y-3 hidden">
                        <Label className="text-xs text-zinc-500">Basic Shapes</Label>
                        {Object.entries(SHAPE_CATEGORIES).map(([categoryKey, category]) => (
                          <div key={categoryKey} className="space-y-2">
                            <span className="text-xs text-zinc-500">{category.name}</span>
                            <div className="grid grid-cols-8 gap-1">
                              {category.shapes.map((shapeKey) => (
                                <button
                                  key={shapeKey}
                                  onClick={() =>
                                    setGeometrySettings({
                                      ...geometrySettings,
                                      selectedShape: shapeKey,
                                      svgPath: SHAPE_CATEGORIES[categoryKey as keyof typeof SHAPE_CATEGORIES].paths[shapeKey],
                                    })
                                  }
                                  className={`aspect-square rounded-lg p-2 flex items-center justify-center text-xs transition-all font-semibold ${
                                    geometrySettings.selectedShape === shapeKey
                                      ? "bg-blue-600 text-white"
                                      : "bg-[#2a2a2a] text-zinc-500 hover:bg-[#333333] hover:text-white"
                                  }`}
                                >
                                  {shapeKey.charAt(0).toUpperCase()}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {geometrySettings.type === "model" && (
                    <div className="space-y-3">
                      <button
                        onClick={() => setShowModelSearch(true)}
                        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <Search className="w-4 h-4" />
                        Search 3D Models
                      </button>
                      
                      {geometrySettings.modelName && (
                        <div className="p-3 bg-[#2a2a2a] rounded-lg">
                          <p className="text-sm text-white font-medium">{geometrySettings.modelName}</p>
                          <p className="text-xs text-zinc-500 mt-1">Currently loaded model</p>
                        </div>
                      )}
                      
                      {modelLoadError && (
                        <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg">
                          <p className="text-xs text-red-400">{modelLoadError}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Extruded SVG Specific Settings */}
                  {geometrySettings.type === "extruded" && (
                      <div className="pt-4 space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-zinc-500">Thickness</Label>
                            <span className="text-xs text-white font-mono">{geometrySettings.thickness}</span>
                          </div>
                          <Slider
                            value={[geometrySettings.thickness]}
                            onValueChange={([value]) => setGeometrySettings({ ...geometrySettings, thickness: value })}
                            min={1}
                            max={100}
                            step={1}
                            className="w-full"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-zinc-500">Bevel Size</Label>
                            <span className="text-xs text-white font-mono">
                              {geometrySettings.bevelSize.toFixed(1)}
                            </span>
                          </div>
                          <Slider
                            value={[geometrySettings.bevelSize]}
                            onValueChange={([value]) => setGeometrySettings({ ...geometrySettings, bevelSize: value })}
                            min={0}
                            max={10}
                            step={0.1}
                            className="w-full"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-zinc-500">Bevel Segments</Label>
                            <span className="text-xs text-white font-mono">{geometrySettings.bevelSegments}</span>
                          </div>
                          <Slider
                            value={[geometrySettings.bevelSegments]}
                            onValueChange={([value]) =>
                              setGeometrySettings({ ...geometrySettings, bevelSegments: value })
                            }
                            min={1}
                            max={20}
                            step={1}
                            className="w-full"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-zinc-500">Bevel Quality</Label>
                            <span className="text-xs text-white font-mono">{geometrySettings.bevelQuality}</span>
                          </div>
                          <Slider
                            value={[geometrySettings.bevelQuality]}
                            onValueChange={([value]) =>
                              setGeometrySettings({ ...geometrySettings, bevelQuality: value })
                            }
                            min={1}
                            max={100}
                            step={1}
                            className="w-full"
                          />
                          <p className="text-xs text-zinc-500">Controls curve smoothness (polygon count)</p>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-[#2a2a2a]/50">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-zinc-500">Texture Scale</span>
                            <span className="text-sm text-white font-mono tabular-nums">
                              {geometrySettings.textureScale.toFixed(2)}
                            </span>
                          </div>
                          <Slider
                            value={[geometrySettings.textureScale]}
                            onValueChange={([value]) =>
                              setGeometrySettings({ ...geometrySettings, textureScale: value })
                            }
                            min={0.1}
                            max={5}
                            step={0.05}
                            className=""
                          />
                          <p className="text-xs text-zinc-500">Adjusts texture tiling to fix stretching on bevels</p>
                        </div>

                        <div className="pt-4 space-y-4 border-t border-[#2a2a2a]/50">
                          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-neutral-800 border border-neutral-700">
                            <div className="flex-1">
                              <Label className="text-sm font-semibold text-neutral-100 block mb-1">
                                Pottery Wheel Mode
                              </Label>
                              <p className="text-xs text-neutral-400">
                                {geometrySettings.usePotteryMode
                                  ? "Rotate profile around central axis"
                                  : "Standard extrusion mode"}
                              </p>
                            </div>
                            <Switch
                              checked={geometrySettings.usePotteryMode}
                              onCheckedChange={(checked) =>
                                setGeometrySettings({ ...geometrySettings, usePotteryMode: checked })
                              }
                              className="data-[state=checked]:bg-amber-600"
                            />
                          </div>

                          {geometrySettings.usePotteryMode && (
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <Label className="text-xs text-zinc-500">Axis</Label>
                                <div className="grid grid-cols-3 gap-2">
                                  {(['center', 'right', 'bottom'] as const).map((axis) => {
                                    const axisLabels: Record<string, string> = {
                                      center: 'Center',
                                      right: 'Position 1',
                                      bottom: 'Position 2',
                                    }
                                    return (
                                      <button
                                        key={axis}
                                        onClick={() =>
                                          setGeometrySettings({ ...geometrySettings, latheAxis: axis })
                                        }
                                        className={`py-2 px-2 rounded text-xs font-medium transition-colors ${
                                          geometrySettings.latheAxis === axis
                                            ? 'bg-amber-600 text-white'
                                            : 'bg-neutral-700 text-zinc-400 hover:bg-neutral-600'
                                        }`}
                                      >
                                        {axisLabels[axis]}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-zinc-500">Bevel Segments</Label>
                                <span className="text-xs text-white font-mono">{geometrySettings.latheSegments}</span>
                              </div>
                              <Slider
                                value={[geometrySettings.latheSegments]}
                                onValueChange={([value]) =>
                                  setGeometrySettings({ ...geometrySettings, latheSegments: value })
                                }
                                min={16}
                                max={64}
                                step={4}
                                className="w-full"
                              />
                              <p className="text-xs text-zinc-500">Controls smoothness around the rotation axis (16-64 recommended)</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="material">
                <div className="space-y-4 px-4">
                  {/* Material Type Tabs */}
                  <Tabs value={materialTypeTab} onValueChange={setMaterialTypeTab} className="w-full">
                  <TabsList className="flex w-full bg-transparent p-0 gap-1 mb-4 border-b border-[#2a2a2a]">
                    <TabsTrigger
                      value="pbr"
                      className="text-zinc-500 text-xs py-2 px-3 rounded-t-lg data-[state=active]:bg-[#2d2d2d] data-[state=active]:text-white hover:text-zinc-300 transition-colors"
                    >
                      PBR
                    </TabsTrigger>
                    <TabsTrigger
                      value="custom"
                      className="text-zinc-500 text-xs py-2 px-3 rounded-t-lg data-[state=active]:bg-[#2d2d2d] data-[state=active]:text-white hover:text-zinc-300 transition-colors"
                    >
                      Custom (PBR)
                    </TabsTrigger>
                    <TabsTrigger
                      value="gradient"
                      className="text-zinc-500 text-xs py-2 px-3 rounded-t-lg data-[state=active]:bg-[#2d2d2d] data-[state=active]:text-white hover:text-zinc-300 transition-colors"
                    >
                      Gradient
                    </TabsTrigger>
                    <TabsTrigger
                      value="matcap"
                      className="text-zinc-500 text-xs py-2 px-3 rounded-t-lg data-[state=active]:bg-[#2d2d2d] data-[state=active]:text-white hover:text-zinc-300 transition-colors"
                    >
                      Matcap
                    </TabsTrigger>
                  </TabsList>

                  {/* PBR Tab */}
                  <TabsContent value="pbr">
                    {/* MaterialPreset Selector */}
                    <div className="rounded-lg overflow-hidden">
                      <div className="pb-4 space-y-3">
                        <Label className="text-xs text-zinc-500 pt-3 block">Material Presets</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {Object.entries(MATERIAL_PRESETS).map(([key, preset]) => (
                            <MaterialPreview
                              key={key}
                              baseColorUrl={preset.baseColor || "/placeholder.svg"}
                              isSelected={selectedPreset === key}
                              onClick={() => handlePresetChange(key)}
                              name={preset.name}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Custom PBR Tab */}
                  <TabsContent value="custom">
                    <div className="space-y-4 pt-2">
                      {/* Base Color - Simple Colors */}
                      <div className="space-y-2">
                        <Label className="text-xs text-zinc-500">Base Color</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {CUSTOM_COLORS.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => setCustomMaterial(prev => ({ ...prev, baseColor: c.color }))}
                              className={`aspect-square rounded-lg transition-all hover:scale-105 ${
                                customMaterial.baseColor === c.color
                                  ? "ring-2 ring-[#00b8c4]"
                                  : "ring-1 ring-[#3a3a3a]"
                              }`}
                              style={{ backgroundColor: c.color }}
                              title={c.name}
                            />
                          ))}
                        </div>
                        {/* Custom color picker */}
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="color"
                            value={customMaterial.baseColor}
                            onChange={(e) => setCustomMaterial(prev => ({ ...prev, baseColor: e.target.value }))}
                            className="w-8 h-8 rounded cursor-pointer bg-transparent border border-[#3a3a3a]"
                          />
                          <span className="text-xs text-zinc-500">Custom color</span>
                          <span className="text-xs text-zinc-400 font-mono ml-auto">{customMaterial.baseColor}</span>
                        </div>
                      </div>

                      {/* Normal Map Texture */}
                      <div className="space-y-2">
                        <Label className="text-xs text-zinc-500">Normal Map</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {CUSTOM_TEXTURES.normal.map((tex) => (
                            <button
                              key={tex.id}
                              onClick={() => setCustomMaterial(prev => ({ ...prev, normal: tex.url }))}
                              className={`aspect-square rounded-lg overflow-hidden transition-all hover:scale-105 ${
                                customMaterial.normal === tex.url
                                  ? "ring-2 ring-[#00b8c4]"
                                  : "ring-1 ring-[#3a3a3a]"
                              }`}
                              title={tex.name}
                            >
                              <img src={tex.url || "/placeholder.svg"} alt={tex.name} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Roughness Texture */}
                      <div className="space-y-2">
                        <Label className="text-xs text-zinc-500">Roughness</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {CUSTOM_TEXTURES.roughness.map((tex) => (
                            <button
                              key={tex.id}
                              onClick={() => setCustomMaterial(prev => ({ ...prev, roughness: tex.url }))}
                              className={`aspect-square rounded-lg overflow-hidden transition-all hover:scale-105 ${
                                customMaterial.roughness === tex.url
                                  ? "ring-2 ring-[#00b8c4]"
                                  : "ring-1 ring-[#3a3a3a]"
                              }`}
                              title={tex.name}
                            >
                              <img src={tex.url || "/placeholder.svg"} alt={tex.name} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Metalness Texture */}
                      <div className="space-y-2">
                        <Label className="text-xs text-zinc-500">Metalness</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {CUSTOM_TEXTURES.metalness.map((tex) => (
                            <button
                              key={tex.id}
                              onClick={() => setCustomMaterial(prev => ({ ...prev, metalness: tex.url }))}
                              className={`aspect-square rounded-lg overflow-hidden transition-all hover:scale-105 ${
                                customMaterial.metalness === tex.url
                                  ? "ring-2 ring-[#00b8c4]"
                                  : "ring-1 ring-[#3a3a3a]"
                              }`}
                              title={tex.name}
                            >
                              <img src={tex.url || "/placeholder.svg"} alt={tex.name} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Gradient Tab */}
                  <TabsContent value="gradient">
                    <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-500">Gradient Type</Label>
                      <Select value={gradientSettings.type} onValueChange={(value) => setGradientSettings(prev => ({ ...prev, type: value as "radial" | "linear" }))}>
                        <SelectTrigger className="bg-[#2a2a2a] border-[#3a3a3a]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#2a2a2a] border-[#3a3a3a]">
                          <SelectItem value="radial">Radial</SelectItem>
                          <SelectItem value="linear">Linear</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-500">Primary Color</Label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={gradientSettings.color1}
                          onChange={(e) => setGradientSettings(prev => ({ ...prev, color1: e.target.value }))}
                          className="w-10 h-10 rounded cursor-pointer bg-transparent border border-[#3a3a3a]"
                        />
                        <span className="text-xs text-zinc-400 flex items-center">{gradientSettings.color1}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-500">Secondary Color</Label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={gradientSettings.color2}
                          onChange={(e) => setGradientSettings(prev => ({ ...prev, color2: e.target.value }))}
                          className="w-10 h-10 rounded cursor-pointer bg-transparent border border-[#3a3a3a]"
                        />
                        <span className="text-xs text-zinc-400 flex items-center">{gradientSettings.color2}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={gradientSettings.useThreeColors}
                        onCheckedChange={(checked) => setGradientSettings(prev => ({ ...prev, useThreeColors: checked }))}
                      />
                      <Label className="text-xs text-zinc-500">Use 3 Colors</Label>
                    </div>

                    {gradientSettings.useThreeColors && (
                      <div className="space-y-2">
                        <Label className="text-xs text-zinc-500">Tertiary Color</Label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={gradientSettings.color3}
                            onChange={(e) => setGradientSettings(prev => ({ ...prev, color3: e.target.value }))}
                            className="w-10 h-10 rounded cursor-pointer bg-transparent border border-[#3a3a3a]"
                          />
                          <span className="text-xs text-zinc-400 flex items-center">{gradientSettings.color3}</span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-500">Intensity: {gradientSettings.intensity.toFixed(2)}</Label>
                      <Slider
                        value={[gradientSettings.intensity]}
                        onValueChange={(value) => setGradientSettings(prev => ({ ...prev, intensity: value[0] }))}
                        min={0}
                        max={2}
                        step={0.1}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-500">Distortion: {gradientSettings.distortion.toFixed(2)}</Label>
                      <Slider
                        value={[gradientSettings.distortion]}
                        onValueChange={(value) => setGradientSettings(prev => ({ ...prev, distortion: value[0] }))}
                        min={0}
                        max={1}
                        step={0.1}
                        className="w-full"
                      />
                    </div>

                    {gradientSettings.type === "linear" && (
                      <div className="space-y-2">
                        <Label className="text-xs text-zinc-500">Angle: {(gradientSettings.angle ? gradientSettings.angle * 180 / Math.PI : 0).toFixed(0)}°</Label>
                        <Slider
                          value={[gradientSettings.angle || 0]}
                          onValueChange={(value) => setGradientSettings(prev => ({ ...prev, angle: value[0] }))}
                          min={0}
                          max={Math.PI * 2}
                          step={0.1}
                          className="w-full"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-500">Noise: {(gradientSettings.noise || 0).toFixed(2)}</Label>
                      <Slider
                        value={[gradientSettings.noise || 0]}
                        onValueChange={(value) => setGradientSettings(prev => ({ ...prev, noise: value[0] }))}
                        min={0}
                        max={2}
                        step={0.1}
                        className="w-full"
                      />
                    </div>
                    </div>
                </TabsContent>

                {/* Matcap Tab */}
                <TabsContent value="matcap">
                    <div className="space-y-4 pt-2">
                      <div className="rounded-lg overflow-hidden">
                        <div className="p-4">
                          <h3 className="text-sm font-medium text-white mb-3">Matcap Materials</h3>
                          <div className="grid grid-cols-4 gap-2">
                            {Object.entries(MATCAP_PRESETS).map(([key, preset]) => (
                              <MatcapPreview
                                key={key}
                                matcapUrl={preset.matcap}
                                isSelected={selectedMatcap === key}
                                onClick={() => {
                                  setSelectedMatcap(key)
                                  setMatcapTexture(preset.matcap)
                                  setRenderMode("matcap")
                                }}
                                name={preset.name}
                              />
                            ))}
                          </div>
                          {selectedMatcap && (
                            <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
                              <p className="text-xs text-zinc-500">{MATCAP_PRESETS[selectedMatcap]?.name || "Unknown"}</p>
                              <p className="text-xs text-zinc-600 mt-0.5">Selected material</p>

                              <div className="mt-4 space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs text-zinc-500 uppercase tracking-wider">Hue Shift</Label>
                                  <span className="text-xs text-zinc-500 font-mono">{matcapHueShift}°</span>
                                </div>
                                <Slider
                                  value={[matcapHueShift]}
                                  onValueChange={(value) => setMatcapHueShift(value[0])}
                                  min={0}
                                  max={360}
                                  step={1}
                                  className="w-full"
                                />
                                <p className="text-[10px] text-zinc-600 mt-1">Shift the color hue of the matcap material</p>
                              </div>

                              <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
                                <Label className="text-xs text-zinc-500 uppercase tracking-wider">Normal Map</Label>
                                <div className="grid grid-cols-4 gap-2 mt-2">
                                  <button
                                    type="button"
                                    onClick={() => setMatcapSettings({ ...matcapSettings, normalMap: "" })}
                                    className={`aspect-square rounded-lg border-2 transition-all flex items-center justify-center text-[10px] text-zinc-500 ${
                                      matcapSettings.normalMap === ""
                                        ? "border-cyan-500 bg-cyan-500/10"
                                        : "border-[#3a3a3a] hover:border-zinc-600"
                                    }`}
                                  >
                                    None
                                  </button>
                                  {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() =>
                                        setMatcapSettings({
                                          ...matcapSettings,
                                          normalMap: `/images/custom/normal-${i}.jpg`,
                                        })
                                      }
                                      className={`aspect-square rounded-lg border-2 transition-all overflow-hidden ${
                                        matcapSettings.normalMap === `/images/custom/normal-${i}.jpg`
                                          ? "border-cyan-500"
                                          : "border-[#3a3a3a] hover:border-zinc-600"
                                      }`}
                                    >
                                      <img
                                        src={`/images/custom/normal-${i}.jpg`}
                                        alt={`Normal ${i}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </button>
                                  ))}
                                </div>

                                {matcapSettings.normalMap && (
                                  <div className="mt-3 space-y-3">
                                    <div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-zinc-600">Intensity</span>
                                        <span className="text-xs text-zinc-500 font-mono">
                                          {matcapSettings.normalIntensity.toFixed(2)}
                                        </span>
                                      </div>
                                      <Slider
                                        value={[matcapSettings.normalIntensity]}
                                        onValueChange={([value]) =>
                                          setMatcapSettings({ ...matcapSettings, normalIntensity: value })
                                        }
                                        min={0}
                                        max={3}
                                        step={0.05}
                                        className="w-full"
                                      />
                                    </div>

                                    <div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-zinc-600">Repeat</span>
                                        <span className="text-xs text-zinc-500 font-mono">
                                          {matcapSettings.normalRepeat.toFixed(1)}
                                        </span>
                                      </div>
                                      <Slider
                                        value={[matcapSettings.normalRepeat]}
                                        onValueChange={([value]) =>
                                          setMatcapSettings({ ...matcapSettings, normalRepeat: value })
                                        }
                                        min={0.5}
                                        max={10}
                                        step={0.5}
                                        className="w-full"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
                                <Label className="text-xs text-zinc-500 uppercase tracking-wider">Rim Lighting</Label>

                                <div className="mt-2 space-y-3">
                                  <div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] text-zinc-600">Color</span>
                                      <input
                                        type="color"
                                        value={matcapSettings.rimColor}
                                        onChange={(e) =>
                                          setMatcapSettings({ ...matcapSettings, rimColor: e.target.value })
                                        }
                                        className="w-12 h-6 rounded border border-[#3a3a3a] cursor-pointer bg-transparent"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] text-zinc-600">Intensity</span>
                                      <span className="text-xs text-zinc-500 font-mono">
                                        {matcapSettings.rimIntensity.toFixed(2)}
                                      </span>
                                    </div>
                                    <Slider
                                      value={[matcapSettings.rimIntensity]}
                                      onValueChange={([value]) =>
                                        setMatcapSettings({ ...matcapSettings, rimIntensity: value })
                                      }
                                      min={0}
                                      max={2}
                                      step={0.05}
                                      className="w-full"
                                    />
                                  </div>

                                  <div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] text-zinc-600">Power</span>
                                      <span className="text-xs text-zinc-500 font-mono">
                                        {matcapSettings.rimPower.toFixed(1)}
                                      </span>
                                    </div>
                                    <Slider
                                      value={[matcapSettings.rimPower]}
                                      onValueChange={([value]) =>
                                        setMatcapSettings({ ...matcapSettings, rimPower: value })
                                      }
                                      min={1}
                                      max={10}
                                      step={0.5}
                                      className="w-full"
                                    />
                                  </div>
                                </div>
                                <p className="text-[10px] text-zinc-600 mt-2">
                                  Edge glow effect for enhanced depth
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                </TabsContent>
              </Tabs>

                {/* PBR-specific settings - only show in PBR and Custom tabs */}
                {(materialTypeTab === "pbr" || materialTypeTab === "custom") && (
                  <>
                    {/* Base Color Section - Only show for non-glass materials */}
                    {materialSettings.transmission === 0 && (
                  <Collapsible defaultOpen className="rounded-lg">
                    <CollapsibleTrigger className="w-full flex items-center justify-between p-3 hover:bg-[#252525] transition-colors rounded-lg bg-[#222222]">
                      <Label className="text-sm font-medium text-white cursor-pointer">Base Color</Label>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={materialSettings.useHueShift}
                          onCheckedChange={(checked) =>
                            setMaterialSettings({ ...materialSettings, useHueShift: checked })
                          }
                          onClick={(e) => e.stopPropagation()}
                        />
                        <ChevronDown className="w-4 h-4 text-zinc-500 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-4 pb-4 space-y-3">
                      {materialSettings.useHueShift ? (
                        <>
                          {/* Hue Shift Mode */}
                          <div className="flex justify-between items-center pt-3">
                            <span className="text-xs text-zinc-500">Hue Shift</span>
                            <span className="text-sm text-white font-mono tabular-nums">
                              {materialSettings.hueShift.toFixed(0)}°
                            </span>
                          </div>
                          <Slider
                            value={[materialSettings.hueShift]}
                            onValueChange={([value]) => setMaterialSettings({ ...materialSettings, hueShift: value })}
                            min={0}
                            max={360}
                            step={1}
                            className=""
                          />
                          <div className="flex items-center gap-2 pt-2">
                            <span className="text-xs text-zinc-500">Preview</span>
                            <div
                              className="flex-1 h-6 rounded border border-[#3a3a3a]"
                              style={{
                                background: `linear-gradient(to right,
                                  hsl(${materialSettings.hueShift}, 70%, 50%),
                                  hsl(${(materialSettings.hueShift + 30) % 360}, 70%, 50%))`,
                              }}
                            />
                          </div>
                          <p className="text-xs text-zinc-500 pt-1">Shifts texture colors by rotating the hue</p>
                        </>
                      ) : (
                        <>
                          {/* Color Tint Mode */}
                          <div className="flex justify-between items-center pt-3">
                            <span className="text-xs text-zinc-500">Color Tint</span>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-6 h-6 rounded border border-[#3a3a3a]"
                                style={{ backgroundColor: materialSettings.colorTint }}
                              />
                              <span className="text-sm text-white font-mono tabular-nums">
                                {materialSettings.colorTint}
                              </span>
                            </div>
                          </div>
                          <input
                            type="color"
                            value={materialSettings.colorTint}
                            onChange={(e) => setMaterialSettings({ ...materialSettings, colorTint: e.target.value })}
                            className="w-full h-10 rounded cursor-pointer bg-transparent"
                          />
                          <p className="text-xs text-zinc-500 pt-1">
                            Enable toggle above for texture-based hue shifting
                          </p>
                        </>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Normal Scale */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-500">Normal Scale</span>
                    <span className="text-sm text-white font-mono tabular-nums">
                      {materialSettings.normalScale.toFixed(1)}
                    </span>
                  </div>
                  <Slider
                    value={[materialSettings.normalScale]}
                    onValueChange={([value]) => setMaterialSettings({ ...materialSettings, normalScale: value })}
                    min={0}
                    max={3}
                    step={0.1}
                    className=""
                  />
                </div>

                {/* Roughness */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-500">Roughness</span>
                    <span className="text-sm text-white font-mono tabular-nums">
                      {materialSettings.roughness.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    value={[materialSettings.roughness]}
                    onValueChange={([value]) => setMaterialSettings({ ...materialSettings, roughness: value })}
                    min={0}
                    max={1}
                    step={0.01}
                    className=""
                  />
                </div>

                {/* Displacement - Only show for sphere mode */}
                {geometrySettings.type === "sphere" && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-500">Displacement Scale</span>
                      <span className="text-sm text-white font-mono tabular-nums">
                        {materialSettings.displacementScale.toFixed(2)}
                      </span>
                    </div>
                    <Slider
                      value={[materialSettings.displacementScale]}
                      onValueChange={([value]) =>
                        setMaterialSettings({ ...materialSettings, displacementScale: value })
                      }
                      min={0}
                      max={1}
                      step={0.01}
                      className=""
                    />
                  </div>
                )}

                {/* Metalness */}
                {selectedPreset !== "dirtyGlass" && selectedPreset !== "scratchedGlass" && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-500">Metalness</span>
                      <span className="text-sm text-white font-mono tabular-nums">
                        {materialSettings.metalness.toFixed(2)}
                      </span>
                    </div>
                    <Slider
                      value={[materialSettings.metalness]}
                      onValueChange={([value]) => setMaterialSettings({ ...materialSettings, metalness: value })}
                      min={0}
                      max={1}
                      step={0.01}
                      className=""
                    />
                  </div>
                )}

                {/* Texture Scale */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-500">Texture Scale</span>
                    <span className="text-sm text-white font-mono tabular-nums">
                      {materialSettings.textureScale.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    value={[materialSettings.textureScale]}
                    onValueChange={([value]) => setMaterialSettings({ ...materialSettings, textureScale: value })}
                    min={0.1}
                    max={10}
                    step={0.1}
                    className=""
                  />
                  <p className="text-xs text-zinc-500">
                    Controls the tiling of textures
                  </p>
                </div>

                  {(selectedPreset === "dirtyGlass" || selectedPreset === "scratchedGlass" || selectedPreset === "clearGlass") && (
                    <>
                      {/* Transmission */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-zinc-500">Transmission</span>
                          <span className="text-sm text-white font-mono tabular-nums">
                            {materialSettings.transmission.toFixed(2)}
                          </span>
                        </div>
                        <Slider
                          value={[materialSettings.transmission]}
                          onValueChange={([value]) =>
                            setMaterialSettings({ ...materialSettings, transmission: value })
                          }
                          min={0}
                          max={1}
                          step={0.01}
                          className=""
                        />
                      </div>

                      {/* IOR (Index of Refraction) */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-zinc-500">IOR</span>
                          <span className="text-sm text-white font-mono tabular-nums">
                            {materialSettings.ior.toFixed(2)}
                          </span>
                        </div>
                        <Slider
                          value={[materialSettings.ior]}
                          onValueChange={([value]) => setMaterialSettings({ ...materialSettings, ior: value })}
                          min={1}
                          max={2.5}
                          step={0.01}
                          className=""
                        />
                      </div>

                      {/* Thickness */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-zinc-500">Thickness</span>
                          <span className="text-sm text-white font-mono tabular-nums">
                            {materialSettings.thickness.toFixed(1)}
                          </span>
                        </div>
                        <Slider
                          value={[materialSettings.thickness]}
                          onValueChange={([value]) => setMaterialSettings({ ...materialSettings, thickness: value })}
                          min={0}
                          max={10}
                          step={0.1}
                          className=""
                        />
                      </div>

                      {/* Clearcoat */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-zinc-500">Clearcoat</span>
                          <span className="text-sm text-white font-mono tabular-nums">
                            {materialSettings.clearcoat.toFixed(2)}
                          </span>
                        </div>
                        <Slider
                          value={[materialSettings.clearcoat]}
                          onValueChange={([value]) => setMaterialSettings({ ...materialSettings, clearcoat: value })}
                          min={0}
                          max={1}
                          step={0.01}
                          className=""
                        />
                      </div>

                      {/* Clearcoat Roughness */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-zinc-500">Clearcoat Roughness</span>
                          <span className="text-sm text-white font-mono tabular-nums">
                            {materialSettings.clearcoatRoughness.toFixed(2)}
                          </span>
                        </div>
                        <Slider
                          value={[materialSettings.clearcoatRoughness]}
                          onValueChange={([value]) => setMaterialSettings({ ...materialSettings, clearcoatRoughness: value })}
                          min={0}
                          max={1}
                          step={0.01}
                          className=""
                        />
                      </div>

                      {/* Attenuation (Light Absorption) */}
                      <div className="rounded-lg overflow-hidden">
                        <div className="p-4">
                          <Label className="text-sm font-medium text-white">Attenuation</Label>
                          <div className="mt-3 space-y-4">
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-zinc-500">Distance</span>
                                <span className="text-sm text-white font-mono tabular-nums">
                                  {materialSettings.attenuationDistance.toFixed(1)}
                                </span>
                              </div>
                              <Slider
                                value={[materialSettings.attenuationDistance]}
                                onValueChange={([value]) =>
                                  setMaterialSettings({ ...materialSettings, attenuationDistance: value })
                                }
                                min={0.1}
                                max={10}
                                step={0.1}
                                className=""
                              />
                              <p className="text-xs text-zinc-500">
                                How far light travels before absorbing (higher = clearer)
                              </p>
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-zinc-500">Tint Color</span>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-6 h-6 rounded border border-[#3a3a3a]"
                                    style={{ backgroundColor: materialSettings.attenuationColor }}
                                  />
                                  <span className="text-sm text-white font-mono tabular-nums">
                                    {materialSettings.attenuationColor}
                                  </span>
                                </div>
                              </div>
                              <input
                                type="color"
                                value={materialSettings.attenuationColor}
                                onChange={(e) =>
                                  setMaterialSettings({ ...materialSettings, attenuationColor: e.target.value })
                                }
                                className="w-full h-10 rounded cursor-pointer bg-transparent"
                              />
                              <p className="text-xs text-zinc-500">Color tint as light passes through glass</p>
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-zinc-500">Thickness</span>
                                <span className="text-sm text-white font-mono tabular-nums">
                                  {materialSettings.thickness.toFixed(2)}
                                </span>
                              </div>
                              <Slider
                                value={[materialSettings.thickness]}
                                onValueChange={([value]) =>
                                  setMaterialSettings({ ...materialSettings, thickness: value })
                                }
                                min={0}
                                max={5}
                                step={0.01}
                                className=""
                              />
                              <p className="text-xs text-zinc-500">Simulated volume depth for light absorption</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg overflow-hidden">
                        <div className="p-4">
                          <Label className="text-sm font-medium text-white">Clearcoat</Label>
                          <p className="text-xs text-zinc-500 mt-1 mb-3">
                            Outer glossy layer - improves rendering on complex shapes
                          </p>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-zinc-500">Intensity</span>
                                <span className="text-sm text-white font-mono tabular-nums">
                                  {materialSettings.clearcoat.toFixed(2)}
                                </span>
                              </div>
                              <Slider
                                value={[materialSettings.clearcoat]}
                                onValueChange={([value]) =>
                                  setMaterialSettings({ ...materialSettings, clearcoat: value })
                                }
                                min={0}
                                max={1}
                                step={0.01}
                                className=""
                              />
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-zinc-500">Roughness</span>
                                <span className="text-sm text-white font-mono tabular-nums">
                                  {materialSettings.clearcoatRoughness.toFixed(2)}
                                </span>
                              </div>
                              <Slider
                                value={[materialSettings.clearcoatRoughness]}
                                onValueChange={([value]) =>
                                  setMaterialSettings({ ...materialSettings, clearcoatRoughness: value })
                                }
                                min={0}
                                max={1}
                                step={0.01}
                                className=""
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg overflow-hidden">
                        <div className="p-4">
                          <Label className="text-sm font-medium text-white">Glass Color</Label>
                          <p className="text-xs text-zinc-500 mt-1 mb-3">Add color tint to the glass surface</p>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-zinc-500">Intensity</span>
                                <span className="text-sm text-white font-mono tabular-nums">
                                  {materialSettings.glassColorIntensity.toFixed(2)}
                                </span>
                              </div>
                              <Slider
                                value={[materialSettings.glassColorIntensity]}
                                onValueChange={([value]) =>
                                  setMaterialSettings({ ...materialSettings, glassColorIntensity: value })
                                }
                                min={0}
                                max={1}
                                step={0.01}
                                className=""
                              />
                            </div>

                            {materialSettings.glassColorIntensity > 0 && (
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-zinc-500">Color</span>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-6 h-6 rounded border border-[#3a3a3a]"
                                      style={{ backgroundColor: materialSettings.glassColor }}
                                    />
                                    <span className="text-sm text-white font-mono tabular-nums">
                                      {materialSettings.glassColor}
                                    </span>
                                  </div>
                                </div>
                                <input
                                  type="color"
                                  value={materialSettings.glassColor}
                                  onChange={(e) =>
                                    setMaterialSettings({ ...materialSettings, glassColor: e.target.value })
                                  }
                                  className="w-full h-10 rounded cursor-pointer bg-transparent"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg overflow-hidden">
                        <div className="p-4">
                          <Label className="text-sm font-medium text-white">Iridescence</Label>
                          <p className="text-xs text-zinc-500 mt-1 mb-3">
                            Rainbow thin-film effect like soap bubbles or oil on water
                          </p>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-zinc-500">Intensity</span>
                                <span className="text-sm text-white font-mono tabular-nums">
                                  {materialSettings.iridescence.toFixed(2)}
                                </span>
                              </div>
                              <Slider
                                value={[materialSettings.iridescence]}
                                onValueChange={([value]) =>
                                  setMaterialSettings({ ...materialSettings, iridescence: value })
                                }
                                min={0}
                                max={1}
                                step={0.01}
                                className=""
                              />
                            </div>

                            {materialSettings.iridescence > 0 && (
                              <>
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-zinc-500">IOR</span>
                                    <span className="text-sm text-white font-mono tabular-nums">
                                      {materialSettings.iridescenceIOR.toFixed(2)}
                                    </span>
                                  </div>
                                  <Slider
                                    value={[materialSettings.iridescenceIOR]}
                                    onValueChange={([value]) =>
                                      setMaterialSettings({ ...materialSettings, iridescenceIOR: value })
                                    }
                                    min={1}
                                    max={2.5}
                                    step={0.01}
                                    className=""
                                  />
                                  <p className="text-xs text-zinc-500">Refraction index of thin film layer</p>
                                </div>

                                <div className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-zinc-500">Film Thickness Min</span>
                                    <span className="text-sm text-white font-mono tabular-nums">
                                      {materialSettings.iridescenceThicknessMin.toFixed(0)}nm
                                    </span>
                                  </div>
                                  <Slider
                                    value={[materialSettings.iridescenceThicknessMin]}
                                    onValueChange={([value]) =>
                                      setMaterialSettings({ ...materialSettings, iridescenceThicknessMin: value })
                                    }
                                    min={0}
                                    max={800}
                                    step={10}
                                    className=""
                                  />
                                </div>

                                <div className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-zinc-500">Film Thickness Max</span>
                                    <span className="text-sm text-white font-mono tabular-nums">
                                      {materialSettings.iridescenceThicknessMax.toFixed(0)}nm
                                    </span>
                                  </div>
                                  <Slider
                                    value={[materialSettings.iridescenceThicknessMax]}
                                    onValueChange={([value]) =>
                                      setMaterialSettings({ ...materialSettings, iridescenceThicknessMax: value })
                                    }
                                    min={0}
                                    max={1200}
                                    step={10}
                                    className=""
                                  />
                                  <p className="text-xs text-zinc-500">
                                    Thickness variation creates different rainbow patterns
                                  </p>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  </>
                )}
                </div>
              </TabsContent>

              <TabsContent value="lighting">
              {renderMode === "pbr" ? (
                <div className="space-y-4 px-4">
                  {/* Warning banner for incompatible materials */}
                  {(materialTypeTab === "gradient" || materialTypeTab === "matcap") && (
                    <div className="border rounded-lg p-3 flex gap-3 bg-zinc-800 border-zinc-700">
                      <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-white" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-50">
                          PBR Lighting disabled
                        </p>
                        <p className="text-xs mt-1 text-neutral-600">
                          {materialTypeTab === "gradient" 
                            ? "Gradient materials use their own shading and don't support PBR lighting."
                            : "Matcap materials use baked lighting and don't support PBR lighting."}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="rounded-lg overflow-hidden">
                    <div className="p-4">
                      <div className="flex justify-between items-center mb-3">
                        <Label className="text-xs text-zinc-500">Light Direction</Label>
                        <span className="text-sm text-white font-mono tabular-nums">
                          {Math.round((lightingSettings.envRotation * 180) / Math.PI)}°
                        </span>
                      </div>
                      <LightRotationControl
                        value={lightingSettings.envRotation}
                        onChange={(value) => setLightingSettings({ ...lightingSettings, envRotation: value })}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleSection("lights")}
                      className="w-full flex items-center justify-between p-4 hover:bg-[#2a2a2a]/50 transition-colors"
                    >
                      <Label className="text-sm font-medium text-white cursor-pointer">Primary Light</Label>
                      <ChevronDown
                        className={`w-4 h-4 text-zinc-500 transition-transform ${openSections.lights ? "rotate-180" : ""}`}
                      />
                    </button>
                    {openSections.lights && (
                      <div className="px-4 pb-4 space-y-4 border-t border-[#2a2a2a]/50 pt-3">
                        {/* Intensity */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-zinc-500">Intensity</span>
                            <span className="text-sm text-white font-mono tabular-nums">
                              {lightingSettings.directionalIntensity.toFixed(2)}
                            </span>
                          </div>
                          <Slider
                            value={[lightingSettings.directionalIntensity]}
                            onValueChange={([value]) =>
                              setLightingSettings({ ...lightingSettings, directionalIntensity: value })
                            }
                            min={0}
                            max={5}
                            step={0.1}
                            className=""
                          />
                        </div>

                        {/* Ambient Light */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-zinc-500">Ambient Fill</span>
                            <span className="text-sm text-white font-mono tabular-nums">
                              {lightingSettings.ambientIntensity.toFixed(2)}
                            </span>
                          </div>
                          <Slider
                            value={[lightingSettings.ambientIntensity]}
                            onValueChange={([value]) =>
                              setLightingSettings({ ...lightingSettings, ambientIntensity: value })
                            }
                            min={0}
                            max={2}
                            step={0.05}
                            className=""
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Environment section */}
                  <div className="rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleSection("environment")}
                      className="w-full flex items-center justify-between p-4 hover:bg-[#2a2a2a]/50 transition-colors"
                    >
                      <Label className="text-sm font-medium text-white cursor-pointer">Environment</Label>
                      <ChevronDown
                        className={`w-4 h-4 text-zinc-500 transition-transform ${openSections.environment ? "rotate-180" : ""}`}
                      />
                    </button>
                    {openSections.environment && (
                      <div className="px-4 pb-4 space-y-4 border-t border-[#2a2a2a]/50 pt-3">
                        <div className="space-y-2">
                          <span className="text-xs text-zinc-500">HDRI Map</span>
                          <Select
                            value={lightingSettings.envMap}
                            onValueChange={(value) => setLightingSettings({ ...lightingSettings, envMap: value })}
                          >
                            <SelectTrigger className="bg-[#2a2a2a] border-[#2a2a2a] text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#2a2a2a] border-[#2a2a2a]">
                              <SelectItem value="studio">Studio</SelectItem>
                              <SelectItem value="sunset">Sunset</SelectItem>
                              <SelectItem value="dawn">Dawn</SelectItem>
                              <SelectItem value="warehouse">Warehouse</SelectItem>
                              <SelectItem value="forest">Forest</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-zinc-500">Intensity</span>
                            <span className="text-sm text-white font-mono tabular-nums">
                              {lightingSettings.envIntensity.toFixed(2)}
                            </span>
                          </div>
                          <Slider
                            value={[lightingSettings.envIntensity]}
                            onValueChange={([value]) =>
                              setLightingSettings({ ...lightingSettings, envIntensity: value })
                            }
                            min={0}
                            max={5}
                            step={0.1}
                            className=""
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-zinc-500">Exposure</span>
                            <span className="text-sm text-white font-mono tabular-nums">
                              {lightingSettings.exposure.toFixed(2)}
                            </span>
                          </div>
                          <Slider
                            value={[lightingSettings.exposure]}
                            onValueChange={([value]) => setLightingSettings({ ...lightingSettings, exposure: value })}
                            min={0.1}
                            max={5}
                            step={0.1}
                            className=""
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden bg-[#222222] p-4">
                  <p className="text-sm text-zinc-500">
                    Lighting controls are only available in PBR render mode. Matcap materials use fixed lighting and cannot be adjusted.
                  </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
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

      {showIconSearch && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#404040] rounded-lg w-full max-w-md max-h-96 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#404040]">
              <h2 className="text-lg font-semibold text-white">Search Icons</h2>
              <button
                onClick={() => setShowIconSearch(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={iconSearchInput}
                  onChange={(e) => setIconSearchInput(e.target.value)}
                  placeholder="Search icons..."
                  className="flex-1 px-3 py-2 bg-[#2a2a2a] border border-[#404040] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-600"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setIconSearchQuery(iconSearchInput)
                    }
                  }}
                />
                <button
                  onClick={() => setIconSearchQuery(iconSearchInput)}
                  disabled={isSearchingIcons}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg font-medium transition-colors"
                >
                  {isSearchingIcons ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
              </div>

              {iconSearchResults?.icons && iconSearchResults.icons.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {iconSearchResults.icons.slice(0, 20).map((icon, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectIcon(icon)}
                      className="p-3 bg-[#2a2a2a] hover:bg-[#333333] rounded-lg flex items-center justify-center group relative transition-colors"
                      title={icon.name}
                    >
                      <img
                        src={icon.preview_url || "/placeholder.svg"}
                        alt={icon.name}
                        className="w-10 h-10 invert"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              ) : iconSearchResults && iconSearchResults.icons?.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-zinc-500 text-sm">No icons found</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-zinc-500 text-sm">Search for icons to get started</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info icon and Background color picker in bottom-left corner */}
      <div className="fixed bottom-4 left-4 z-40 flex gap-2 items-center">
        <a
          href="https://buildin.ai/sava/share/4745d01a-eba4-43a4-bcbe-bd42cb780ac7?code=11A3SR"
          target="_blank"
          rel="noopener noreferrer"
          className="w-9 h-9 rounded-lg border border-[#404040] bg-[#2a2a2a] hover:bg-[#353535] flex items-center justify-center text-zinc-400 hover:text-white transition-all"
          title="View Buildin.AI project"
        >
          <Info className="w-4 h-4" />
        </a>
        
        <label className="flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] hover:bg-[#353535] text-white text-sm rounded-lg border border-[#404040] transition-all cursor-pointer">
          <div 
            className="w-4 h-4 rounded-full border border-[#505050] flex-shrink-0"
            style={{ backgroundColor: backgroundColor }}
          />
          <span>Background</span>
          <input
            type="color"
            value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
            className="hidden"
          />
        </label>

        <label className="flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] hover:bg-[#353535] text-white text-sm rounded-lg border border-[#404040] transition-all cursor-pointer">
          <div 
            className={`w-4 h-4 rounded border border-[#505050] flex-shrink-0 transition-all ${showGrid ? 'bg-blue-500' : 'bg-transparent'}`}
          />
          <span>Grid</span>
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
            className="hidden"
          />
        </label>

        <label className="flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] hover:bg-[#353535] text-white text-sm rounded-lg border border-[#404040] transition-all cursor-pointer">
          <div 
            className={`w-4 h-4 rounded border border-[#505050] flex-shrink-0 transition-all ${showRotateControls ? 'bg-orange-500' : 'bg-transparent'}`}
          />
          <span>Rotate</span>
          <input
            type="checkbox"
            checked={showRotateControls}
            onChange={(e) => setShowRotateControls(e.target.checked)}
            className="hidden"
          />
        </label>
      </div>
    </div>
  )
}
