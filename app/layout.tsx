import React from "react"
import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import './knopika.css'
import { GOOGLE_FONTS_URL } from '@/lib/knopika/theme'


export const metadata: Metadata = {
  title: 'pólya - 3D Material Tool',
  description: '3D material editor for creating stunning extruded SVG shapes with PBR and Matcap materials',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* optional fonts for the Knopika theme tuner; the default UI uses the local Helvetica stack */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={GOOGLE_FONTS_URL} />
      </head>
      <body className={`font-sans antialiased bg-[#121212]`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
