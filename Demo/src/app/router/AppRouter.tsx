import { Suspense, lazy, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

const OverviewPage = lazy(async () => {
  const module = await import('@/features/solar-monitoring/pages/OverviewPage')
  return { default: module.OverviewPage }
})

const FixedPanelPage = lazy(async () => {
  const module = await import('@/features/solar-monitoring/pages/FixedPanelPage')
  return { default: module.FixedPanelPage }
})

const ConventionalPanelPage = lazy(async () => {
  const module = await import('@/features/solar-monitoring/pages/ConventionalPanelPage')
  return { default: module.ConventionalPanelPage }
})

const AnnPanelPage = lazy(async () => {
  const module = await import('@/features/solar-monitoring/pages/AnnPanelPage')
  return { default: module.AnnPanelPage }
})

function RouteFrame({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="h-full"
    >
      <Suspense
        fallback={
          <div className="grid gap-4">
            <div className="h-36 animate-pulse rounded-[32px] border border-slate-200 bg-slate-200/70 dark:border-white/10 dark:bg-white/5" />
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="h-56 animate-pulse rounded-[28px] border border-slate-200 bg-slate-200/70 dark:border-white/10 dark:bg-white/5 xl:col-span-2" />
              <div className="h-56 animate-pulse rounded-[28px] border border-slate-200 bg-slate-200/70 dark:border-white/10 dark:bg-white/5" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-40 animate-pulse rounded-[28px] border border-slate-200 bg-slate-200/70 dark:border-white/10 dark:bg-white/5"
                />
              ))}
            </div>
          </div>
        }
      >
        {children}
      </Suspense>
    </motion.div>
  )
}

export function AppRouter() {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname])

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route
          path="/overview"
          element={
            <RouteFrame>
              <OverviewPage />
            </RouteFrame>
          }
        />
        <Route
          path="/fixed-panel"
          element={
            <RouteFrame>
              <FixedPanelPage />
            </RouteFrame>
          }
        />
        <Route
          path="/conventional-panel"
          element={
            <RouteFrame>
              <ConventionalPanelPage />
            </RouteFrame>
          }
        />
        <Route
          path="/ann-panel"
          element={
            <RouteFrame>
              <AnnPanelPage />
            </RouteFrame>
          }
        />
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
    </AnimatePresence>
  )
}
