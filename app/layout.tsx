import type { Metadata } from 'next'
import Link from 'next/link'
import { DM_Sans } from 'next/font/google'
import { SessionProvider } from '@/lib/session-context'
import { ThemeToggle } from '@/components/ThemeToggle'
import '@/styles/globals.css'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Aura — Meeting Recorder',
  description: 'Record, transcribe, and summarise your meetings',
}

const NAV_LINKS = [
  { href: '/', label: 'Record' },
  { href: '/history', label: 'History' },
  { href: '/settings', label: 'Settings' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=localStorage.getItem('aura:theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(s==='dark'||(s==null&&d))document.documentElement.classList.add('dark')})()`,
          }}
        />
      </head>
      <body className={`${dmSans.variable} min-h-screen bg-background font-sans`}>
        <SessionProvider>
          <header className="border-b-3 border-border bg-secondary-background">
            <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
              <Link href="/" className="text-xl font-bold tracking-tight">
                AURA
              </Link>
              <div className="flex items-center gap-2">
                {NAV_LINKS.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="rounded-base border-2 border-border bg-background px-3 py-1.5 text-sm font-semibold shadow-shadow-sm transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                  >
                    {label}
                  </Link>
                ))}
                <ThemeToggle />
              </div>
            </nav>
          </header>
          <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
        </SessionProvider>
      </body>
    </html>
  )
}
