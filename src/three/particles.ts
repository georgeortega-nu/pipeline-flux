import * as THREE from 'three'
import { particleFragment, particleVertex } from './shaders'

export const MAX_INSTANCES = 3000

const QUAD = new Float32Array([
  -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
])

/**
 * One draw call for every candidate on screen. A six-vertex quad is instanced
 * MAX_INSTANCES times and billboarded in the vertex shader; per-candidate data
 * rides along as dynamic instanced attributes.
 */
export class ParticleField {
  readonly geometry: THREE.InstancedBufferGeometry
  readonly material: THREE.ShaderMaterial
  readonly mesh: THREE.Mesh

  private offsets = new Float32Array(MAX_INSTANCES * 3)
  private progress = new Float32Array(MAX_INSTANCES)
  private states = new Float32Array(MAX_INSTANCES)
  private alphas = new Float32Array(MAX_INSTANCES)
  private seeds = new Float32Array(MAX_INSTANCES)

  private aOffset: THREE.InstancedBufferAttribute
  private aProgress: THREE.InstancedBufferAttribute
  private aState: THREE.InstancedBufferAttribute
  private aAlpha: THREE.InstancedBufferAttribute
  private aSeed: THREE.InstancedBufferAttribute

  constructor() {
    this.geometry = new THREE.InstancedBufferGeometry()
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(QUAD, 3))

    this.aOffset = new THREE.InstancedBufferAttribute(this.offsets, 3).setUsage(THREE.DynamicDrawUsage)
    this.aProgress = new THREE.InstancedBufferAttribute(this.progress, 1).setUsage(THREE.DynamicDrawUsage)
    this.aState = new THREE.InstancedBufferAttribute(this.states, 1).setUsage(THREE.DynamicDrawUsage)
    this.aAlpha = new THREE.InstancedBufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage)
    this.aSeed = new THREE.InstancedBufferAttribute(this.seeds, 1).setUsage(THREE.DynamicDrawUsage)

    this.geometry.setAttribute('aOffset', this.aOffset)
    this.geometry.setAttribute('aProgress', this.aProgress)
    this.geometry.setAttribute('aState', this.aState)
    this.geometry.setAttribute('aAlpha', this.aAlpha)
    this.geometry.setAttribute('aSeed', this.aSeed)

    this.geometry.instanceCount = 0
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 40)

    this.material = new THREE.ShaderMaterial({
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uSize: { value: 0.34 },
        uTime: { value: 0 },
        uCold: { value: new THREE.Color(0x2f5390) },
        uWarm: { value: new THREE.Color(0xf5a524) },
        uHot: { value: new THREE.Color(0xfff6e2) },
        uReject: { value: new THREE.Color(0x8f3220) },
      },
    })

    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 4
  }

  write(i: number, x: number, y: number, z: number, progress: number, state: number, alpha: number, seed: number) {
    const o = i * 3
    this.offsets[o] = x
    this.offsets[o + 1] = y
    this.offsets[o + 2] = z
    this.progress[i] = progress
    this.states[i] = state
    this.alphas[i] = alpha
    this.seeds[i] = seed
  }

  commit(count: number, time: number) {
    this.geometry.instanceCount = count
    this.aOffset.needsUpdate = true
    this.aProgress.needsUpdate = true
    this.aState.needsUpdate = true
    this.aAlpha.needsUpdate = true
    this.aSeed.needsUpdate = true
    this.material.uniforms.uTime.value = time
  }

  setSize(size: number) {
    this.material.uniforms.uSize.value = size
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
  }
}
