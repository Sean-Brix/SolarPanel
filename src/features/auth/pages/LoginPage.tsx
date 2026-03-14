import { motion } from 'framer-motion'
import { useState, type FormEvent } from 'react'
import { LockKeyhole, SunMedium } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-2xl border',
          dark
            ? 'border-white/10 bg-white/10 text-amber-300'
            : 'border-slate-200 bg-white text-amber-500',
        )}
      >
        <SunMedium className="h-5 w-5" />
      </div>
      <div>
        <p className={cn('text-xs uppercase tracking-[0.28em]', dark ? 'text-slate-400' : 'text-slate-500')}>
          SolarPanel
        </p>
        <p className={cn('text-lg font-semibold', dark ? 'text-white' : 'text-slate-950')}>
          HelioScope
        </p>
      </div>
    </div>
  )
}

function LoginForm({
  tone,
  className,
}: {
  tone: 'light' | 'dark'
  className?: string
}) {
  const navigate = useNavigate()
  const isDark = tone === 'dark'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message ?? 'Login failed')
        return
      }

      localStorage.setItem('token', data.token)
      navigate('/overview')
    } catch {
      setError('Unable to reach the server. Try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'rounded-[32px] border p-6 shadow-xl backdrop-blur-xl',
        isDark
          ? 'border-white/10 bg-slate-950/70 text-white'
          : 'border-slate-200 bg-white/90 text-slate-950',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Sign in</h1>
          <p className={cn('mt-2 text-sm', isDark ? 'text-slate-300' : 'text-slate-600')}>
            Access your dashboard.
          </p>
        </div>
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-2xl',
            isDark ? 'bg-white/10 text-amber-300' : 'bg-slate-950 text-white',
          )}
        >
          <LockKeyhole className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        <label className="grid gap-2" htmlFor={`username-${tone}`}>
          <span className={cn('text-sm font-medium', isDark ? 'text-slate-200' : 'text-slate-700')}>
            Username
          </span>
          <input
            id={`username-${tone}`}
            type="text"
            placeholder="admin"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={cn(
              'h-12 rounded-2xl border px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-4',
              isDark
                ? 'border-white/10 bg-white/5 text-white focus:ring-amber-400/10'
                : 'border-slate-200 bg-white text-slate-900 focus:ring-amber-400/15',
            )}
          />
        </label>

        <label className="grid gap-2" htmlFor={`password-${tone}`}>
          <span className={cn('text-sm font-medium', isDark ? 'text-slate-200' : 'text-slate-700')}>
            Password
          </span>
          <input
            id={`password-${tone}`}
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn(
              'h-12 rounded-2xl border px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-4',
              isDark
                ? 'border-white/10 bg-white/5 text-white focus:ring-amber-400/10'
                : 'border-slate-200 bg-white text-slate-900 focus:ring-amber-400/15',
            )}
          />
        </label>

        {error && (
          <p className="rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
        )}
      </div>

      <div
        className={cn(
          'mt-4 flex items-center justify-between gap-3 text-sm',
          isDark ? 'text-slate-300' : 'text-slate-600',
        )}
      >
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            className={cn(
              'h-4 w-4 rounded border',
              isDark ? 'border-white/20 bg-white/10 accent-amber-300' : 'accent-slate-950',
            )}
          />
          <span>Remember me</span>
        </label>
        <a href="mailto:operations@helioscope.io" className="font-medium text-amber-500">
          Forgot?
        </a>
      </div>

      <button
        type="submit"
        disabled={isLoading || !username || !password}
        className={cn(
          'mt-6 h-12 w-full rounded-2xl text-sm font-semibold transition disabled:opacity-50',
          isDark
            ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
            : 'bg-slate-950 text-white hover:bg-slate-800',
        )}
      >
        {isLoading ? 'Signing in…' : 'Login'}
      </button>
    </motion.form>
  )
}

export function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07121f]">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 18%, rgba(251,191,36,0.18), transparent 22%), radial-gradient(circle at 85% 12%, rgba(56,189,248,0.14), transparent 20%), linear-gradient(145deg, #07121f 0%, #0f172a 45%, #f8fafc 100%)',
        }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-8 md:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-4 sm:max-w-lg">
          <div className="flex justify-center">
            <Logo dark />
          </div>
          <LoginForm tone="dark" />
        </div>
      </div>
    </div>
  )
}
