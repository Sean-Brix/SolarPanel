import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  BrainCircuit,
  Code2,
  Gauge,
  Moon,
  MoreHorizontal,
  PanelRightOpen,
  Sun,
  SunMedium,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTheme } from '@/app/providers/useTheme'
import { cn } from '@/shared/lib/cn'

const navItems = [
  { label: 'Overview', shortLabel: 'Home', path: '/overview', icon: Gauge },
  { label: 'Fixed Panel', shortLabel: 'Fixed', path: '/fixed-panel', icon: SunMedium },
  {
    label: 'Conventional Panel',
    shortLabel: 'Track',
    path: '/conventional-panel',
    icon: Activity,
  },
  { label: 'ANN Panel', shortLabel: 'ANN', path: '/ann-panel', icon: BrainCircuit },
  {
    label: 'Dev Page',
    shortLabel: 'Dev',
    path: '/dev',
    icon: Code2,
  },
]

const primaryMobilePaths = ['/overview', '/ann-panel', '/dev']
const primaryMobileNav = navItems.filter((item) => primaryMobilePaths.includes(item.path))
const secondaryMobileNav = navItems.filter((item) => !primaryMobilePaths.includes(item.path))

function ThemeButton({
  theme,
  onClick,
  compact = false,
}: {
  theme: 'light' | 'dark'
  onClick: () => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100',
        'dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
      )}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {compact ? null : <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const [ready, setReady] = useState(false)
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const isAuthRoute = location.pathname === '/' || location.pathname === '/login'

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 700)
    return () => window.clearTimeout(timer)
  }, [])

  const isSecondaryRoute = secondaryMobileNav.some((item) => item.path === location.pathname)

  if (isAuthRoute) {
    return <div className="relative min-h-screen overflow-hidden">{children}</div>
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="relative mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 px-4 py-4 lg:flex-row lg:px-6">
        <aside className="hidden w-[280px] shrink-0 lg:block">
          <div className="sticky top-4 flex h-[calc(100vh-2rem)] flex-col rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/75">
            <div className="mb-8 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-200/80">
                  Solar Thesis Lab
                </p>
                <h1 className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
                  HelioScope
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <ThemeButton theme={theme} onClick={toggleTheme} compact />
                <PanelRightOpen className="h-5 w-5 text-slate-900 dark:text-slate-500" />
              </div>
            </div>

            <nav className="space-y-2">
              {navItems.map(({ icon: Icon, label, path }) => (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition',
                      isActive
                        ? 'border-cyan-500/25 bg-cyan-500/10 text-slate-900 dark:text-white'
                        : 'border-transparent bg-slate-100/80 text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:bg-white/[0.03] dark:text-slate-400 dark:hover:border-white/10 dark:hover:text-slate-100',
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="mt-auto rounded-2xl border border-lime-500/25 bg-lime-500/10 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-lime-700 dark:text-lime-200/80">
                Status
              </p>
              <p className="mt-3 text-sm font-medium text-lime-900 dark:text-lime-50">
                Mock telemetry online
              </p>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col pb-28 lg:pb-0">
          <AnimatePresence mode="wait">
            {ready ? (
              <motion.main
                key={location.pathname}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="min-w-0 flex-1"
              >
                {children}
              </motion.main>
            ) : (
              <motion.div
                key="shell-loader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid gap-4"
              >
                <div className="h-36 animate-pulse rounded-[32px] border border-slate-200 bg-slate-200/70 dark:border-white/10 dark:bg-white/5" />
                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="h-52 animate-pulse rounded-[28px] border border-slate-200 bg-slate-200/70 dark:border-white/10 dark:bg-white/5 xl:col-span-2" />
                  <div className="h-52 animate-pulse rounded-[28px] border border-slate-200 bg-slate-200/70 dark:border-white/10 dark:bg-white/5" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-40 animate-pulse rounded-[28px] border border-slate-200 bg-slate-200/70 dark:border-white/10 dark:bg-white/5"
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {mobileMoreOpen ? (
          <>
            <motion.button
              key="mobile-menu-backdrop"
              type="button"
              aria-label="Close more menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-slate-950/35 backdrop-blur-[2px] lg:hidden"
              onClick={() => setMobileMoreOpen(false)}
            />
            <motion.div
              key="mobile-menu-panel"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-x-4 bottom-24 z-40 rounded-3xl border border-slate-200 bg-white/96 p-3 shadow-xl backdrop-blur lg:hidden dark:border-white/10 dark:bg-slate-950/96"
            >
              <div className="mb-2 flex items-center justify-between px-2 py-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    More options
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Other pages and display settings
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMoreOpen(false)}
                  className="rounded-full border border-slate-200 p-2 text-slate-600 dark:border-white/10 dark:text-slate-400"
                  aria-label="Close more menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-2">
                {secondaryMobileNav.map(({ icon: Icon, label, path }) => (
                  <NavLink
                    key={path}
                    to={path}
                    onClick={() => setMobileMoreOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition',
                        isActive
                          ? 'border-cyan-500/25 bg-cyan-500/10 text-slate-900 dark:text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300',
                      )
                    }
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>

              <div className="mt-3 border-t border-slate-200 px-2 pt-3 dark:border-white/10">
                <ThemeButton theme={theme} onClick={toggleTheme} />
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <div className="fixed inset-x-4 bottom-4 z-50 lg:hidden">
        <div className="grid grid-cols-4 gap-2 rounded-3xl border border-slate-200 bg-white/96 p-2 shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-950/96">
          {primaryMobileNav.map(({ icon: Icon, path, shortLabel }) => {
            const isActive = location.pathname === path

            return (
              <NavLink
                key={path}
                to={path}
                className={cn(
                  'flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 text-[11px] font-medium transition',
                  isActive
                    ? 'bg-cyan-500/15 text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{shortLabel}</span>
              </NavLink>
            )
          })}

          <button
            type="button"
            onClick={() => setMobileMoreOpen((current) => !current)}
            className={cn(
              'flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 text-[11px] font-medium transition',
              mobileMoreOpen || isSecondaryRoute
                ? 'bg-cyan-500/15 text-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-slate-400',
            )}
            aria-label="Open more options"
            aria-expanded={mobileMoreOpen}
          >
            <MoreHorizontal className="h-4 w-4 shrink-0" />
            <span className="truncate">More</span>
          </button>
        </div>
      </div>
    </div>
  )
}
