// «El stand se construye mientras bajas»: una sola línea de tiempo (0 → 1) que monta el stand pieza a pieza.
// El scroll es la línea de tiempo: todo es reversible y nada se dispara por su cuenta.
// Cinco coreografías sobre el mismo stand:
//   A · Montaje       piezas que bajan, se deslizan y encajan en su sitio, cámara de fotógrafo que se va asentando
//   B · Extrusión     el plano visto desde arriba se levanta y el material sube como una pasada de escáner
//   C · Despiece      axonometría técnica: el stand aparece despiezado por capas y baja capa a capa
//   D · A pie de pasillo  cámara a la altura de los ojos, fija como un trípode; el stand se monta delante
//   E · Manual        cada pieza dibuja primero su trayectoria (origen → destino) y luego la recorre
import * as THREE from './vendor/three/three.module.min.js';
import { RoomEnvironment } from './vendor/three/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from './vendor/three/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from './vendor/three/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/three/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from './vendor/three/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from './vendor/three/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/three/jsm/postprocessing/OutputPass.js';
import { cl, lerp, rnd, woodTex, noiseTex, wallGfxTex, counterGfxTex, columnGfxTex, leafTex } from './stand-tex.js';

// Curvas de movimiento: una sola familia, sin rebotes ni excesos.
const io = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;   // estructura: arranca y frena despacio
const out = x => 1 - Math.pow(1 - x, 4);                                    // mobiliario: llega y se posa
const soft = x => x * x * (3 - 2 * x);                                      // luz y gráfica
const DAY = new THREE.Color(0xF4F3EE), EVE = new THREE.Color(0x24211e);

