/* eslint-disable react-refresh/only-export-components */
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import {
  BRAND_THEME_CLASS_PREFIX,
  BRAND_THEME_STORAGE_KEY,
  USE_CUSTOM_BRAND_THEMES_STORAGE_KEY,
  type BrandTheme,
  brandThemes,
  getBrandThemeAppearance,
  getBrandThemeClass,
  isBrandTheme,
  readUseCustomBrandThemes,
} from "@/lib/brand-themes"
import {
  WMS_SKIN_CLASS_MAP,
  WMS_SKIN_STORAGE_KEY,
  type WmsSkin,
  readStoredWmsSkin,
} from "@/lib/skins"

type Theme = "dark" | "light" | "system"
type ResolvedTheme = Exclude<Theme, "system">

type ThemeProviderProps = {
  children: ReactNode
  defaultTheme?: Theme
  storageKey?: string
  brandThemeStorageKey?: string
  useCustomBrandThemesStorageKey?: string
  skinStorageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  resolvedTheme: ResolvedTheme
  brandTheme: BrandTheme
  useCustomBrandThemes: boolean
  skin: WmsSkin
  setTheme: (theme: Theme) => void
  setBrandTheme: (theme: BrandTheme) => void
  setUseCustomBrandThemes: (enabled: boolean) => void
  setSkin: (skin: WmsSkin) => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  resolvedTheme: "light",
  brandTheme: "v3rii",
  useCustomBrandThemes: false,
  skin: "terminal",
  setTheme: () => null,
  setBrandTheme: () => null,
  setUseCustomBrandThemes: () => null,
  setSkin: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

function getResolvedTheme(theme: Theme): ResolvedTheme {
  if (theme !== "system") return theme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyResolvedThemeClass(resolvedTheme: ResolvedTheme): void {
  const root = window.document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(resolvedTheme)
  root.dataset.theme = resolvedTheme
}

function clearBrandThemeClasses(): void {
  const root = window.document.documentElement
  const themeClasses = brandThemes.map((item) => item.className)
  root.classList.remove(...themeClasses)
  delete root.dataset.brandTheme
}

function applyBrandThemeClass(brandTheme: BrandTheme): void {
  const root = window.document.documentElement
  const themeClasses = brandThemes.map((item) => item.className)
  root.classList.remove(...themeClasses)
  root.classList.add(getBrandThemeClass(brandTheme))
  root.dataset.brandTheme = brandTheme
}

function applySkinClass(skin: WmsSkin): void {
  const root = window.document.documentElement
  for (const className of Object.values(WMS_SKIN_CLASS_MAP)) {
    if (className) root.classList.remove(className)
  }
  const skinClass = WMS_SKIN_CLASS_MAP[skin]
  if (skinClass) root.classList.add(skinClass)
  root.dataset.skin = skin
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  brandThemeStorageKey = BRAND_THEME_STORAGE_KEY,
  useCustomBrandThemesStorageKey = USE_CUSTOM_BRAND_THEMES_STORAGE_KEY,
  skinStorageKey = WMS_SKIN_STORAGE_KEY,
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )
  const [useCustomBrandThemes, setUseCustomBrandThemes] = useState<boolean>(() =>
    readUseCustomBrandThemes(useCustomBrandThemesStorageKey)
  )
  const [brandTheme, setBrandTheme] = useState<BrandTheme>(() => {
    const stored = localStorage.getItem(brandThemeStorageKey)
    return isBrandTheme(stored) ? stored : "v3rii"
  })
  const [skin, setSkin] = useState<WmsSkin>(() => readStoredWmsSkin(skinStorageKey))
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (readUseCustomBrandThemes(useCustomBrandThemesStorageKey)) {
      const storedBrandTheme = localStorage.getItem(brandThemeStorageKey)
      const activeBrandTheme = isBrandTheme(storedBrandTheme) ? storedBrandTheme : "v3rii"
      return getBrandThemeAppearance(activeBrandTheme)
    }

    return getResolvedTheme((localStorage.getItem(storageKey) as Theme) || defaultTheme)
  })

  useEffect(() => {
    if (useCustomBrandThemes) {
      const lockedAppearance = getBrandThemeAppearance(brandTheme)
      applyResolvedThemeClass(lockedAppearance)
      setResolvedTheme(lockedAppearance)
      applyBrandThemeClass(brandTheme)
      return
    }

    clearBrandThemeClasses()
    const nextResolvedTheme = getResolvedTheme(theme)
    applyResolvedThemeClass(nextResolvedTheme)
    setResolvedTheme(nextResolvedTheme)

    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      const systemResolvedTheme = getResolvedTheme('system')
      applyResolvedThemeClass(systemResolvedTheme)
      setResolvedTheme(systemResolvedTheme)
    }
    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme, brandTheme, useCustomBrandThemes])

  useEffect(() => {
    applySkinClass(skin)
  }, [skin])

  const setThemeAndStore = useCallback((nextTheme: Theme) => {
    if (useCustomBrandThemes) return

    localStorage.setItem(storageKey, nextTheme)
    setTheme(nextTheme)
  }, [storageKey, useCustomBrandThemes])

  const setBrandThemeAndStore = useCallback((nextTheme: BrandTheme) => {
    if (!useCustomBrandThemes) return

    const root = window.document.documentElement
    root.classList.forEach((className) => {
      if (className.startsWith(BRAND_THEME_CLASS_PREFIX)) {
        root.classList.remove(className)
      }
    })
    localStorage.setItem(brandThemeStorageKey, nextTheme)
    setBrandTheme(nextTheme)
  }, [brandThemeStorageKey, useCustomBrandThemes])

  const setUseCustomBrandThemesAndStore = useCallback((enabled: boolean) => {
    localStorage.setItem(useCustomBrandThemesStorageKey, enabled ? 'true' : 'false')
    setUseCustomBrandThemes(enabled)

    if (enabled) {
      const storedBrandTheme = localStorage.getItem(brandThemeStorageKey)
      const activeBrandTheme = isBrandTheme(storedBrandTheme) ? storedBrandTheme : brandTheme
      if (!isBrandTheme(storedBrandTheme)) {
        localStorage.setItem(brandThemeStorageKey, activeBrandTheme)
      }
      setBrandTheme(activeBrandTheme)
      return
    }

    clearBrandThemeClasses()
  }, [brandTheme, brandThemeStorageKey, useCustomBrandThemesStorageKey])

  const setSkinAndStore = useCallback((nextSkin: WmsSkin) => {
    localStorage.setItem(skinStorageKey, nextSkin)
    setSkin(nextSkin)
  }, [skinStorageKey])

  const value = useMemo(() => ({
    theme,
    resolvedTheme,
    brandTheme,
    useCustomBrandThemes,
    skin,
    setTheme: setThemeAndStore,
    setBrandTheme: setBrandThemeAndStore,
    setUseCustomBrandThemes: setUseCustomBrandThemesAndStore,
    setSkin: setSkinAndStore,
  }), [
    theme,
    resolvedTheme,
    brandTheme,
    useCustomBrandThemes,
    skin,
    setThemeAndStore,
    setBrandThemeAndStore,
    setUseCustomBrandThemesAndStore,
    setSkinAndStore,
  ])

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
