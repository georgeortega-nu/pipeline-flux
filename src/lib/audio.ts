/**
 * Procedural voice for the sim: a short filtered blip when a candidate clears a
 * membrane (pitch rises with funnel depth) and a lower, softer tone on rejection.
 * Nothing is preloaded and no context is created until the user unmutes.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private muted = true
  private budget = 0
  private lastRefill = 0

  setMuted(muted: boolean) {
    this.muted = muted
    if (!muted) this.ensure()
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.09, this.ctx.currentTime, 0.05)
    }
  }

  private ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    try {
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.09
      const shelf = this.ctx.createBiquadFilter()
      shelf.type = 'highshelf'
      shelf.frequency.value = 5200
      shelf.gain.value = -7
      this.master.connect(shelf).connect(this.ctx.destination)
    } catch {
      this.ctx = null
    }
  }

  /** rate limiter so 2000 particles do not turn into a wall of noise */
  private take(now: number): boolean {
    if (now - this.lastRefill > 0.1) {
      this.budget = 2
      this.lastRefill = now
    }
    if (this.budget <= 0) return false
    this.budget--
    return true
  }

  tick(depth: number) {
    if (this.muted || !this.ctx || !this.master) return
    const t = this.ctx.currentTime
    if (!this.take(t)) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'triangle'
    const base = 420 + depth * 760
    osc.frequency.setValueAtTime(base, t)
    osc.frequency.exponentialRampToValueAtTime(base * 1.28, t + 0.045)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.5, t + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.13)
  }

  reject() {
    if (this.muted || !this.ctx || !this.master) return
    const t = this.ctx.currentTime
    if (!this.take(t)) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    osc.type = 'sine'
    osc.frequency.setValueAtTime(186, t)
    osc.frequency.exponentialRampToValueAtTime(96, t + 0.16)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.32, t + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
    osc.connect(lp).connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.22)
  }

  dispose() {
    if (this.ctx) {
      void this.ctx.close().catch(() => undefined)
      this.ctx = null
      this.master = null
    }
  }
}
