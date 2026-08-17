import { useEffect, useRef } from 'react'
import { FunnelApp } from '@/three/FunnelApp'
import type { FunnelConfig, SimStats } from '@/lib/types'

interface Props {
  config: FunnelConfig
  playing: boolean
  reducedMotion: boolean
  resetToken: number
  onStats: (stats: SimStats) => void
  onTick: (depth: number) => void
  onReject: (stage: number) => void
}

export function FunnelCanvas({ config, playing, reducedMotion, resetToken, onStats, onTick, onReject }: Props) {
  const holder = useRef<HTMLDivElement | null>(null)
  const app = useRef<FunnelApp | null>(null)

  // keep callbacks in refs so the scene is never torn down just to rebind them
  const handlers = useRef({ onStats, onTick, onReject })
  handlers.current = { onStats, onTick, onReject }

  const initial = useRef(config)
  initial.current = config

  useEffect(() => {
    if (!holder.current) return
    const instance = new FunnelApp(holder.current, {
      reducedMotion,
      onStats: (s) => handlers.current.onStats(s),
      onTick: (d) => handlers.current.onTick(d),
      onReject: (s) => handlers.current.onReject(s),
    })
    instance.setConfig(initial.current)
    app.current = instance
    return () => {
      instance.dispose()
      app.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    app.current?.setReducedMotion(reducedMotion)
  }, [reducedMotion])

  useEffect(() => {
    app.current?.setConfig({
      intake: config.intake,
      maxParticles: config.maxParticles,
      passRates: config.passRates,
    })
  }, [config.intake, config.maxParticles, config.passRates])

  useEffect(() => {
    app.current?.setPlaying(playing && !reducedMotion)
  }, [playing, reducedMotion])

  const firstReset = useRef(true)
  useEffect(() => {
    if (firstReset.current) {
      firstReset.current = false
      return
    }
    app.current?.reset()
  }, [resetToken])

  return <div ref={holder} className="absolute inset-0" />
}
