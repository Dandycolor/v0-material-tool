# Polya — 3D Material Shader Tool

Modern 3D material shader editor with real-time preview, admin panel, and Supabase integration.

## Features

- 🎨 **Live Material Editor** — Real-time PBR, gradient, and wireframe shader previews
- 🎛️ **Admin Panel** — Manage materials, models, and custom shaders
- 🌓 **Dark Professional UI** — Custom CSS design system (no shadcn)
- 📊 **3D Viewer** — React Three Fiber + Three.js rendering
- 🔄 **State Management** — Zustand with immer middleware
- 📦 **Supabase Ready** — PostgreSQL schema included

## Tech Stack

- **Next.js 15** (App Router, TypeScript)
- **React 19** + React Three Fiber
- **Zustand** (State) + **Immer** (Immutable updates)
- **Tailwind CSS v4** with custom design system
- **Three.js** 3D rendering
- **Supabase** (optional) for data persistence

## Getting Started

### Local Development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

### Viewer
- **Materials**: Left sidebar
- **Lighting**: Right sidebar (Lighting tab)
- **Model Selection**: Right sidebar (Model tab)

### Admin Panel
Navigate to `/admin` for:
- Materials CRUD
- Model management
- Custom shader editor

## Environment Variables

Create `.env.local`:

```env
# Optional: Supabase connection
# NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Admin authentication (for later)
# ADMIN_SECRET=your-secret
```

## Data

Currently uses JSON-based data layer:
- `data/materials.json` — Material presets
- `data/models.json` — 3D models

To migrate to Supabase:
1. Run `lib/supabase/migrations.sql` in Supabase SQL editor
2. Update `lib/data.ts` to query Supabase instead of JSON
3. Set Supabase environment variables

## Project Structure

```
app/
├── page.tsx              # Main viewer
├── layout.tsx            # Root layout with CSS system
├── globals.css           # Design system (CSS variables)
└── admin/
    ├── layout.tsx        # Admin sidebar nav
    ├── page.tsx          # Dashboard
    ├── materials/
    ├── models/
    └── shaders/

components/
└── viewer/
    ├── ViewerScene.tsx   # R3F Canvas + 3D rendering
    ├── MaterialPanel.tsx # Live material editor
    ├── LeftSidebar.tsx   # Material list
    ├── RightSidebar.tsx  # Tabbed editor (Lighting/Model)
    ├── Toolbar.tsx       # Top bar controls
    └── gradient-material.ts # GLSL gradient shader

lib/
├── store.ts              # Zustand state management
├── data.ts               # Data access layer (JSON → Supabase)
├── types.ts              # Domain types
└── supabase/
    ├── client.ts         # Supabase client
    └── migrations.sql    # PostgreSQL schema

data/
├── materials.json        # Material presets
└── models.json          # 3D model references
```

## Material Types

- **PBR** — Physically-based rendering (metalness, roughness, IOR, etc.)
- **Gradient** — Radial/linear gradients with noise and distortion
- **Wireframe** — Basic wireframe rendering
- **Matcap** — Matcap texture-based rendering (future)
- **Toon** — Cartoon shading (future)
- **Custom Shader** — User-defined GLSL (future)

## Admin Features

- Material editor with live preview
- Model file upload and metadata
- Custom shader GLSL editor with compilation feedback
- Material/model tagging and categorization
- Enable/disable for public visibility

## License

MIT
