/**
 * [VS2] Mallas del ambiente (reglas en ambience.ts): la cúpula del cielo, la película de agua sobre el asfalto, las dos
 * nubes de puntos que dejan los coches (estela y chispas) y el público. Una llamada de dibujo cada una.
 */
import * as THREE from 'three';
import type { SkyLook, Seat, TrailPoint } from './ambience';

/** Cúpula del cielo: degradado del horizonte al cénit, resplandor hacia el sol, estrellas de noche y nubes por ruido. */
export function createSky(): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: {
      zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, glow: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, stars: { value: 0 }, clouds: { value: 0 }, dusk: { value: 0 }, time: { value: 0 },
    },
    vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vDir; uniform vec3 zenith; uniform vec3 horizon; uniform vec3 glow; uniform vec3 sunDir;
      uniform float stars; uniform float clouds; uniform float dusk; uniform float time;
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
      float fbm(vec2 p) { return 0.5 * noise(p) + 0.25 * noise(p * 2.1) + 0.125 * noise(p * 4.3) + 0.0625 * noise(p * 8.7); }
      void main() {
        vec3 d = normalize(vDir); float up = max(d.y, 0.0);
        vec3 col = mix(horizon, zenith, pow(up, 0.55));
        float toSun = max(dot(d, normalize(sunDir)), 0.0);
        col += glow * (0.35 * pow(toSun, 6.0) + 0.9 * pow(toSun, 220.0)) * (0.4 + 0.6 * dusk) * (1.0 - clouds);
        if (stars > 0.0 && d.y > 0.0) { vec2 g = d.xz / (0.35 + d.y) * 90.0; vec2 c = floor(g); float s = h21(c);
          float tw = 0.75 + 0.25 * sin(time * 1.3 + s * 40.0);
          col += vec3(0.9, 0.95, 1.0) * step(0.985, s) * smoothstep(0.35, 0.0, length(fract(g) - 0.5)) * tw * stars * smoothstep(0.0, 0.25, d.y); }
        if (clouds > 0.0 && d.y > 0.02) { vec2 p = d.xz / (0.25 + d.y) * 1.6 + vec2(time * 0.004, 0.0);
          float c = smoothstep(1.0 - clouds * 0.9, 1.05, fbm(p) + 0.45);
          vec3 cloud = mix(mix(horizon, vec3(1.0), 0.55), horizon * 0.55, clouds * 0.6);
          col = mix(col, cloud, c * smoothstep(0.02, 0.2, d.y)); }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), material);
  mesh.frustumCulled = false; mesh.renderOrder = -1000; mesh.name = 'cielo';
  return mesh;
}

export function updateSky(sky: THREE.Mesh, look: SkyLook, sunDir: THREE.Vector3, camera: THREE.PerspectiveCamera, timeSec: number): void {
  const u = (sky.material as THREE.ShaderMaterial).uniforms;
  u.zenith.value.setRGB(look.zenith.r, look.zenith.g, look.zenith.b); u.horizon.value.setRGB(look.horizon.r, look.horizon.g, look.horizon.b);
  u.glow.value.setRGB(look.glow.r, look.glow.g, look.glow.b); u.sunDir.value.copy(sunDir);
  u.stars.value = look.stars; u.clouds.value = look.clouds; u.dusk.value = look.dusk; u.time.value = timeSec;
  sky.position.copy(camera.position); sky.scale.setScalar(camera.far * 0.9);
}

