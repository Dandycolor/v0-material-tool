import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Polya — Material Tool",
  description: "3D material shader tool with admin panel",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
