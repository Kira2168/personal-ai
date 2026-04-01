'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from '@/components/theme-toggle';

function isActive(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/';
  }

  return pathname.startsWith(href);
}

export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="top-nav">
      <span className="brand-title">Kirubel Personal AI</span>
      <Link href="/" className={`nav-link ${isActive(pathname, '/') ? 'nav-link-active' : ''}`}>
        Chat
      </Link>
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </nav>
  );
}