/** Película oscura sobre el asfalto (cinta por el eje, del ancho de la pista); su opacidad dice lo mojado que está. */
export function createWetFilm(points: readonly { x: number; y: number }[], widthM: number, heightAt: (i: number) => number): THREE.Mesh {
  const n = points.length, pos = new Float32Array(n * 6), index: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[(i + n - 1) % n], b = points[(i + 1) % n], len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len, p = points[i], z = heightAt(i) + 0.035;
    pos.set([p.x + nx * widthM / 2, z, p.y + ny * widthM / 2, p.x - nx * widthM / 2, z, p.y - ny * widthM / 2], i * 6);
    const j = (i + 1) % n; index.push(i * 2, j * 2, i * 2 + 1, i * 2 + 1, j * 2, j * 2 + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(index);
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x05080c, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  mesh.visible = false; mesh.renderOrder = -5; mesh.name = 'pelicula-de-agua';
  return mesh;
}

/** Material de los puntos del ambiente: redondos, con su tamaño en metros y un tope en píxeles (de cerca no se hacen
 *  enormes). Los que suman luz (estela y chispas) se apagan hacia el borde; el público es opaco. */
function pointMaterial(sizeM: number, maxPx: number, additive: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { sizeM: { value: sizeM }, maxPx: { value: maxPx }, pxPerM: { value: 800 }, gain: { value: 1 } },
    vertexShader: `attribute vec3 color; uniform float sizeM; uniform float maxPx; uniform float pxPerM; varying vec3 vColor;
      void main() { vColor = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(sizeM * pxPerM / max(0.1, -mv.z), 1.5, maxPx); }`,
    fragmentShader: additive
      ? 'varying vec3 vColor; uniform float gain; void main() { float r = length(gl_PointCoord * 2.0 - 1.0); if (r > 1.0) discard; gl_FragColor = vec4(vColor * gain * (1.0 - r * r), 1.0); }'
      : 'varying vec3 vColor; uniform float gain; void main() { if (length(gl_PointCoord * 2.0 - 1.0) > 1.0) discard; gl_FragColor = vec4(vColor * gain, 1.0); }',
    transparent: additive, depthWrite: !additive, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

/** Píxeles por metro a un metro de la cámara (para el tamaño de los puntos) y brillo de la nube. */
export function setPointLook(points: THREE.Points, pxPerM: number, gain: number): void {
  const u = (points.material as THREE.ShaderMaterial).uniforms;
  u.pxPerM.value = pxPerM; u.gain.value = gain;
}

/** Nube de puntos para estelas: suma su color al fondo, así que apagar un punto es bajarle el color. */
export function createTrail(name: string, maxPoints: number, sizeM: number, maxPx: number): THREE.Points {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(maxPoints * 3), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(maxPoints * 3), 3));
  g.setDrawRange(0, 0);
  const points = new THREE.Points(g, pointMaterial(sizeM, maxPx, true));
  points.frustumCulled = false; points.visible = false; points.name = name;
  return points;
}

/** Escribe los puntos de una estela a partir del índice `from`; devuelve el índice siguiente. */
export function writeTrail(points: THREE.Points, from: number, trail: readonly TrailPoint[], color: { r: number; g: number; b: number }): number {
  const pos = points.geometry.getAttribute('position') as THREE.BufferAttribute, col = points.geometry.getAttribute('color') as THREE.BufferAttribute;
  let i = from;
  for (const p of trail) {
    if (i >= pos.count) break;
    pos.setXYZ(i, p.x, p.z, p.y); col.setXYZ(i, color.r * p.fade, color.g * p.fade, color.b * p.fade); i++;
  }
  return i;
}

export function finishTrail(points: THREE.Points, count: number): void {
  points.visible = count > 0;
  points.geometry.setDrawRange(0, count);
  if (count) { points.geometry.getAttribute('position').needsUpdate = true; points.geometry.getAttribute('color').needsUpdate = true; }
}

/** Público: un punto por persona, del color de su ropa. `baseAt` da la altura del suelo bajo cada asiento. */
export function createCrowd(seats: readonly Seat[], palette: readonly string[], baseAt: (x: number, y: number) => number): THREE.Points | null {
  if (!seats.length) return null;
  const pos = new Float32Array(seats.length * 3), col = new Float32Array(seats.length * 3), c = new THREE.Color();
  seats.forEach((s, i) => {
    pos.set([s.x, baseAt(s.x, s.y) + s.up, s.y], i * 3);
    c.set(palette[s.color % palette.length]); col.set([c.r, c.g, c.b], i * 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const points = new THREE.Points(g, pointMaterial(0.7, 9, false));
  points.name = 'publico';
  return points;
}
