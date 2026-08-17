import * as CANNON from 'cannon-es'
import { PLATE_RADIUS, PLATE_Y, STAGES } from '@/lib/stages'
import { mulberry32 } from '@/lib/rng'

export const P_FALLING = 0
export const P_REJECTED = 1
export const P_HIRED = 2

const PARTICLE_GROUP = 1
const PLATE_GROUP = 1 << 6
const PARTICLE_RADIUS = 0.115
const HARD_CAP = 3000
/** fraction of the wall radius the swarm is allowed to occupy */
const FUNNEL_FILL = 0.62
const SWIRL = 0.55
const SPAWN_Y = STAGES[0].y
const DEPTH_SPAN = SPAWN_Y - PLATE_Y

export interface Particle {
  body: CANNON.Body
  active: boolean
  state: number
  /** how many membranes this candidate has cleared */
  stage: number
  /** membrane index (1..5) where it will be rejected, or 0 if it goes all the way */
  rejectAt: number
  alpha: number
  timer: number
  seed: number
}

interface CollideEvent {
  body: CANNON.Body
}

/**
 * The simulation. Fate is rolled once at spawn, then encoded into the body's
 * collision mask: a candidate only physically collides with the single membrane
 * where it gets rejected, or with the collector plate if it clears everything.
 * cannon-es therefore does the real work of stopping and deflecting rejects.
 */
export class FunnelSim {
  readonly world: CANNON.World
  readonly pool: Particle[] = []
  counts: number[] = new Array(STAGES.length).fill(0)
  activeCount = 0

  intake = 14
  maxParticles = 1400
  passRates = [0.55, 0.52, 0.6, 0.68, 0.85]

  onTick: ((depth: number) => void) | null = null
  onReject: ((stage: number, x: number, z: number) => void) | null = null
  onHire: (() => void) | null = null

  private free: number[] = []
  private spawnAcc = 0
  private rand: () => number
  private seed: number
  private membranes: CANNON.Body[] = []
  private plate: CANNON.Body

