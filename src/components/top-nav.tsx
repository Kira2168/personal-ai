'use client';

import ThemeToggle from '@/components/theme-toggle';

export default function TopNav() {
  return (
    <nav className="top-nav">
      <span className="brand-title">Kirubel Personal AI</span>
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </nav>
  );
}