export async function createBuild(root, opt = {}) {
  const mode = opt.mode || 'A', img = opt.imgBase || '../assets/img/';
  try { await Promise.all([document.fonts.load('400 80px Poppins'), document.fonts.load('800 80px Poppins')]); } catch (e) { }
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.localClippingEnabled = true;
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'; root.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = DAY.clone(); scene.fog = new THREE.Fog(DAY.clone(), 26, 70);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), .03).texture;
  const persp = new THREE.PerspectiveCamera(mode === 'D' ? 30 : 32, 1, .1, 200);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 200);
  const camera = mode === 'C' ? ortho : persp;
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 }));
  const rp = new RenderPass(scene, camera); composer.addPass(rp);
  const gtao = new GTAOPass(scene, camera, 2, 2); gtao.updateGtaoMaterial({ radius: .45, distanceExponent: 1.8, thickness: 1, scale: 1.1, samples: 16 }); gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 }); composer.addPass(gtao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), .12, .35, .96); composer.addPass(bloom); composer.addPass(new OutputPass());

  /* ── Luz ── */
  const hemi = new THREE.HemisphereLight(0xffffff, 0xcdc6b6, .85); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e6, 3.2); sun.position.set(-7, 15, 13); sun.target.position.set(5, 0, 3.5);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 45 }); sun.shadow.bias = -.0003; sun.shadow.normalBias = .02; sun.shadow.radius = 5;
  scene.add(sun, sun.target);
  const lights = [];   // [luz, intensidad, instante en que se enciende]
  const spotAt = (x, z, tx, tz, i, t, sh) => { const s = new THREE.SpotLight(0xffd6a2, 0, 9, .5, .8, 1.5); s.position.set(x, 3.0, z); s.target.position.set(tx, 0, tz); s.castShadow = !!sh; if (sh) { s.shadow.mapSize.set(1024, 1024); s.shadow.bias = -.0005; } scene.add(s, s.target); lights.push([s, i, t]); };
  const pointAt = (x, y, z, i, d, t) => { const l = new THREE.PointLight(0xffcf96, 0, d, 2); l.position.set(x, y, z); scene.add(l); lights.push([l, i, t]); };

  /* ── Materiales ── */
  const all = [];
  const M = (o, env = .5) => { const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: .8, metalness: 0 }, o)); m.userData.env = env; m.envMapIntensity = env; all.push(m); return m; };
  const tile = (t, x, y, ox = 0, oy = 0) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(x, y); t.offset.set(ox, oy); return t; };
  const mBlack = M({ color: 0x1f1e1c, roughness: .55 }, .35);
  const mWood = M({ map: tile(woodTex([196, 152, 102], 5, 1024), 1, 1), roughness: .6 });
  const slatTex = tile(woodTex([206, 164, 112], 9, 1024), .3, 1), mSlat = M({ map: slatTex, roughness: .55 });
  const floorTex = woodTex([226, 205, 172], 7, 60);
  const mStone = M({ map: tile(noiseTex('#d9cfbe', .05, 3, 6), 1, 1), roughness: .6 }, .55), mStoneTop = M({ map: tile(noiseTex('#e3dacb', .04, 4, 4), 1, 1), roughness: .35 }, .7);
  const mFabric = M({ map: tile(noiseTex('#dcd3c4', .07, 8), 2, 2), roughness: .95 }, .4), mTable = M({ color: 0xcdbfa8, roughness: .45 }, .6);
  const mMetal = M({ color: 0x1a1a1a, roughness: .3, metalness: .85 }, .8), mPot = M({ color: 0x1c1b1a, roughness: .7 }, .3), mTrunk = M({ color: 0x6b5a45, roughness: .9 }, .3);
  const mFrame = M({ color: 0x0f0f0f, roughness: .25, metalness: .3 }, .9), mLaptop = M({ color: 0xb9b9bb, roughness: .3, metalness: .8 }, .8);
  const mGlass = M({ color: 0xf0e7d6, roughness: .2, emissive: 0xffd9a0, emissiveIntensity: 0 }, .6);
  const mLed = M({ color: 0xfff0d2, emissive: 0xffcf8a, emissiveIntensity: 0 }, .2);
  const mCable = new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0 });

  /* ── Pabellón ── */
  const hallMat = new THREE.MeshStandardMaterial({ map: tile(noiseTex('#cfccc5', .06, 2), 26, 26), roughness: .42 }); hallMat.userData.env = .9;
  const hall = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), hallMat); hall.rotation.x = -Math.PI / 2; hall.receiveShadow = true; scene.add(hall);
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xfff3dc, transparent: true, opacity: 0, fog: false });
  for (let i = -6; i <= 8; i++) for (let j = -6; j <= 4; j++) { const d = new THREE.Mesh(new THREE.CircleGeometry(.09, 16), hlMat); d.rotation.x = Math.PI / 2; d.position.set(5 + i * 3.2, 10.5, 3.5 + j * 3.2); scene.add(d); }

  /* ── Registro de piezas: cada una sabe de dónde viene, cuándo llega y con qué peso ── */
  const P = .12, H = 3.0, EL = [];
  const shadowOn = o => o.traverse(c => { if (c.isMesh) { c.castShadow = c.userData.noCast ? false : true; c.receiveShadow = true; } });
  // piece(grupo en su posición final, tipo de movimiento, ventana [a, b] de la línea de tiempo, opciones)
  const piece = (g, mv, a, b, o = {}) => { shadowOn(g); scene.add(g); const e = Object.assign({ g, mv, a, b, home: g.position.clone(), rot: g.rotation.y, layer: 0 }, o); EL.push(e); return e; };
  const grp = (x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); return g; };
  const add = (g, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  const cable = (g, h) => { const c = add(g, new THREE.CylinderGeometry(.006, .006, 8, 6), mCable, 0, h + 4, 0); c.userData.noCast = true; c.userData.cable = 1; return c; };

  // 01 · tarima: se coloca por filas, del fondo hacia el pasillo
  for (let r = 0; r < 7; r++) { const g = grp(5, 0, -.1 + r * 1.03 + .515), t = floorTex.clone(); t.needsUpdate = true; tile(t, 2.4, 1.7 / 7, 0, r / 7 * 1.7);
    add(g, new THREE.BoxGeometry(10.2, P, 1.03), [mBlack, mBlack, M({ map: t, roughness: .5 }, .6), mBlack, mBlack, mBlack], 0, P / 2, 0);
    piece(g, 'lay', .10 + r * .008, .135 + r * .008, { layer: 0, cat: 'floor' }); }
  // 02 · columnas: bajan colgadas y se anclan
  [[.22, 6.78], [9.78, 6.78], [9.78, .22]].forEach(([x, z], i) => { const g = grp(x, P, z); add(g, new THREE.BoxGeometry(.42, H + .45, .42), mBlack, 0, (H + .45) / 2, 0); cable(g, H + .45); piece(g, 'crane', .16 + i * .018, .23 + i * .018, { h: 4.2, layer: 2, cat: 'struct' }); });
  // paneles de pared de 1,2 m: cada uno baja a su carril
  const panels = [];
  for (let i = 0; i < 4; i++) panels.push([.07, .14 + .575 + i * 1.15, .14, 1.15, mBlack]);          // lateral, de delante hacia el fondo
  for (let i = 0; i < 3; i++) panels.push([.6 + i * 1.2, .07, 1.2, .14, mBlack]);                     // fondo, izquierda
  for (let i = 0; i < 4; i++) panels.push([4.1 + i * 1.0, .07, 1.0, .14, mWood]);                     // fondo, madera
  for (let i = 0; i < 2; i++) panels.push([8.2 + i * 1.2, .07, 1.2, .14, mBlack]);                    // fondo, derecha
  panels.forEach(([x, z, w, d, m], i) => { const g = grp(x, P, z); add(g, new THREE.BoxGeometry(w - .004, H, d - .004), m, 0, H / 2, 0); piece(g, 'drop', .19 + i * .0075, .235 + i * .0075, { h: .9, layer: 2, cat: 'struct' }); });
  // 03 · techo perimetral: suspendido y bajado con cables
  const RH = .45;
  [[10.2, .5, 5, 6.8], [10.2, .5, 5, .2], [.5, 6.2, .2, 3.5], [.5, 6.2, 9.8, 3.5]].forEach(([w, d, x, z], i) => { const g = grp(x, P + H + RH / 2, z); add(g, new THREE.BoxGeometry(w, RH, d), mBlack, 0, 0, 0);
    [-1, 1].forEach(s => { const c = add(g, new THREE.CylinderGeometry(.006, .006, 8, 6), mCable, s * (w > d ? w / 2 - .3 : 0), 4, s * (w > d ? 0 : d / 2 - .3)); c.userData.noCast = true; c.userData.cable = 1; });
    piece(g, 'crane', .30 + i * .02, .40 + i * .02, { h: 3.6, layer: 3, cat: 'roof' }); });
  // lamas de madera y celosía: se fijan una a una
  const slatG = grp(0, P, 0), slats = new THREE.InstancedMesh(new THREE.BoxGeometry(.045, H - .02, .06), mSlat, 36); slatG.add(slats); piece(slatG, 'instances', .35, .45, { n: 36, pos: i => [3.65 + i * .11, (H - .02) / 2, .17], from: [0, 0, .7], layer: 2, cat: 'arch' });
  const finG = grp(0, P, 0), fins = new THREE.InstancedMesh(new THREE.BoxGeometry(.06, H - .05, .22), mSlat, 22); finG.add(fins); piece(finG, 'instances', .39, .47, { n: 22, pos: i => [9.55, (H - .05) / 2, 1.0 + i * .16], from: [.8, 0, 0], layer: 2, cat: 'arch' });
  // mostrador: entra deslizándose desde el pasillo
  const ctr = grp(2.5, P, 5.35); add(ctr, new THREE.BoxGeometry(3.1, .98, .72), mStone, 0, .04 + .49, 0); add(ctr, new THREE.BoxGeometry(3.22, .05, .8), mStoneTop, 0, 1.045, -.02); add(ctr, new THREE.BoxGeometry(3.0, .04, .62), mBlack, 0, .02, .03);
  const ctrLed = add(ctr, new THREE.BoxGeometry(3.0, .02, .02), mLed, 0, .06, .37);
  piece(ctr, 'slide', .40, .48, { from: [-3.2, 0, 1.4], layer: 2, cat: 'arch' });
  // pantalla: se acerca a la pared y se cuelga
  const scrG = grp(5.6, P + 1.78, .24); add(scrG, new THREE.BoxGeometry(2.3, 1.32, .07), mFrame, 0, 0, 0);
  const scrTex = new THREE.TextureLoader().load(img + 'servicios/render-casa.jpg', () => redraw()); scrTex.colorSpace = THREE.SRGBColorSpace;
  const scrMat = new THREE.MeshStandardMaterial({ map: scrTex, color: 0x070707, emissive: 0xffffff, emissiveMap: scrTex, emissiveIntensity: 0, roughness: .15 });
  add(scrG, new THREE.PlaneGeometry(2.2, 1.24), scrMat, 0, 0, .037);
  piece(scrG, 'slide', .45, .50, { from: [0, -.12, .55], layer: 2, cat: 'arch' });

  // 04 · mobiliario: mesas, sillas, olivos y objetos
  const chairGroup = (x, z, ry) => { const g = grp(x, P, z); g.rotation.y = ry;
    add(g, new RoundedBoxGeometry(.5, .1, .48, 3, .04), mFabric, 0, .47, 0);
    const bk = add(g, new THREE.CylinderGeometry(.27, .26, .4, 28, 1, true, Math.PI * .7, Math.PI * .6), mFabric, 0, .7, 0); bk.material = mFabric.clone(); bk.material.side = THREE.DoubleSide; all.push(bk.material); bk.material.userData.env = .4;
    [[-.2, -.18], [.2, -.18], [-.2, .18], [.2, .18]].forEach(([a, b]) => { const l = add(g, new THREE.CylinderGeometry(.012, .01, .43, 8), mMetal, a, .215, b); l.rotation.set(-b * .25, 0, a * .25); });
    return g; };
  const TB = [[5.3, 3.4], [7.5, 2.5], [7.2, 4.9]];
  TB.forEach(([x, z], k) => { const g = grp(x, P, z);
    add(g, new THREE.CylinderGeometry(.42, .42, .035, 40), mTable, 0, .748, 0); add(g, new THREE.CylinderGeometry(.05, .07, .71, 20), mTable, 0, .375, 0); add(g, new THREE.CylinderGeometry(.24, .26, .03, 32), mTable, 0, .015, 0);
    piece(g, 'place', .50 + k * .02, .56 + k * .02, { h: .45, layer: 1, cat: 'furn' });
    for (let c = 0; c < 3; c++) { const a = c / 3 * Math.PI * 2 + .5, ch = chairGroup(x + Math.sin(a) * .72, z + Math.cos(a) * .72, a + Math.PI);
      piece(ch, 'tuck', .53 + k * .02 + c * .008, .59 + k * .02 + c * .008, { push: .38, ang: a, layer: 1, cat: 'furn' }); }
    const lg = grp(x, P + .765, z); add(lg, new THREE.CylinderGeometry(.012, .012, .22, 8), mMetal, 0, .11, 0); add(lg, new THREE.CylinderGeometry(.1, .1, .07, 24), mGlass, 0, .245, 0);
    piece(lg, 'place', .61 + k * .006, .635 + k * .006, { h: .25, layer: 1, cat: 'small' });
    pointAt(x, 1.1, z, .35, 1.8, .82 + k * .015); });
  const lm = leafTex(), leafMat = M({ map: lm, alphaTest: .45, side: THREE.DoubleSide, roughness: .7 }, .4), leafDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: lm, alphaTest: .45 });
  const tree = (x, z, s, seed, t) => { const g = grp(x, P, z); add(g, new THREE.BoxGeometry(.62 * s, .62, .62 * s), mPot, 0, .31, 0);
    const r = rnd(seed), tops = [];
    for (let b = 0; b < 4; b++) { const a = b / 4 * 6.28 + r(), tl = .25 + r() * .25, len = (1.1 + r() * .6) * s;
      const br = add(g, new THREE.CylinderGeometry(.018, .035, len, 8), mTrunk, Math.sin(a) * Math.sin(tl) * len / 2, .62 + len / 2 * Math.cos(tl), Math.cos(a) * Math.sin(tl) * len / 2); br.rotation.set(Math.cos(a) * tl, 0, -Math.sin(a) * tl);
      tops.push([Math.sin(a) * Math.sin(tl) * len, .62 + len * Math.cos(tl), Math.cos(a) * Math.sin(tl) * len]); }
    const N = 1500, im = new THREE.InstancedMesh(new THREE.PlaneGeometry(.15, .045), leafMat, N), col = new THREE.Color(), d = new THREE.Object3D();
    for (let i = 0; i < N; i++) { const tp = tops[i % 4], rr = Math.pow(r(), .6) * .42 * s, u = r() * 6.28, v = Math.acos(2 * r() - 1);
      d.position.set(tp[0] + rr * Math.sin(v) * Math.cos(u), tp[1] + rr * Math.cos(v) * .8, tp[2] + rr * Math.sin(v) * Math.sin(u)); d.rotation.set(r() * 3.14, r() * 3.14, r() * 3.14); d.scale.setScalar(.7 + r() * .6); d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.setColorAt(i, col.setHSL(.22 + r() * .05, .18 + r() * .15, .55 + r() * .25)); }
    im.customDepthMaterial = leafDepth; g.add(im); piece(g, 'crane', t, t + .07, { h: 1.6, layer: 1, cat: 'furn', ry: .4 }); };
  tree(.62, 6.15, 1.05, 11, .56); tree(9.0, 5.9, 1, 23, .58); tree(8.7, 1.2, .9, 37, .6);
  const lap = grp(2.9, P + 1.07, 5.2); add(lap, new RoundedBoxGeometry(.36, .012, .25, 2, .005), mLaptop, 0, .006, 0); const lid = add(lap, new THREE.BoxGeometry(.36, .23, .008), mLaptop, 0, .12, -.12); lid.rotation.x = -.25;
  piece(lap, 'place', .62, .645, { h: .2, layer: 1, cat: 'small' });
  const vase = grp(1.6, P + 1.07, 5.2); add(vase, new THREE.CylinderGeometry(.06, .05, .22, 24), mGlass, 0, .11, 0); piece(vase, 'place', .625, .645, { h: .2, layer: 1, cat: 'small' });

  // 05 · marca: la gráfica se instala como un vinilo, de un borde al otro
  const brand = [];
  const vinyl = (w, h, tex, x, y, z, dir, a, b) => { const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: .6, depthWrite: false }); m.userData.env = .4; all.push(m);
    const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); me.position.set(x, P + y, z); scene.add(me); brand.push({ me, tex, w, h, x, y: P + y, dir, a, b }); };
  vinyl(2.4, 2.4, wallGfxTex(), 1.75, 1.75, .142, 'x', .64, .70);
  vinyl(2.4, .6, counterGfxTex(), 2.5, .55, 5.712, 'x', .68, .72);
  vinyl(.42, 2.52, columnGfxTex(), 9.78, 1.75, 6.992, 'y', .70, .75);

  // 06 · luz: tiras LED que se encienden de un extremo a otro
  const strips = [];
  const strip = (len, x, y, z, axis, a, b) => { const g = grp(x, y, z), m = add(g, axis === 'x' ? new THREE.BoxGeometry(len, .02, .03) : new THREE.BoxGeometry(.03, .02, len), mLed.clone(), axis === 'x' ? len / 2 : 0, 0, axis === 'x' ? 0 : len / 2); m.userData.noCast = true; all.push(m.material); m.material.userData.env = .2; scene.add(g); strips.push({ g, m, axis, a, b }); };
  strip(9.2, .4, P + H + .0, 6.54, 'x', .75, .80); strip(9.2, .4, P + H, .46, 'x', .76, .81); strip(5.8, .46, P + H, .6, 'z', .77, .82); strip(5.8, 9.54, P + H, .6, 'z', .78, .83);
  strip(4.0, 3.6, P + H - .04, .21, 'x', .78, .82); strip(3.0, 1.0, P + .06, 5.72, 'x', .79, .83);
  spotAt(4.6, .9, 4.9, .3, 18, .80, true); spotAt(6.6, .9, 6.3, .3, 18, .81); spotAt(2.4, 4.2, 2.5, 5.3, 18, .82, true); spotAt(7.0, 3.6, 7.2, 4.2, 18, .83); spotAt(1.4, 1.0, 1.2, .2, 18, .84);
  [[2, 6.4], [5, 6.4], [8, 6.4], [9.4, 3], [.6, 3]].forEach(([x, z], i) => pointAt(x, 2.85, z, 1.4, 4, .76 + i * .012));

  /* ── Huella en el suelo (fase 1): cinta adhesiva sobre el pabellón ── */
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0xD93333, roughness: .7 }), tape = [];
  const tapeSeg = (x0, z0, x1, z1, t) => { const len = Math.hypot(x1 - x0, z1 - z0), g = grp(x0, .002, z0); g.rotation.y = -Math.atan2(z1 - z0, x1 - x0); const m = add(g, new THREE.PlaneGeometry(len, .05), tapeMat, len / 2, 0, 0); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; scene.add(g); tape.push({ g, t }); };
  tapeSeg(-.1, -.1, 10.1, -.1, .015); tapeSeg(10.1, -.1, 10.1, 7.1, .035); tapeSeg(10.1, 7.1, -.1, 7.1, .055); tapeSeg(-.1, 7.1, -.1, -.1, .075);
  const marks = new THREE.Group(); scene.add(marks); const markMat = new THREE.MeshBasicMaterial({ color: 0x0b0b0b, transparent: true, opacity: 0 });
  [[-.1, -.1], [10.1, -.1], [10.1, 7.1], [-.1, 7.1]].forEach(([x, z]) => { [[.4, .02], [.02, .4]].forEach(([w, d]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), markMat); m.rotation.x = -Math.PI / 2; m.position.set(x, .003, z); marks.add(m); }); });

  /* ── Trayectorias (opción E): una línea a trazos de origen a destino ── */
  const paths = [];
  if (mode === 'E') EL.forEach(e => { if (e.cat === 'floor' || e.mv === 'instances') return;
    const a = fromPos(e, 0), b = e.home.clone(); if (a.distanceTo(b) < .05) return;
    const mid = a.clone().lerp(b, .5); if (e.mv === 'slide') mid.y += .4;
    const c = new THREE.QuadraticBezierCurve3(a, mid, b), geo = new THREE.BufferGeometry().setFromPoints(c.getPoints(30));
    const ln = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: 0xD93333, dashSize: .12, gapSize: .08, transparent: true, opacity: 0, depthTest: false })); ln.computeLineDistances(); ln.renderOrder = 5; scene.add(ln);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(.05, 12, 8), new THREE.MeshBasicMaterial({ color: 0xD93333, transparent: true, opacity: 0, depthTest: false })); dot.position.copy(b); dot.renderOrder = 6; scene.add(dot);
    paths.push({ e, ln, dot, n: geo.attributes.position.count }); });

  // Opción B: el material sube como un escáner por encima de las aristas
  const scan = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), edges = [];
  if (mode === 'B') {
    all.forEach(m => m.clippingPlanes = [scan]);
    const em = new THREE.LineBasicMaterial({ color: 0x0b0b0b, transparent: true, opacity: .85 });
    EL.forEach(e => e.g.traverse(c => { if (c.isMesh && !c.isInstancedMesh && !c.userData.cable && c.geometry.parameters && !(c.material === leafMat)) { const l = new THREE.LineSegments(new THREE.EdgesGeometry(c.geometry, 30), em); c.add(l); edges.push(l); } }));
    edges.mat = em; }

  /* ── Coreografía ── */
  const dm = new THREE.Object3D();
  function fromPos(e, k) {   // posición de la pieza con avance k (0 = origen, 1 = sitio final)
    const h = e.home, v = h.clone();
    if (e.mv === 'crane') v.y += (1 - io(k)) * e.h;
    else if (e.mv === 'drop') v.y += (1 - io(k)) * e.h;
    else if (e.mv === 'place') v.y += (1 - out(k)) * e.h;
    else if (e.mv === 'slide') v.set(h.x + e.from[0] * (1 - out(k)), h.y + e.from[1] * (1 - out(k)), h.z + e.from[2] * (1 - out(k)));
    else if (e.mv === 'tuck') { const q = 1 - out(k); v.set(h.x + Math.sin(e.ang) * e.push * q, h.y, h.z + Math.cos(e.ang) * e.push * q); }
    return v; }
  // Opción C: capas del despiece y su orden de bajada
  const EXPL = [0, 2.0, 4.2, 6.6], DESC = [[0, 0], [.47, .56], [.52, .62], [.58, .68]];
  function place(e, p) {
    const g = e.g;
    if (mode === 'B') { const k = io(cl((p - (e.a - .04)) / (e.b - e.a + .06))); g.visible = k > 0; g.position.copy(e.home); g.scale.set(1, Math.max(.0001, k), 1); if (e.mv === 'instances') setInst(e, 1); return; }
    let k = cl((p - e.a) / (e.b - e.a));
    if (mode === 'C') {   // llega a su capa del despiece y luego baja con su capa
      const L = e.layer, arr = cl((p - (e.a * .72 + .02)) / ((e.b - e.a) * .8)), dn = io(cl((p - DESC[L][0]) / Math.max(.001, DESC[L][1] - DESC[L][0])));
      const ex = L ? EXPL[L] * (1 - dn) : 0; e.mv === 'instances' ? setInst(e, arr) : 0;
      const pos = e.mv === 'instances' ? e.home : fromPos(e, arr); g.position.set(pos.x, pos.y + ex, pos.z); g.visible = arr > 0; g.scale.set(1, 1, 1);
      if (e.mv === 'lay') { g.scale.set(1, 1, Math.max(.0001, io(arr))); }
      cables(g, 0); return; }
    if (e.mv === 'lay') { g.visible = k > 0; g.position.copy(e.home); g.position.y = e.home.y + (1 - io(k)) * .25; return; }
    if (e.mv === 'instances') { g.visible = k > 0; setInst(e, k); return; }
    g.visible = k > 0; g.position.copy(fromPos(e, k)); if (e.mv === 'tuck') g.rotation.y = e.rot + (1 - out(k)) * .35; if (e.ry) g.rotation.y = e.ry * (1 - io(k));
    cables(g, e.mv === 'crane' && k > 0 && k < 1 ? Math.min(1, Math.min(k * 6, (1 - k) * 6)) : 0); }
  function cables(g, o) { g.traverse(c => { if (c.userData.cable) c.visible = o > 0; }); mCable.opacity = 1; }
  function setInst(e, k) { const inst = e.g.children[0], n = e.n; for (let i = 0; i < n; i++) { const loc = cl((k * (n + 8) - i) / 8), w = out(loc), p0 = e.pos(i);
    dm.position.set(p0[0] + e.from[0] * (1 - w), p0[1] + e.from[1] * (1 - w), p0[2] + e.from[2] * (1 - w)); dm.scale.setScalar(loc > 0 ? 1 : .0001); dm.updateMatrix(); inst.setMatrixAt(i, dm.matrix); } inst.instanceMatrix.needsUpdate = true; }

  /* ── Cámara: un fotógrafo que va afinando el encuadre ── */
  const T = new THREE.Vector3(5, .7, 3.5); let W = 1, Hh = 1;
  function shot(p) {
    const asp = W / Hh, far = Math.pow(Math.max(1, 1.3 / asp), .85), c = io(cl(p / .9));
    if (mode === 'C') { const s = 5.4 * far * (1 - .05 * c); ortho.left = -s * asp; ortho.right = s * asp; ortho.top = s; ortho.bottom = -s; ortho.updateProjectionMatrix();
      const az = .72 + .06 * c, pol = .98; ortho.position.set(T.x + 30 * Math.sin(pol) * Math.sin(az), 2.6 + 30 * Math.cos(pol), T.z + 30 * Math.sin(pol) * Math.cos(az)); ortho.lookAt(T.x, 2.2 - 1.2 * cl((p - .45) / .3), T.z); return; }
    let R, pol, az, ty = T.y - (asp < 1 ? .6 : .2);
    if (mode === 'B') { const t = io(cl((p - .05) / .3)); R = 15.6 * (1 + .2 * (1 - t)) * far; pol = .02 + 1.0 * t; az = .62 * t - .04 * c; }
    else if (mode === 'D') { const f = Math.max(1, far); persp.position.set(5 + (11.5 - .5 * c) * f, 1.62, 3.4 + (11.6 - .6 * c) * f); persp.lookAt(5.0, 1.35 - .12 * c, 3.2); return; }
    else if (mode === 'E') { R = (19 - 2.6 * c) * far; pol = .72 + .24 * c; az = .5 + .1 * c; }
    else { R = (18.2 - 2.4 * c) * far; pol = .78 + .2 * c; az = .46 + .16 * c; }
    persp.position.set(T.x + R * Math.sin(pol) * Math.sin(az), T.y + R * Math.cos(pol), T.z + R * Math.sin(pol) * Math.cos(az)); persp.lookAt(T.x, ty, T.z); }

  function resize() { W = root.clientWidth || 1; Hh = root.clientHeight || 1; renderer.setSize(W, Hh, false); composer.setSize(W, Hh); persp.aspect = W / Hh; persp.updateProjectionMatrix(); }
  resize();
  let last = 0;
  function set(p) {
    last = p;
    // 1 · espacio vacío: la cinta marca dónde irá el stand
    tape.forEach(s => { const k = io(cl((p - s.t) / .03)); s.g.scale.set(Math.max(.0001, k), 1, 1); s.g.visible = k > 0 && p < .2; });
    markMat.opacity = cl((p - .08) / .02) * (1 - cl((p - .14) / .03));
    // 2-4 · piezas
    EL.forEach(e => place(e, p));
    if (mode === 'B') { const y = lerp(-.05, 4.4, io(cl((p - .5) / .14))); scan.constant = y; edges.mat.opacity = .85 * (1 - cl((p - .58) / .1)); }
    // 5 · marca
    brand.forEach(b => { const k = soft(cl((p - b.a) / (b.b - b.a))); b.me.visible = k > 0; if (!b.me.visible) return;
      if (b.dir === 'x') { b.me.scale.set(Math.max(.0001, k), 1, 1); b.me.position.x = b.x - b.w / 2 * (1 - k); b.tex.repeat.set(k, 1); b.tex.offset.set(0, 0); }
      else { b.me.scale.set(1, Math.max(.0001, k), 1); b.me.position.y = b.y - b.h / 2 * (1 - k); b.tex.repeat.set(1, k); b.tex.offset.set(0, 0); } });
    scrMat.emissiveIntensity = .9 * soft(cl((p - .72) / .04)); scrMat.color.setScalar(lerp(.03, 1, soft(cl((p - .72) / .04))));
    // 6 · luz
    const amb = soft(cl((p - .74) / .14));
    strips.forEach(s => { const k = soft(cl((p - s.a) / (s.b - s.a))); s.g.visible = k > 0; s.g.scale[s.axis === 'x' ? 'x' : 'z'] = Math.max(.0001, k); s.m.material.emissiveIntensity = 2.2 * k * (.4 + .6 * amb); });
    lights.forEach(([l, i, t]) => l.intensity = i * soft(cl((p - t) / .05)));
    mGlass.emissiveIntensity = .8 * soft(cl((p - .82) / .04));
    scene.background.copy(DAY).lerp(EVE, amb * .9); scene.fog.color.copy(scene.background);
    hallMat.color.setRGB(1, 1, 1).lerp(EVE, amb * .7); hlMat.opacity = amb;
    hemi.intensity = lerp(.85, .2, amb); sun.intensity = lerp(3.2, .4, amb);
    all.forEach(m => m.envMapIntensity = m.userData.env * lerp(1, .3, amb));
    renderer.toneMappingExposure = lerp(.95, 1.05, amb); bloom.strength = .05 + .17 * amb;
    // trayectorias (E)
    paths.forEach(q => { const e = q.e, pre = cl((p - (e.a - .05)) / .04), k = cl((p - e.a) / (e.b - e.a)); q.ln.material.opacity = pre * (1 - cl((k - .85) / .15)) * .9; q.ln.geometry.setDrawRange(0, Math.floor(q.n * pre)); q.dot.material.opacity = q.ln.material.opacity; });
    shot(p); composer.render();
    return amb > .5; }
  function redraw() { set(last); }
  return { set, resize: () => { resize(); redraw(); } };
}
