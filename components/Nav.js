'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from './ThemeToggle'
export default function Nav() {
  const pathname = usePathname()
  const isActive = (href) => pathname === href

  return (
    <nav>
      <div className="nav-wrap">
        <Link className="brand" href="/">Daily Planner</Link>
        <div className="spacer" />
        <div className="links">
          <Link className={`link ${isActive('/') ? 'active' : ''}`} href="/">Home</Link>
          <Link className={`link ${isActive('/about') ? 'active' : ''}`} href="/about">About</Link>
        </div>
        <ThemeToggle />
      </div>
    </nav>
  )
}
