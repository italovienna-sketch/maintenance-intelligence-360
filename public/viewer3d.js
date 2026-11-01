/**
 * Visualizador 3D do modelo conceitual bc-101.glb.
 * Three.js fica em /vendor para o 3D funcionar sem internet.
 * mountPumpViewer rejeita a promessa se não houver WebGL ou se o GLB falhar;
 * quem chama decide mostrar a imagem de reserva.
 */
import * as THREE from 'three';
import { OrbitControls } from '/vendor/three/controls/OrbitControls.js';
import { GLTFLoader } from '/vendor/three/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '/vendor/three/libs/meshopt_decoder.module.js';

const OUTER_NODES = new Set(['BC_CASING', 'BC_INSPECTION_COVER', 'BC_COVER_ASSEMBLY', 'BC_BEARING_HOUSING', 'BC_BEARING_COVER', 'BC_SEAL_HOUSING']);
const INTERNAL_NODES = new Set(['BC_IMPELLER', 'BC_WEAR_PLATE', 'BC_FLAP_VALVE', 'BC_MECH_SEAL_ROTATING', 'BC_BEARING_INBOARD', 'BC_BEARING_OUTBOARD', 'BC_SHAFT']);
const CAMERA_HOME = new THREE.Vector3(1.6, 1.05, 1.9);

const knownNode = (obj) => {
  for (let cur = obj; cur; cur = cur.parent) {
    if (cur.name?.startsWith('BC_')) return cur.name;
  }
  return null;
};

export async function mountPumpViewer(container, modelUrl, opts) {
  const size = () => ({ w: container.clientWidth || 640, h: container.clientHeight || 420 });
  const { w, h } = size();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(w, h);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.domElement.setAttribute('aria-label', 'Modelo 3D conceitual. Arraste para girar, use a roda para aproximar.');
  renderer.domElement.setAttribute('role', 'img');
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, w / h, 0.05, 100);
  camera.position.copy(CAMERA_HOME);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.dampingFactor = 0.07;
  controls.minDistance = 0.45;
  controls.maxDistance = 6;

  scene.add(new THREE.AmbientLight(0xdbeafe, 1.35));
  const lights = [[0xffffff, 2.4, [4, 6, 5]], [0xf97316, 1.15, [-4, 2, -4]], [0x38bdf8, 0.9, [0, -4, 3]]];
  for (const [color, power, pos] of lights) {
    const light = new THREE.DirectionalLight(color, power);
    light.position.set(...pos);
    scene.add(light);
  }

  await MeshoptDecoder.ready;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  let gltf;
  try {
    gltf = await loader.loadAsync(modelUrl);
  } catch (err) {
    renderer.dispose();
    renderer.domElement.remove();
    throw err;
  }

  const root = gltf.scene;
  const box = new THREE.Box3().setFromObject(root);
  const scale = 1.65 / (Math.max(...box.getSize(new THREE.Vector3()).toArray()) || 1);
  root.scale.setScalar(scale);
  root.position.sub(box.getCenter(new THREE.Vector3()).multiplyScalar(scale));
  scene.add(root);
  scene.updateMatrixWorld(true);

  const meshes = [];
  const anchors = new Map();
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.material = obj.material.clone();
    obj.material.metalness = 0.55;
    obj.material.roughness = 0.38;
    meshes.push(obj);
    const node = knownNode(obj);
    if (node) {
      const bounds = anchors.get(node) ?? new THREE.Box3();
      anchors.set(node, bounds.expandByObject(obj));
    }
  });

  let selected = null;
  let xray = false;
  function paint() {
    const ghostShell = xray || INTERNAL_NODES.has(selected);
    for (const mesh of meshes) {
      const node = knownNode(mesh);
      const isSelected = selected !== null && node === selected;
      const ghost = ghostShell && OUTER_NODES.has(node) && !isSelected;
      mesh.material.emissive?.setHex(isSelected ? 0xf97316 : 0x000000);
      mesh.material.emissiveIntensity = isSelected ? 0.35 : 0;
      mesh.material.transparent = ghost;
      mesh.material.opacity = ghost ? 0.2 : 1;
      mesh.material.depthWrite = !ghost;
    }
  }
  paint();

  // Pinos numerados são botões HTML acompanhando o centro de cada componente.
  const pins = [...container.parentElement.querySelectorAll('[data-pin-node]')];
  const point = new THREE.Vector3();
  function placePins() {
    const { w: width, h: height } = size();
    for (const pin of pins) {
      const bounds = anchors.get(pin.dataset.pinNode);
      if (!bounds) { pin.hidden = true; continue; }
      bounds.getCenter(point).project(camera);
      pin.style.left = `${((point.x + 1) / 2) * width}px`;
      pin.style.top = `${((1 - point.y) / 2) * height}px`;
    }
  }

  const raycaster = new THREE.Raycaster();
  let down = { x: 0, y: 0 };
  const onDown = (e) => { down = { x: e.clientX, y: e.clientY }; };
  const onUp = (e) => {
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(meshes, false).find((i) => i.object.material.opacity === 1);
    const node = hit && knownNode(hit.object);
    if (node) opts.onSelect(node);
  };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);

  let frame = 0;
  const tick = () => {
    frame = requestAnimationFrame(tick);
    controls.update();
    renderer.render(scene, camera);
    placePins();
  };
  tick();

  const observer = new ResizeObserver(() => {
    const next = size();
    camera.aspect = next.w / next.h;
    camera.updateProjectionMatrix();
    renderer.setSize(next.w, next.h);
  });
  observer.observe(container);

  return {
    highlight(node, xrayOn) { selected = node; xray = xrayOn; paint(); },
    resetCamera() {
      camera.position.copy(CAMERA_HOME);
      controls.target.set(0, 0, 0);
    },
    destroy() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
