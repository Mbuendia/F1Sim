// [VS6] La escena: carga el coche despiezado y lo coloca según el scroll (js/explode.js). Solo dibuja cuando algo
// cambia: al bajar, al subir o al cambiar el tamaño de la ventana.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { carState, DRS } from './explode.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage = document.querySelector('.escena');
const canvas = document.querySelector('[data-lienzo]');
const note = document.querySelector('[data-carga]');

// La dirección del juego vive en un solo sitio (../js/config.js, la misma que usa la otra landing).
const playUrl = window.F1RM_CONFIG && window.F1RM_CONFIG.PLAY_URL;
if (playUrl) document.querySelectorAll('[data-jugar]').forEach(a => { a.href = playUrl; });

// La sección que ocupa el centro de la pantalla enciende su tarjeta (y el rótulo del DRS en la suya).
const steps = [...document.querySelectorAll('[data-paso]')];
function markActive() {
  const mid = window.innerHeight / 2;
  for (const s of steps) {
    const r = s.getBoundingClientRect();
    s.classList.toggle('activa', r.top <= mid && r.bottom > mid);
  }
}
window.addEventListener('scroll', markActive, { passive: true });
window.addEventListener('resize', markActive);
markActive();

function fail(message) {
  note.textContent = message;
}

function groundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0,0,0,0.75)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function start() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    fail('Tu navegador no puede enseñar el coche en 3D; el texto se lee igual.');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.75;
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 7, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff3b2f, 0.9);
  rim.position.set(-6, 2.5, -4);
  scene.add(rim);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.2), new THREE.MeshBasicMaterial({ map: groundTexture(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.002;
  scene.add(shadow);

  // Suelo de estudio: una rejilla fina que se pierde en la oscuridad, con la línea central en rojo.
  const grid = new THREE.GridHelper(40, 80, 0x7a1410, 0x2a2a2e);
  for (const m of [].concat(grid.material)) { m.transparent = true; m.opacity = 0.32; m.depthWrite = false; }
  grid.position.y = 0.001;
  scene.add(grid);
  scene.fog = new THREE.Fog(0x050505, 13, 26);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const look = new THREE.Vector3();
  const pieces = new Map();
  let car = null;

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // En vertical el coche no cabe con el mismo ángulo: más campo de visión.
    camera.fov = camera.aspect < 0.8 ? 46 : camera.aspect < 1.2 ? 38 : 30;
    camera.updateProjectionMatrix();
    dirty = true;
  }

  function apply(state) {
    for (const [name, node] of pieces) {
      const s = state.pieces[name];
      node.position.copy(node.userData.rest);
      if (!s) continue;
      node.position.x += s.offset[0];
      node.position.y += s.offset[1];
      node.position.z += s.offset[2];
      if (name === DRS.name) node.rotation.z = node.userData.restRot + s.rot;
    }
    const portrait = camera.aspect < 0.8;
    const [px, py, pz] = state.camera.pos, [lx, ly, lz] = state.camera.look;
    const k = portrait ? 1.4 : 1;
    // En vertical, al final el coche entero no cabe centrado: el encuadre se corre hacia el morro.
    const shift = portrait ? 0.55 * Math.min(1, Math.max(0, (state.p - 0.9) / 0.1)) : 0;
    look.set(lx + shift, ly, lz);
    camera.position.set(lx + shift + (px - lx) * k, ly + (py - ly) * k, lz + (pz - lz) * k);
    camera.lookAt(look);
  }

  // El scroll da el objetivo; lo que se dibuja lo sigue con suavidad (sin animar nada que no pida el scroll).
  const target = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  };
  let shown = target(), dirty = true, last = performance.now();

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (car && !reduceMotion) {
      const goal = target();
      const diff = goal - shown;
      if (Math.abs(diff) > 0.00005) {
        shown += diff * Math.min(1, dt * 7);
        apply(carState(shown));
        dirty = true;
      }
    }
    if (dirty) {
      renderer.render(scene, camera);
      dirty = false;
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', () => {
    resize();
    if (car) apply(reduceMotion ? carState(1) : carState(shown));
  });
  resize();

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load('f1-despiece.glb', gltf => {
    car = gltf.scene;
    car.traverse(o => {
      if (o.isMesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          m.side = THREE.DoubleSide;            // el suelo y parte de la carrocería son una sola lámina
          if (m.metalness < 0.5) m.envMapIntensity = 0.9;
        }
      }
    });
    for (const node of car.children) {
      node.userData.rest = node.position.clone();
      node.userData.restRot = node.rotation.z;
      pieces.set(node.name, node);
    }
    scene.add(car);
    // Con «reducir movimiento» el coche se ve ya despiezado y quieto.
    apply(reduceMotion ? carState(1) : carState(shown));
    stage.classList.add('lista');
    dirty = true;
  }, undefined, () => fail('No se ha podido cargar el coche; el texto se lee igual.'));

  requestAnimationFrame(frame);
}

start();
