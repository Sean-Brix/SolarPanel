import annData from './mock/ann.json'
import comparisonData from './mock/comparison.json'
import conventionalData from './mock/conventional.json'
import environmentData from './mock/environment.json'
import fixedData from './mock/fixed.json'
import historyData from './mock/history.json'
import notificationsData from './mock/notifications.json'
import weatherData from './mock/weather.json'
import type {
  ComparisonPayload,
  EnvironmentSnapshot,
  HistoryRow,
  NotificationRecord,
  PanelKey,
  PanelRecord,
  TimeRange,
  WeatherPayload,
} from '@/shared/types/solar'

export const panels: Record<PanelKey, PanelRecord> = {
  fixed: fixedData as PanelRecord,
  conventional: conventionalData as PanelRecord,
  ann: annData as PanelRecord,
}

export const panelList = [panels.fixed, panels.conventional, panels.ann]
export const environments = environmentData as Record<PanelKey, EnvironmentSnapshot>
export const weather = weatherData as WeatherPayload
export const notifications = notificationsData as Record<PanelKey, NotificationRecord[]>
export const comparison = comparisonData as ComparisonPayload
export const history = historyData as Record<PanelKey, HistoryRow[]>

export function getPanelRangeEnergy(panelKey: PanelKey, range: TimeRange) {
  const energyRange = range === 'live' ? 'hourly' : range
  return panels[panelKey].energy[energyRange]
}

export function buildPowerComparison(range: TimeRange) {
  const fixed = panels.fixed.ranges[range]
  const conventional = panels.conventional.ranges[range]
  const ann = panels.ann.ranges[range]

  return fixed.map((point, index) => ({
    label: point.label,
    fixed: point.power,
    conventional: conventional[index]?.power ?? 0,
    ann: ann[index]?.power ?? 0,
  }))
}

export function buildEfficiencyComparison(range: TimeRange) {
  const fixed = panels.fixed.ranges[range]
  const conventional = panels.conventional.ranges[range]
  const ann = panels.ann.ranges[range]

  return fixed.map((point, index) => ({
    label: point.label,
    fixed: point.efficiency ?? 0,
    conventional: conventional[index]?.efficiency ?? 0,
    ann: ann[index]?.efficiency ?? 0,
  }))
}

export function buildMovementComparison(range: TimeRange) {
  const conventional = panels.conventional.ranges[range]
  const ann = panels.ann.ranges[range]

  return conventional.map((point, index) => ({
    label: point.label,
    conventional: point.movementCount ?? 0,
    ann: ann[index]?.movementCount ?? 0,
    conventionalCost: point.movementCost ?? 0,
    annCost: ann[index]?.movementCost ?? 0,
  }))
}

export function buildEnergyComparison(range: TimeRange) {
  const energyRange = range === 'live' ? 'hourly' : range
  const fixed = panels.fixed.energy[energyRange]
  const conventional = panels.conventional.energy[energyRange]
  const ann = panels.ann.energy[energyRange]

  return fixed.map((point, index) => ({
    label: point.label,
    fixed: point.energy,
    conventional: conventional[index]?.energy ?? 0,
    ann: ann[index]?.energy ?? 0,
  }))
}
