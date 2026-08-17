import { useState } from 'react'
import { Slider } from '@/components/ui/slider'
import { BUILTIN_PRESETS, STAGES, ratioToHire } from '@/lib/stages'
import type { FunnelConfig, Preset } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  config: FunnelConfig
  presets: Preset[]
}

interface Row {
  key: string
  label: string
  survivors: number
  lost: number
  conversion: number | null
  share: number
}

function waterfall(sourced: number, passRates: number[]): Row[] {
  const rows: Row[] = []
  let running = sourced
  for (let i = 0; i < STAGES.length; i++) {
    if (i === 0) {
      rows.push({ key: STAGES[i].key, label: STAGES[i].label, survivors: sourced, lost: 0, conversion: null, share: 1 })
      continue
    }
    const rate = passRates[i - 1] ?? 0
    const before = running
    running = before * rate
    rows.push({
      key: STAGES[i].key,
      label: STAGES[i].label,
      survivors: running,
      lost: before - running,
      conversion: rate,
      share: sourced > 0 ? running / sourced : 0,
    })
  }
  return rows
}

/**
 * The same pass rates that drive the 3D field, resolved into countable outcomes.
 * The field shows the shape; this page gives the number that goes in a doc.
 */
export function CohortView({ config, presets }: Props) {
  const [sourced, setSourced] = useState(1000)
  const rows = waterfall(sourced, config.passRates)
  const hires = rows[rows.length - 1].survivors
  const ratio = ratioToHire(config.passRates)
  const totalLost = sourced - hires
  const biggestLeak = rows.slice(1).reduce((worst, row) => (row.lost > worst.lost ? row : worst), rows[1])
  const leakRate = biggestLeak.conversion ?? 0
  const upliftHires = leakRate > 0 ? hires * ((Math.min(1, leakRate + 0.1)) / leakRate) - hires : 0
  const activePreset = presets.find((p) => p.id === config.presetId)

  return (
    <div className="absolute inset-0 overflow-y-auto thin-scroll">
      <div className="mx-auto max-w-3xl px-5 pb-24 pt-24 md:px-8">
        <p className="gauge text-foreground/70">Cohort waterfall</p>
        <h2 className="mt-2 max-w-xl font-mono text-[15px] leading-relaxed tracking-wide text-foreground">
          {sourced.toLocaleString()} sourced candidates, run through the pass rates currently set on the field.
        </h2>
        <p className="mt-2 font-mono text-[10px] tracking-gauge text-muted-foreground">
          Preset: {activePreset?.name ?? 'Custom'}
        </p>

        <div className="mt-8 grid grid-cols-3 gap-6 border-y border-border py-5">
          <Stat label="Hires" value={Math.round(hires).toLocaleString()} accent />
          <Stat label="Lost" value={Math.round(totalLost).toLocaleString()} />
          <Stat label="Per hire" value={Number.isFinite(ratio) ? `${ratio.toFixed(1)}:1` : 'n/a'} />
        </div>

        <div className="mt-8">
          <div className="flex items-baseline justify-between">
            <span className="gauge">Cohort size</span>
            <span className="tnum font-mono text-[11px] text-foreground/85">{sourced.toLocaleString()}</span>
          </div>
          <Slider
            value={[sourced]}
            min={100}
            max={10000}
            step={100}
            onValueChange={([value]) => setSourced(value)}
            aria-label="Number of sourced candidates"
          />
        </div>

        <div className="mt-10 space-y-4">
          {rows.map((row, index) => {
            const last = index === rows.length - 1
            return (
              <div key={row.key}>
                <div className="flex items-baseline justify-between gap-4">
                  <span
                    className={cn(
                      'font-mono text-[10px] uppercase tracking-gauge',
                      last ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {row.label}
                  </span>
                  <span className="flex items-baseline gap-3">
                    <span className={cn('tnum font-mono text-[13px]', last ? 'text-primary' : 'text-foreground/85')}>
                      {Math.round(row.survivors).toLocaleString()}
                    </span>
                    {row.conversion !== null && (
                      <span className="tnum font-mono text-[9px] text-muted-foreground/80">
                        {Math.round(row.conversion * 100)}% pass
                      </span>
                    )}
                  </span>
                </div>
                <div className="mt-1.5 flex h-[6px] w-full overflow-hidden">
                  <div
                    className={cn('h-full', last ? 'bg-primary/80' : 'bg-primary/35')}
                    style={{ width: `${Math.max(row.share * 100, 0.4)}%` }}
                  />
                  <div className="h-full flex-1 bg-border/60" />
                </div>
                {row.lost > 0 && (
                  <p className="mt-1 font-mono text-[9px] tracking-wide text-muted-foreground/70">
                    {Math.round(row.lost).toLocaleString()} lost at this membrane
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-10 border-t border-border pt-5">
          <p className="gauge text-foreground/70">Where it leaks worst</p>
          <p className="mt-2 font-mono text-[11px] leading-relaxed tracking-wide text-foreground/85">
            {biggestLeak.label} drops {Math.round(biggestLeak.lost).toLocaleString()} of the cohort, the largest single
            loss in absolute terms. Raising that one gate by ten points would return about{' '}
            {Math.round(upliftHires).toLocaleString()} more hires from the same {sourced.toLocaleString()} sourced.
          </p>
          <p className="mt-3 font-mono text-[10px] leading-relaxed tracking-wide text-muted-foreground">
            Absolute loss is not the same as the worst rate. Early membranes always shed the most people because they
            see the most people, which is why pass rate and headcount lost tell different stories and want different
            fixes.
          </p>
        </div>

        <div className="mt-12">
          <p className="gauge text-foreground/70">Preset comparison</p>
          <p className="mt-2 font-mono text-[10px] leading-relaxed tracking-wide text-muted-foreground">
            Hires from {sourced.toLocaleString()} sourced, holding each preset at its own pass rates.
          </p>
          <div className="mt-4 border-t border-border">
            {BUILTIN_PRESETS.map((preset) => {
              const presetRatio = ratioToHire(preset.passRates)
              const presetHires = preset.passRates.reduce((acc, rate) => acc * rate, sourced)
              const isActive = preset.id === config.presetId
              return (
                <div
                  key={preset.id}
                  className={cn(
                    'flex items-baseline justify-between border-b border-border py-2.5',
                    isActive && 'bg-primary/5',
                  )}
                >
                  <span
                    className={cn('font-mono text-[11px] tracking-wide', isActive ? 'text-primary' : 'text-foreground/85')}
                  >
                    {preset.name}
                  </span>
                  <span className="flex items-baseline gap-5">
                    <span className="tnum font-mono text-[11px] text-foreground/70">
                      {Math.round(presetHires).toLocaleString()} hires
                    </span>
                    <span className="tnum w-16 text-right font-mono text-[11px] text-muted-foreground">
                      {presetRatio.toFixed(1)}:1
                    </span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-5">
          <p className="gauge text-foreground/70">How the field works</p>
          <div className="mt-3 space-y-3 font-mono text-[10px] leading-relaxed tracking-wide text-muted-foreground">
            <p>
              Every candidate rolls its outcome once at spawn. That outcome is written into its physics body collision
              mask as a single bit, naming the one membrane it is allowed to touch. Passers fall through every plane
              untouched. Rejects meet a real sphere against box contact at exactly their stage, take a lateral impulse,
              and fade out.
            </p>
            <p>
              The whole field is one draw call. A six vertex quad is instanced up to three thousand times and
              billboarded in the vertex shader, with position, velocity, depth, state and alpha riding along as
              instanced attributes. Velocity stretches the quad into a streak, so acceleration becomes visible.
            </p>
            <p>
              The taper is a damped radial spring rather than a cone mesh, which keeps contact counts low and stops
              candidates skidding down a wall they should be falling past.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="gauge">{label}</div>
      <div className={cn('tnum font-mono text-[19px] leading-tight', accent ? 'text-primary' : 'text-foreground/85')}>
        {value}
      </div>
    </div>
  )
}
