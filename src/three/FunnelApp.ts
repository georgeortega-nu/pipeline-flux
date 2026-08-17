import * as THREE from 'three'
import { FunnelSim } from '@/sim/FunnelSim'
import { STAGES } from '@/lib/stages'
import type { Marker, SimStats } from '@/lib/types'
import { Funnel } from './membranes'
import { MAX_INSTANCES, ParticleField } from './particles'

export interface AppOptions {
  reducedMotion: boolean
  onStats?: (stats: SimStats) => void
  onTick?: (depth: number) => void
  onReject?: (stage: number) => void
}

const TARGET_HEIGHT = 22.5
const TARGET_WIDTH = 13.5
const MARKER_POINT = new THREE.Vector3()

export class FunnelApp {
  readonly sim = new FunnelSim()

  private container: HTMLElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private funnel = new Funnel()
  private particles = new ParticleField()

  private frame = 0
  private clock = new THREE.Clock()
  private playing = true
  private reducedMotion: boolean
  private disposed = false

  private yaw = 0.34
  private pitch = 0.1
  private targetYaw = 0.34
  private targetPitch = 0.1
  private distance = 26
  private zoom = 1
  private dragging = false
  private userTook = false
  private pointerId = -1
  private lastX = 0
  private lastY = 0

  private fpsSamples: number[] = []
  private statsTimer = 0
  private downscaled = false
  private observer: ResizeObserver | null = null
  private options: AppOptions

  constructor(container: HTMLElement, options: AppOptions) {
    this.container = container
    this.options = options
    this.reducedMotion = options.reducedMotion

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.renderer.domElement.style.touchAction = 'none'
    this.renderer.domElement.setAttribute('aria-hidden', 'true')
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200)
    this.scene.add(this.funnel.group)
    this.scene.add(this.particles.mesh)

