// Portada de Eventos: presentación de producto en 3D (tubo cosmético azul con tapón crema).
// createProducto(canvas, {getP}) -> { render(p) }. Todo depende de p (0..1), así que el scroll avanza y retrocede.
import * as THREE from './vendor/three/three.module.min.js';
import { RoomEnvironment } from './vendor/three/jsm/environments/RoomEnvironment.js';

const cl = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;
const io = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const out = (x) => 1 - Math.pow(1 - x, 3);
const seg = (p, a, b) => cl((p - a) / (b - a));

const BLUE = 0x86aed0, CREAM = 0xEFE7D6, BG = 0xEAE4D9;
const R = 0.55, H = 4.1, AT = Math.PI * R / 2 * 1.04, CRIMP = 0.34;

// impresión de la marca sobre el tubo (logo y texto en blanco)
function printTex() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1024; const g = c.getContext('2d');
  g.fillStyle = '#7ea8cf'; g.fillRect(0, 0, 2048, 1024);
  // ligera variación de tono para que no parezca plástico plano
  const gr = g.createLinearGradient(0, 0, 0, 1024); gr.addColorStop(0, 'rgba(255,255,255,.05)'); gr.addColorStop(1, 'rgba(0,0,0,.05)'); g.fillStyle = gr; g.fillRect(0, 0, 2048, 1024);
  // la cara frontal está en u=0.25 (x=512)
  g.save(); g.translate(1024, 0); g.scale(-1, 1);
  g.fillStyle = '#ffffff'; g.translate(512, 0); g.scale(2.3, 1); g.translate(-512, 0);
  // logo
  g.save(); g.translate(512 - 60, 330); g.scale(.11, .11); g.translate(-440, -260);
  g.fill(new Path2D('M462 283H935V1467A353 353 0 0 0 1027 1703H935A473 473 0 0 1 462 1230Z'));
  g.beginPath(); g.arc(1288, 1467, 237, 0, Math.PI * 2); g.fill(); g.restore();
  g.font = '800 64px Poppins, sans-serif'; g.textAlign = 'center'; g.fillText('Launch', 512, 580);
  g.font = '400 12px "DM Mono", monospace'; g.fillText('H Y D R A   C R E A M   ·   7 5  m l', 512, 630);
  g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function ridgeTex(n = 90) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 8; const g = c.getContext('2d');
  for (let i = 0; i < 1024; i++) { const v = 128 + 110 * Math.sin(i / 1024 * n * Math.PI * 2); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(i, 0, 1, 8); }
  const t = new THREE.CanvasTexture(c); return t;
}
function blobTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128); r.addColorStop(0, 'rgba(60,40,20,.55)'); r.addColorStop(.5, 'rgba(60,40,20,.18)'); r.addColorStop(1, 'rgba(60,40,20,0)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
}

