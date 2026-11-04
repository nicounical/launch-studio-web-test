// «La sala se monta mientras bajas»: la sala de un evento corporativo se construye sobre una línea de tiempo (0 → 1).
// Bajar construye, subir desmonta. Cinco versiones, cada una con su paleta (ninguna sobre negro) y su cámara:
//   A · Del día a la noche   balcón en una esquina; la luz pasa del montaje de mañana a la tarde del evento
//   B · Plano de sala        vista cenital de organizador: el aforo se llena como un plano de asientos
//   C · Por el pasillo       a la altura de los ojos, avanzando despacio por el pasillo central hacia el escenario
//   D · Maqueta              una maqueta blanca de arquitecto que se colorea al final
//   E · Frontal              composición simétrica frente al escenario; la pantalla se monta pieza a pieza
import * as THREE from './vendor/three/three.module.min.js';
import { RoomEnvironment } from './vendor/three/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from './vendor/three/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from './vendor/three/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from './vendor/three/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/three/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from './vendor/three/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from './vendor/three/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/three/jsm/postprocessing/OutputPass.js';
import { cl, lerp, rnd, woodTex, noiseTex, canvasTex, drawLogo, spaced } from './stand-tex.js';
import { screenTex, rollTex } from './eventos-3d.js';

const io = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2, out = x => 1 - Math.pow(1 - x, 4), soft = x => x * x * (3 - 2 * x);

// Paletas: base clara o de color, nunca negra
const PAL = {
  A: { name: 'Cálida', bg: 0xF4F1EA, eve: 0x3a2a22, wall: '#EDE5D8', panel: [196, 150, 104], floor: [222, 198, 160], stage: 0xD9CBB4, fascia: 0xB98B5E, chair: '#B4553A', carpet: '#CDBFA8', aisle: 0xC4221D, bar: 0xE8DFD0, text: '#2a2522' },
  B: { name: 'Salvia', bg: 0xF2F2EC, eve: 0x26302a, wall: '#E9ECE3', panel: [186, 160, 120], floor: [228, 214, 186], stage: 0xD8D6CC, fascia: 0x8C9A7C, chair: '#7F937A', carpet: '#D9D5C7', aisle: 0xC4221D, bar: 0xEDEAE0, text: '#2a2d28' },
  C: { name: 'Arcilla', bg: 0xF3ECE6, eve: 0x3b2622, wall: '#E7D3C6', panel: [150, 98, 70], floor: [210, 180, 146], stage: 0xC9A88E, fascia: 0x8F5A43, chair: '#EFE7DA', carpet: '#B9775E', aisle: 0xC4221D, bar: 0xDCC2B0, text: '#3a2620' },
  D: { name: 'Maqueta', bg: 0xF3F2EE, eve: 0x2c2826, wall: '#EFEAE0', panel: [190, 146, 100], floor: [220, 196, 158], stage: 0xD7CCBA, fascia: 0xA97C55, chair: '#3D5A80', carpet: '#D6CFC2', aisle: 0xC4221D, bar: 0xE6DED0, text: '#2a2522' },
  R: { name: 'Real', bg: 0xE8E5DF, eve: 0x1c1a18, wall: '#D8D3CA', panel: [150, 112, 80], floor: [184, 152, 114], stage: 0x1e1d1c, fascia: 0x2a2928, chair: '#47484b', carpet: '#5e5852', aisle: 0x3e3833, bar: 0x1f1e1d, text: '#ECE6DA' },
  E: { name: 'Arena', bg: 0xF4EFE6, eve: 0x2f2620, wall: '#EADFCB', panel: [176, 130, 86], floor: [214, 186, 146], stage: 0xE2D3BC, fascia: 0xC4221D, chair: '#E3D6C0', carpet: '#C9B79A', aisle: 0xC4221D, bar: 0xF0E7D8, text: '#2a2522' }};

function brandTex(txt, color, w = 1024, h = 256, size = 64, logo = true) { return canvasTex(w, h, g => { if (logo) drawLogo(g, h * .35, h * .28, h * .44, color); g.fillStyle = color; g.font = `400 ${size}px Poppins, sans-serif`; g.textBaseline = 'middle'; spaced(g, txt, logo ? h * .95 : w * .08, h / 2, size * .25); }); }