    this.sim.onTick = (depth) => this.options.onTick?.(depth)
    this.sim.onReject = (stage) => this.options.onReject?.(stage)

    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.onPointerUp)
    this.renderer.domElement.addEventListener('wheel', this.onWheel, { passive: false })
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost)

    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(container)
    this.resize()

    if (this.reducedMotion) {
      this.playing = false
      this.sim.populateStatic(900)
      this.renderStatic()
      this.emitStats(0)
    } else {
      this.frame = requestAnimationFrame(this.loop)
    }
  }

  // ——— input ———

  private onPointerDown = (event: PointerEvent) => {
    if (this.dragging) return
    this.dragging = true
    this.userTook = true
    this.pointerId = event.pointerId
    this.lastX = event.clientX
    this.lastY = event.clientY
  }

  private onPointerMove = (event: PointerEvent) => {
    if (!this.dragging || event.pointerId !== this.pointerId) return
    const dx = event.clientX - this.lastX
    const dy = event.clientY - this.lastY
    this.lastX = event.clientX
    this.lastY = event.clientY
    this.targetYaw = clamp(this.targetYaw + dx * 0.005, -1.1, 1.1)
    this.targetPitch = clamp(this.targetPitch + dy * 0.003, -0.32, 0.45)
    if (this.reducedMotion) this.renderStatic()
  }

  private onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== this.pointerId) return
    this.dragging = false
    this.pointerId = -1
  }

  private onWheel = (event: WheelEvent) => {
    event.preventDefault()
    this.zoom = clamp(this.zoom + event.deltaY * 0.0009, 0.62, 1.5)
    this.resize()
    if (this.reducedMotion) this.renderStatic()
  }

  private onContextLost = (event: Event) => {
    event.preventDefault()
  }

  // ——— layout ———

  private resize() {
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)
    const aspect = width / height

    this.renderer.setSize(width, height, false)
    this.camera.aspect = aspect
    const fov = (this.camera.fov * Math.PI) / 180
    const byHeight = TARGET_HEIGHT / 2 / Math.tan(fov / 2)
    const byWidth = TARGET_WIDTH / 2 / Math.tan(fov / 2) / aspect
    this.distance = Math.max(byHeight, byWidth) * this.zoom
    this.camera.updateProjectionMatrix()
    this.particles.setSize(aspect < 0.8 ? 0.4 : 0.34)
    this.updateCamera(1)
  }

  private updateCamera(lerp: number) {
    this.yaw += (this.targetYaw - this.yaw) * lerp
    this.pitch += (this.targetPitch - this.pitch) * lerp
    const target = new THREE.Vector3(0, -0.4, 0)
    const x = Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance
    const z = Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance
    const y = Math.sin(this.pitch) * this.distance + target.y
    this.camera.position.set(x, y, z)
    this.camera.lookAt(target)
  }

  // ——— loop ———

  private loop = () => {
    if (this.disposed) return
    this.frame = requestAnimationFrame(this.loop)
    const raw = this.clock.getDelta()
    const dt = Math.min(raw, 1 / 20)

    if (raw > 0) {
      this.fpsSamples.push(1 / raw)
      if (this.fpsSamples.length > 40) this.fpsSamples.shift()
    }

    if (this.playing) this.sim.step(dt)

    if (!this.userTook) {
      this.targetYaw = 0.34 + Math.sin(this.clock.elapsedTime * 0.11) * 0.18
    }
    this.updateCamera(0.08)

    this.funnel.update(this.clock.elapsedTime)
    this.writeParticles()
    this.renderer.render(this.scene, this.camera)

    this.statsTimer += raw
    if (this.statsTimer > 0.1) {
      this.emitStats(this.statsTimer)
      this.statsTimer = 0
      this.considerDownscale()
    }
  }

  private writeParticles() {
    const pool = this.sim.pool
    let n = 0
    for (let i = 0; i < pool.length && n < MAX_INSTANCES; i++) {
      const p = pool[i]
      if (!p.active || p.alpha <= 0.001) continue
      const pos = p.body.position
      this.particles.write(n, pos.x, pos.y, pos.z, this.sim.depthOf(p), p.state, p.alpha, p.seed)
      n++
    }
    this.particles.commit(n, this.clock.elapsedTime)
  }

  private renderStatic() {
    this.updateCamera(1)
    this.funnel.update(0)
    this.writeParticles()
    this.renderer.render(this.scene, this.camera)
  }

  private considerDownscale() {
    if (this.downscaled || this.fpsSamples.length < 30) return
    const avg = this.averageFps()
    if (avg < 44 && this.renderer.getPixelRatio() > 1.25) {
      this.downscaled = true
      this.renderer.setPixelRatio(1.25)
      this.resize()
    }
  }

  private averageFps(): number {
    if (!this.fpsSamples.length) return 0
    let sum = 0
    for (const f of this.fpsSamples) sum += f
    return sum / this.fpsSamples.length
  }

  private markers(): Marker[] {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    const out: Marker[] = []
    for (const stage of STAGES) {
      MARKER_POINT.set(-stage.radius * 1.03, stage.y, 0)
      MARKER_POINT.project(this.camera)
      out.push({
        x: (MARKER_POINT.x * 0.5 + 0.5) * width,
        y: (-MARKER_POINT.y * 0.5 + 0.5) * height,
      })
    }
    return out
  }

  private emitStats(_dt: number) {
    this.options.onStats?.({
      fps: Math.round(this.averageFps()),
      active: this.sim.activeCount,
      counts: this.sim.counts.slice(),
      markers: this.markers(),
    })
  }

  // ——— public api ———

  setConfig(config: { intake: number; maxParticles: number; passRates: number[] }) {
    this.sim.intake = config.intake
    this.sim.maxParticles = Math.min(config.maxParticles, MAX_INSTANCES)
    this.sim.passRates = config.passRates
    if (this.reducedMotion) {
      this.sim.populateStatic(900)
      this.renderStatic()
      this.emitStats(0)
    }
  }

  setPlaying(playing: boolean) {
    this.playing = playing
  }

  isPlaying() {
    return this.playing
  }

  reset() {
    this.sim.reset()
    if (this.reducedMotion) {
      this.sim.populateStatic(900)
      this.renderStatic()
    }
    this.emitStats(0)
  }

  setReducedMotion(reduced: boolean) {
    if (reduced === this.reducedMotion) return
    this.reducedMotion = reduced
    if (reduced) {
      cancelAnimationFrame(this.frame)
      this.frame = 0
      this.playing = false
      this.sim.populateStatic(900)
      this.renderStatic()
    } else {
      this.sim.reset()
      this.playing = true
      this.clock.getDelta()
      if (!this.frame) this.frame = requestAnimationFrame(this.loop)
    }
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.observer?.disconnect()
    this.observer = null
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointercancel', this.onPointerUp)
    this.renderer.domElement.removeEventListener('wheel', this.onWheel)
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost)
    this.sim.onTick = null
    this.sim.onReject = null
    this.sim.dispose()
    this.particles.dispose()
    this.funnel.dispose()
    this.scene.clear()
    this.renderer.dispose()
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement)
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}
