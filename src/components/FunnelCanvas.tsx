import { useEffect, useRef, useState } from 'react'
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
  const [failure, setFailure] = useState<string | null>(null)

  // keep callbacks in refs so the scene is never torn down just to rebind them
  const handlers = useRef({ onStats, onTick, onReject })
  handlers.current = { onStats, onTick, onReject }

  const initial = useRef(config)
  initial.current = config

  useEffect(() => {
    if (!holder.current) return
    let instance: FunnelApp
    try {
      instance = new FunnelApp(holder.current, {
        reducedMotion,
        onStats: (s) => handlers.current.onStats(s),
        onTick: (d) => handlers.current.onTick(d),
        onReject: (s) => handlers.current.onReject(s),
      })
      instance.setConfig(initial.current)
    } catch (error) {
      // WebGL context creation throws outright when acceleration is unavailable or
      // blocklisted. Keep the surrounding UI alive and say so.
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      console.error('Pipeline Flux could not start the WebGL scene:', error)
      setFailure(message)
      return
    }
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

  return (
    <div ref={holder} className="absolute inset-0">
      {failure && (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="max-w-md">
            <p className="gauge text-primary">Scene unavailable</p>
            <p className="mt-2 font-mono text-[11px] leading-relaxed tracking-wide text-foreground/85">
              The 3D scene could not initialize, so the controls are shown without it.
            </p>
            <pre className="mt-3 whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-muted-foreground">
              {failure}
            </pre>
            <p className="mt-3 font-mono text-[10px] leading-relaxed tracking-wide text-muted-foreground">
              This is usually WebGL being disabled. Check chrome://gpu, or enable “Use graphics acceleration when
              available” in Chrome settings and reload.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
