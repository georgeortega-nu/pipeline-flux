import { useState, type ReactNode } from 'react'
import { Pause, Play, RotateCcw, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { TRANSITION_LABELS, ratioToHire } from '@/lib/stages'
import type { FunnelConfig, Preset } from '@/lib/types'

interface Props {
  config: FunnelConfig
  presets: Preset[]
  playing: boolean
  reducedMotion: boolean
  motionOverride: boolean
  onChange: (patch: Partial<FunnelConfig>) => void
  onSelectPreset: (id: string) => void
  onSavePreset: (name: string) => void
  onDeletePreset: (id: string) => void
  onTogglePlay: () => void
  onReset: () => void
  onMotionOverride: (value: boolean) => void
}

export function ControlPanel({
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
  onMotionOverride,
}: Props) {
  const [name, setName] = useState('')
  const builtins = presets.filter((p) => p.builtin)
  const saved = presets.filter((p) => !p.builtin)
  const active = presets.find((p) => p.id === config.presetId)
  const ratio = ratioToHire(config.passRates)

  const commitPreset = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSavePreset(trimmed)
    setName('')
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-5 thin-scroll">
      <Section label="Transport">
        <div className="flex items-center gap-2">
          <Button variant="primary" size="wide" onClick={onTogglePlay} disabled={reducedMotion}>
            {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {playing ? 'Pause' : 'Run'}
          </Button>
          <Button size="wide" onClick={onReset}>
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Label htmlFor="audio">Audio cues</Label>
          <Switch
            id="audio"
            checked={!config.muted}
            onCheckedChange={(checked) => onChange({ muted: !checked })}
            aria-label="Toggle audio cues"
          />
        </div>
      </Section>

      <Section label="Preset">
        <Select value={config.presetId} onValueChange={onSelectPreset}>
          <SelectTrigger aria-label="Choose a funnel preset">
            <SelectValue placeholder="Custom">{active?.name ?? 'Custom'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectLabel>Built in</SelectLabel>
            {builtins.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {preset.name}
              </SelectItem>
            ))}
            {saved.length > 0 && <SelectSeparator />}
            {saved.length > 0 && <SelectLabel>Saved</SelectLabel>}
            {saved.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {preset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="mt-2 flex items-center gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitPreset()
            }}
            placeholder="Save current as…"
            aria-label="Name for a new preset"
          />
          <Button size="icon" onClick={commitPreset} disabled={!name.trim()} aria-label="Save preset">
            <Save className="h-3 w-3" />
          </Button>
          {active && !active.builtin && (
            <Button
              size="icon"
              variant="danger"
              onClick={() => onDeletePreset(active.id)}
              aria-label={`Delete preset ${active.name}`}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </Section>

      <Section label="Intake">
        <Row label="Candidates / sec" value={config.intake.toFixed(0)} />
        <Slider
          value={[config.intake]}
          min={1}
          max={60}
          step={1}
          onValueChange={([value]) => onChange({ intake: value, presetId: 'custom' })}
          aria-label="Intake volume in candidates per second"
        />
        <Row label="Particle ceiling" value={String(config.maxParticles)} />
        <Slider
          value={[config.maxParticles]}
          min={200}
          max={3000}
          step={100}
          onValueChange={([value]) => onChange({ maxParticles: value })}
          aria-label="Maximum simultaneous particles"
        />
      </Section>

      <Section label="Stage pass rate">
        <div className="space-y-3">
          {TRANSITION_LABELS.map((label, index) => (
            <div key={label}>
              <Row label={label} value={`${Math.round(config.passRates[index] * 100)}%`} />
              <Slider
                value={[config.passRates[index]]}
                min={0.02}
                max={1}
                step={0.01}
                onValueChange={([value]) => {
                  const next = config.passRates.slice()
                  next[index] = value
                  onChange({ passRates: next, presetId: 'custom' })
                }}
                aria-label={`Pass rate for ${label}`}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-baseline justify-between border-t border-border pt-3">
          <span className="gauge">Candidates per hire</span>
          <span className="tnum font-mono text-[15px] text-primary">
            {Number.isFinite(ratio) ? ratio.toFixed(1) : '∞'}:1
          </span>
        </div>
      </Section>

      {reducedMotion && (
        <Section label="Motion">
          <p className="font-mono text-[10px] leading-relaxed tracking-wide text-muted-foreground">
            Your system asks for reduced motion, so the field is frozen mid-flight.
          </p>
          <div className="mt-3 flex items-center justify-between">
            <Label htmlFor="motion">Animate anyway</Label>
            <Switch
              id="motion"
              checked={motionOverride}
              onCheckedChange={onMotionOverride}
              aria-label="Animate despite reduced motion preference"
            />
          </div>
        </Section>
      )}

      <p className="mt-auto font-mono text-[9px] leading-relaxed tracking-gauge text-muted-foreground/60">
        Drag to orbit · scroll to zoom · config persists locally
      </p>
    </div>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-3">
        <span className="gauge whitespace-nowrap text-foreground/70">{label}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      {children}
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="font-mono text-[10px] tracking-wide text-muted-foreground">{label}</span>
      <span className="tnum font-mono text-[11px] text-foreground/85">{value}</span>
    </div>
  )
}
