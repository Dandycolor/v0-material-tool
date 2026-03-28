import { getMaterials } from "@/lib/data"
import { Plus, Play } from "lucide-react"
import type { Material } from "@/lib/types"

const SHADER_TEMPLATE = `// Vertex shader
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}

// --- fragment ---
uniform float time;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 color = vNormal * 0.5 + 0.5;
  gl_FragColor = vec4(color, 1.0);
}`

export default function ShadersAdmin() {
  const materials = getMaterials()
  const shaderMaterials = materials.filter((m) => m.type === "custom_shader")
  const gradientMaterials = materials.filter((m) => m.type === "gradient")

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-[18px] font-semibold mb-1"
            style={{ color: "var(--color-text)" }}
          >
            Shaders
          </h1>
          <p className="text-[12px]" style={{ color: "var(--color-muted)" }}>
            Custom GLSL shaders + gradient materials
          </p>
        </div>
        <button className="btn btn-accent gap-1.5">
          <Plus size={12} />
          New Shader
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Editor panel */}
        <div className="panel flex flex-col" style={{ minHeight: 500 }}>
          <div className="panel-header justify-between">
            <span>Editor</span>
            <button className="btn btn-accent gap-1">
              <Play size={10} />
              Compile
            </button>
          </div>

          <div className="flex-1 relative">
            <textarea
              defaultValue={SHADER_TEMPLATE}
              className="absolute inset-0 w-full h-full p-4 font-mono text-[11px] resize-none bg-transparent border-0 outline-none leading-relaxed"
              style={{
                color: "var(--color-text)",
                background: "var(--color-bg)",
                caretColor: "var(--color-accent)",
              }}
              spellCheck={false}
            />
          </div>

          <div
            className="panel-header border-t border-b-0"
            style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-surface)" }}
          >
            <span style={{ color: "var(--color-green)" }}>● ready</span>
            <span className="ml-auto">GLSL ES 1.0</span>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-3">
          {/* Custom shaders list */}
          <div className="panel">
            <div className="panel-header">Custom Shaders ({shaderMaterials.length})</div>
            {shaderMaterials.length === 0 ? (
              <div className="px-4 py-6 text-center text-[11px]" style={{ color: "var(--color-muted)" }}>
                No custom shaders yet.
                <br />Use the editor to create one.
              </div>
            ) : (
              shaderMaterials.map((m) => (
                <div key={m.id} className="flex items-center gap-2 px-4 py-2">
                  <span className="text-[12px]" style={{ color: "var(--color-text)" }}>{m.name}</span>
                  <span className={`badge ml-auto ${m.enabled ? "badge-green" : "badge-default"}`}>
                    {m.enabled ? "on" : "off"}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Gradient materials */}
          <div className="panel">
            <div className="panel-header">Gradient Materials ({gradientMaterials.length})</div>
            {gradientMaterials.map((m) => (
              <div key={m.id} className="flex items-center gap-2 px-4 py-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: "var(--color-accent)" }}
                />
                <span className="text-[12px]" style={{ color: "var(--color-text)" }}>{m.name}</span>
                <span className={`badge ml-auto ${m.enabled ? "badge-green" : "badge-default"}`}>
                  {m.enabled ? "on" : "off"}
                </span>
              </div>
            ))}
          </div>

          {/* Uniforms hint */}
          <div className="panel">
            <div className="panel-header">Available Uniforms</div>
            <div className="p-3 font-mono text-[11px] space-y-1" style={{ color: "var(--color-muted)" }}>
              {[
                "uniform float time;",
                "uniform vec2 resolution;",
                "uniform vec3 cameraPosition;",
                "// Three.js built-ins:",
                "projectionMatrix",
                "modelViewMatrix",
                "normalMatrix",
              ].map((u) => (
                <div key={u} style={{ color: u.startsWith("//") ? "var(--color-subtle)" : undefined }}>
                  {u}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
