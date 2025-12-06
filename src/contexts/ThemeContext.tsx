import { createContext, useContext, useLayoutEffect, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';

  try {
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme;
    }

    // Default to light mode unless explicitly dark
    return 'light';
  } catch {
    return 'light';
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme());

  useLayoutEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    // Remove all theme classes first to avoid conflicts
    root.classList.remove('light', 'dark');
    body.classList.remove('light', 'dark');

    // Add the current theme class (Tailwind uses 'dark' class for dark mode)
    if (theme === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
    } else {
      // For light mode, ensure dark is removed
      root.classList.remove('dark');
      body.classList.remove('dark');
    }

    // Save to localStorage
    try {
      localStorage.setItem('theme', theme);
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error);
    }

    // Debug log in development
    if (import.meta.env.DEV) {
      console.log(`[ThemeContext] Theme changed to: ${theme}`);
    }
  }, [theme]);

  // Sync theme from localStorage periodically to catch mismatches
  // This ensures theme is restored correctly after leaving Login page
  useEffect(() => {
    const checkAndSyncTheme = () => {
      const storedTheme = localStorage.getItem('theme') as Theme | null;
      const hasDarkClass = document.documentElement.classList.contains('dark');

      // Only sync if there's a clear mismatch
      if (storedTheme === 'dark' && !hasDarkClass && theme !== 'dark') {
        // Stored theme is dark but DOM and state don't match
        setThemeState('dark');
      } else if (storedTheme === 'light' && hasDarkClass && theme !== 'light') {
        // Stored theme is light but DOM and state don't match
        setThemeState('light');
      }
    };

    // Check periodically (every 2 seconds) to catch theme mismatches
    // This is especially useful after navigation from Login page
    const interval = setInterval(checkAndSyncTheme, 2000);

    // Also check immediately on mount
    checkAndSyncTheme();

    return () => {
      clearInterval(interval);
    };
  }, [theme]); // Re-run when theme changes

  useLayoutEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      const storedTheme = localStorage.getItem('theme');
      if (!storedTheme) {
        // If no user preference, stay in light mode by default or follow system?
        // User wants default light. If system changes to dark, maybe they want dark?
        // But "First time load" is key.
        // I will leave this as is, as it handles dynamic changes.
        // Actually, if I want to ENFORCE light mode by default, I should ignore system preference initially.
        // Which I did in getInitialTheme.
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{
      theme,
      setTheme,
      toggleTheme
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
