import { STAGES } from '@/lib/stages'
import type { Marker } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  markers: Marker[]
  counts: number[]
}

export function StageRail({ markers, counts }: Props) {
  if (!markers.length) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      {STAGES.map((stage, i) => {
        const marker = markers[i]
        if (!marker) return null
        const x = Math.max(78, marker.x)
        const count = counts[i] ?? 0
        const previous = i === 0 ? count : counts[i - 1] ?? 0
        const conversion = i === 0 || previous === 0 ? null : count / previous
        const last = i === STAGES.length - 1

        return (
          <div
            key={stage.key}
            className="absolute flex -translate-x-full -translate-y-1/2 items-center gap-2 pr-3"
            style={{ left: `${x}px`, top: `${marker.y}px` }}
          >
            <div className="text-right">
              <div
                className={cn(
                  'font-mono text-[10px] uppercase tracking-gauge',
                  last ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {stage.label}
              </div>
              <div className="flex items-baseline justify-end gap-1.5">
                <span className={cn('tnum font-mono text-[13px]', last ? 'text-primary' : 'text-foreground/85')}>
                  {count}
                </span>
                {conversion !== null && (
                  <span className="tnum font-mono text-[9px] text-muted-foreground/80">
                    {Math.round(conversion * 100)}%
                  </span>
                )}
              </div>
            </div>
            <div className={cn('h-px w-4', last ? 'bg-primary/70' : 'bg-border')} />
          </div>
        )
      })}
    </div>
  )
}
