// Stand de Launch Studio en 3D (Three.js): plano → líneas → volúmenes → materiales → montaje del techo → luz.
// Inspirado en el render del stand de Launch: estructura negra, madera, mostrador de piedra y olivos.
// createStand(contenedor) devuelve { set(p, cam, ocultarNotas) → true cuando el pabellón está a oscuras, resize() }.
import * as THREE from './vendor/three/three.module.min.js';
import { RoomEnvironment } from './vendor/three/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from './vendor/three/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from './vendor/three/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/three/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from './vendor/three/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from './vendor/three/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/three/jsm/postprocessing/OutputPass.js';

const cl = x => Math.max(0, Math.min(1, x));
const ez = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const lerp = (a, b, t) => a + (b - a) * t;
const INK = 0x0b0b0b, CREAM = new THREE.Color(0xF4F3EE), NIGHT = new THREE.Color(0x141312);
function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

/* ── Texturas dibujadas ── */
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function woodTex(base, seed, plank = 64) {
  return canvasTex(1024, 1024, (g, w, h) => {
    const r = rnd(seed);
    for (let y = 0; y < h; y += plank) {
      let x = -Math.floor(r() * 500);
      while (x < w) {
        const len = 300 + r() * 420, t = r() * .16 - .08;
        g.fillStyle = `rgb(${base.map(v => Math.round(v * (1 + t))).join(',')})`; g.fillRect(x, y, len, plank);
        for (let i = 0; i < 34; i++) {
          g.strokeStyle = `rgba(90,55,25,${.03 + r() * .07})`; g.lineWidth = .5 + r() * 1.6;
          const yy = y + r() * plank, ph = r() * 6; g.beginPath(); g.moveTo(x, yy);
          for (let xx = x; xx < x + len; xx += 24) g.lineTo(xx, yy + Math.sin(xx * .012 + ph) * 2.4);
          g.stroke();
        }
        g.fillStyle = 'rgba(50,30,10,.28)'; g.fillRect(x, y, 2, plank); x += len;
      }
      g.fillStyle = 'rgba(50,30,10,.25)'; g.fillRect(0, y, w, 1.5);
    }
  });
}
function noiseTex(base, amp, seed, veins = 0) {
  return canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h); const r = rnd(seed);
    for (let i = 0; i < 26000; i++) { const v = r() > .5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${r() * amp})`; g.fillRect(r() * w, r() * h, 1 + r() * 2.5, 1 + r() * 2.5); }
    for (let k = 0; k < veins; k++) { g.strokeStyle = `rgba(140,120,95,${.08 + r() * .1})`; g.lineWidth = .6 + r() * 1.5; g.beginPath(); let x = r() * w, y = 0; g.moveTo(x, y); while (y < h) { x += (r() - .5) * 40; y += 20 + r() * 30; g.lineTo(x, y); } g.stroke(); }
  });
}
const LOGO = 'M462 283H935V1467A353 353 0 0 0 1027 1703H935A473 473 0 0 1 462 1230Z';
function drawLogo(g, x, y, hgt, fill, dot = '#D93333') {
  const s = hgt / 1470; g.save(); g.translate(x, y); g.scale(s, s); g.translate(-440, -260);
  g.fillStyle = fill; g.fill(new Path2D(LOGO)); g.fillStyle = dot; g.beginPath(); g.arc(1288, 1467, 237, 0, 7); g.fill(); g.restore();
}
function spaced(g, txt, x, y, sp) { if ('letterSpacing' in g) { g.letterSpacing = sp + 'px'; g.fillText(txt, x, y); g.letterSpacing = '0px'; return; } let cx = x; for (const ch of txt) { g.fillText(ch, cx, y); cx += g.measureText(ch).width + sp; } }
function wallGfxTex() { // logotipo de la pared negra
  return canvasTex(1024, 1024, (g) => {
    drawLogo(g, 150, 150, 170, '#EDE6D8');
    g.fillStyle = '#EDE6D8'; g.textBaseline = 'alphabetic';
    g.font = '400 82px Poppins, sans-serif'; spaced(g, 'LAUNCH', 150, 470, 30); spaced(g, 'STUDIO', 150, 580, 30);
    g.fillRect(152, 650, 60, 4);
    g.font = '400 40px Poppins, sans-serif'; ['EVENTS', 'EXHIBITIONS', 'BRAND EXPERIENCES'].forEach((t, i) => spaced(g, t, 150, 740 + i * 62, 8));
  });
}
function counterGfxTex() {
  return canvasTex(1024, 256, (g) => { drawLogo(g, 250, 92, 78, '#1d1b19'); g.fillStyle = '#1d1b19'; g.font = '400 54px Poppins, sans-serif'; g.textBaseline = 'middle'; spaced(g, 'LAUNCH STUDIO', 330, 132, 16); });
}
function columnGfxTex() {
  return canvasTex(256, 1536, (g) => {
    g.save(); g.translate(150, 1080); g.rotate(-Math.PI / 2); g.fillStyle = '#EDE6D8'; g.font = '400 74px Poppins, sans-serif'; g.textBaseline = 'middle'; spaced(g, 'LAUNCH STUDIO', 0, 0, 22); g.restore();
    drawLogo(g, 92, 1180, 96, '#EDE6D8');
  });
}
function leafTex() {
  return canvasTex(128, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#93a37a'); gr.addColorStop(.5, '#5f7246'); gr.addColorStop(1, '#3d4b2c');
    g.fillStyle = gr; g.beginPath(); g.moveTo(2, h / 2); g.quadraticCurveTo(w * .45, -h * .05, w - 2, h / 2); g.quadraticCurveTo(w * .45, h * 1.05, 2, h / 2); g.fill();
    g.strokeStyle = 'rgba(220,230,190,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(4, h / 2); g.lineTo(w - 6, h / 2); g.stroke();
  });
}

export async function createStand(root, imgBase = '../assets/img/') {
  try { await Promise.all([document.fonts.load('400 80px Poppins'), document.fonts.load('800 80px Poppins')]); } catch (e) { }
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  root.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = CREAM.clone(); scene.fog = new THREE.Fog(CREAM.clone(), 24, 62);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(renderer), .03).texture;
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 200);
  const loader = new THREE.TextureLoader(); let redraw = () => { };

  /* ── Posproceso: oclusión ambiental, brillo de los LED y antialias ── */
  const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 2, 2); gtao.output = GTAOPass.OUTPUT.Default; gtao.blendIntensity = 1;
  gtao.updateGtaoMaterial({ radius: .5, distanceExponent: 1.6, thickness: 1.2, scale: 1.2, samples: 16 }); gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  composer.addPass(gtao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), .3, .4, .95); composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ── Luces ── */
  const hemi = new THREE.HemisphereLight(0xffffff, 0xcfc8b8, .9); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e6, 3.4); sun.position.set(-7, 15, 13); sun.target.position.set(5, 0, 3.5);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 45 }); sun.shadow.bias = -.0003; sun.shadow.normalBias = .02; sun.shadow.radius = 5;
  scene.add(sun, sun.target);
  const warm = [];
  const addSpot = (x, z, tx, tz, shadow) => { const s = new THREE.SpotLight(0xffd29a, 0, 9, .45, .8, 1.6); s.position.set(x, 3.0, z); s.target.position.set(tx, 0, tz); s.castShadow = shadow; if (shadow) { s.shadow.mapSize.set(1024, 1024); s.shadow.bias = -.0005; } scene.add(s, s.target); warm.push([s, 18]); };
  addSpot(4.6, .9, 4.9, .3, true); addSpot(6.6, .9, 6.3, .3, false); addSpot(2.4, 4.2, 2.5, 5.3, true); addSpot(7.0, 3.6, 7.2, 4.2, false); addSpot(1.4, 1.0, 1.2, .2, false);
  const addPoint = (x, y, z, i, d) => { const l = new THREE.PointLight(0xffcf94, 0, d, 2); l.position.set(x, y, z); scene.add(l); warm.push([l, i]); return l; };
  [[2, 6.4], [5, 6.4], [8, 6.4], [9.4, 3], [.6, 3]].forEach(([x, z]) => addPoint(x, 2.85, z, 1.4, 4));

  /* ── Materiales (aparecen fundiéndose) ── */
  const mats = [];
  const M = (o, env = .5) => { const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: .8, metalness: 0, transparent: true, opacity: 0 }, o)); m.userData.env = env; m.envMapIntensity = env; mats.push(m); return m; };
  const tile = (t, x, y) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(x, y); return t; };
  const mBlack = M({ color: 0x1f1e1c, roughness: .55 }, .35);
  const mBlackRough = M({ color: 0x252422, roughness: .85 }, .3);
  const mWallWood = M({ map: tile(woodTex([196, 152, 102], 5, 1024), 1, 1), roughness: .6 });
  const mSlat = M({ map: tile(woodTex([206, 164, 112], 9, 1024), .3, 1), roughness: .55 });
  const mFloor = M({ map: tile(woodTex([226, 205, 172], 7, 60), 2.4, 1.7), roughness: .5 }, .6);
  const mStone = M({ map: tile(noiseTex('#d9cfbe', .05, 3, 6), 1, 1), roughness: .6 }, .55);
  const mStoneTop = M({ map: tile(noiseTex('#e3dacb', .04, 4, 4), 1, 1), roughness: .35 }, .7);
  const mFabric = M({ map: tile(noiseTex('#dcd3c4', .07, 8), 2, 2), roughness: .95 }, .4);
  const mTable = M({ color: 0xcdbfa8, roughness: .45 }, .6);
  const mMetal = M({ color: 0x1a1a1a, roughness: .3, metalness: .85 }, .8);
  const mPot = M({ color: 0x1c1b1a, roughness: .7 }, .3);
  const mTrunk = M({ color: 0x6b5a45, roughness: .9 }, .3);
  const mScreenFrame = M({ color: 0x0f0f0f, roughness: .25, metalness: .3 }, .9);
  const mGlass = M({ color: 0xf0e7d6, roughness: .2, emissive: 0xffd9a0, emissiveIntensity: 0 }, .6);
  const mLaptop = M({ color: 0xb9b9bb, roughness: .3, metalness: .8 }, .8);

  /* ── Estructura de la escena ── */
  const P = .12; // altura de la tarima
  const stand = new THREE.Group(); stand.position.y = P; scene.add(stand);   // crece en altura
  const gfxG = new THREE.Group(); scene.add(gfxG);                             // gráficas
  const edgeMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0 });
  const FP = [];   // huella en planta: ['r', x0, z0, x1, z1] o ['c', x, z, r]
  function mesh(geo, mat, x, y, z, o = {}) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.ry) m.rotation.y = o.ry; if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz;
    m.castShadow = o.cast !== false; m.receiveShadow = true;
    if (o.edges !== false) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), edgeMat); e.userData.edge = 1; m.add(e); }
    (o.parent || stand).add(m); return m;
  }
  const box = (w, h, d, mat, x, y0, z, o = {}) => { if (o.fp !== false) FP.push(['r', x - w / 2, z - d / 2, x + w / 2, z + d / 2]); return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y0 + h / 2, z, o); };
  const rbox = (w, h, d, r, mat, x, y0, z, o = {}) => mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat, x, y0 + h / 2, z, o);
  const cyl = (rt, rb, h, mat, x, y0, z, o = {}) => { if (o.fp) FP.push(['c', x, z, Math.max(rt, rb)]); return mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg || 40, 1, !!o.open, o.ts || 0, o.tl || Math.PI * 2), mat, x, y0 + h / 2, z, o); };

  // suelo del pabellón y cuadrícula
  const hallMat = new THREE.MeshStandardMaterial({ map: tile(noiseTex('#cfccc5', .06, 2), 26, 26), roughness: .42, color: 0xffffff }); hallMat.userData.env = .9;
  const hall = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), hallMat); hall.rotation.x = -Math.PI / 2; hall.receiveShadow = true; scene.add(hall);
  const grid = new THREE.GridHelper(44, 88, 0xb3b0a6, 0xd0cdc4); grid.position.set(5, .003, 3.5); grid.material.transparent = true; scene.add(grid);
  // focos lejanos del techo del pabellón (solo de noche)
  const hallLights = new THREE.Group(); scene.add(hallLights);
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xfff3dc, transparent: true, opacity: 0, fog: false });
  for (let i = -6; i <= 8; i++) for (let j = -6; j <= 4; j++) { const d = new THREE.Mesh(new THREE.CircleGeometry(.09, 16), hlMat); d.rotation.x = Math.PI / 2; d.position.set(5 + i * 3.2, 10.5, 3.5 + j * 3.2); hallLights.add(d); }

  // tarima
  const plat = new THREE.Mesh(new THREE.BoxGeometry(10.2, P, 7.2), [mBlack, mBlack, mFloor, mBlack, mBlack, mBlack]); plat.position.set(5, -P / 2, 3.5); plat.receiveShadow = true; plat.castShadow = true;
  plat.add(Object.assign(new THREE.LineSegments(new THREE.EdgesGeometry(plat.geometry), edgeMat), { userData: { edge: 1 } })); stand.add(plat);

  const H = 3.0;
  // paredes
  box(3.6, H, .14, mBlack, 1.8, 0, .07);
  box(4.0, H, .14, mWallWood, 5.6, 0, .07);
  box(2.4, H, .14, mBlack, 8.8, 0, .07);
  box(.14, H, 4.6, mBlack, .07, 0, .14 + 2.3);
  // lamas de madera delante de la pared central
  const slatGeo = new THREE.BoxGeometry(.045, H - .02, .06), slats = new THREE.InstancedMesh(slatGeo, mSlat, 36), dm = new THREE.Object3D();
  for (let i = 0; i < 36; i++) { dm.position.set(3.65 + i * .11, H / 2, .17); dm.updateMatrix(); slats.setMatrixAt(i, dm.matrix); }
  slats.castShadow = slats.receiveShadow = true; stand.add(slats);
  // pantalla
  box(2.3, 1.32, .07, mScreenFrame, 5.6, 1.12, .24, { fp: false });
  // columnas
  [[.22, 6.78], [9.78, 6.78], [9.78, .22]].forEach(([x, z]) => box(.42, H + .45, .42, mBlack, x, 0, z));
  // celosía de madera lateral (derecha)
  const finGeo = new THREE.BoxGeometry(.06, H - .05, .22), fins = new THREE.InstancedMesh(finGeo, mSlat, 22);
  for (let i = 0; i < 22; i++) { dm.position.set(9.55, (H - .05) / 2, 1.0 + i * .16); dm.updateMatrix(); fins.setMatrixAt(i, dm.matrix); }
  fins.castShadow = fins.receiveShadow = true; stand.add(fins); FP.push(['r', 9.52, .92, 9.58, 4.52]);
  // mostrador de piedra
  box(3.1, .98, .72, mStone, 2.5, .04, 5.35);
  box(3.22, .05, .8, mStoneTop, 2.5, 1.02, 5.33, { fp: false });
  box(3.0, .04, .62, mBlack, 2.5, 0, 5.38, { fp: false, cast: false });
  rbox(.36, .012, .25, .005, mLaptop, 2.9, 1.07, 5.2, { edges: false });
  mesh(new THREE.BoxGeometry(.36, .23, .008), mLaptop, 2.9, 1.19, 5.08, { rx: -.25, edges: false });
  cyl(.06, .05, .22, mGlass, 1.6, 1.07, 5.2, { seg: 24 });
  // zona de reuniones: mesas redondas con sillas
  const chair = (x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; stand.add(g); FP.push(['c', x, z, .27]);
    rbox(.5, .1, .48, .04, mFabric, 0, .42, 0, { parent: g });
    mesh(new THREE.CylinderGeometry(.27, .26, .4, 28, 1, true, Math.PI * .7, Math.PI * .6), mFabric, 0, .7, 0, { parent: g }).material.side = THREE.DoubleSide;
    [[-.2, -.18], [.2, -.18], [-.2, .18], [.2, .18]].forEach(([a, b]) => mesh(new THREE.CylinderGeometry(.012, .01, .43, 8), mMetal, a, .21, b, { parent: g, edges: false, rz: a * .25, rx: -b * .25 }));
  };
  const lamps = [];
  [[5.3, 3.4], [7.5, 2.5], [7.2, 4.9]].forEach(([x, z]) => {
    cyl(.42, .42, .035, mTable, x, .73, z, { fp: true });
    cyl(.05, .07, .71, mTable, x, .02, z, { edges: false });
    cyl(.24, .26, .03, mTable, x, 0, z, { edges: false });
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + .5; chair(x + Math.sin(a) * .72, z + Math.cos(a) * .72, a + Math.PI); }
    cyl(.012, .012, .22, mMetal, x, .765, z, { edges: false }); const sh = cyl(.1, .1, .07, mGlass, x, .97, z, { seg: 24 });
    lamps.push(addPoint(x, 1.1, z, .35, 1.8));
  });
  // olivos en jardinera negra
  const leafMap = leafTex(), leafMat = M({ map: leafMap, alphaTest: .45, side: THREE.DoubleSide, roughness: .7 }, .4);
  const leafDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: leafMap, alphaTest: .45 });
  const tree = (x, z, s, seed) => {
    box(.62 * s, .62, .62 * s, mPot, x, 0, z);
    const r = rnd(seed), g = new THREE.Group(); g.position.set(x, .62, z); stand.add(g);
    const tops = [];
    for (let b = 0; b < 4; b++) { const a = b / 4 * 6.28 + r(), tilt = .25 + r() * .25, len = (1.1 + r() * .6) * s;
      const br = mesh(new THREE.CylinderGeometry(.018, .035, len, 8), mTrunk, Math.sin(a) * Math.sin(tilt) * len / 2, len / 2 * Math.cos(tilt), Math.cos(a) * Math.sin(tilt) * len / 2, { parent: g, edges: false });
      br.rotation.set(Math.cos(a) * tilt, 0, -Math.sin(a) * tilt);
      tops.push(new THREE.Vector3(Math.sin(a) * Math.sin(tilt) * len, len * Math.cos(tilt), Math.cos(a) * Math.sin(tilt) * len)); }
    const N = 1500, im = new THREE.InstancedMesh(new THREE.PlaneGeometry(.15, .045), leafMat, N), col = new THREE.Color();
    for (let i = 0; i < N; i++) { const t = tops[i % tops.length], rr = Math.pow(r(), .6) * .42 * s, u = r() * 6.28, v = Math.acos(2 * r() - 1);
      dm.position.set(t.x + rr * Math.sin(v) * Math.cos(u), t.y + rr * Math.cos(v) * .8, t.z + rr * Math.sin(v) * Math.sin(u));
      dm.rotation.set(r() * 3.14, r() * 3.14, r() * 3.14); dm.scale.setScalar(.7 + r() * .6); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix);
      im.setColorAt(i, col.setHSL(.22 + r() * .05, .18 + r() * .15, .55 + r() * .25)); }
    im.castShadow = true; im.receiveShadow = true; im.customDepthMaterial = leafDepth; g.add(im);
  };
  tree(.62, 6.15, 1.05, 11); tree(9.0, 5.9, 1, 23); tree(8.7, 1.2, .9, 37);

  /* ── Techo perimetral (baja en el montaje) ── */
  const roof = new THREE.Group(); scene.add(roof); const RH = .45;
  const beam = (w, d, x, z) => mesh(new THREE.BoxGeometry(w, RH, d), mBlack, x, 0, z, { parent: roof });
  beam(10.2, .5, 5, 6.8); beam(10.2, .5, 5, .2); beam(.5, 6.2, .2, 3.5); beam(.5, 6.2, 9.8, 3.5);
  const ledMat = new THREE.MeshStandardMaterial({ color: 0xfff0d2, emissive: 0xffcf8a, emissiveIntensity: 0, transparent: true, opacity: 0 }); mats.push(ledMat); ledMat.userData.env = .2;
  [[9.2, .03, 5, 6.54], [9.2, .03, 5, .46], [.03, 5.8, .46, 3.5], [.03, 5.8, 9.54, 3.5]].forEach(([w, d, x, z]) => { const l = new THREE.Mesh(new THREE.BoxGeometry(w, .02, d), ledMat); l.position.set(x, -RH / 2 - .005, z); roof.add(l); });
  const counterLed = new THREE.Mesh(new THREE.BoxGeometry(3.0, .02, .02), ledMat); counterLed.position.set(2.5, .06, 5.72); stand.add(counterLed);
  const wallLed = new THREE.Mesh(new THREE.BoxGeometry(4.0, .02, .02), ledMat); wallLed.position.set(5.6, H - .04, .21); stand.add(wallLed);

  /* ── Gráficas ── */
  const gfx = [];
  const plane = (w, h, map, x, y, z, ry = 0, o = {}) => { const m = new THREE.MeshStandardMaterial(Object.assign({ map, transparent: true, opacity: 0, roughness: .6, depthWrite: false }, o)); m.userData.env = .4; gfx.push(m); const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); me.position.set(x, P + y, z); me.rotation.y = ry; gfxG.add(me); return me; };
  plane(2.4, 2.4, wallGfxTex(), 1.75, 1.75, .142);
  const scrTex = loader.load(imgBase + 'servicios/render-casa.jpg', () => redraw()); scrTex.colorSpace = THREE.SRGBColorSpace;
  const scr = plane(2.2, 1.24, scrTex, 5.6, 1.78, .277, 0, { emissive: 0xffffff, emissiveMap: scrTex, emissiveIntensity: .15, roughness: .15 });
  plane(2.4, .6, counterGfxTex(), 2.5, .55, 5.712);
  plane(.42, 2.52, columnGfxTex(), 9.78, 1.75, 6.992);

  /* ── Plano en el suelo ── */
  const segs = [];
  FP.forEach(f => { if (f[0] === 'r') { const [, a, b, c, d] = f; segs.push(a, b, c, b, c, b, c, d, c, d, a, d, a, d, a, b); } else { const [, x, z, r] = f; for (let i = 0; i < 24; i++) { const u = i / 24 * 6.283, v = (i + 1) / 24 * 6.283; segs.push(x + Math.cos(u) * r, z + Math.sin(u) * r, x + Math.cos(v) * r, z + Math.sin(v) * r); } } });
  const pv = []; for (let i = 0; i < segs.length; i += 4) pv.push(segs[i], P + .004, segs[i + 1], segs[i + 2], P + .004, segs[i + 3]);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pv, 3));
  const planMat = new THREE.LineBasicMaterial({ color: INK, transparent: true }); scene.add(new THREE.LineSegments(pg, planMat)); const nPlan = pv.length / 3;
  const dimV = [0, P, -.7, 10, P, -.7, 0, P, -.85, 0, P, -.55, 10, P, -.85, 10, P, -.55, 10.8, P, 0, 10.8, P, 7, 10.65, P, 0, 10.95, P, 0, 10.65, P, 7, 10.95, P, 7];
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(dimV, 3));
  const dimMat = new THREE.LineBasicMaterial({ color: 0xD93333, transparent: true, opacity: 0 }); scene.add(new THREE.LineSegments(dg, dimMat));
  const roofPlan = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(9.4, 6.4).rotateX(-Math.PI / 2)), new THREE.LineDashedMaterial({ color: 0xD93333, dashSize: .22, gapSize: .16, transparent: true, opacity: 0 }));
  roofPlan.position.set(5, P + .006, 3.5); roofPlan.computeLineDistances(); scene.add(roofPlan);

  /* ── Notas sobre el lienzo ── */
  const ov = document.createElement('div'); ov.className = 'callouts'; ov.innerHTML = '<svg></svg>'; root.appendChild(ov); const svg = ov.firstChild;
  const CO = [
    { a: [1.0, P + H, .14], r: [.36, .62], t: 'Altura 3 m', s: 'Estructura autoportante', dx: -150, dy: -60 },
    { a: [7.4, P + .8, 3.4], r: [.4, .62], t: 'Zona de reuniones', s: '3 mesas · 9 sillas', dx: 110, dy: -90 },
    { a: [4.6, P + 2.5, .2], r: [.64, .82], t: 'Pared de madera', s: 'Lamas de roble + pantalla', dx: 60, dy: -90 },
    { a: [2.0, P + .6, 5.71], r: [.64, .82], t: 'Mostrador', s: 'Piedra natural · luz LED', dx: -230, dy: 50 },
    { a: 'roof', r: [.86, 1.1], t: 'Techo perimetral', s: 'Tira LED cálida', dx: -210, dy: -50 },
    { a: [9.78, P + 2.4, 6.99], r: [.86, 1.1], t: 'Columna de marca', s: 'Logotipo retroiluminado', dx: 60, dy: -70 }];
  const PL = [{ a: [5, P, -.7], t: '10,00 m', c: 'red' }, { a: [10.8, P, 3.5], t: '7,00 m', c: 'red' }, { a: [5.6, P, 1.6], t: '70 m²', c: 'big' }, { a: [2.5, P, 4.75], t: 'MOSTRADOR' }, { a: [6.6, P, 3.9], t: 'REUNIONES' }, { a: [1.8, P, .55], t: 'PARED DE MARCA' }, { a: [5.6, P, .62], t: 'MADERA + PANTALLA' }, { a: [5, P, 6.3], t: 'TECHO CON LED · COTA +3,00', c: 'red' }];
  CO.forEach(c => { const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.innerHTML = '<line/><circle r="4.5"/>'; g.style.opacity = 0; svg.appendChild(g); c.g = g; const d = document.createElement('div'); d.className = 'co'; d.style.opacity = 0; d.innerHTML = '<b>' + c.t + '</b><span>' + c.s + '</span>'; ov.appendChild(d); c.el = d; });
  PL.forEach(l => { const d = document.createElement('div'); d.className = 'plab' + (l.c ? ' ' + l.c : ''); d.textContent = l.t; d.style.opacity = 0; ov.appendChild(d); l.el = d; });
  const v3 = new THREE.Vector3(); let W = 1, Hh = 1;
  const proj = a => { v3.set(a[0], a[1], a[2]).project(camera); return [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * Hh]; };

  function resize() { W = root.clientWidth || 1; Hh = root.clientHeight || 1; renderer.setSize(W, Hh, false); composer.setSize(W, Hh); camera.aspect = W / Hh; camera.updateProjectionMatrix(); }
  resize();

  const T = new THREE.Vector3(5, .7, 3.5), col = new THREE.Color();
  let last = [0, null, false];
  function set(p, cam, hideCo) {
    last = [p, cam, hideCo]; cam = cam || {};
    const plan = cl(p / .24), tilt = ez(cl((p - .24) / .2)), rise = ez(cl((p - .3) / .24)), fill = cl((p - .52) / .14), gfxA = cl((p - .6) / .12), drop = ez(cl((p - .72) / .16)), lit = ez(cl((p - .86) / .12));
    // plano y líneas
    planMat.opacity = (1 - .85 * rise) * (1 - fill); dimMat.opacity = cl((plan - .5) / .4) * (1 - fill); roofPlan.material.opacity = cl((plan - .6) / .3) * (1 - rise);
    pg.setDrawRange(0, Math.floor(nPlan * cl(plan * 1.15) / 2) * 2);
    grid.material.opacity = (1 - fill) * .9; grid.visible = fill < .999;
    stand.scale.y = Math.max(.0001, rise); stand.visible = rise > .002;
    const eo = rise > .002 ? (1 - fill) * .85 : 0; edgeMat.opacity = eo; edgeMat.visible = eo > .01;
    mats.forEach(m => { m.opacity = fill; m.transparent = fill < .999; m.depthWrite = fill > .4; });
    gfx.forEach(m => m.opacity = gfxA);
    // techo
    roof.position.y = P + H + RH / 2 + (1 - drop) * 7; roof.visible = drop > .001;
    // día → noche en el pabellón
    scene.background.copy(CREAM).lerp(NIGHT, lit); scene.fog.color.copy(scene.background);
    hallMat.color.copy(col.set(0xffffff).lerp(new THREE.Color(0x3b3936), lit));
    hlMat.opacity = lit; hemi.intensity = lerp(.9, .22, lit); sun.intensity = lerp(3.4, .45, lit);
    warm.forEach(([l, i]) => l.intensity = i * lit); ledMat.emissiveIntensity = lit * 2.2; mGlass.emissiveIntensity = lit * .8; scr.material.emissiveIntensity = .15 + lit * .9;
    mats.forEach(m => m.envMapIntensity = m.userData.env * lerp(1, .22, lit)); hallMat.envMapIntensity = lerp(.9, .25, lit);
    renderer.toneMappingExposure = lerp(1, 1.05, lit);
    gtao.enabled = fill > .95 && W > 700; bloom.strength = .08 + .3 * lit;
    // cámara
    const R0 = 13.6 * (1 + .22 * (1 - tilt)) * Math.pow(Math.max(1, 1.3 / (W / Hh)), .85) * (cam.s ? 1 / cam.s : 1);
    const polar = .02 + 1.0 * tilt + (cam.a || 0), az = .62 * tilt + (cam.b || 0);
    const tx = T.x + (cam.x || 0) * .08, tz = T.z - (cam.y || 0) * .08;
    camera.position.set(tx + R0 * Math.sin(polar) * Math.sin(az), T.y + R0 * Math.cos(polar), tz + R0 * Math.sin(polar) * Math.cos(az));
    camera.lookAt(tx, T.y + (W / Hh < 1 ? -.6 : -.2), tz); camera.updateMatrixWorld();
    composer.render();
    // notas
    CO.forEach(c => {
      const on = !hideCo && p >= c.r[0] && p < c.r[1]; c.g.style.opacity = c.el.style.opacity = on ? 1 : 0; if (!on) return;
      const [x, y] = proj(c.a === 'roof' ? [2.6, roof.position.y - RH / 2, 6.8 + .25] : c.a), sc = W < 700 ? .55 : 1, lw = c.el.offsetWidth, lh = c.el.offsetHeight;
      let lx = x + c.dx * sc, ly = y + c.dy * sc; lx = Math.max(8, Math.min(W - lw - 8, lx)); ly = Math.max(W < 700 ? 150 : 180, Math.min(Hh - lh - 110, ly));
      c.el.style.transform = `translate(${lx.toFixed(1)}px,${ly.toFixed(1)}px)`;
      const ln = c.g.firstChild, ci = c.g.lastChild; ln.setAttribute('x1', x); ln.setAttribute('y1', y); ln.setAttribute('x2', lx + (c.dx < 0 ? lw : 0)); ln.setAttribute('y2', ly + lh / 2); ci.setAttribute('cx', x); ci.setAttribute('cy', y);
    });
    const po = cl((plan - .55) / .35) * (1 - cl((p - .3) / .06));
    PL.forEach(l => { l.el.style.opacity = po; if (po <= 0) return; const [x, y] = proj(l.a); l.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`; });
    return lit > .5;
  }
  redraw = () => set(...last);
  return { set, resize: () => { resize(); redraw(); } };
}
