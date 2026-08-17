import * as THREE from 'three'
import { PLATE_RADIUS, PLATE_Y, STAGES } from '@/lib/stages'
import { membraneFragment, membraneVertex, wallFragment, wallVertex } from './shaders'

const ACCENT = 0xf5a524
const COOL = 0x7f97c4
const REJECT_FLASH = 0xd8593a
const HIRE_FLASH = 0xfff4dc
const HIT_SLOTS = 3

function makeHits(): THREE.Vector3[] {
  const hits: THREE.Vector3[] = []
  for (let i = 0; i < HIT_SLOTS; i++) hits.push(new THREE.Vector3(0, 0, -100))
  return hits
}

/** The static furniture: stage membranes, the tapering funnel wall, the collector plate. */
export class Funnel {
  readonly group = new THREE.Group()
  /** index 0..4 are membranes for STAGES 1..5, index 5 is the collector plate */
  private discs: THREE.ShaderMaterial[] = []
  private hitCursor: number[] = []
  private disposables: Array<THREE.BufferGeometry | THREE.Material> = []

  constructor() {
    for (let i = 1; i < STAGES.length; i++) {
      const stage = STAGES[i]
      const last = i === STAGES.length - 1

      const geo = new THREE.CircleGeometry(stage.radius, 96)
      const mat = new THREE.ShaderMaterial({
        vertexShader: membraneVertex,
        fragmentShader: membraneFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColor: { value: new THREE.Color(last ? ACCENT : COOL) },
          uFlashColor: { value: new THREE.Color(REJECT_FLASH) },
          uOpacity: { value: last ? 1.0 : 0.62 },
          uTime: { value: 0 },
          uPhase: { value: i * 1.7 },
          uHits: { value: makeHits() },
        },
      })
      const disc = new THREE.Mesh(geo, mat)
      disc.rotation.x = -Math.PI / 2
      disc.position.y = stage.y
      disc.renderOrder = 2
      this.group.add(disc)
      this.discs.push(mat)
      this.hitCursor.push(0)
      this.disposables.push(geo, mat)

      // hairline rim so each membrane reads as a discrete instrument plane
      const ringGeo = new THREE.RingGeometry(stage.radius * 0.997, stage.radius * 1.012, 128)
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(last ? ACCENT : COOL),
        transparent: true,
        opacity: last ? 0.85 : 0.4,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.rotation.x = -Math.PI / 2
      ring.position.y = stage.y
      ring.renderOrder = 3
      this.group.add(ring)
      this.disposables.push(ringGeo, ringMat)
    }

    // tapering shells between stages
    for (let i = 0; i < STAGES.length - 1; i++) {
      const top = STAGES[i]
      const bottom = STAGES[i + 1]
      const height = top.y - bottom.y
      const geo = new THREE.CylinderGeometry(top.radius, bottom.radius, height, 64, 1, true)
      const mat = new THREE.ShaderMaterial({
        vertexShader: wallVertex,
        fragmentShader: wallFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColor: { value: new THREE.Color(COOL) },
          uOpacity: { value: 0.9 - i * 0.06 },
        },
      })
      const shell = new THREE.Mesh(geo, mat)
      shell.position.y = bottom.y + height / 2
      shell.renderOrder = 1
      this.group.add(shell)
      this.disposables.push(geo, mat)
    }

    // collector plate
    const plateGeo = new THREE.CircleGeometry(PLATE_RADIUS, 96)
    const plateMat = new THREE.ShaderMaterial({
      vertexShader: membraneVertex,
      fragmentShader: membraneFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(0xfff0d2) },
        uFlashColor: { value: new THREE.Color(HIRE_FLASH) },
        uOpacity: { value: 1.35 },
        uTime: { value: 0 },
        uPhase: { value: 0 },
        uHits: { value: makeHits() },
      },
    })
    const plate = new THREE.Mesh(plateGeo, plateMat)
    plate.rotation.x = -Math.PI / 2
    plate.position.y = PLATE_Y
    plate.renderOrder = 2
    this.group.add(plate)
    this.discs.push(plateMat)
    this.hitCursor.push(0)
    this.disposables.push(plateGeo, plateMat)

    // spawn aperture at the top, drawn as a bare rim
    const apertureGeo = new THREE.RingGeometry(STAGES[0].radius * 0.995, STAGES[0].radius * 1.01, 128)
    const apertureMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(COOL),
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const aperture = new THREE.Mesh(apertureGeo, apertureMat)
    aperture.rotation.x = -Math.PI / 2
    aperture.position.y = STAGES[0].y
    this.group.add(aperture)
    this.disposables.push(apertureGeo, apertureMat)
  }

  private writeHit(index: number, localX: number, localY: number, time: number) {
    const mat = this.discs[index]
    if (!mat) return
    const hits = mat.uniforms.uHits.value as THREE.Vector3[]
    const slot = this.hitCursor[index] % HIT_SLOTS
    this.hitCursor[index] = slot + 1
    hits[slot].set(localX, localY, time)
  }

  /**
   * A rejection at stage 1..5. World x/z are converted to local disc space,
   * where the circle geometry's y axis maps to negative world z.
   */
  flash(stage: number, x: number, z: number, time: number) {
    const index = stage - 1
    if (index < 0 || index >= STAGES.length - 1) return
    const radius = STAGES[stage].radius
    this.writeHit(index, x / radius, -z / radius, time)
  }

  /** A hire landing on the collector plate. */
  burst(time: number) {
    this.writeHit(this.discs.length - 1, 0, 0, time)
  }

  update(time: number) {
    for (const mat of this.discs) {
      mat.uniforms.uTime.value = time
    }
  }

  dispose() {
    for (const item of this.disposables) item.dispose()
    this.disposables.length = 0
    this.discs.length = 0
    this.group.clear()
  }
}
