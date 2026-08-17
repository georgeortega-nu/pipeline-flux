import * as THREE from 'three'
import { PLATE_RADIUS, PLATE_Y, STAGES } from '@/lib/stages'
import { membraneFragment, membraneVertex, wallFragment, wallVertex } from './shaders'

const ACCENT = 0xf5a524
const COOL = 0x7f97c4

/** The static furniture: stage membranes, the tapering funnel wall, the collector plate. */
export class Funnel {
  readonly group = new THREE.Group()
  readonly membraneMaterials: THREE.ShaderMaterial[] = []
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
          uOpacity: { value: last ? 1.0 : 0.62 },
          uTime: { value: 0 },
          uPhase: { value: i * 1.7 },
        },
      })
      const disc = new THREE.Mesh(geo, mat)
      disc.rotation.x = -Math.PI / 2
      disc.position.y = stage.y
      disc.renderOrder = 2
      this.group.add(disc)
      this.membraneMaterials.push(mat)
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
        uOpacity: { value: 1.35 },
        uTime: { value: 0 },
        uPhase: { value: 0 },
      },
    })
    const plate = new THREE.Mesh(plateGeo, plateMat)
    plate.rotation.x = -Math.PI / 2
    plate.position.y = PLATE_Y
    plate.renderOrder = 2
    this.group.add(plate)
    this.membraneMaterials.push(plateMat)
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

  update(time: number) {
    for (const mat of this.membraneMaterials) {
      mat.uniforms.uTime.value = time
    }
  }

  dispose() {
    for (const item of this.disposables) item.dispose()
    this.disposables.length = 0
    this.group.clear()
  }
}