  constructor(seed = 0x5eed) {
    this.seed = seed
    this.rand = mulberry32(seed)

    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -8.6, 0) })
    this.world.broadphase = new CANNON.SAPBroadphase(this.world)
    this.world.allowSleep = false
    this.world.defaultContactMaterial.restitution = 0.34
    this.world.defaultContactMaterial.friction = 0.16

    for (let i = 1; i < STAGES.length; i++) {
      const s = STAGES[i]
      const half = s.radius * 0.8
      const body = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(new CANNON.Vec3(half, 0.14, half)),
        position: new CANNON.Vec3(0, s.y, 0),
        collisionFilterGroup: 1 << i,
        collisionFilterMask: PARTICLE_GROUP,
      })
      this.membranes[i] = body
      this.world.addBody(body)
    }

    this.plate = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(new CANNON.Vec3(PLATE_RADIUS * 0.8, 0.16, PLATE_RADIUS * 0.8)),
      position: new CANNON.Vec3(0, PLATE_Y, 0),
      collisionFilterGroup: PLATE_GROUP,
      collisionFilterMask: PARTICLE_GROUP,
    })
    this.world.addBody(this.plate)
  }

  /** the radius of the funnel wall at a given height */
  funnelRadiusAt(y: number): number {
    if (y >= STAGES[0].y) return STAGES[0].radius
    for (let i = 0; i < STAGES.length - 1; i++) {
      const top = STAGES[i]
      const bottom = STAGES[i + 1]
      if (y <= top.y && y >= bottom.y) {
        const t = (top.y - y) / (top.y - bottom.y)
        return top.radius + (bottom.radius - top.radius) * t
      }
    }
    return STAGES[STAGES.length - 1].radius
  }

  /**
   * Rather than build a physical cone (expensive, and it makes candidates skid),
   * the taper is a damped radial spring that squeezes the swarm inward as it
   * descends, plus a slow swirl so depth is readable in motion.
   */
  private constrain(body: CANNON.Body, dt: number) {
    const pos = body.position
    const r = Math.sqrt(pos.x * pos.x + pos.z * pos.z)
    if (r < 1e-4) return
    const nx = pos.x / r
    const nz = pos.z / r

    const limit = this.funnelRadiusAt(pos.y) * FUNNEL_FILL
    const excess = r - limit
    if (excess > 0) {
      const radialVelocity = body.velocity.x * nx + body.velocity.z * nz
      const accel = -excess * 15 - radialVelocity * 3.6
      body.velocity.x += nx * accel * dt
      body.velocity.z += nz * accel * dt
    }

    body.velocity.x += -nz * SWIRL * dt
    body.velocity.z += nx * SWIRL * dt
  }

  private createParticle(): number {
    const index = this.pool.length
    const body = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Sphere(PARTICLE_RADIUS),
      position: new CANNON.Vec3(0, SPAWN_Y, 0),
      linearDamping: 0.015,
      angularDamping: 0.4,
      collisionFilterGroup: PARTICLE_GROUP,
      collisionFilterMask: PLATE_GROUP,
    })
    const particle: Particle = {
      body,
      active: false,
      state: P_FALLING,
      stage: 0,
      rejectAt: 0,
      alpha: 0,
      timer: 0,
      seed: this.rand(),
    }
    body.addEventListener('collide', (event: CollideEvent) => {
      if (!particle.active || particle.state !== P_FALLING) return
      if (event.body === this.plate) {
        particle.state = P_HIRED
        particle.timer = 0
        if (this.onHire) this.onHire()
      } else {
        this.deflect(particle)
      }
    })
    this.pool.push(particle)
    return index
  }

  private deflect(particle: Particle) {
    particle.state = P_REJECTED
    particle.timer = 0
    const contactX = particle.body.position.x
    const contactZ = particle.body.position.z
    const angle = this.rand() * Math.PI * 2
    const force = 2.4 + this.rand() * 2.2
    particle.body.applyImpulse(new CANNON.Vec3(Math.cos(angle) * force, 0.7 + this.rand() * 0.6, Math.sin(angle) * force))
    if (this.onReject) this.onReject(particle.rejectAt, contactX, contactZ)
  }

  private spawn() {
    if (this.activeCount >= this.maxParticles) return
    let index = this.free.pop()
    if (index === undefined) {
      if (this.pool.length >= HARD_CAP) return
      index = this.createParticle()
    }
    const p = this.pool[index]

    let rejectAt = 0
    for (let i = 0; i < this.passRates.length; i++) {
      if (this.rand() > this.passRates[i]) {
        rejectAt = i + 1
        break
      }
    }

    p.active = true
    p.state = P_FALLING
    p.stage = 0
    p.rejectAt = rejectAt
    p.alpha = 0
    p.timer = 0
    p.seed = this.rand()

    const angle = this.rand() * Math.PI * 2
    const radius = Math.sqrt(this.rand()) * STAGES[0].radius * FUNNEL_FILL
    p.body.position.set(Math.cos(angle) * radius, SPAWN_Y, Math.sin(angle) * radius)
    p.body.velocity.set((this.rand() - 0.5) * 0.3, -0.5 - this.rand() * 0.9, (this.rand() - 0.5) * 0.3)
    p.body.angularVelocity.set(0, 0, 0)
    p.body.quaternion.set(0, 0, 0, 1)
    p.body.collisionResponse = true
    p.body.collisionFilterMask = rejectAt > 0 ? 1 << rejectAt : PLATE_GROUP
    p.body.wakeUp()
    this.world.addBody(p.body)

    this.activeCount++
    this.counts[0]++
  }

  private despawn(p: Particle, index: number) {
    if (!p.active) return
    p.active = false
    p.alpha = 0
    this.world.removeBody(p.body)
    this.free.push(index)
    this.activeCount--
  }

  step(dt: number) {
    this.spawnAcc += dt * this.intake
    const toSpawn = Math.min(Math.floor(this.spawnAcc), 40)
    this.spawnAcc -= Math.floor(this.spawnAcc)
    for (let i = 0; i < toSpawn; i++) this.spawn()

    this.world.step(1 / 120, dt, 4)

    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i]
      if (!p.active) continue
      const y = p.body.position.y

      if (p.state === P_FALLING) {
        p.alpha = Math.min(1, p.alpha + dt * 5)
        this.constrain(p.body, dt)
        while (p.stage < STAGES.length - 1 && y < STAGES[p.stage + 1].y) {
          const next = p.stage + 1
          if (p.rejectAt === next) {
            // slipped past its own membrane (rare, high velocity): reject anyway
            this.deflect(p)
            break
          }
          p.stage = next
          this.counts[next]++
          if (this.onTick) this.onTick(next / (STAGES.length - 1))
        }
        if (y < PLATE_Y - 6) this.despawn(p, i)
        continue
      }

      p.timer += dt

      if (p.state === P_REJECTED) {
        if (p.timer > 0.08) p.body.collisionResponse = false
        p.alpha = Math.max(0, 1 - Math.max(0, p.timer - 0.12) / 0.95)
        if (p.timer > 1.15 || y < PLATE_Y - 6) this.despawn(p, i)
        continue
      }

      // hired: hold on the plate, glow, then fade out
      p.alpha = p.timer < 1.6 ? 1 : Math.max(0, 1 - (p.timer - 1.6) / 0.7)
      if (p.timer > 2.35 || y < PLATE_Y - 6) this.despawn(p, i)
    }
  }

  /** deterministic frozen snapshot for prefers-reduced-motion */
  populateStatic(count: number) {
    this.reset()
    const rand = mulberry32(this.seed ^ 0x9e37)
    const spans = STAGES.length - 1
    for (let i = 0; i < count; i++) {
      const index = this.free.pop() ?? (this.pool.length < HARD_CAP ? this.createParticle() : undefined)
      if (index === undefined) break
      const p = this.pool[index]

      // sample a depth weighted by how many candidates actually survive to it
      let segment = 0
      let survival = 1
      const roll = rand()
      let acc = 0
      const weights: number[] = []
      let total = 0
      for (let s = 0; s < spans; s++) {
        weights.push(survival)
        total += survival
        survival *= this.passRates[s] ?? 0.5
      }
      for (let s = 0; s < spans; s++) {
        acc += weights[s] / total
        if (roll <= acc) {
          segment = s
          break
        }
      }

      const t = rand()
      const yTop = STAGES[segment].y
      const yBottom = STAGES[segment + 1].y
      const y = yTop + (yBottom - yTop) * t
      const rTop = STAGES[segment].radius
      const rBottom = STAGES[segment + 1].radius
      const rHere = (rTop + (rBottom - rTop) * t) * FUNNEL_FILL
      const angle = rand() * Math.PI * 2
      const radius = Math.sqrt(rand()) * rHere

      p.active = true
      p.state = P_FALLING
      p.stage = segment
      p.rejectAt = 0
      p.alpha = 0.55 + rand() * 0.45
      p.timer = 0
      p.seed = rand()
      p.body.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
      // a frozen field should read as still, so no velocity streaks
      p.body.velocity.set(0, 0, 0)
      this.activeCount++
      this.counts[0]++
    }
  }

  reset() {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i]
      if (p.active) this.despawn(p, i)
    }
    this.counts = new Array(STAGES.length).fill(0)
    this.spawnAcc = 0
    this.rand = mulberry32(this.seed)
  }

  /** returns 0..1 depth used to drive particle color */
  depthOf(p: Particle): number {
    if (p.state === P_HIRED) return 1
    return Math.min(1, Math.max(0, (SPAWN_Y - p.body.position.y) / DEPTH_SPAN))
  }

  dispose() {
    this.reset()
    // every listener is owned by its body, so dropping the pool drops them all
    this.pool.length = 0
    this.free.length = 0
    for (let i = 1; i < this.membranes.length; i++) {
      if (this.membranes[i]) this.world.removeBody(this.membranes[i])
    }
    this.world.removeBody(this.plate)
  }
}
