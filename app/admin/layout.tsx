import type { Metadata } from "next"
import Link from "next/link"
import { LayoutDashboard, Layers, Box, Code2, Settings } from "lucide-react"

export const metadata: Metadata = {
  title: "Admin — Polya",
}

const NAV = [
  { href: "/admin",          label: "Dashboard",  icon: LayoutDashboard },
  { href: "/admin/materials", label: "Materials",  icon: Layers          },
  { href: "/admin/models",    label: "Models",     icon: Box             },
  { href: "/admin/shaders",   label: "Shaders",    icon: Code2           },
] as const

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Sidebar nav */}
      <nav
        className="panel flex flex-col shrink-0"
        style={{ width: 200 }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-2 px-4 py-3 border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <Link
            href="/"
            className="font-mono text-[13px] font-semibold"
            style={{ color: "var(--color-accent)" }}
          >
            polya
          </Link>
          <span
            className="badge badge-accent ml-1"
            style={{ fontSize: 9 }}
          >
            admin
          </span>
        </div>

        {/* Nav items */}
        <div className="flex-1 py-2">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-4 py-2 text-[12px] transition-colors hover:bg-white/5"
              style={{ color: "var(--color-muted)" }}
            >
              <Icon size={13} />
              {label}
            </Link>
          ))}
        </div>

        {/* Back to viewer */}
        <div
          className="px-4 py-3 border-t"
          style={{ borderColor: "var(--color-border)" }}
        >
          <Link
            href="/"
            className="flex items-center gap-2 text-[11px] transition-colors hover:underline"
            style={{ color: "var(--color-muted)" }}
          >
            ← Back to viewer
          </Link>
        </div>
      </nav>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto" style={{ background: "var(--color-bg)" }}>
        {children}
      </main>
    </div>
  )
}
