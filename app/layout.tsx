import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import { SessionProvider } from '@/lib/session-context'
import { AppShellHeader } from '@/components/AppShellHeader'
import { ThemeProvider } from '@prasheel/ui'
import '@prasheel/ui/styles.css'
import '@/styles/globals.css'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Aura — Meeting Recorder',
  description: 'Record, transcribe, and summarise your meetings',
}

const THEME_STORAGE_KEYS = {
  themeId: 'aura:theme-id',
  colorMode: 'aura:theme',
}

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
        <ThemeProvider
          defaultThemeId="blue"
          storageKeys={THEME_STORAGE_KEYS}
          useSystemDarkMode
        >
          <SessionProvider>
            <AppShellHeader />
            <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