export async function createEventBuild(root, opt = {}) {
  const mode = opt.mode || 'A', cam = opt.cam || mode, C = PAL[opt.pal || mode];
  try { await Promise.all([document.fonts.load('800 80px Poppins'), document.fonts.load('400 40px "DM Mono"')]); } catch (e) { }
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .97;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'; root.appendChild(renderer.domElement);
  const BG = new THREE.Color(C.bg), EVE = new THREE.Color(C.eve);
  const scene = new THREE.Scene(); scene.background = BG.clone(); scene.fog = new THREE.Fog(BG.clone(), 34, 85);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), .03).texture;
  const camera = new THREE.PerspectiveCamera(cam === 'C' ? 40 : 32, 1, .1, 250);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 2, 2); gtao.updateGtaoMaterial({ radius: .55, distanceExponent: 1.8, thickness: 1, scale: 1.1, samples: 16 }); composer.addPass(gtao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), .1, .35, .95); composer.addPass(bloom); composer.addPass(new OutputPass());

  /* luz */
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd2c9b8, .9); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2e0, 3.0); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 }); sun.shadow.bias = -.0003; sun.shadow.normalBias = .02; scene.add(sun, sun.target); sun.target.position.set(8, 0, 5.5);
  const LT = [];   // [luz, intensidad, instante]
  const spot = (x, y, z, tx, ty, tz, i, ang, col, t, sh) => { const s = new THREE.SpotLight(col, 0, 18, ang, .7, 1.4); s.position.set(x, y, z); s.target.position.set(tx, ty, tz); s.castShadow = !!sh; if (sh) { s.shadow.mapSize.set(1024, 1024); s.shadow.bias = -.0005; } scene.add(s, s.target); LT.push([s, i, t]); };
  const point = (x, y, z, i, d, col, t) => { const l = new THREE.PointLight(col, 0, d, 2); l.position.set(x, y, z); scene.add(l); LT.push([l, i, t]); };

  /* materiales */
  const mats = [];
  const M = (o, env = .5) => { const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: .8 }, o)); m.userData.env = env; m.envMapIntensity = env; mats.push(m); return m; };
  const tile = (t, x, y, ox = 0, oy = 0) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(x, y); t.offset.set(ox, oy); return t; };
  const mWall = M({ map: tile(noiseTex(C.wall, .03, 2), 3, 1), roughness: .95 }, .35);
  const mPanel = M({ map: tile(woodTex(C.panel, 5, 1024), 1, 1), roughness: .6 });
  const floorTex = woodTex(C.floor, 7, 56);
  const mStage = M({ color: C.stage, roughness: .55 }, .5), mFascia = M({ color: C.fascia, roughness: .5 }, .5);
  const mChair = M({ map: tile(noiseTex(C.chair, .08, 4), 2, 2), roughness: .95 }, .3), mFrame = M({ color: 0xb8ad9c, roughness: .3, metalness: .85 }, .8);
  const mCarpet = M({ map: tile(noiseTex(C.carpet, .07, 9), 6, 6), roughness: 1 }, .2), mAisle = M({ color: C.aisle, roughness: 1 }, .2);
  const mCloth = M({ color: 0xF5F1E8, roughness: .9, side: THREE.DoubleSide }, .4), mTop = M({ color: 0xF6F3EC, roughness: .6 }, .5);
  const mBar = M({ color: C.bar, roughness: .5 }, .5), mBarTop = M({ map: tile(noiseTex('#e7ded0', .04, 4), 1, 1), roughness: .35 }, .7);
  const mLeaf = M({ color: 0x56693f, roughness: .8 }, .3), mFlower = M({ color: 0xf1ebe0, roughness: .7 }, .3), mFlowerR = M({ color: 0xc9302c, roughness: .6 }, .3), mPot = M({ color: 0xd9d1c3, roughness: .7 }, .4);
  const mGlass = M({ color: 0x9aa7a0, roughness: .1, metalness: .2 }, 1), mCandle = M({ color: 0xfff1d8, emissive: 0xffc77a, emissiveIntensity: 0 }, .3);
  const mTruss = M({ color: 0xcfc8bc, roughness: .35, metalness: .8 }, .8), mLed = M({ color: 0xfff0d2, emissive: 0xffcf8a, emissiveIntensity: 0 }, .2);
  const mTileOff = M({ color: 0x2b2a29, roughness: .3, metalness: .3 }, .8);
  const mCable = new THREE.MeshBasicMaterial({ color: 0x333333 });
  // maqueta: todo empieza en yeso blanco y se colorea al final
  const CLAY = new THREE.Color(0xF2EFE8);

  /* pabellón */
  const hallMat = new THREE.MeshStandardMaterial({ map: tile(noiseTex('#d6d2ca', .05, 3), 30, 30), roughness: .5 });
  const hall = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), hallMat); hall.rotation.x = -Math.PI / 2; hall.receiveShadow = true; scene.add(hall);

  /* registro de piezas */
  const EL = [], P = .03, Wd = 16, Dp = 11, H = 4.6;
  const grp = (x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); return g; };
  const add = (g, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  const piece = (g, mv, a, b, o = {}) => { scene.add(g); EL.push(Object.assign({ g, mv, a, b, home: g.position.clone() }, o)); return g; };
  const cableOn = (g, h, xs) => xs.forEach(x => { const c = add(g, new THREE.CylinderGeometry(.006, .006, 9, 6), mCable, x, h + 4.5, 0); c.castShadow = false; c.userData.cable = 1; });

  // 01 · suelo por filas
  for (let r = 0; r < 11; r++) { const g = grp(Wd / 2, 0, r + .5), t = floorTex.clone(); t.needsUpdate = true; tile(t, 4, 3 / 11, 0, r / 11 * 3);
    add(g, new THREE.BoxGeometry(Wd, P, 1), [mStage, mStage, M({ map: t, roughness: .5 }, .6), mStage, mStage, mStage], 0, P / 2, 0); piece(g, 'lay', .08 + r * .004, .11 + r * .004); }
  // paredes por paneles
  for (let i = 0; i < 8; i++) { const g = grp(1 + i * 2, P, .1); add(g, new THREE.BoxGeometry(1.996, H, .2), mWall, 0, H / 2, 0); piece(g, 'drop', .12 + i * .012, .17 + i * .012, { h: 1.2 }); }
  for (let i = 0; i < 5; i++) { const g = grp(.1, P, .2 + 1.08 + i * 2.16); add(g, new THREE.BoxGeometry(.2, H, 2.156), mWall, 0, H / 2, 0); piece(g, 'drop', .17 + i * .012, .22 + i * .012, { h: 1.2 }); }
  // escenario por módulos que entran deslizándose
  for (let i = 0; i < 6; i++) { const g = grp(4.5 + i * 1.4, P, 1.6); add(g, new THREE.BoxGeometry(1.396, .56, 2.8), mStage, 0, .28, 0); add(g, new THREE.BoxGeometry(1.396, .04, 2.84), mFascia, 0, .58, .0); piece(g, 'slide', .2 + i * .012, .26 + i * .012, { from: [0, 0, 3.2] }); }
  { const g = grp(8, P, 3.25); add(g, new THREE.BoxGeometry(1.4, .2, .5), mStage, 0, .1, 0); add(g, new THREE.BoxGeometry(1.4, .4, .3), mStage, 0, .2, -.1); piece(g, 'slide', .27, .3, { from: [0, 0, 1.2] }); }
  // 03 · pantalla LED: 6 × 4 módulos colocados uno a uno
  const SCR = { x: 8, y: P + 2.8, w: 6.6, h: 3.4 }, tiles = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) { const g = grp(SCR.x - SCR.w / 2 + (c + .5) * 1.1, SCR.y - SCR.h / 2 + (r + .5) * .85, .3); add(g, new THREE.BoxGeometry(1.096, .846, .1), mTileOff, 0, 0, 0); piece(g, 'slide', .28 + (r * 6 + c) * .0032, .30 + (r * 6 + c) * .0032, { from: [0, 0, .7] }); tiles.push(g); }
  const sTex = screenTex(), scrMat = new THREE.MeshStandardMaterial({ map: sTex, emissive: 0xffffff, emissiveMap: sTex, emissiveIntensity: 0, roughness: .2, transparent: true, opacity: 0 });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(SCR.w, SCR.h), scrMat); scr.position.set(SCR.x, SCR.y, .352); scene.add(scr);
  // paneles de madera en la pared
  [[2.2, .23], [13.8, .23]].forEach(([x, z], i) => { const g = grp(x, P + .3, z); add(g, new THREE.BoxGeometry(2, H - .6, .05), mPanel, 0, (H - .6) / 2, 0); piece(g, 'slide', .32 + i * .015, .37 + i * .015, { from: [0, 0, .8] }); });
  [3.6, 9.6].forEach((z, i) => { const g = grp(.23, P + .3, z); add(g, new THREE.BoxGeometry(.05, H - .6, 3.6), mPanel, 0, (H - .6) / 2, 0); piece(g, 'slide', .34 + i * .015, .39 + i * .015, { from: [.8, 0, 0] }); });
  // truss con focos, bajado con cables
  const truss = grp(8, P + 5.15, 1.3); add(truss, new THREE.BoxGeometry(10, .3, .3), mTruss, 0, 0, 0);
  for (let i = 0; i < 7; i++) { const c = add(truss, new THREE.CylinderGeometry(.09, .13, .32, 16), mTruss, -4.5 + i * 1.5, -.3, .1); c.rotation.x = .7; }
  cableOn(truss, 0, [-4.8, 4.8]); piece(truss, 'crane', .38, .46, { h: 4 });
  // barra que entra desde el lateral
  const bar = grp(1.6, P, 6.8); add(bar, new THREE.BoxGeometry(.7, 1.1, 4.6), mBar, 0, .55, 0); add(bar, new THREE.BoxGeometry(.82, .05, 4.72), mBarTop, 0, 1.12, 0);
  const barLed = add(bar, new THREE.BoxGeometry(.02, .02, 4.4), mLed, .37, .06, 0); piece(bar, 'slide', .4, .46, { from: [0, 0, 5.5] });
  const shelf = grp(.42, P, 6.8);
  for (let s = 0; s < 3; s++) { add(shelf, new THREE.BoxGeometry(.3, .03, 4.2), mPanel, 0, 1.3 + s * .55, 0); for (let b = 0; b < 16; b++) add(shelf, new THREE.CylinderGeometry(.035, .035, .26, 10), mGlass, 0, 1.45 + s * .55, -1.95 + b * .26); }
  piece(shelf, 'place', .45, .5, { h: .4 });
  // atril
  const lect = grp(10.6, P + .6, 2.1); add(lect, new THREE.BoxGeometry(.6, 1.15, .45), mFascia, 0, .575, 0); piece(lect, 'place', .44, .48, { h: .5 });

  // 04 · moqueta que se desenrolla y butacas fila a fila
  const carpet = grp(8, P + .006, 3.1); const cm = add(carpet, new THREE.PlaneGeometry(10.4, 6.4), mCarpet, 0, 0, 3.2); cm.rotation.x = -Math.PI / 2; cm.castShadow = false;
  const aisle = add(carpet, new THREE.PlaneGeometry(1.0, 6.4), mAisle, 0, .004, 3.2); aisle.rotation.x = -Math.PI / 2; aisle.castShadow = false;
  piece(carpet, 'unroll', .46, .51);
  const ni = g => g.index ? g.toNonIndexed() : g;
  const seat = new RoundedBoxGeometry(.46, .09, .44, 2, .03).translate(0, .46, 0), back = new RoundedBoxGeometry(.46, .5, .07, 2, .03).translate(0, .78, .2);
  const legs = mergeGeometries([[-.19, -.17], [.19, -.17], [-.19, .17], [.19, .17]].map(([a, b]) => ni(new THREE.CylinderGeometry(.012, .012, .44, 6).translate(a, .22, b))));
  const chairs = new THREE.InstancedMesh(mergeGeometries([mergeGeometries([ni(seat), ni(back)]), legs], true), [mChair, mFrame], 96); chairs.castShadow = chairs.receiveShadow = true; scene.add(chairs);
  const CH = []; for (let r = 0; r < 6; r++) for (let i = 0; i < 16; i++) CH.push([i < 8 ? 3.6 + i * .52 : 8.8 + (i - 8) * .52, 4.1 + r * .92, r, i]);
  // mesas altas, plantas y roll-ups
  const flowers = (g, s, seed) => { const r = rnd(seed); for (let i = 0; i < 26; i++) { const a = r() * 6.28, rr = r() * .13 * s; add(g, new THREE.SphereGeometry((.03 + r() * .025) * s, 8, 6), r() > .72 ? mFlowerR : r() > .4 ? mFlower : mLeaf, Math.cos(a) * rr, r() * .1 * s, Math.sin(a) * rr); } };
  const TB = [[2.6, 9.9], [4.9, 10.1], [11.1, 10.1], [13.4, 9.9], [14.6, 7.6], [14.6, 5.2]];
  TB.forEach(([x, z], k) => { const g = grp(x, P, z);
    add(g, new THREE.CylinderGeometry(.42, .6, 1.08, 40, 1, true), mCloth, 0, .54, 0); add(g, new THREE.CylinderGeometry(.43, .43, .025, 40), mTop, 0, 1.09, 0); add(g, new THREE.CylinderGeometry(.05, .04, .14, 16), mGlass, 0, 1.17, 0);
    const fl = grp(0, 1.27, 0); flowers(fl, 1, 30 + k); g.add(fl); add(g, new THREE.CylinderGeometry(.025, .025, .08, 12), mCandle, .18, 1.14, .08);
    piece(g, 'place', .58 + k * .007, .62 + k * .007, { h: .5 }); point(x, 1.4, z, .18, 1.6, 0xffb866, .84 + k * .006); });
  const plant = (x, z, seed, t) => { const g = grp(x, P, z); add(g, new THREE.CylinderGeometry(.3, .24, .6, 24), mPot, 0, .3, 0); const r = rnd(seed);
    for (let i = 0; i < 160; i++) { const a = r() * 6.28, rr = Math.sqrt(r()) * .45, l = add(g, new THREE.SphereGeometry(.05, 6, 4), r() > .5 ? mLeaf : mFlower, Math.cos(a) * rr, .7 + r() * 1.2 * (1 - rr), Math.sin(a) * rr); l.scale.set(1, .3, 2.2); l.rotation.set(r() * 3, r() * 3, r() * 3); }
    piece(g, 'place', t, t + .04, { h: .6 }); };
  plant(3.4, .9, 3, .6); plant(12.6, .9, 5, .61);
  [[4.4, 3.05], [5.6, 3.05], [10.4, 3.05], [11.6, 3.05]].forEach(([x, z], k) => { const g = grp(x, P + .6, z); flowers(g, 2.4, 60 + k); piece(g, 'place', .62 + k * .004, .645 + k * .004, { h: .3 }); });
  const rT = rollTex(), rolls = [2.2, 13.8].map((x, i) => { const g = grp(x, P, 3.6); add(g, new THREE.BoxGeometry(.9, .08, .3), mFrame, 0, .04, 0); piece(g, 'place', .6, .63, { h: .3 });
    const m = new THREE.MeshStandardMaterial({ map: rT, roughness: .6, side: THREE.DoubleSide }); const me = new THREE.Mesh(new THREE.PlaneGeometry(.86, 2.3), m); me.position.set(x, P + .08 + 1.15, 3.62); me.castShadow = true; scene.add(me); return { me, tex: rT, a: .64 + i * .015, b: .68 + i * .015 }; });

  // 05 · marca instalada como vinilo
  const vinyl = [];
  const vin = (w, h, tex, x, y, z, ry, a, b) => { const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: .6, depthWrite: false }); const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); me.position.set(x, y, z); me.rotation.y = ry; scene.add(me); vinyl.push({ me, tex, w, x, z, ry, a, b }); };
  vin(3.0, .75, brandTex('LAUNCH STUDIO · BAR', C.text), 1.951, P + .6, 6.8, Math.PI / 2, .66, .70);
  vin(.5, .5, canvasTex(512, 512, g => { drawLogo(g, 200, 120, 160, '#ffffff'); g.fillStyle = '#fff'; g.font = '400 44px Poppins, sans-serif'; g.textBaseline = 'middle'; spaced(g, 'LAUNCH', 150, 380, 14); }), 10.6, P + 1.35, 2.326, 0, .68, .71);

  // 06 · luz
  const stageLed = add(grp(0, 0, 0), new THREE.BoxGeometry(8.4, .03, .02), mLed, 8, P + .58, 3.02); scene.add(stageLed.parent);
  [[6.6, 1.9], [8, 2.0], [9.4, 1.9]].forEach(([x, z], i) => spot(x, 4.9, 1.6, x, .6, z + .4, 30, .32, 0xfff0d8, .76 + i * .012, i === 1));
  [[5.2, 6.5], [10.8, 6.5]].forEach(([x, z], i) => spot(x, 4.6, 4.8, x, 0, z + 1, 10, .62, 0xffd6a0, .8 + i * .01));
  [1.6, 4.1, 11.9, 14.4].forEach((x, i) => spot(x, .1, .6, x, 4.2, .3, 8, .5, opt.pal ? 0xffc890 : mode === 'B' ? 0xb8d0a8 : 0xff8a6a, .78 + i * .008));
  [3.6, 9.6].forEach((z, i) => spot(.6, .1, z, .2, 4.2, z, 6, .55, 0xffb870, .8 + i * .01));
  [[3, 9.6], [8, 9.8], [13, 9.6], [14.6, 6.4]].forEach(([x, z], i) => spot(x, 4.4, z, x, 0, z, 8, .55, 0xffcf94, .82 + i * .008));
  point(.6, 2.6, 6.8, 2, 4.5, 0xffc98a, .8);

  // 01 · cinta en el suelo que marca la sala
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0xD93333, roughness: .7 }), tape = [];
  const tapeSeg = (x0, z0, x1, z1, t) => { const len = Math.hypot(x1 - x0, z1 - z0), g = grp(x0, .002, z0); g.rotation.y = -Math.atan2(z1 - z0, x1 - x0); const m = add(g, new THREE.PlaneGeometry(len, .05), tapeMat, len / 2, 0, 0); m.rotation.x = -Math.PI / 2; m.castShadow = false; scene.add(g); tape.push({ g, t }); };
  tapeSeg(0, 0, Wd, 0, .01); tapeSeg(Wd, 0, Wd, Dp, .025); tapeSeg(Wd, Dp, 0, Dp, .04); tapeSeg(0, Dp, 0, 0, .055); tapeSeg(3.8, .2, 12.2, .2, .065); tapeSeg(12.2, .2, 12.2, 3.0, .07); tapeSeg(12.2, 3.0, 3.8, 3.0, .075); tapeSeg(3.8, 3.0, 3.8, .2, .08);

  /* coreografía */
  mats.forEach((m, i) => { m.userData.col = m.color.clone(); m.userData.map = m.map; m.userData.th = .62 + (i % 9) * .012; m.userData.clay = null; });
  const dm = new THREE.Object3D(), clayMode = opt.clay !== undefined ? opt.clay : mode === 'D';
  function placeEl(e, p) { const k = cl((p - e.a) / (e.b - e.a)), g = e.g, h = e.home; g.visible = k > 0; if (!g.visible) return;
    if (e.mv === 'lay') { g.position.set(h.x, h.y + (1 - io(k)) * .25, h.z); return; }
    if (e.mv === 'drop' || e.mv === 'crane') g.position.set(h.x, h.y + (1 - io(k)) * e.h, h.z);
    else if (e.mv === 'place') g.position.set(h.x, h.y + (1 - out(k)) * e.h, h.z);
    else if (e.mv === 'slide') { const q = 1 - out(k); g.position.set(h.x + e.from[0] * q, h.y + e.from[1] * q, h.z + e.from[2] * q); }
    else if (e.mv === 'unroll') { g.scale.set(1, 1, Math.max(.0001, io(k))); }
    g.traverse(c => { if (c.userData.cable) c.visible = e.mv === 'crane' && k < 1; }); }

  /* cámara: cada versión tiene su encuadre y apenas se mueve */
  let W = 1, Hh = 1;
  function shot(p) { const asp = W / Hh, far = Math.pow(Math.max(1, 1.3 / asp), .85), c = io(cl(p / .9));
    const orbit = (R, pol, az, tx, ty, tz) => { camera.position.set(tx + R * Math.sin(pol) * Math.sin(az), ty + R * Math.cos(pol), tz + R * Math.sin(pol) * Math.cos(az)); camera.lookAt(tx, ty, tz); };
    if (cam === 'A') orbit((24 - 2 * c) * far, .9 + .08 * c, .7 - .06 * c, 8, .4, 5.4);
    else if (cam === 'B') { const t = io(cl((p - .78) / .12)); orbit((22 + 2 * (1 - t)) * far, .02 + .92 * t, .5 * t, 8, .2, 5.6); }
    else if (cam === 'C') { const z = lerp(14.5, 9.6, c); camera.position.set(8 + .25 * Math.sin(p * 3), 1.95, z * Math.max(1, far * .9)); camera.lookAt(8, 1.7 - .2 * c, 1.0); }
    else if (cam === 'D') orbit((25 - 2.5 * c) * far, .74 + .12 * c, -.62 + .08 * c, 8, .2, 5.6);
    else if (cam === 'F') { camera.position.set(lerp(15.2, 14.6, c) * Math.max(1, far * .9), 2.4, lerp(11.8, 10.6, c) * Math.max(1, far * .9)); camera.lookAt(7.2, 1.0, 4.2); }
    else orbit((19 - 1.5 * c) * far, 1.12 - .05 * c, .0, 8, 1.4, 4.2); }

  function resize() { W = root.clientWidth || 1; Hh = root.clientHeight || 1; renderer.setSize(W, Hh, false); composer.setSize(W, Hh); camera.aspect = W / Hh; camera.updateProjectionMatrix(); }
  resize();
  let last = 0;
  function set(p) { last = p;
    tape.forEach(s => { const k = io(cl((p - s.t) / .025)); s.g.scale.set(Math.max(.0001, k), 1, 1); s.g.visible = k > 0 && p < .14; });
    EL.forEach(e => placeEl(e, p));
    // butacas: fila a fila desde el escenario, cada una se posa en su sitio
    CH.forEach(([x, z, r, i], n) => { const t0 = .49 + r * .016 + (i % 8) * .0011 + (i >= 8 ? .004 : 0), k = cl((p - t0) / .02), q = 1 - out(k);
      dm.position.set(x, P + q * .35, z); dm.rotation.set(0, 0, 0); dm.scale.setScalar(k > 0 ? 1 : .0001); dm.updateMatrix(); chairs.setMatrixAt(n, dm.matrix); });
    chairs.instanceMatrix.needsUpdate = true;
    // roll-ups: la lona sube desde la base
    rolls.forEach(r => { const k = soft(cl((p - r.a) / (r.b - r.a))); r.me.visible = k > 0; r.me.scale.y = Math.max(.0001, k); r.me.position.y = P + .08 + 1.15 * k; r.tex.repeat.set(1, k); r.tex.offset.set(0, 1 - k); });
    vinyl.forEach(v => { const k = soft(cl((p - v.a) / (v.b - v.a))); v.me.visible = k > 0; v.me.scale.x = Math.max(.0001, k); v.tex.repeat.set(k, 1);
      const off = v.w / 2 * (1 - k); if (v.ry) v.me.position.z = v.z + off; else v.me.position.x = v.x - off; });
    // la pantalla se enciende cuando todos los módulos están colgados
    const on = soft(cl((p - .7) / .04)); scrMat.opacity = on; scrMat.emissiveIntensity = .55 * on;
    // maqueta (D): yeso blanco hasta que llega el color
    if (clayMode) mats.forEach(m => { const c = p < m.userData.th; if (c === m.userData.clay) return; m.userData.clay = c; m.map = c ? null : m.userData.map; m.color.copy(c ? CLAY : m.userData.col); m.needsUpdate = true; });
    // luz: de la mañana de montaje a la tarde del evento
    const amb = soft(cl((p - .74) / .14));
    LT.forEach(([l, i, t]) => l.intensity = i * soft(cl((p - t) / .05)));
    mLed.emissiveIntensity = 2.2 * soft(cl((p - .76) / .06)); mCandle.emissiveIntensity = 1.6 * soft(cl((p - .84) / .04));
    const dusk = opt.dusk !== undefined ? opt.dusk : mode === 'A' ? 1 : .75;
    scene.background.copy(BG).lerp(EVE, amb * .92 * dusk); scene.fog.color.copy(scene.background); hallMat.color.setRGB(1, 1, 1).lerp(EVE, amb * .8 * dusk);
    hemi.intensity = lerp(.9, .2, amb * dusk); sun.intensity = lerp(3.0, .25, amb * dusk);
    if (cam === 'A' && !opt.pal) { const a = lerp(-.4, 1.25, cl(p / .86)); sun.position.set(8 + 20 * Math.cos(a), 6 + 16 * Math.sin(Math.min(a + .5, 2.6)), 5.5 + 14); sun.color.setHSL(.09, .5 * cl(p / .86), .95 - .1 * cl(p / .86)); }
    else sun.position.set(-9, 20, 17);
    mats.forEach(m => m.envMapIntensity = m.userData.env * lerp(1, .3, amb));
    renderer.toneMappingExposure = lerp(.97, 1.06, amb); bloom.strength = .05 + .15 * amb;
    shot(p); composer.render(); return amb * dusk > .55; }
  return { set, resize: () => { resize(); set(last); } };
}
