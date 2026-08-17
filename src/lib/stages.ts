import type { FunnelConfig, Preset } from './types'

export interface StageDef {
  key: string
  label: string
  short: string
  /** world-space height of the stage membrane */
  y: number
  /** membrane radius, tapering downward */
  radius: number
}

export const STAGES: StageDef[] = [
  { key: 'sourced', label: 'Sourced', short: 'SRC', y: 9.0, radius: 5.0 },
  { key: 'screen', label: 'Screen', short: 'SCR', y: 5.2, radius: 4.2 },
  { key: 'tech', label: 'Tech Screen', short: 'TEC', y: 1.6, radius: 3.4 },
  { key: 'onsite', label: 'Onsite', short: 'ONS', y: -1.8, radius: 2.6 },
  { key: 'offer', label: 'Offer', short: 'OFR', y: -5.0, radius: 1.8 },
  { key: 'hired', label: 'Hired', short: 'HIR', y: -8.0, radius: 1.1 },
]

/** the collector plate that only full-pass candidates ever touch */
export const PLATE_Y = -9.8
export const PLATE_RADIUS = 1.35

export const TRANSITION_LABELS = [
  'Sourced → Screen',
  'Screen → Tech Screen',
  'Tech Screen → Onsite',
  'Onsite → Offer',
  'Offer → Hired',
]

export const BUILTIN_PRESETS: Preset[] = [
  {
    id: 'deepforge',
    name: 'Deepforge · ~10:1',
    intake: 14,
    passRates: [0.55, 0.52, 0.6, 0.68, 0.85],
    builtin: true,
  },
  {
    id: 'balanced',
    name: 'Balanced · ~15:1',
    intake: 18,
    passRates: [0.5, 0.5, 0.5, 0.6, 0.9],
    builtin: true,
  },
  {
    id: 'canada',
    name: 'Canada · ~64:1',
    intake: 34,
    passRates: [0.35, 0.32, 0.42, 0.55, 0.6],
    builtin: true,
  },
  {
    id: 'topheavy',
    name: 'Top-heavy volume',
    intake: 52,
    passRates: [0.22, 0.45, 0.62, 0.72, 0.9],
    builtin: true,
  },
  {
    id: 'lateleak',
    name: 'Late-stage leak',
    intake: 22,
    passRates: [0.7, 0.65, 0.6, 0.32, 0.45],
    builtin: true,
  },
  {
    id: 'calibrated',
    name: 'Tight calibration',
    intake: 8,
    passRates: [0.75, 0.7, 0.72, 0.8, 0.92],
    builtin: true,
  },
]

export const DEFAULT_CONFIG: FunnelConfig = {
  intake: 14,
  maxParticles: 1400,
  passRates: [0.55, 0.52, 0.6, 0.68, 0.85],
  presetId: 'deepforge',
  muted: true,
}

export function cumulative(passRates: number[]): number {
  return passRates.reduce((a, b) => a * b, 1)
}

export function ratioToHire(passRates: number[]): number {
  const c = cumulative(passRates)
  return c <= 0 ? Infinity : 1 / c
}
