'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { createProceduralShape, type ProceduralShapeParams } from './procedural-shape-generator'
import { ChevronDown, ChevronUp, Shuffle } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import * as THREE from 'three'

interface ProceduralShapeControlsProps {
  onShapeChange?: (geometry: THREE.BufferGeometry) => void
  onParamsChange?: (params: ProceduralShapeParams) => void
}

export function ProceduralShapeControls({ onShapeChange, onParamsChange }: ProceduralShapeControlsProps) {
  const [params, setParams] = useState<ProceduralShapeParams>({
    baseRadius: 1,
    height: 2,
    segments: 64,
    twistAmount: 0,
    bulgeFactor: 0.3, // Уменьшено для лучшего вида
    indentFactor: 0.15, // Уменьшено
    bulgeFrequency: 4, // Количество волн по высоте
    topSharpness: 0.2, // Мягкая округлая верхушка
    bottomSharpness: 0.2, // Мягкое округлое дно
    noiseScale: 0.1, // Уменьшено для чистоты
    randomSeed: 42,
  })

  const [isOpen, setIsOpen] = useState(true)

  // Initialize geometry on mount
  useEffect(() => {
    const initialGeometry = createProceduralShape(params)
    onShapeChange?.(initialGeometry)
    onParamsChange?.(params)
  }, [])

  // Update shape whenever parameters change
  const updateShape = useCallback(
    (newParams: ProceduralShapeParams) => {
      setParams(newParams)
      const geometry = createProceduralShape(newParams)
      onShapeChange?.(geometry)
      onParamsChange?.(newParams)
    },
    [onShapeChange, onParamsChange]
  )

  const handleRandomize = () => {
    const newParams: ProceduralShapeParams = {
      baseRadius: 0.6 + Math.random() * 0.8,
      height: 1.5 + Math.random() * 2,
      segments: 48 + Math.floor(Math.random() * 64),
      twistAmount: (Math.random() - 0.5) * Math.PI * 2,
      bulgeFactor: Math.random() * 0.8,
      indentFactor: Math.random() * 0.5,
      bulgeFrequency: 2 + Math.floor(Math.random() * 10), // 2-12 волн
      topSharpness: Math.random(),
      bottomSharpness: Math.random(),
      noiseScale: Math.random() * 0.5,
      randomSeed: Math.floor(Math.random() * 10000),
    }
    updateShape(newParams)
  }

  const handleReset = () => {
    updateShape({
      baseRadius: 1,
      height: 2,
      segments: 64,
      twistAmount: 0,
      bulgeFactor: 0.3,
      indentFactor: 0.15,
      bulgeFrequency: 4,
      topSharpness: 0.2,
      bottomSharpness: 0.2,
      noiseScale: 0.1,
      randomSeed: 42,
    })
  }

  const handleParamChange = (key: keyof ProceduralShapeParams, value: number) => {
    const newParams = { ...params, [key]: value }
    updateShape(newParams)
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full space-y-2">
      <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 rounded-lg hover:bg-[#2a2a2a] transition-colors">
        <span className="text-sm font-semibold text-white">Procedural Shape</span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-zinc-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-4 px-2">
        {/* Quick Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleRandomize}
            className="flex-1 px-3 py-2 bg-[#2a7a7a] hover:bg-[#2d8c8c] text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Shuffle className="w-3 h-3" />
            Randomize
          </button>
          <button
            onClick={handleReset}
            className="flex-1 px-3 py-2 bg-[#2a2a2a] hover:bg-[#353535] text-white text-xs font-medium rounded-lg transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Base Radius */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-zinc-500">Base Radius</Label>
            <span className="text-xs text-white font-mono">{params.baseRadius.toFixed(2)}</span>
          </div>
          <Slider
            value={[params.baseRadius]}
            onValueChange={([value]) => handleParamChange('baseRadius', value)}
            min={0.3}
            max={2}
            step={0.05}
          />
        </div>

        {/* Height */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-zinc-500">Height</Label>
            <span className="text-xs text-white font-mono">{params.height.toFixed(2)}</span>
          </div>
          <Slider
            value={[params.height]}
            onValueChange={([value]) => handleParamChange('height', value)}
            min={0.5}
            max={4}
            step={0.1}
          />
        </div>

        {/* Segments (Quality) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-zinc-500">Quality (Segments)</Label>
            <span className="text-xs text-white font-mono">{params.segments}</span>
          </div>
          <Slider
            value={[params.segments]}
            onValueChange={([value]) => handleParamChange('segments', value)}
            min={16}
            max={128}
            step={8}
          />
        </div>

        <div className="border-t border-[#2a2a2a]/50 my-3" />

        {/* Twist Amount */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-zinc-500">Twist</Label>
            <span className="text-xs text-white font-mono">{(params.twistAmount / Math.PI).toFixed(2)}π</span>
          </div>
          <Slider
            value={[params.twistAmount]}
            onValueChange={([value]) => handleParamChange('twistAmount', value)}
            min={-Math.PI * 2}
            max={Math.PI * 2}
            step={0.1}
          />
          <p className="text-xs text-zinc-600">Rotational twist along height</p>
        </div>

        {/* Bulge Factor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-zinc-500">Bulge</Label>
            <span className="text-xs text-white font-mono">{params.bulgeFactor.toFixed(2)}</span>
          </div>
          <Slider
            value={[params.bulgeFactor]}
            onValueChange={([value]) => handleParamChange('bulgeFactor', value)}
            min={0}
            max={1}
            step={0.05}
          />
          <p className="text-xs text-zinc-600">Outward bulging deformation</p>
        </div>

        {/* Indent Factor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-zinc-500">Indent</Label>
            <span className="text-xs text-white font-mono">{params.indentFactor.toFixed(2)}</span>
          </div>
          <Slider
            value={[params.indentFactor]}
            onValueChange={([value]) => handleParamChange('indentFactor', value)}
            min={0}
            max={0.8}
            step={0.05}
          />
          <p className="text-xs text-zinc-600">Inward indentation deformation</p>
        </div>

        {/* Bulge Frequency */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-zinc-500">Bulge Frequency</Label>
            <span className="text-xs text-white font-mono">{params.bulgeFrequency}</span>
          </div>
          <Slider
            value={[params.bulgeFrequency]}
            onValueChange={([value]) => handleParamChange('bulgeFrequency', value)}
            min={0}
            max={20}
            step={1}
          />
          <p className="text-xs text-zinc-600">Number of bulges along height</p>
        </div>

        <div className="border-t border-[#2a2a2a]/50 my-3" />

        {/* Top Sharpness */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-zinc-500">Top Sharpness</Label>
            <span className="text-xs text-white font-mono">{params.topSharpness.toFixed(2)}</span>
          </div>
          <Slider
            value={[params.topSharpness]}
            onValueChange={([value]) => handleParamChange('topSharpness', value)}
            min={0}
            max={1}
            step={0.05}
          />
          <p className="text-xs text-zinc-600">0 = flat top, 1 = sharp point</p>
        </div>

        {/* Bottom Sharpness */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-zinc-500">Bottom Sharpness</Label>
            <span className="text-xs text-white font-mono">{params.bottomSharpness.toFixed(2)}</span>
          </div>
          <Slider
            value={[params.bottomSharpness]}
            onValueChange={([value]) => handleParamChange('bottomSharpness', value)}
            min={0}
            max={1}
            step={0.05}
          />
          <p className="text-xs text-zinc-600">0 = flat bottom, 1 = sharp point</p>
        </div>

        <div className="border-t border-[#2a2a2a]/50 my-3" />

        {/* Noise Scale */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-zinc-500">Organic Detail</Label>
            <span className="text-xs text-white font-mono">{params.noiseScale.toFixed(2)}</span>
          </div>
          <Slider
            value={[params.noiseScale]}
            onValueChange={([value]) => handleParamChange('noiseScale', value)}
            min={0}
            max={1}
            step={0.05}
          />
          <p className="text-xs text-zinc-600">Random surface variations</p>
        </div>

        {/* Random Seed */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-zinc-500">Random Seed</Label>
            <span className="text-xs text-white font-mono">{params.randomSeed}</span>
          </div>
          <Slider
            value={[params.randomSeed]}
            onValueChange={([value]) => handleParamChange('randomSeed', value)}
            min={0}
            max={10000}
            step={1}
          />
          <p className="text-xs text-zinc-600">Change for different variations</p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
