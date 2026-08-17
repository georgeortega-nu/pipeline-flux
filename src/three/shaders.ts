export const particleVertex = /* glsl */ `
  attribute vec3 aOffset;
  attribute vec3 aVelocity;
  attribute float aProgress;
  attribute float aState;
  attribute float aAlpha;
  attribute float aSeed;

  uniform float uSize;
  uniform float uTime;
  uniform float uStretch;
  uniform float uFogNear;
  uniform float uFogFar;

  varying vec2 vQuad;
  varying float vProgress;
  varying float vState;
  varying float vAlpha;
  varying float vFog;
  varying float vSpeed;

  void main() {
    vQuad = position.xy * 2.0;
    vProgress = aProgress;
    vState = aState;
    vAlpha = aAlpha;

    vec4 mv = viewMatrix * vec4(aOffset, 1.0);

    // atmospheric falloff so the far side of the funnel recedes
    float depth = -mv.z;
    vFog = clamp((depth - uFogNear) / max(0.001, uFogFar - uFogNear), 0.0, 1.0);

    float pulse = 1.0 + 0.10 * sin(uTime * 2.6 + aSeed * 43.0);
    float hired = step(1.5, aState);
    float scale = uSize * pulse * mix(1.0, 2.05, hired);

    // stretch the billboard along screen-space velocity so falling candidates
    // read as streaks that elongate as they accelerate
    vec3 velView = (viewMatrix * vec4(aVelocity, 0.0)).xyz;
    vec2 dir = velView.xy;
    float speed = length(dir);
    vSpeed = speed;
    vec2 axis = speed > 0.001 ? dir / speed : vec2(0.0, 1.0);
    vec2 perp = vec2(-axis.y, axis.x);
    float stretch = 1.0 + clamp(speed * uStretch, 0.0, 2.6) * (1.0 - hired);

    vec2 local = position.xy * scale;
    mv.xy += axis * local.y * stretch + perp * local.x;

    gl_Position = projectionMatrix * mv;
  }
`

export const particleFragment = /* glsl */ `
  precision highp float;

  uniform vec3 uCold;
  uniform vec3 uWarm;
  uniform vec3 uHot;
  uniform vec3 uReject;

  varying vec2 vQuad;
  varying float vProgress;
  varying float vState;
  varying float vAlpha;
  varying float vFog;
  varying float vSpeed;

  void main() {
    float d = length(vQuad);
    if (d > 1.0) discard;

    float core = smoothstep(0.36, 0.0, d);
    float halo = pow(1.0 - d, 3.2) * 0.62;

    vec3 c = mix(uCold, uWarm, smoothstep(0.04, 0.76, vProgress));
    c = mix(c, uHot, smoothstep(0.80, 1.0, vProgress));

    float rejected = step(0.5, vState) * (1.0 - step(1.5, vState));
    c = mix(c, uReject, rejected * 0.92);

    float a = (core * 0.95 + halo) * vAlpha;
    a *= mix(1.0, 0.22, vFog);

    gl_FragColor = vec4(c * (0.5 + core * 1.75), a);
  }
`

export const membraneVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/**
 * uHits carries three impact slots as (x, y, time). A rejection writes the
 * contact point in local disc space and the ring expands from exactly there,
 * so the collision you cannot see becomes an event you can.
 */
export const membraneFragment = /* glsl */ `
  precision highp float;

  uniform vec3 uColor;
  uniform vec3 uFlashColor;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uPhase;
  uniform vec3 uHits[3];

  varying vec2 vUv;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    if (r > 1.0) discard;

    float rim = smoothstep(0.88, 0.985, r) * (1.0 - smoothstep(0.985, 1.0, r));
    float body = (1.0 - smoothstep(0.0, 1.05, r)) * 0.13;
    float ripple = 0.5 + 0.5 * sin(r * 42.0 - uTime * 0.9 + uPhase);
    float a = (body * (0.7 + 0.3 * ripple) + rim * 0.9) * uOpacity;

    float flash = 0.0;
    for (int i = 0; i < 3; i++) {
      float age = uTime - uHits[i].z;
      if (age > 0.0 && age < 0.95) {
        float dHit = length(p - uHits[i].xy);
        float wave = 1.0 - smoothstep(0.0, 0.2, abs(dHit - age * 1.7));
        flash += wave * (1.0 - age / 0.95);
      }
    }

    vec3 color = mix(uColor, uFlashColor, clamp(flash, 0.0, 1.0));
    a += flash * 0.55 * uOpacity;

    gl_FragColor = vec4(color, a);
  }
`

export const wallVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    vNormalView = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`

export const wallFragment = /* glsl */ `
  precision highp float;

  uniform vec3 uColor;
  uniform float uOpacity;

  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  void main() {
    float facing = abs(dot(normalize(vNormalView), normalize(vViewDir)));
    float fresnel = pow(1.0 - facing, 2.6);
    float ribs = smoothstep(0.982, 1.0, abs(sin(vUv.x * 3.14159265 * 30.0)));
    float gradient = 0.28 + 0.72 * vUv.y;
    float a = (fresnel * 0.30 + ribs * 0.16) * gradient * uOpacity;
    gl_FragColor = vec4(uColor, a);
  }
`
