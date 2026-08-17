export interface FunnelConfig {
  /** candidates entering per second */
  intake: number
  /** hard ceiling on simultaneously live particles */
  maxParticles: number
  /** length 5: pass probability into Screen, Tech, Onsite, Offer, Hired */
  passRates: number[]
  presetId: string
  muted: boolean
}

export interface Preset {
  id: string
  name: string
  intake: number
  passRates: number[]
  builtin?: boolean
}

export interface Marker {
  x: number
  y: number
}

export interface SimStats {
  fps: number
  active: number
  counts: number[]
  markers: Marker[]
}