// cuerpo: sección circular abajo (y=0) que se aplana hasta una línea arriba (y=H)
function bodyGeo() {
  const N = 140, M = 128, pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, y = t * H;
    const f = Math.pow(t, 1.25);
    const b = R * (1 - f) + 0.028 * f;
    const a = R + (AT - R) * (1 - b / R);
    // pequeño hombro redondeado al llegar al tapón
    const sh = t < .03 ? Math.sqrt(1 - Math.pow(1 - t / .03, 2)) * .06 + .94 : 1;
    for (let j = 0; j <= M; j++) {
      const th = j / M * Math.PI * 2;
      pos.push(Math.cos(th) * a * sh, y, Math.sin(th) * b * sh); uv.push(j / M, t);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = i * (M + 1) + j, b = a + M + 1; idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry(); g.setIndex(idx);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals(); return g;
}
// tapón: perfil con bordes redondeados (de pie sobre él)
function capGeo() {
  const pts = [], h = 0.62, rb = 0.535, rt = 0.575, f = 0.05;
  pts.push(new THREE.Vector2(0, 0));
  for (let k = 0; k <= 8; k++) { const a = -Math.PI / 2 + k / 8 * Math.PI / 2; pts.push(new THREE.Vector2(rb - f + Math.cos(a) * f, f + Math.sin(a) * f)); }
  for (let k = 0; k <= 8; k++) { const a = k / 8 * Math.PI / 2; pts.push(new THREE.Vector2(rt - f + Math.cos(a) * f, h - f + Math.sin(a) * f)); }
  pts.push(new THREE.Vector2(0.5, h)); pts.push(new THREE.Vector2(0.49, 0.07)); pts.push(new THREE.Vector2(0, 0.07));
  return new THREE.LatheGeometry(pts, 96);
}

export function createProducto(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene(); scene.background = new THREE.Color(BG); scene.fog = new THREE.Fog(BG, 11, 26);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.8;
  const cam = new THREE.PerspectiveCamera(30, 1, .1, 100);

  // suelo y fondo curvo (ciclorama) del mismo color
  const floorM = new THREE.MeshStandardMaterial({ color: BG, roughness: .92 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), floorM); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const cyc = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 20, 64, 1, true, Math.PI * .5, Math.PI), new THREE.MeshStandardMaterial({ color: BG, roughness: 1, side: THREE.BackSide }));
  cyc.position.set(0, 10, 0); scene.add(cyc);

  // luces
  const hemi = new THREE.HemisphereLight(0xfff8ee, 0xd9cdb8, .55); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff4e6, 2.2); key.position.set(-5, 9, 6); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -6; key.shadow.camera.right = 6; key.shadow.camera.top = 7; key.shadow.camera.bottom = -4;
  key.shadow.radius = 9; key.shadow.blurSamples = 20; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfeaff, 1.1); rim.position.set(6, 5, -6); scene.add(rim);
  const spot = new THREE.SpotLight(0xffd9a8, 0, 22, Math.PI / 9, .55, 1.2); spot.position.set(0.5, 11, 2.5); spot.target.position.set(0.4, 0, 0);
  spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.radius = 6; scene.add(spot, spot.target);

  // materiales
  const bodyM = new THREE.MeshPhysicalMaterial({ map: printTex(), roughness: .32, clearcoat: 1, clearcoatRoughness: .12, sheen: .2, sheenColor: new THREE.Color(0xffffff) });
  const plainM = new THREE.MeshPhysicalMaterial({ color: 0x7ea8cf, roughness: .32, clearcoat: 1, clearcoatRoughness: .12 });
  const rt = ridgeTex(); rt.wrapS = THREE.RepeatWrapping;
  const crimpM = new THREE.MeshPhysicalMaterial({ color: 0x6f9bc4, roughness: .45, clearcoat: .6, bumpMap: rt, bumpScale: 3 });
  const capM = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, color: CREAM, roughness: .18, clearcoat: 1, clearcoatRoughness: .06 });
  const blobM = new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false });

  document.fonts && document.fonts.ready.then(() => { bodyM.map = printTex(); bodyM.needsUpdate = true; });
  const BG_ = bodyGeo(), CG = capGeo();
  // un tubo completo; el origen está en la base del tapón
  function tube(printed, withCap = true) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(BG_, printed ? bodyM : plainM); body.position.y = 0.6; body.castShadow = true; body.receiveShadow = true; g.add(body);
    const crimp = new THREE.Mesh(new THREE.BoxGeometry(AT * 2, CRIMP, 0.055), crimpM); crimp.position.y = 0.6 + H + CRIMP / 2 - 0.01; crimp.castShadow = true; g.add(crimp);
    // boquilla (solo se ve sin tapón)
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(.17, .2, .32, 40), plainM); neck.position.y = 0.42; g.add(neck);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .08, 64), plainM); sh.position.y = .6; g.add(sh);
    let cap = null;
    if (withCap) { cap = new THREE.Mesh(CG, capM); cap.castShadow = true; cap.receiveShadow = true; g.add(cap); }
    return { g, cap };
  }
  const A = tube(true); scene.add(A.g);
  const B = tube(false, false); scene.add(B.g);
  const looseCap = new THREE.Mesh(CG, capM); looseCap.castShadow = true; scene.add(looseCap);

  // sombras de contacto suaves
  const blob = (s) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), blobM); m.rotation.x = -Math.PI / 2; m.position.y = .002; scene.add(m); return m; };
  const blobA = blob(2.4), blobB = blob(1), blobC = blob(1.6);

  // posiciones finales
  const AX = -0.5, AZ = 0.2;          // tubo de pie
  const BX = 0.5, BZ = -1.2, BRY = 0.85; // tubo tumbado, detrás a la derecha
  const CX = 1.75, CZ = 1.15;            // tapón suelto
  const bBlob = new THREE.Group(); bBlob.rotation.y = BRY; scene.add(bBlob); scene.remove(blobB); bBlob.add(blobB); blobB.position.set(2.7, 0, 0); blobB.scale.set(5.4, 1.5, 1);

  let W = 1, Hh = 1;
  function size() {
    const r = canvas.getBoundingClientRect(); W = Math.max(1, r.width); Hh = Math.max(1, r.height);
    renderer.setSize(W, Hh, false); cam.aspect = W / Hh; cam.updateProjectionMatrix();
  }
  size();

  function render(p) {
    // 1 · cae el tubo y rebota (0 → .32)
    const f = seg(p, 0, .24), fall = f * f; // aceleración
    let y = lerp(7.5, 0, fall), sq = 1;
    const bnc = seg(p, .24, .34);
    if (f >= 1) { y = Math.sin(bnc * Math.PI) * .32 * (1 - bnc); sq = 1 - Math.sin(Math.min(1, bnc * 3) * Math.PI) * .05; }
    A.g.position.set(AX, y, AZ);
    A.g.rotation.set(lerp(.35, 0, out(f)), lerp(-1.4, -0.12, out(seg(p, 0, .3))), lerp(-.25, 0, out(f)));
    A.g.scale.set(2 - sq, sq, 2 - sq);
    blobA.position.set(AX, .002, AZ); const near = 1 - cl(y / 7.5); blobA.material.opacity = 1; blobA.scale.setScalar(lerp(1.7, 1, near));

    // 2 · el tubo tumbado se desliza a su sitio y el tapón rueda (.3 → .62)
    const s = out(seg(p, .3, .55));
    const qB = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, BRY, 0))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.115))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2));
    B.g.quaternion.copy(qB);
    B.g.position.set(lerp(BX + 9, BX, s), R + .02, lerp(BZ - 2, BZ, s));
    bBlob.position.set(B.g.position.x, .003, B.g.position.z);
    const rc = out(seg(p, .4, .66)), cx = lerp(CX + 8, CX, rc);
    looseCap.rotation.set(-Math.PI / 2, 0, 0);
    looseCap.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), -(cx - CX) / .56 * -1);
    looseCap.position.set(cx, .555, CZ + .31);
    blobC.position.set(cx, .002, CZ); blobC.scale.set(.9, 1.2, 1);
    // 3 · cámara: plano frontal → órbita → plano héroe
    const o = io(seg(p, .26, .78));
    const ang = lerp(-0.05, 0.55, o), dist = lerp(17, 14.6, o) - io(seg(p, .78, 1)) * .8;
    const ty = lerp(2.7, 2.3, o);
    cam.position.set(Math.sin(ang) * dist + 0.3, lerp(3.2, 4.4, o) + seg(p, .78, 1) * .3, Math.cos(ang) * dist);
    const lx = cam.aspect > 1.2 ? -1.1 : 0.1; cam.lookAt(lx, ty, -0.05);
    // encuadre: en pantallas estrechas nos alejamos
    if (cam.aspect < 1) { cam.fov = 30 / Math.max(.55, cam.aspect) * .62; } else cam.fov = 30;
    cam.updateProjectionMatrix();

    // 4 · se enciende el foco cálido (.62 → .9)
    const l = io(seg(p, .62, .9));
    spot.intensity = l * 110; key.intensity = lerp(2.0, 1.1, l); hemi.intensity = lerp(.5, .28, l); scene.environmentIntensity = lerp(.7, .45, l);
    const bg = new THREE.Color(BG).lerp(new THREE.Color(0xC9BFAE), l * .55);
    scene.background.copy(bg); scene.fog.color.copy(bg); floorM.color.copy(new THREE.Color(BG).lerp(new THREE.Color(0xD6CCBA), l * .5)); cyc.material.color.copy(floorM.color);
    renderer.render(scene, cam);
  }
  return { render, size };
}
