'use client';

import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="theme-toggle"
      suppressHydrationWarning
    >
      {theme === 'dark' ? 'SWITCH TO LIGHT' : 'SWITCH TO DARK'}
    </button>
  );
}
