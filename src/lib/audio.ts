/**
 * Procedural voice for the sim. Clearing a membrane plays a note from an A minor
 * pentatonic scale, rising with stage depth, so a healthy pipeline sounds like an
 * ascending figure rather than a click track. Rejection is a low damped thud.
 * Nothing is preloaded and no context is created until the user unmutes.
 */

/** A minor pentatonic, two octaves up: A C D E G */
const SCALE = [440.0, 523.25, 587.33, 659.25, 783.99]

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

  /** depth is 0..1 across the funnel; it selects the scale degree */
  tick(depth: number) {
    if (this.muted || !this.ctx || !this.master) return
    const t = this.ctx.currentTime
    if (!this.take(t)) return

    const degree = Math.min(SCALE.length - 1, Math.max(0, Math.round(depth * SCALE.length) - 1))
    const freq = SCALE[degree]

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, t)

    // a quiet fifth above the deepest stages, so hires ring rather than blip
    const shimmer = this.ctx.createOscillator()
    const shimmerGain = this.ctx.createGain()
    shimmer.type = 'sine'
    shimmer.frequency.setValueAtTime(freq * 1.5, t)
    const shimmerLevel = depth > 0.75 ? 0.2 : 0.0

    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.45, t + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28)

    shimmerGain.gain.setValueAtTime(0.0001, t)
    if (shimmerLevel > 0) {
      shimmerGain.gain.exponentialRampToValueAtTime(shimmerLevel, t + 0.01)
      shimmerGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
    }

    osc.connect(gain).connect(this.master)
    shimmer.connect(shimmerGain).connect(this.master)
    osc.start(t)
    shimmer.start(t)
    osc.stop(t + 0.3)
    shimmer.stop(t + 0.42)
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
    // a minor third below the tonic, so rejects sit under the scale
    osc.frequency.setValueAtTime(146.83, t)
    osc.frequency.exponentialRampToValueAtTime(88.0, t + 0.16)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    osc.connect(lp).connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.24)
  }

  dispose() {
    if (this.ctx) {
      void this.ctx.close().catch(() => undefined)
      this.ctx = null
      this.master = null
    }
  }
}
