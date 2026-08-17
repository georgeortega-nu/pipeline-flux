import { ratioToHire } from '@/lib/stages'
import type { SimStats } from '@/lib/types'

interface Props {
  stats: SimStats
  passRates: number[]
  reducedMotion: boolean
}

export function Hud({ stats, passRates, reducedMotion }: Props) {
  const ratio = ratioToHire(passRates)
  const ratioLabel = Number.isFinite(ratio) ? ratio.toFixed(1) : '∞'

  return (
    <>
      <header className="pointer-events-none absolute left-5 top-5 z-20 md:left-7 md:top-7">
        <h1 className="font-mono text-[13px] uppercase tracking-wider2 text-foreground">Pipeline Flux</h1>
        <p className="mt-1 max-w-[15rem] font-mono text-[10px] leading-relaxed tracking-gauge text-muted-foreground">
          Candidates as particles · membranes as stages
        </p>
      </header>

      <div className="pointer-events-none absolute bottom-5 left-5 z-20 flex gap-6 md:bottom-7 md:left-7">
        <Readout label="Ratio" value={`${ratioLabel}:1`} accent />
        <Readout label="Live" value={String(stats.active)} />
        <Readout label="FPS" value={reducedMotion ? 'static' : String(stats.fps || '—')} />
      </div>
    </>
  )
}

function Readout({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="gauge">{label}</div>
      <div className={`tnum font-mono text-[15px] leading-tight ${accent ? 'text-primary' : 'text-foreground/85'}`}>
        {value}
      </div>
    </div>
  )
}
