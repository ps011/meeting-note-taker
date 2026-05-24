'use client'

import Link from 'next/link'
import {
  AppHeader,
  type AppHeaderLinkProps,
  type AppHeaderNavItem,
} from '@prasheel/ui'

const NAV_ITEMS: AppHeaderNavItem[] = [
  { href: '/', label: 'Record' },
  { href: '/history', label: 'History' },
  { href: '/settings', label: 'Settings' },
]

const HeaderLink = ({ href, ...props }: AppHeaderLinkProps) => (
  <Link href={href} {...props} />
)

export function AppShellHeader() {
  return (
    <AppHeader
      brand="AURA"
      brandHref="/"
      linkComponent={HeaderLink}
      navItems={NAV_ITEMS}
      sticky={false}
      breakpoint="md"
      className="border-b-3 bg-secondary-background"
      containerClassName="max-w-4xl flex-wrap"
      desktopNavClassName="flex-1 flex-wrap"
      themeSwitcherClassName="shrink-0"
    />
  )
}
