import { CloudSun, Sunrise, Sunset, Wind } from 'lucide-react'
import type { EnvironmentSnapshot, WeatherPayload } from '@/shared/types/solar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'

type WeatherCardProps = {
  environment: EnvironmentSnapshot
  weather: WeatherPayload
}

export function WeatherCard({ environment, weather }: WeatherCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Environmental Conditions</CardTitle>
        <CardDescription>
          Weather-aware context prepared for future API integration.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-[24px] border border-slate-200 bg-slate-100/85 p-5 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-3 text-slate-700 dark:text-slate-200">
            <CloudSun className="h-5 w-5 text-cyan-300" />
            <div className="min-w-0">
              <p className="text-wrap-anywhere text-lg font-medium text-slate-900 dark:text-white">
                {weather.current.condition}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {weather.current.summary}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 rounded-2xl border border-slate-200 bg-white/90 p-4 dark:border-white/10 dark:bg-slate-950/60">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Air + irradiance</p>
              <p className="text-wrap-anywhere mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
                {environment.temperature.toFixed(1)} C
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {environment.humidity}% humidity | {environment.irradiance} W/m2
              </p>
            </div>
            <div className="min-w-0 rounded-2xl border border-slate-200 bg-white/90 p-4 dark:border-white/10 dark:bg-slate-950/60">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Site conditions</p>
              <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
                {environment.sunlightIndex}/100
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Wind className="h-4 w-4 text-lime-300" />
                <span>{environment.windKph} kph wind | {weather.current.cloudiness}% clouds</span>
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-400">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 dark:border-white/10 dark:bg-white/5">
              <Sunrise className="h-4 w-4 text-amber-300" />
              Sunrise {weather.current.sunrise}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 dark:border-white/10 dark:bg-white/5">
              <Sunset className="h-4 w-4 text-rose-300" />
              Sunset {weather.current.sunset}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 dark:border-white/10 dark:bg-white/5">
              UV {weather.current.uv}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
          {weather.forecast.map((item) => (
            <div
              key={item.day}
              className="min-w-0 rounded-[22px] border border-slate-200 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.day}</p>
              <p className="text-wrap-anywhere mt-2 text-base font-medium text-slate-900 dark:text-white">
                {item.condition}
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Sunlight {item.sunlight}% | Clouds {item.cloudiness}%
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">
                Confidence {item.confidence}%
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
