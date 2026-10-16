// 3D chrome "127" for the homepage hero. Loads after first paint; the page works without it.
import * as THREE from 'three';
import { SVGLoader } from './vendor/SVGLoader.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const MARK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 290.8 145.2"><path transform="translate(-7.6 145.2)" d="M68.80 0L38.40 0L38.40-93.40L7.60-93.40L7.60-115.60L19.80-115.60Q33-115.60 38.80-121.30Q44.60-127 44.60-142L68.80-142L68.80 0M195 0L87.40 0Q87.40-18.20 92.30-31.60Q97.20-45 108.30-55.50Q119.40-66 137.80-75.80Q147.60-80.80 153.30-84.70Q159-88.60 161.40-92.60Q163.80-96.60 163.80-102Q163.80-109.80 158.70-114.70Q153.60-119.60 143.80-119.60Q132.80-119.60 126.50-113.20Q120.20-106.80 118.80-95L87.60-96.80Q89.60-119.40 104.10-132.30Q118.60-145.20 143.40-145.20Q168-145.20 181.50-133.40Q195-121.60 195-102.40Q195-91.20 191.30-83.60Q187.60-76 179.40-69.60Q171.20-63.20 157.80-56Q140.60-46.80 132.40-39.10Q124.20-31.40 123.60-25.60L195-25.60L195 0M253.20 0L222.40 0Q222.40-33 234.80-62.70Q247.20-92.40 267.60-116.40L193.60-116.40L193.60-142L298.40-142L298.40-118.20Q283.60-101.40 273.50-83.70Q263.40-66 258.30-45.60Q253.20-25.20 253.20 0"/></svg>';

const canvas = document.getElementById('hero3d');
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

function start() {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 0, 11);

  const shapes = new SVGLoader().parse(MARK).paths.flatMap((p) => SVGLoader.createShapes(p));
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: 30, bevelEnabled: true, bevelThickness: 5, bevelSize: 2.6, bevelSegments: 8, curveSegments: 28 });
  geo.center();
  geo.scale(0.022, -0.022, 0.022);
  geo.computeVertexNormals();
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xeef0f6, metalness: 1, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.8 });
  const mark = new THREE.Mesh(geo, mat);
  const group = new THREE.Group();
  group.add(mark);
  scene.add(group);

  const key = new THREE.DirectionalLight(0xffffff, 3); key.position.set(4, 5, 6); scene.add(key);
  const front = new THREE.DirectionalLight(0xffffff, 1.6); front.position.set(-2, 1, 8); scene.add(front);
  const rim = new THREE.DirectionalLight(0xb8bfff, 4); rim.position.set(-6, -2, -4); scene.add(rim);
  const warm = new THREE.PointLight(0xd8b46e, 30, 30); warm.position.set(5, -3, 3); scene.add(warm);

  function size() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the mark the same visual width on narrow canvases
    camera.position.z = w / h < 1 ? 11 / (w / h) * 0.8 : 11;
    camera.updateProjectionMatrix();
  }
  size();
  addEventListener('resize', size);

  let tx = 0, ty = 0;
  addEventListener('pointermove', (e) => { tx = (e.clientX / innerWidth - 0.5); ty = (e.clientY / innerHeight - 0.5); }, { passive: true });

  let visible = true, t0 = performance.now();
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) loop(); }).observe(canvas);
  canvas.classList.add('on');

  function frame(now) {
    const t = (now - t0) / 1000;
    group.rotation.y += ((tx * 0.9 + Math.sin(t * 0.5) * 0.35) - group.rotation.y) * 0.05;
    group.rotation.x += ((ty * 0.5 + Math.sin(t * 0.37) * 0.08) - group.rotation.x) * 0.05;
    group.position.y = Math.sin(t * 0.8) * 0.08;
    renderer.render(scene, camera);
  }
  let raf = 0;
  function loop() { cancelAnimationFrame(raf); const tick = (now) => { if (!visible) return; frame(now); raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); }
  if (still) { group.rotation.set(0.12, -0.35, 0); renderer.render(scene, camera); } else loop();
}

if (canvas) (window.requestIdleCallback || ((f) => setTimeout(f, 200)))(start);
