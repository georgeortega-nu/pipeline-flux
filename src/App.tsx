import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { CohortView } from '@/components/CohortView'
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
import { cn } from '@/lib/utils'

const EMPTY_STATS: SimStats = {
  fps: 0,
  active: 0,
  counts: new Array(STAGES.length).fill(0),
  markers: [],
}

function readRoute(): string {
  const raw = window.location.hash.replace(/^#\/?/, '')
  return raw === 'cohort' ? 'cohort' : 'field'
}

export default function App() {
  const systemReduced = useReducedMotion()
  const [motionOverride, setMotionOverride] = useState(false)
  const reducedMotion = systemReduced && !motionOverride
  const isDesktop = useMediaQuery('(min-width: 768px)')

  const [route, setRoute] = useState(readRoute)
  const [config, setConfig] = useState<FunnelConfig>(DEFAULT_CONFIG)
  const [presets, setPresets] = useState<Preset[]>(BUILTIN_PRESETS)
  const [playing, setPlaying] = useState(true)
  const [resetToken, setResetToken] = useState(0)
  const [stats, setStats] = useState<SimStats>(EMPTY_STATS)
  const [hydrated, setHydrated] = useState(false)

  const audio = useRef<AudioEngine | null>(null)
  if (!audio.current) audio.current = new AudioEngine()

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

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

  const isCohort = route === 'cohort'

  return (
    <main className="field-backdrop relative h-full w-full overflow-hidden">
      {/* The scene stays mounted across routes so returning to the field does not
          rebuild the world or lose the running counts. */}
      <div className={cn('absolute inset-0', isCohort && 'pointer-events-none opacity-0')} aria-hidden={isCohort}>
        {hydrated && (
          <FunnelCanvas
            config={config}
            playing={playing && !isCohort}
            reducedMotion={reducedMotion}
            resetToken={resetToken}
            onStats={onStats}
            onTick={onTick}
            onReject={onReject}
          />
        )}
      </div>

      {!isCohort && (
        <>
          <div className="vignette pointer-events-none absolute inset-0 z-[5]" aria-hidden="true" />
          <StageRail markers={stats.markers} counts={stats.counts} />
          <Hud stats={stats} passRates={config.passRates} reducedMotion={reducedMotion} />
        </>
      )}

      {isCohort && <CohortView config={config} presets={presets} />}

      <Nav route={route} />

      {!isCohort &&
        (isDesktop ? (
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
        ))}
    </main>
  )
}

function Nav({ route }: { route: string }) {
  const item = (href: string, key: string, label: string) => (
    <a
      key={key}
      href={href}
      aria-current={route === key ? 'page' : undefined}
      className={cn(
        'px-3 py-1.5 font-mono text-[10px] uppercase tracking-gauge transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ring',
        route === key ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </a>
  )

  return (
    <nav className="absolute left-5 top-5 z-40 flex border border-border md:left-7 md:top-7">
      {item('#/field', 'field', 'Field')}
      <span className="w-px bg-border" aria-hidden="true" />
      {item('#/cohort', 'cohort', 'Cohort')}
    </nav>
  )
}
