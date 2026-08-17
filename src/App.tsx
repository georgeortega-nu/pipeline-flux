import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { ControlPanel } from '@/components/ControlPanel'
import { FunnelCanvas } from '@/components/FunnelCanvas'
import { Hud } from '@/components/Hud'
import { StageRail } from '@/components/StageRail'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { AudioEngine } from '@/lib/audio'
import { BUILTIN_PRESETS, DEFAULT_CONFIG, STAGES } from '@/lib/stages'
import * as store from '@/lib/storage'
import type { FunnelConfig, Preset, SimStats } from '@/lib/types'

const EMPTY_STATS: SimStats = {
  fps: 0,
  active: 0,
  counts: new Array(STAGES.length).fill(0),
  markers: [],
}

export default function App() {
  const systemReduced = useReducedMotion()
  const [motionOverride, setMotionOverride] = useState(false)
  const reducedMotion = systemReduced && !motionOverride
  const isDesktop = useMediaQuery('(min-width: 768px)')

  const [config, setConfig] = useState<FunnelConfig>(DEFAULT_CONFIG)
  const [presets, setPresets] = useState<Preset[]>(BUILTIN_PRESETS)
  const [playing, setPlaying] = useState(true)
  const [resetToken, setResetToken] = useState(0)
  const [stats, setStats] = useState<SimStats>(EMPTY_STATS)
  const [hydrated, setHydrated] = useState(false)

  const audio = useRef<AudioEngine | null>(null)
  if (!audio.current) audio.current = new AudioEngine()

  // hydrate from IndexedDB before the scene starts
  useEffect(() => {
    let cancelled = false
    Promise.all([store.loadConfig(), store.loadPresets()]).then(([saved, savedPresets]) => {
      if (cancelled) return
      if (saved && Array.isArray(saved.passRates) && saved.passRates.length === 5) {
        setConfig({ ...DEFAULT_CONFIG, ...saved })
      }
      if (savedPresets.length) setPresets([...BUILTIN_PRESETS, ...savedPresets])
      setHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // persist, debounced
  useEffect(() => {
    if (!hydrated) return
    const id = window.setTimeout(() => void store.saveConfig(config), 400)
    return () => window.clearTimeout(id)
  }, [config, hydrated])

  useEffect(() => {
    audio.current?.setMuted(config.muted)
  }, [config.muted])

  useEffect(() => {
    const engine = audio.current
    return () => engine?.dispose()
  }, [])

  const onChange = useCallback((patch: Partial<FunnelConfig>) => {
    setConfig((previous) => ({ ...previous, ...patch }))
  }, [])

  const onSelectPreset = useCallback(
    (id: string) => {
      const preset = presets.find((p) => p.id === id)
      if (!preset) return
      setConfig((previous) => ({
        ...previous,
        intake: preset.intake,
        passRates: preset.passRates.slice(),
        presetId: preset.id,
      }))
      setResetToken((n) => n + 1)
    },
    [presets],
  )

  const onSavePreset = useCallback(
    (name: string) => {
      const preset: Preset = {
        id: `user-${Date.now().toString(36)}`,
        name,
        intake: config.intake,
        passRates: config.passRates.slice(),
      }
      setPresets((current) => [...current, preset])
      setConfig((previous) => ({ ...previous, presetId: preset.id }))
      void store.savePreset(preset)
    },
    [config.intake, config.passRates],
  )

  const onDeletePreset = useCallback((id: string) => {
    setPresets((current) => current.filter((p) => p.id !== id))
    setConfig((previous) => (previous.presetId === id ? { ...previous, presetId: 'custom' } : previous))
    void store.deletePreset(id)
  }, [])

  const onReset = useCallback(() => setResetToken((n) => n + 1), [])
  const onTogglePlay = useCallback(() => setPlaying((p) => !p), [])
  const onStats = useCallback((next: SimStats) => setStats(next), [])
  const onTick = useCallback((depth: number) => audio.current?.tick(depth), [])
  const onReject = useCallback(() => audio.current?.reject(), [])

  const panel = useMemo(
    () => (
      <ControlPanel
        config={config}
        presets={presets}
        playing={playing}
        reducedMotion={reducedMotion}
        motionOverride={motionOverride}
        onChange={onChange}
        onSelectPreset={onSelectPreset}
        onSavePreset={onSavePreset}
        onDeletePreset={onDeletePreset}
        onTogglePlay={onTogglePlay}
        onReset={onReset}
        onMotionOverride={setMotionOverride}
      />
    ),
    [
      config,
      presets,
      playing,
      reducedMotion,
      motionOverride,
      onChange,
      onSelectPreset,
      onSavePreset,
      onDeletePreset,
      onTogglePlay,
      onReset,
    ],
  )

  return (
    <main className="field-backdrop relative h-full w-full overflow-hidden">
      <div className="absolute inset-0">
        {hydrated && (
          <FunnelCanvas
            config={config}
            playing={playing}
            reducedMotion={reducedMotion}
            resetToken={resetToken}
            onStats={onStats}
            onTick={onTick}
            onReject={onReject}
          />
        )}
      </div>

      <div className="vignette pointer-events-none absolute inset-0 z-[5]" aria-hidden="true" />

      <StageRail markers={stats.markers} counts={stats.counts} />
      <Hud stats={stats} passRates={config.passRates} reducedMotion={reducedMotion} />

      {isDesktop ? (
        <aside className="panel absolute right-6 top-6 bottom-6 z-30 w-[336px] border border-border">{panel}</aside>
      ) : (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="primary" className="pointer-events-auto h-10 px-5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Controls
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetTitle className="sr-only">Simulation controls</SheetTitle>
              {panel}
            </SheetContent>
          </Sheet>
        </div>
      )}
    </main>
  )
}
