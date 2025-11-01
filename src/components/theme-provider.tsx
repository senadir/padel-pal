import { createContext, use } from 'react'
import type { PropsWithChildren } from 'react'
import type { T as Theme } from '@/lib/theme'
import { setThemeServerFn } from '@/lib/theme'

type ThemeContextVal = { theme: Theme; setTheme: (val: Theme) => void }
type Props = PropsWithChildren<{ theme: Theme }>

const ThemeContext = createContext<ThemeContextVal | null>(null)

export function ThemeProvider({ children, theme }: Props) {
  function setTheme(val: Theme) {
    setThemeServerFn({ data: val }).then(() => {
      // Reload the page to apply the theme change
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
    })
  }

  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>
}

export function useTheme() {
  const val = use(ThemeContext)
  if (!val) throw new Error('useTheme called outside of ThemeProvider!')
  return val
}
