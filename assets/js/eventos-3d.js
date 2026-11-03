// Sala de evento corporativo en 3D (Three.js): plano → paredes y escenario → mobiliario → decoración → luz.
// createEvent(contenedor) devuelve { set(p, cam, ocultarNotas) → true cuando la sala está a oscuras, resize() }.
import * as THREE from './vendor/three/three.module.min.js';
import { RoomEnvironment } from './vendor/three/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from './vendor/three/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from './vendor/three/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from './vendor/three/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/three/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from './vendor/three/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from './vendor/three/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/three/jsm/postprocessing/OutputPass.js';

const cl = x => Math.max(0, Math.min(1, x));
const ez = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eb = x => { const c = 1.6; return x <= 0 ? 0 : x >= 1 ? 1 : 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }; // pequeño rebote
const lerp = (a, b, t) => a + (b - a) * t;
const INK = 0x0b0b0b, CREAM = new THREE.Color(0xF4F3EE), NIGHT = new THREE.Color(0x111012);
function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function noiseTex(base, amp, seed) { return canvasTex(1024, 1024, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); const r = rnd(seed); for (let i = 0; i < 30000; i++) { const v = r() > .5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${r() * amp})`; g.fillRect(r() * w, r() * h, 1 + r() * 2.5, 1 + r() * 2.5); } }); }
function woodTex(base, seed) {
  return canvasTex(1024, 1024, (g, w, h) => { const r = rnd(seed);
    for (let y = 0; y < h; y += 56) { let x = -Math.floor(r() * 500);
      while (x < w) { const len = 300 + r() * 420, t = r() * .14 - .07; g.fillStyle = `rgb(${base.map(v => Math.round(v * (1 + t))).join(',')})`; g.fillRect(x, y, len, 56);
        for (let i = 0; i < 28; i++) { g.strokeStyle = `rgba(90,55,25,${.03 + r() * .06})`; g.lineWidth = .5 + r() * 1.4; const yy = y + r() * 56, ph = r() * 6; g.beginPath(); g.moveTo(x, yy); for (let xx = x; xx < x + len; xx += 24) g.lineTo(xx, yy + Math.sin(xx * .012 + ph) * 2); g.stroke(); }
        g.fillStyle = 'rgba(50,30,10,.25)'; g.fillRect(x, y, 2, 56); x += len; }
      g.fillStyle = 'rgba(50,30,10,.22)'; g.fillRect(0, y, w, 1.5); } }); }
const LOGO = 'M462 283H935V1467A353 353 0 0 0 1027 1703H935A473 473 0 0 1 462 1230Z';
function drawLogo(g, x, y, hgt, fill, dot = '#D93333') { const s = hgt / 1470; g.save(); g.translate(x, y); g.scale(s, s); g.translate(-440, -260); g.fillStyle = fill; g.fill(new Path2D(LOGO)); g.fillStyle = dot; g.beginPath(); g.arc(1288, 1467, 237, 0, 7); g.fill(); g.restore(); }
function spaced(g, txt, x, y, sp) { if ('letterSpacing' in g) { g.letterSpacing = sp + 'px'; g.fillText(txt, x, y); g.letterSpacing = '0px'; return; } let cx = x; for (const ch of txt) { g.fillText(ch, cx, y); cx += g.measureText(ch).width + sp; } }
function screenTex() {
  return canvasTex(2048, 1024, (g, w, h) => {
    const gr = g.createRadialGradient(w * .7, h * .35, 50, w * .6, h * .5, w * .7); gr.addColorStop(0, '#5a1715'); gr.addColorStop(.55, '#1c0c0c'); gr.addColorStop(1, '#0b0b0b');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(217,51,51,.55)'; g.lineWidth = 3; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(w * .82, h * .5, 120 + i * 70, 0, 7); g.stroke(); g.globalAlpha *= .8; } g.globalAlpha = 1;
    drawLogo(g, 160, 170, 170, '#ffffff');
    g.fillStyle = '#fff'; g.font = '800 250px Poppins, sans-serif'; g.textBaseline = 'alphabetic'; spaced(g, 'Welcome', 150, 640, -12);
    g.font = '400 50px "DM Mono", monospace'; g.fillStyle = 'rgba(255,255,255,.75)'; spaced(g, 'PRODUCT LAUNCH · 2026', 160, 760, 10);
  });
}
function rollTex() { return canvasTex(512, 1400, (g, w, h) => { g.fillStyle = '#C4221D'; g.fillRect(0, 0, w, h); drawLogo(g, 70, 90, 170, '#ffffff', '#ffffff'); g.fillStyle = '#fff'; g.font = '800 120px Poppins, sans-serif'; g.textBaseline = 'alphabetic'; spaced(g, 'Launch', 60, 560, -5); spaced(g, 'Studio', 60, 680, -5); g.font = '400 34px "DM Mono", monospace'; spaced(g, 'EVERY DETAIL', 66, 1200, 6); spaced(g, 'MATTERS', 66, 1250, 6); }); }
function lecternTex() { return canvasTex(512, 512, (g) => { drawLogo(g, 200, 120, 160, '#EDE6D8'); g.fillStyle = '#EDE6D8'; g.font = '400 44px Poppins, sans-serif'; g.textBaseline = 'middle'; spaced(g, 'LAUNCH', 150, 380, 14); }); }
function barTex() { return canvasTex(1024, 256, (g) => { drawLogo(g, 90, 70, 110, '#EDE6D8'); g.fillStyle = '#EDE6D8'; g.font = '400 64px Poppins, sans-serif'; g.textBaseline = 'middle'; spaced(g, 'LAUNCH STUDIO · BAR', 210, 128, 16); }); }

export async function createEvent(root, imgBase = '../assets/img/') {
  try { await Promise.all([document.fonts.load('800 80px Poppins'), document.fonts.load('400 40px "DM Mono"')]); } catch (e) { }
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'; root.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = CREAM.clone(); scene.fog = new THREE.Fog(CREAM.clone(), 34, 80);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), .03).texture;
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 250);
  const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt); composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 2, 2); gtao.updateGtaoMaterial({ radius: .6, distanceExponent: 1.6, thickness: 1.2, scale: 1.2, samples: 16 }); composer.addPass(gtao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), .3, .45, .92); composer.addPass(bloom); composer.addPass(new OutputPass());

  /* luces */
  const hemi = new THREE.HemisphereLight(0xffffff, 0xcfc8b8, .9); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e6, 3.2); sun.position.set(-9, 20, 17); sun.target.position.set(8, 0, 5.5);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 }); sun.shadow.bias = -.0003; sun.shadow.normalBias = .02;
  scene.add(sun, sun.target);
  const warm = [];
  const spot = (x, y, z, tx, ty, tz, i, ang, colr = 0xffe2b0, sh = false) => { const s = new THREE.SpotLight(colr, 0, 18, ang, .6, 1.3); s.position.set(x, y, z); s.target.position.set(tx, ty, tz); s.castShadow = sh; if (sh) { s.shadow.mapSize.set(1024, 1024); s.shadow.bias = -.0005; } scene.add(s, s.target); warm.push([s, i]); return s; };
  const point = (x, y, z, i, d, colr = 0xffc98a) => { const l = new THREE.PointLight(colr, 0, d, 2); l.position.set(x, y, z); scene.add(l); warm.push([l, i]); return l; };

  /* materiales */
  const mats = [];
  const M = (o, env = .5) => { const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: .8, transparent: true, opacity: 0 }, o)); m.userData.env = env; m.envMapIntensity = env; mats.push(m); return m; };
  const tile = (t, x, y) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(x, y); return t; };
  const mWall = M({ map: tile(noiseTex('#e9e5dc', .035, 2), 3, 1), roughness: .95 }, .35);
  const mPanel = M({ map: tile(woodTex([176, 132, 88], 5), 1, 1), roughness: .6 });
  const mFloor = M({ map: tile(woodTex([214, 190, 154], 7), 4, 3), roughness: .5 }, .6);
  const mCarpet = M({ map: tile(noiseTex('#3a3836', .08, 9), 6, 6), roughness: 1 }, .2);
  const mBlack = M({ color: 0x1c1b1a, roughness: .5 }, .35);
  const mStage = M({ color: 0x161515, roughness: .4 }, .5);
  const mFabric = M({ map: tile(noiseTex('#5b5752', .08, 4), 2, 2), roughness: .95 }, .3);
  const mChairFrame = M({ color: 0x1a1a1a, roughness: .3, metalness: .85 }, .8);
  const mCloth = M({ color: 0xF3F0E8, roughness: .9, side: THREE.DoubleSide }, .4);
  const mTop = M({ color: 0xF6F3EC, roughness: .6 }, .5);
  const mGold = M({ color: 0xbfa27a, roughness: .3, metalness: .9 }, 1);
  const mLeaf = M({ color: 0x56693f, roughness: .8 }, .3), mFlower = M({ color: 0xf1ebe0, roughness: .7 }, .3), mFlowerR = M({ color: 0xc9302c, roughness: .6 }, .3);
  const mGlass = M({ color: 0x2b3530, roughness: .1, metalness: .2 }, 1);
  const mCandle = M({ color: 0xfff1d8, emissive: 0xffc77a, emissiveIntensity: 0 }, .3);

  /* estructura */
  const P = .03, Wd = 16, Dp = 11, H = 4.6;
  const room = new THREE.Group(); room.position.y = P; scene.add(room);     // crece en altura
  const furn = new THREE.Group(); furn.position.y = P; scene.add(furn);     // aparece pieza a pieza
  const gfxG = new THREE.Group(); scene.add(gfxG);
  const edgeMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0 });
  const FP = [], pops = [];
  function mesh(geo, mat, x, y, z, o = {}) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.ry) m.rotation.y = o.ry;
    m.castShadow = o.cast !== false; m.receiveShadow = true;
    if (o.edges) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), edgeMat); m.add(e); }
    (o.parent || room).add(m); return m; }
  const box = (w, h, d, mat, x, y0, z, o = {}) => { if (o.fp !== false) FP.push(['r', x - w / 2, z - d / 2, x + w / 2, z + d / 2]); return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y0 + h / 2, z, Object.assign({ edges: true }, o)); };
  // pieza que aparece con un pequeño salto en el momento t
  function popper(obj, x, z, t) { const g = new THREE.Group(); g.position.set(x, 0, z); g.add(obj); furn.add(g); pops.push([g, t]); return g; }

  // suelo de la sala y del pabellón
  const outerMat = new THREE.MeshStandardMaterial({ map: tile(noiseTex('#cfccc5', .05, 3), 30, 30), roughness: .5 }); const outer = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), outerMat); outer.rotation.x = -Math.PI / 2; outer.receiveShadow = true; scene.add(outer);
  const grid = new THREE.GridHelper(60, 120, 0xb3b0a6, 0xd0cdc4); grid.position.set(8, .004, 5.5); grid.material.transparent = true; scene.add(grid);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(Wd, P, Dp), [mBlack, mBlack, mFloor, mBlack, mBlack, mBlack]); floor.position.set(Wd / 2, P / 2, Dp / 2); floor.receiveShadow = true; scene.add(floor);
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 6.4), mCarpet); carpet.rotation.x = -Math.PI / 2; carpet.position.set(8, P + .006, 6.3); carpet.receiveShadow = true; scene.add(carpet);
  const aisle = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 6.4), M({ color: 0xa8231f, roughness: 1 }, .2)); aisle.rotation.x = -Math.PI / 2; aisle.position.set(8, P + .009, 6.3); aisle.receiveShadow = true; scene.add(aisle);

  // paredes (fondo y lateral izquierdo) con paneles de madera
  box(Wd, H, .2, mWall, Wd / 2, 0, .1);
  box(.2, H, Dp - .2, mWall, .1, 0, .2 + (Dp - .2) / 2);
  [[1.2, 3.2], [12.8, 14.8]].forEach(([a, b]) => box(b - a, H - .6, .05, mPanel, (a + b) / 2, .3, .225, { fp: false }));
  [3.6, 9.6].forEach(z => box(.05, H - .6, 3.6, mPanel, .225, .3, z, { fp: false }));
  // escenario
  box(8.4, .6, 2.8, mStage, 8, 0, 1.6);
  box(1.4, .2, .5, mStage, 8, 0, 3.25, { fp: false }); box(1.4, .4, .3, mStage, 8, 0, 3.15, { fp: false });
  const stageLed = new THREE.Mesh(new THREE.BoxGeometry(8.4, .03, .02), M({ color: 0xffe9c8, emissive: 0xffc77a, emissiveIntensity: 0 }, .2)); stageLed.position.set(8, .58, 3.01); room.add(stageLed); const mStageLed = stageLed.material;
  // pantalla LED
  box(6.8, 3.6, .16, mBlack, 8, 1.0, .32, { fp: false });
  // atril
  const lect = box(.6, 1.15, .45, mBlack, 10.6, .6, 2.1, { fp: false });

  // butacas: 6 filas × 16, con pasillo central
  const seat = new RoundedBoxGeometry(.46, .09, .44, 2, .03).translate(0, .46, 0), back = new RoundedBoxGeometry(.46, .5, .07, 2, .03).translate(0, .78, .2);
  const ni = g => g.index ? g.toNonIndexed() : g;
  const legs = mergeGeometries([[-.19, -.17], [.19, -.17], [-.19, .17], [.19, .17]].map(([a, b]) => ni(new THREE.CylinderGeometry(.012, .012, .44, 6).translate(a, .22, b))));
  const chairG = mergeGeometries([mergeGeometries([ni(seat), ni(back)]), legs], true);
  const chairPos = [];
  for (let r = 0; r < 6; r++) for (let i = 0; i < 16; i++) chairPos.push([i < 8 ? 3.6 + i * .52 : 8.8 + (i - 8) * .52, 4.1 + r * .92]);
  chairPos.forEach(([x, z]) => FP.push(['r', x - .23, z - .22, x + .23, z + .22]));
  const chairs = new THREE.InstancedMesh(chairG, [mFabric, mChairFrame], chairPos.length); chairs.castShadow = chairs.receiveShadow = true; furn.add(chairs);
  const dm = new THREE.Object3D();

  // zona cóctel: mesas altas con mantel y centro de flores
  const TB = [[2.6, 9.9], [4.9, 10.1], [11.1, 10.1], [13.4, 9.9], [14.6, 7.6], [14.6, 5.2]];
  const flowers = (g, s, seed) => { const r = rnd(seed); for (let i = 0; i < 26; i++) { const a = r() * 6.28, rr = r() * .13 * s; const f = new THREE.Mesh(new THREE.SphereGeometry((.03 + r() * .025) * s, 8, 6), r() > .72 ? mFlowerR : r() > .4 ? mFlower : mLeaf); f.position.set(Math.cos(a) * rr, r() * .1 * s, Math.sin(a) * rr); f.castShadow = true; g.add(f); } };
  TB.forEach(([x, z], k) => { FP.push(['c', x, z, .45]);
    const g = new THREE.Group();
    const cloth = new THREE.Mesh(new THREE.CylinderGeometry(.42, .6, 1.08, 40, 1, true), mCloth); cloth.position.y = .54; cloth.castShadow = cloth.receiveShadow = true; g.add(cloth);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(.43, .43, .025, 40), mTop); top.position.y = 1.09; top.castShadow = true; g.add(top);
    const vase = new THREE.Mesh(new THREE.CylinderGeometry(.05, .04, .14, 16), mGlass); vase.position.y = 1.17; g.add(vase);
    const fl = new THREE.Group(); fl.position.y = 1.27; flowers(fl, 1, 30 + k); g.add(fl);
    const cnd = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .08, 12), mCandle); cnd.position.set(.18, 1.14, .08); g.add(cnd);
    popper(g, x, z, .64 + k * .012); point(x, 1.4, z, .18, 1.6, 0xffb866); });
  // barra a la izquierda con estantería iluminada
  const bar = new THREE.Group();
  const bb = new THREE.Mesh(new THREE.BoxGeometry(.7, 1.1, 4.6), mBlack); bb.position.y = .55; bb.castShadow = bb.receiveShadow = true; bar.add(bb);
  const bt = new THREE.Mesh(new THREE.BoxGeometry(.82, .05, 4.72), mTop); bt.position.y = 1.12; bt.castShadow = true; bar.add(bt);
  popper(bar, 1.6, 6.8, .66); FP.push(['r', 1.25, 4.5, 1.95, 9.1]);
  const shelf = new THREE.Group();
  for (let s = 0; s < 3; s++) { const sh = new THREE.Mesh(new THREE.BoxGeometry(.3, .03, 4.2), mPanel); sh.position.set(0, 1.3 + s * .55, 0); shelf.add(sh);
    for (let b = 0; b < 16; b++) { const bo = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .26, 10), mGlass); bo.position.set(0, 1.45 + s * .55, -1.95 + b * .26); shelf.add(bo); } }
  popper(shelf, .42, 6.8, .68);
  const barLed = new THREE.Mesh(new THREE.BoxGeometry(.02, .02, 4.4), mStageLed); barLed.position.set(.97, .06, 0); bar.add(barLed);
  point(.6, 2.6, 6.8, 2.2, 4.5);
  // plantas grandes en las esquinas del escenario y flores en el borde
  const bigPlant = (x, z, seed) => { const g = new THREE.Group(); const pot = new THREE.Mesh(new THREE.CylinderGeometry(.3, .24, .6, 24), mBlack); pot.position.y = .3; pot.castShadow = true; g.add(pot); const r = rnd(seed);
    for (let i = 0; i < 160; i++) { const a = r() * 6.28, rr = Math.sqrt(r()) * .45, l = new THREE.Mesh(new THREE.SphereGeometry(.05, 6, 4), r() > .5 ? mLeaf : mFlower); l.scale.set(1, .3, 2.2); l.position.set(Math.cos(a) * rr, .7 + r() * 1.2 * (1 - rr), Math.sin(a) * rr); l.rotation.set(r() * 3, r() * 3, r() * 3); l.castShadow = true; g.add(l); }
    popper(g, x, z, .74); FP.push(['c', x, z, .3]); };
  bigPlant(3.4, .9, 3); bigPlant(12.6, .9, 5);
  [[4.4, 3.05], [5.6, 3.05], [10.4, 3.05], [11.6, 3.05]].forEach(([x, z], k) => { const g = new THREE.Group(); g.position.y = .6; flowers(g, 2.4, 60 + k); popper(g, x, z, .76); });
  // roll-ups de marca a los lados
  const ru = (x) => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(.9, .08, .3), mChairFrame); b.position.y = .04; g.add(b); popper(g, x, 3.6, .72); return g; };
  ru(2.2); ru(13.8);

  // truss con focos (baja en el montaje)
  const truss = new THREE.Group(); scene.add(truss);
  const tb = new THREE.Mesh(new THREE.BoxGeometry(10, .3, .3), mChairFrame); tb.castShadow = true; truss.add(tb);
  const cans = [];
  for (let i = 0; i < 7; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.09, .13, .32, 16), mBlack); c.position.set(-4.5 + i * 1.5, -.3, .1); c.rotation.x = .7; truss.add(c); cans.push(c); }
  [-4.8, 4.8].forEach(x => { const c = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, 6, 6), mChairFrame); c.position.set(x, 3, 0); truss.add(c); });
  truss.position.set(8, 5.2, 1.3);
  // luces de la noche
  [[6.6, 1.9], [8, 2.0], [9.4, 1.9]].forEach(([x, z], i) => spot(x, 4.9, 1.6, x, .6, z + .4, 34, .32, 0xfff0d8, i === 1));
  [[5.2, 6.5], [10.8, 6.5]].forEach(([x, z]) => spot(x, 4.1, 4.4, x, 0, z + 1, 10, .62, 0xffd6a0));
  [1.6, 4.1, 11.9, 14.4].forEach(x => spot(x, .1, .6, x, 4.2, .3, 9, .5, 0xd93333));   // luz roja que sube por la pared
  [3.6, 9.6].forEach(z => spot(.6, .1, z, .2, 4.2, z, 6, .55, 0xffb870));
  [[3, 9.6], [8, 9.8], [13, 9.6], [14.6, 6.4]].forEach(([x, z]) => spot(x, 4.4, z, x, 0, z, 9, .55, 0xffcf94));

  /* gráficas */
  const gfx = [];
  const plane = (w, h, map, x, y, z, ry = 0, o = {}) => { const m = new THREE.MeshStandardMaterial(Object.assign({ map, transparent: true, opacity: 0, roughness: .6, depthWrite: false }, o)); gfx.push(m); const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); me.position.set(x, y, z); me.rotation.y = ry; gfxG.add(me); return me; };
  const st = screenTex(); const scr = plane(6.6, 3.4, st, 8, P + 2.8, .405, 0, { emissive: 0xffffff, emissiveMap: st, emissiveIntensity: .1, roughness: .2 });
  const lt = plane(.5, .5, lecternTex(), 10.6, P + 1.35, 2.326);
  const bartex = plane(3.0, .75, barTex(), 1.951, P + .6, 6.8, Math.PI / 2);
  const rollT = rollTex(); const rolls = [2.2, 13.8].map(x => plane(.86, 2.3, rollT, x, P + 1.23, 3.62));

  /* plano */
  const segs = [];
  FP.forEach(f => { if (f[0] === 'r') { const [, a, b, c, d] = f; segs.push(a, b, c, b, c, b, c, d, c, d, a, d, a, d, a, b); } else { const [, x, z, r] = f; for (let i = 0; i < 24; i++) { const u = i / 24 * 6.283, v = (i + 1) / 24 * 6.283; segs.push(x + Math.cos(u) * r, z + Math.sin(u) * r, x + Math.cos(v) * r, z + Math.sin(v) * r); } } });
  const pv = []; for (let i = 0; i < segs.length; i += 4) pv.push(segs[i], P + .012, segs[i + 1], segs[i + 2], P + .012, segs[i + 3]);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pv, 3));
  const planMat = new THREE.LineBasicMaterial({ color: INK, transparent: true }); scene.add(new THREE.LineSegments(pg, planMat)); const nPlan = pv.length / 3;
  const dimV = [0, P, -.8, Wd, P, -.8, 0, P, -.95, 0, P, -.65, Wd, P, -.95, Wd, P, -.65, Wd + .8, P, 0, Wd + .8, P, Dp, Wd + .65, P, 0, Wd + .95, P, 0, Wd + .65, P, Dp, Wd + .95, P, Dp, 0, P, Dp, Wd, P, Dp, Wd, P, 0, Wd, P, Dp];
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(dimV, 3));
  const dimMat = new THREE.LineBasicMaterial({ color: 0xD93333, transparent: true, opacity: 0 }); scene.add(new THREE.LineSegments(dg, dimMat));

  /* notas */
  const ov = document.createElement('div'); ov.className = 'callouts'; ov.innerHTML = '<svg></svg>'; root.appendChild(ov); const svg = ov.firstChild;
  const CO = [
    { a: [8, P + .6, 3.0], r: [.34, .56], t: 'Escenario', s: '8,4 × 2,8 m · altura 60 cm', dx: 90, dy: -110 },
    { a: [5.0, P + 3.4, .4], r: [.4, .6], t: 'Pantalla LED', s: '6,6 × 3,4 m', dx: -200, dy: -40 },
    { a: [5.4, P + .8, 6.4], r: [.6, .78], t: 'Patio de butacas', s: '96 plazas · pasillo central', dx: -230, dy: 30 },
    { a: [13.4, P + 1.2, 9.9], r: [.66, .8], t: 'Zona cóctel', s: 'Mesas altas · flores naturales', dx: 50, dy: -110 },
    { a: [1.6, P + 1.15, 5.2], r: [.68, .82], t: 'Barra', s: 'Frontal de marca · luz LED', dx: -60, dy: -120 },
    { a: 'truss', r: [.84, 1.1], t: 'Iluminación', s: 'Truss con focos sobre el escenario', dx: 120, dy: 40 }];
  const PL = [{ a: [8, P, -.8], t: '16,00 m', c: 'red' }, { a: [Wd + .8, P, 5.5], t: '11,00 m', c: 'red' }, { a: [8, P, 1.6], t: 'ESCENARIO' }, { a: [8, P, 6.6], t: '96 PLAZAS' }, { a: [1.6, P, 3.9], t: 'BARRA' }, { a: [8, P, 10.2], t: 'ZONA CÓCTEL' }, { a: [13.3, P, 4.4], t: '176 m²', c: 'big' }];
  CO.forEach(c => { const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.innerHTML = '<line/><circle r="4.5"/>'; g.style.opacity = 0; svg.appendChild(g); c.g = g; const d = document.createElement('div'); d.className = 'co'; d.style.opacity = 0; d.innerHTML = '<b>' + c.t + '</b><span>' + c.s + '</span>'; ov.appendChild(d); c.el = d; });
  PL.forEach(l => { const d = document.createElement('div'); d.className = 'plab' + (l.c ? ' ' + l.c : ''); d.textContent = l.t; d.style.opacity = 0; ov.appendChild(d); l.el = d; });
  const v3 = new THREE.Vector3(); let W = 1, Hh = 1;
  const proj = a => { v3.set(a[0], a[1], a[2]).project(camera); return [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * Hh]; };
  function resize() { W = root.clientWidth || 1; Hh = root.clientHeight || 1; renderer.setSize(W, Hh, false); composer.setSize(W, Hh); camera.aspect = W / Hh; camera.updateProjectionMatrix(); }
  resize();

  const T = new THREE.Vector3(8, .9, 5.6), wallNight = new THREE.Color(0x3a3634), tmpC = new THREE.Color();
  let last = [0, null, false];
  function set(p, cam, hideCo) {
    last = [p, cam, hideCo]; cam = cam || {};
    const plan = cl(p / .22), tilt = ez(cl((p - .22) / .2)), rise = ez(cl((p - .28) / .22)), fill = cl((p - .48) / .12), gfxA = cl((p - .7) / .1), drop = ez(cl((p - .76) / .12)), lit = ez(cl((p - .86) / .12));
    planMat.opacity = (1 - .8 * rise) * (1 - cl((p - .6) / .12)); dimMat.opacity = cl((plan - .5) / .4) * (1 - fill);
    pg.setDrawRange(0, Math.floor(nPlan * cl(plan * 1.1) / 2) * 2);
    grid.material.opacity = (1 - fill) * .9; grid.visible = fill < .999;
    room.scale.y = Math.max(.0001, rise); room.visible = rise > .002; floor.visible = carpet.visible = aisle.visible = rise > .002;
    const eo = rise > .002 ? (1 - fill) * .85 : 0; edgeMat.opacity = eo; edgeMat.visible = eo > .01;
    mats.forEach(m => { m.opacity = fill; m.transparent = fill < .999; m.depthWrite = fill > .4; });
    gfx.forEach(m => m.opacity = gfxA);
    // butacas fila a fila
    chairPos.forEach(([x, z], i) => { const r = Math.floor(i / 16), k = eb(cl((p - .54 - r * .016 - (i % 16) * .0012) / .03)); dm.position.set(x, 0, z); dm.rotation.set(0, Math.PI, 0); dm.scale.setScalar(Math.max(.0001, k)); dm.updateMatrix(); chairs.setMatrixAt(i, dm.matrix); });
    chairs.instanceMatrix.needsUpdate = true; chairs.visible = p > .54;
    pops.forEach(([g, t]) => { const k = eb(cl((p - t) / .04)); g.scale.setScalar(Math.max(.0001, k)); g.visible = k > .001; });
    truss.position.y = P + 5.15 + (1 - drop) * 7; truss.visible = drop > .001;
    // día → noche
    scene.background.copy(CREAM).lerp(NIGHT, lit); scene.fog.color.copy(scene.background);
    mWall.color.copy(tmpC.set(0xffffff).lerp(wallNight, lit * .9)); outerMat.color.copy(tmpC.set(0xffffff).lerp(NIGHT, lit * .97)); outerMat.envMapIntensity = 1 - .9 * lit;
    hemi.intensity = lerp(.9, .08, lit); sun.intensity = lerp(3.2, .12, lit);
    warm.forEach(([l, i]) => l.intensity = i * lit);
    mStageLed.emissiveIntensity = lit * 2.4; mCandle.emissiveIntensity = lit * 2; scr.material.emissiveIntensity = .1 + lit * .5;
    mats.forEach(m => m.envMapIntensity = m.userData.env * lerp(1, .15, lit));
    renderer.toneMappingExposure = lerp(1, 1.1, lit); gtao.enabled = fill > .95 && W > 700; bloom.strength = .08 + .32 * lit;
    // cámara
    const R0 = 21 * (1 + .18 * (1 - tilt)) * Math.pow(Math.max(1, 1.3 / (W / Hh)), .85) * (cam.s ? 1 / cam.s : 1);
    const polar = .02 + .98 * tilt + (cam.a || 0), az = .58 * tilt + (cam.b || 0);
    const tx = T.x + (cam.x || 0) * .1, tz = T.z - (cam.y || 0) * .1;
    camera.position.set(tx + R0 * Math.sin(polar) * Math.sin(az), T.y + R0 * Math.cos(polar), tz + R0 * Math.sin(polar) * Math.cos(az));
    camera.lookAt(tx, T.y + (W / Hh < 1 ? -.6 : -.2), tz); camera.updateMatrixWorld();
    composer.render();
    CO.forEach(c => {
      const on = !hideCo && p >= c.r[0] && p < c.r[1]; c.g.style.opacity = c.el.style.opacity = on ? 1 : 0; if (!on) return;
      const [x, y] = proj(c.a === 'truss' ? [11.5, truss.position.y - .3, 1.3] : c.a), sc = W < 700 ? .55 : 1, lw = c.el.offsetWidth, lh = c.el.offsetHeight;
      let lx = x + c.dx * sc, ly = y + c.dy * sc; lx = Math.max(8, Math.min(W - lw - 8, lx)); ly = Math.max(W < 700 ? 150 : 180, Math.min(Hh - lh - 110, ly));
      c.el.style.transform = `translate(${lx.toFixed(1)}px,${ly.toFixed(1)}px)`;
      const ln = c.g.firstChild, ci = c.g.lastChild; ln.setAttribute('x1', x); ln.setAttribute('y1', y); ln.setAttribute('x2', lx + (c.dx < 0 ? lw : 0)); ln.setAttribute('y2', ly + lh / 2); ci.setAttribute('cx', x); ci.setAttribute('cy', y);
    });
    const po = cl((plan - .55) / .35) * (1 - cl((p - .28) / .06));
    PL.forEach(l => { l.el.style.opacity = po; if (po <= 0) return; const [x, y] = proj(l.a); l.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`; });
    return lit > .5;
  }
  return { set, resize: () => { resize(); set(...last); } };
}
