'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('theme') as Theme | null;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = storedTheme ?? (systemPrefersDark ? 'dark' : 'light');

    applyTheme(initialTheme);

    queueMicrotask(() => {
      setTheme(initialTheme);
      setReady(true);
    });
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    window.localStorage.setItem('theme', nextTheme);
    applyTheme(nextTheme);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label="Toggle light and dark mode"
      title="Toggle theme"
      disabled={!ready}
    >
      <span className="theme-toggle-icon-wrap" aria-hidden="true">
        <Sun className={`theme-toggle-icon ${theme === 'light' ? 'theme-icon-active' : ''}`} />
        <Moon className={`theme-toggle-icon ${theme === 'dark' ? 'theme-icon-active' : ''}`} />
      </span>
      <span className="theme-toggle-label">
        {theme === 'dark' ? 'Dark' : 'Light'}
      </span>
    </button>
  );
}
