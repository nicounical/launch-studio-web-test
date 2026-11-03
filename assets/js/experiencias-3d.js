// Activación de marca en 3D (Three.js): idea → zonas → recorrido → la gente lo vive → de noche.
// createExperience(contenedor) devuelve { set(p, cam, ocultarNotas) → true cuando es de noche, resize() }.
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
const eb = x => { const c = 1.6; return x <= 0 ? 0 : x >= 1 ? 1 : 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const lerp = (a, b, t) => a + (b - a) * t;
const INK = 0x0b0b0b, CREAM = new THREE.Color(0xF4F3EE), NIGHT = new THREE.Color(0x121114);
function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function noiseTex(base, amp, seed) { return canvasTex(1024, 1024, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); const r = rnd(seed); for (let i = 0; i < 30000; i++) { const v = r() > .5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${r() * amp})`; g.fillRect(r() * w, r() * h, 1 + r() * 2.5, 1 + r() * 2.5); } }); }
function woodTex(base, seed) { return canvasTex(1024, 1024, (g, w, h) => { const r = rnd(seed); for (let y = 0; y < h; y += 64) { let x = -Math.floor(r() * 400); while (x < w) { const len = 260 + r() * 380, t = r() * .14 - .07; g.fillStyle = `rgb(${base.map(v => Math.round(v * (1 + t))).join(',')})`; g.fillRect(x, y, len, 64); for (let i = 0; i < 24; i++) { g.strokeStyle = `rgba(90,55,25,${.03 + r() * .06})`; g.lineWidth = .5 + r() * 1.4; const yy = y + r() * 64; g.beginPath(); g.moveTo(x, yy); for (let xx = x; xx < x + len; xx += 24) g.lineTo(xx, yy + Math.sin(xx * .012 + i) * 2); g.stroke(); } g.fillStyle = 'rgba(50,30,10,.25)'; g.fillRect(x, y, 2, 64); x += len; } g.fillStyle = 'rgba(50,30,10,.22)'; g.fillRect(0, y, w, 1.5); } }); }
const LOGO = 'M462 283H935V1467A353 353 0 0 0 1027 1703H935A473 473 0 0 1 462 1230Z';
function drawLogo(g, x, y, hgt, fill, dot = '#D93333') { const s = hgt / 1470; g.save(); g.translate(x, y); g.scale(s, s); g.translate(-440, -260); g.fillStyle = fill; g.fill(new Path2D(LOGO)); g.fillStyle = dot; g.beginPath(); g.arc(1288, 1467, 237, 0, 7); g.fill(); g.restore(); }
function spaced(g, txt, x, y, sp) { if ('letterSpacing' in g) { g.letterSpacing = sp + 'px'; g.fillText(txt, x, y); g.letterSpacing = '0px'; return; } let cx = x; for (const ch of txt) { g.fillText(ch, cx, y); cx += g.measureText(ch).width + sp; } }
function repeatTex() { return canvasTex(1600, 1040, (g, w, h) => { g.fillStyle = '#F4F1EA'; g.fillRect(0, 0, w, h); for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) { const x = 60 + c * 260 + (r % 2) * 130, y = 50 + r * 200; if ((r + c) % 2) drawLogo(g, x + 40, y + 20, 110, '#0b0b0b'); else { g.fillStyle = '#C4221D'; g.font = '800 56px Poppins, sans-serif'; g.textBaseline = 'top'; spaced(g, 'Launch', x, y + 50, -2); } } }); }
function textTex(lines, o = {}) { const { w = 1024, h = 256, bg = null, color = '#fff', size = 120, font = '800', glow = 0 } = o; return canvasTex(w, h, g => { if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); } g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `${font} ${size}px Poppins, sans-serif`; if (glow) { g.shadowColor = color; g.shadowBlur = glow; } const lh = size * 1.02; lines.forEach((l, i) => { if ('letterSpacing' in g) g.letterSpacing = (font === '800' ? -4 : 2) + 'px'; g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * lh); }); }); }
function archTex() { return canvasTex(1400, 250, (g, w, h) => { g.fillStyle = '#C4221D'; g.fillRect(0, 0, w, h); drawLogo(g, 120, 50, 150, '#fff', '#fff'); g.fillStyle = '#fff'; g.font = '800 120px Poppins, sans-serif'; g.textBaseline = 'middle'; spaced(g, 'Welcome', 300, 130, -4); g.font = '400 36px "DM Mono", monospace'; spaced(g, 'MAKE IT A FEELING', 960, 132, 6); }); }

export async function createExperience(root) {
  try { await Promise.all([document.fonts.load('800 80px Poppins'), document.fonts.load('400 40px "DM Mono"')]); } catch (e) { }
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'; root.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = CREAM.clone(); scene.fog = new THREE.Fog(CREAM.clone(), 30, 75);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), .03).texture;
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 250);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 2, 2); gtao.updateGtaoMaterial({ radius: .5, distanceExponent: 1.6, thickness: 1.2, scale: 1.2, samples: 16 }); composer.addPass(gtao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), .3, .5, .9); composer.addPass(bloom); composer.addPass(new OutputPass());

  const hemi = new THREE.HemisphereLight(0xffffff, 0xcfc8b8, .9); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e6, 3.3); sun.position.set(-8, 18, 14); sun.target.position.set(7, 0, 4.5);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50 }); sun.shadow.bias = -.0003; sun.shadow.normalBias = .02;
  scene.add(sun, sun.target);
  const warm = [];
  const spot = (x, y, z, tx, tz, i, ang, colr, sh) => { const s = new THREE.SpotLight(colr, 0, 14, ang, .7, 1.4); s.position.set(x, y, z); s.target.position.set(tx, 0, tz); s.castShadow = !!sh; if (sh) s.shadow.mapSize.set(1024, 1024); scene.add(s, s.target); warm.push([s, i]); };
  const point = (x, y, z, i, d, colr = 0xffc98a) => { const l = new THREE.PointLight(colr, 0, d, 2); l.position.set(x, y, z); scene.add(l); warm.push([l, i]); };

  const mats = [];
  const M = (o, env = .5) => { const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: .8, transparent: true, opacity: 0 }, o)); m.userData.env = env; m.envMapIntensity = env; mats.push(m); return m; };
  const tile = (t, x, y) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(x, y); return t; };
  const mWhite = M({ color: 0xF3F1EB, roughness: .6 }, .5), mRed = M({ color: 0xC4221D, roughness: .45 }, .5), mBlack = M({ color: 0x1c1b1a, roughness: .5 }, .35);
  const mDeck = M({ map: tile(woodTex([212, 176, 130], 5), 2, 1.5), roughness: .55 }), mCarpet = M({ color: 0xa8231f, roughness: 1 }, .2);
  const mBag1 = M({ color: 0xC4221D, roughness: .9 }, .3), mBag2 = M({ color: 0xE8E0D2, roughness: .95 }, .3), mBag3 = M({ color: 0x2a2826, roughness: .9 }, .3);
  const mLeaf = M({ color: 0x56693f, roughness: .8 }, .3), mPot = M({ color: 0xd8d2c6, roughness: .7 }, .4), mMetal = M({ color: 0x1a1a1a, roughness: .3, metalness: .85 }, .8);
  const mRepeat = M({ map: repeatTex(), roughness: .7 }, .4);
  const mRing = M({ color: 0xffffff, emissive: 0xfff6e8, emissiveIntensity: 0 }, .3);
  const mProd = M({ color: 0xffffff, emissive: 0xffe2c2, emissiveIntensity: 0, roughness: .2, metalness: .1 }, 1);
  const mGlow = M({ color: 0xfff0d0, emissive: 0xffc77a, emissiveIntensity: 0 }, .2);

  const P = .02, Wd = 14, Dp = 9;
  const base = new THREE.Group(); base.position.y = P; scene.add(base);   // estructuras que crecen
  const furn = new THREE.Group(); furn.position.y = P; scene.add(furn);   // piezas que aparecen
  const gfxG = new THREE.Group(); scene.add(gfxG);
  const edgeMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0 });
  const FP = [], pops = [];
  const mesh = (geo, mat, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.ry) m.rotation.y = o.ry; m.castShadow = o.cast !== false; m.receiveShadow = true; if (o.edges !== false) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), edgeMat)); (o.parent || base).add(m); return m; };
  const box = (w, h, d, mat, x, y0, z, o = {}) => { if (o.fp !== false) FP.push(['r', x - w / 2, z - d / 2, x + w / 2, z + d / 2]); return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y0 + h / 2, z, o); };
  const popper = (obj, x, z, t) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.add(obj); furn.add(g); pops.push([g, t]); return g; };

  // suelo
  const floorMat = new THREE.MeshStandardMaterial({ map: tile(noiseTex('#d6d2ca', .05, 3), 34, 34), roughness: .55 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), floorMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const grid = new THREE.GridHelper(50, 100, 0xb3b0a6, 0xd0cdc4); grid.position.set(7, .004, 4.5); grid.material.transparent = true; scene.add(grid);
  const area = new THREE.Mesh(new THREE.PlaneGeometry(Wd, Dp), M({ map: tile(noiseTex('#ece8e0', .04, 6), 6, 4), roughness: .7 }, .5)); area.rotation.x = -Math.PI / 2; area.position.set(Wd / 2, P + .003, Dp / 2); area.receiveShadow = true; scene.add(area);

  // 01 · Entrada: arco de marca
  box(.4, 3.0, .4, mRed, 1.0, 0, 7.6); box(.4, 3.0, .4, mRed, 3.2, 0, 7.6); box(2.6, .55, .4, mRed, 2.1, 3.0, 7.6, { fp: false });
  // 02 · Photocall: fondo de marca, alfombra y aro de luz
  box(4.2, 2.7, .14, mWhite, 3.4, 0, .9);
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.8), mCarpet); carpet.rotation.x = -Math.PI / 2; carpet.position.set(3.4, .008, 2.0); carpet.receiveShadow = true; base.add(carpet); FP.push(['r', 1.7, 1.1, 5.1, 2.9]);
  const ring = new THREE.Group(); const rl = new THREE.Mesh(new THREE.TorusGeometry(.32, .035, 12, 48), mRing); rl.position.y = 1.65; ring.add(rl); const rs = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, 1.5, 8), mMetal); rs.position.y = .75; ring.add(rs); const rb = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, .03, 20), mMetal); rb.position.y = .015; ring.add(rb);
  ring.children.forEach(c => c.castShadow = true); ring.rotation.y = -.5; popper(ring, 5.6, 2.9, .5); FP.push(['c', 5.6, 2.9, .25]);
  // 03 · Prueba de producto: isla, podios y pantalla
  box(3.4, .95, 1.3, mWhite, 7.4, 0, 4.6);
  box(3.46, .04, 1.36, mBlack, 7.4, .95, 4.6, { fp: false });
  [[6.5, .3, mRed], [7.4, .42, mWhite], [8.3, .3, mRed]].forEach(([x, h, m], k) => { const g = new THREE.Group(); const pod = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, h, 32), m); pod.position.y = 1.0 + h / 2; pod.castShadow = true; g.add(pod); const pr = new THREE.Mesh(new RoundedBoxGeometry(.16, .26, .16, 3, .03), mProd); pr.position.y = 1.0 + h + .13; pr.castShadow = true; g.add(pr); popper(g, x, 4.6, .52 + k * .01); });
  box(1.6, .06, .5, mBlack, 7.4, 0, 3.35, { fp: false }); box(.08, 1.6, .08, mBlack, 7.4, 0, 3.35, { fp: false });
  const scrBack = box(1.7, 1.0, .06, mBlack, 7.4, 1.6, 3.35, { fp: false });
  // 04 · Zona chill: tarima de madera, puffs, mesa, plantas y neón
  box(3.8, .16, 2.8, mDeck, 11.3, 0, 2.0);
  box(3.8, 2.6, .14, mBlack, 11.3, .16, .6, { fp: false });
  [[10.2, 2.4, mBag1], [11.0, 2.9, mBag2], [12.3, 2.5, mBag1], [11.9, 1.5, mBag3], [10.6, 1.4, mBag2]].forEach(([x, z, m], k) => { const b = new THREE.Mesh(new THREE.SphereGeometry(.42, 32, 20), m); b.scale.set(1, .55, 1); b.position.y = .16 + .22; b.castShadow = b.receiveShadow = true; popper(b, x, z, .54 + k * .008); FP.push(['c', x, z, .42]); });
  { const t = new THREE.Group(); const top = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, .04, 32), mDeck); top.position.y = .58; const leg = new THREE.Mesh(new THREE.CylinderGeometry(.04, .12, .4, 16), mBlack); leg.position.y = .36; t.add(top, leg); t.children.forEach(c => c.castShadow = true); popper(t, 11.4, 2.1, .56); }
  // 05 · Regalo: quiosco con cajas
  box(2.6, 2.6, .14, mRed, 12.0, 0, 6.4);
  box(2.2, 1.0, .7, mWhite, 12.0, 0, 7.1);
  const gifts = new THREE.Group(); const gr = rnd(4);
  for (let i = 0; i < 9; i++) { const s = .18 + gr() * .12, gb = new THREE.Mesh(new THREE.BoxGeometry(s, s * .8, s), i % 3 ? mRed : mWhite); gb.position.set(-.9 + (i % 5) * .42, 1.0 + s * .4 + (i > 4 ? .3 : 0), (gr() - .5) * .3); gb.rotation.y = gr(); gb.castShadow = true; const rib = new THREE.Mesh(new THREE.BoxGeometry(s * 1.02, s * .82, .03), i % 3 ? mWhite : mRed); gb.add(rib); gifts.add(gb); }
  popper(gifts, 12.0, 7.1, .58);
  // plantas en macetas
  const plant = (x, z, s, seed) => { const g = new THREE.Group(); const pot = new THREE.Mesh(new THREE.CylinderGeometry(.28 * s, .22 * s, .5 * s, 24), mPot); pot.position.y = .25 * s; pot.castShadow = true; g.add(pot); const r = rnd(seed);
    for (let i = 0; i < 150; i++) { const a = r() * 6.28, rr = Math.sqrt(r()) * .45 * s, l = new THREE.Mesh(new THREE.SphereGeometry(.05 * s, 6, 4), mLeaf); l.scale.set(1, .3, 2.2); l.position.set(Math.cos(a) * rr, .6 * s + r() * 1.1 * s * (1 - rr / s), Math.sin(a) * rr); l.rotation.set(r() * 3, r() * 3, r() * 3); l.castShadow = true; g.add(l); }
    popper(g, x, z, .6); FP.push(['c', x, z, .28 * s]); };
  plant(.7, .8, 1.1, 3); plant(9.7, .7, 1, 5); plant(13.4, 3.4, 1, 7); plant(13.4, 6.0, .9, 9); plant(5.9, 7.9, .9, 11); plant(9.8, 7.8, 1, 13);
  // guirnalda de bombillas sobre el recorrido
  const bulbs = []; const poles = [[.4, 6.2], [5.0, 6.6], [9.6, 5.6], [13.6, 4.6]];
  poles.forEach(([x, z]) => box(.08, 3.4, .08, mMetal, x, 0, z, { fp: false }));
  for (let s = 0; s < poles.length - 1; s++) { const [x0, z0] = poles[s], [x1, z1] = poles[s + 1]; for (let i = 1; i < 14; i++) { const u = i / 14, b = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), mGlow); b.position.set(lerp(x0, x1, u), 3.35 - Math.sin(u * Math.PI) * .55, lerp(z0, z1, u)); base.add(b); bulbs.push(b); } }

  // luces de la noche
  spot(3.4, 4.5, 3.6, 3.4, 1.6, 12, .5, 0xfff2e0, true);
  spot(7.4, 4.8, 5.6, 7.4, 4.6, 26, .4, 0xfff0d8, true);
  spot(11.3, 4.5, 3.2, 11.3, 1.8, 18, .6, 0xffc58a, false);
  spot(12.0, 4.2, 8.4, 12.0, 6.8, 18, .5, 0xffd6a0, false);
  spot(2.1, 4.4, 9.0, 2.1, 7.6, 18, .45, 0xffe2b0, false);
  point(11.3, 1.6, 1.0, 1.8, 4, 0xff4a3a); point(5.6, 1.7, 2.9, .8, 3, 0xfff6e8); point(7.4, 1.6, 4.6, .8, 3, 0xffe2c2);
  [[2.8, 6.4], [7.2, 6.2], [11.6, 5.1]].forEach(([x, z]) => point(x, 3, z, 1.6, 6));

  /* gráficas */
  const gfx = [];
  const plane = (w, h, map, x, y, z, ry = 0, o = {}) => { const m = new THREE.MeshStandardMaterial(Object.assign({ map, transparent: true, opacity: 0, roughness: .6, depthWrite: false }, o)); gfx.push(m); const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); me.position.set(x, y, z); me.rotation.y = ry; gfxG.add(me); return me; };
  plane(4.1, 2.6, repeatTex(), 3.4, P + 1.35, .975);
  plane(2.5, .45, archTex(), 2.1, P + 3.275, 7.805);
  const neonT = textTex(['Make it', 'a feeling.'], { w: 1024, h: 512, color: '#ff4f45', size: 150, font: '400', glow: 30 });
  const neon = plane(2.6, 1.3, neonT, 11.3, P + 1.75, .675, 0, { emissive: 0xffffff, emissiveMap: neonT, emissiveIntensity: .1 });
  const scrT = textTex(['Pruébalo'], { w: 800, h: 470, bg: '#C4221D', size: 140 });
  const scr = plane(1.6, .94, scrT, 7.4, P + 2.1, 3.385, 0, { emissive: 0xffffff, emissiveMap: scrT, emissiveIntensity: .1 });
  const giftT = textTex(['Take it', 'home.'], { w: 800, h: 800, color: '#fff', size: 170 }); plane(2.2, 2.2, giftT, 12.0, P + 1.75, 6.475);

  /* recorrido: curva por las cinco zonas */
  const curve = new THREE.CatmullRomCurve3([[.2, 8.7], [2.1, 7.9], [2.6, 5.4], [3.6, 3.4], [5.8, 4.2], [7.4, 5.8], [9.2, 4.6], [10.4, 3.7], [12.4, 3.9], [12.6, 5.3], [12.8, 7.9], [14.2, 8.8]].map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', .5);
  const NDOT = 140, dots = new THREE.InstancedMesh(new THREE.CylinderGeometry(.07, .07, .012, 16), new THREE.MeshStandardMaterial({ color: 0xD93333, roughness: .6, transparent: true, opacity: 0 }), NDOT);
  const dm = new THREE.Object3D();
  for (let i = 0; i < NDOT; i++) { const v = curve.getPointAt(i / (NDOT - 1)); dm.position.set(v.x, P + .012, v.z); dm.updateMatrix(); dots.setMatrixAt(i, dm.matrix); }
  dots.receiveShadow = true; scene.add(dots);
  const pathPts = curve.getSpacedPoints(200).map(v => new THREE.Vector3(v.x, P + .015, v.z));
  const pathLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pathPts), new THREE.LineDashedMaterial({ color: 0xD93333, dashSize: .25, gapSize: .18, transparent: true, opacity: 0 })); pathLine.computeLineDistances(); scene.add(pathLine);

  /* personas */
  const NP = 44, prr = rnd(21);
  const bodyGeo = new THREE.CapsuleGeometry(.17, .78, 6, 14).translate(0, .56, 0), headGeo = new THREE.SphereGeometry(.12, 16, 12).translate(0, 1.29, 0);
  const pMat = new THREE.MeshStandardMaterial({ roughness: .85, transparent: true, opacity: 0 }), hMat = new THREE.MeshStandardMaterial({ roughness: .7, transparent: true, opacity: 0 });
  const bodies = new THREE.InstancedMesh(bodyGeo, pMat, NP), heads = new THREE.InstancedMesh(headGeo, hMat, NP);
  const clothes = [0xC4221D, 0xC4221D, 0x2b2a28, 0xe6e0d4, 0x5b6470, 0x8b6d55, 0x3d4b5c, 0xd2c3a8, 0x1f1e1d], skins = [0xe8c4a8, 0xc99c7a, 0x8a6248, 0xf0d2bc, 0x5e4030], col = new THREE.Color();
  const people = [];
  // unos recorren el camino y otros se quedan en cada zona
  const STAY = [[3.2, 2.0], [3.7, 2.1], [2.7, 2.3], [6.8, 5.5], [7.6, 5.5], [8.2, 5.4], [7.1, 3.8], [10.5, 2.4], [11.6, 2.8], [12.2, 1.8], [11.4, 7.8], [12.6, 7.9], [2.0, 8.3], [5.4, 3.3]];
  for (let i = 0; i < NP; i++) { const stay = i < STAY.length; people.push({ stay, pos: stay ? STAY[i] : null, u: prr(), off: (prr() - .5) * .9, sp: .8 + prr() * .5, s: .9 + prr() * .2, t: prr() * .9 });
    bodies.setColorAt(i, col.set(clothes[Math.floor(prr() * clothes.length)])); heads.setColorAt(i, col.set(skins[Math.floor(prr() * skins.length)])); }
  bodies.castShadow = heads.castShadow = true; scene.add(bodies, heads);
  const tan = new THREE.Vector3();

  /* plano */
  const segs = [];
  FP.forEach(f => { if (f[0] === 'r') { const [, a, b, c, d] = f; segs.push(a, b, c, b, c, b, c, d, c, d, a, d, a, d, a, b); } else { const [, x, z, r] = f; for (let i = 0; i < 24; i++) { const u = i / 24 * 6.283, v = (i + 1) / 24 * 6.283; segs.push(x + Math.cos(u) * r, z + Math.sin(u) * r, x + Math.cos(v) * r, z + Math.sin(v) * r); } } });
  const pv = []; for (let i = 0; i < segs.length; i += 4) pv.push(segs[i], P + .012, segs[i + 1], segs[i + 2], P + .012, segs[i + 3]);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pv, 3));
  const planMat = new THREE.LineBasicMaterial({ color: INK, transparent: true }); scene.add(new THREE.LineSegments(pg, planMat)); const nPlan = pv.length / 3;
  const areaEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(Wd, Dp).rotateX(-Math.PI / 2)), new THREE.LineDashedMaterial({ color: 0x0b0b0b, dashSize: .3, gapSize: .2, transparent: true, opacity: 0 })); areaEdge.position.set(Wd / 2, P + .01, Dp / 2); areaEdge.computeLineDistances(); scene.add(areaEdge);

  /* notas y contadores */
  const ov = document.createElement('div'); ov.className = 'callouts'; ov.innerHTML = '<svg></svg>'; root.appendChild(ov); const svg = ov.firstChild;
  const Z = [{ t: '01 · Entrada', a: [2.1, P + 3.6, 7.6], n: 214 }, { t: '02 · Photocall', a: [3.4, P + 2.8, .9], n: 186 }, { t: '03 · Prueba de producto', a: [7.4, P + 2.7, 3.4], n: 152 }, { t: '04 · Zona chill', a: [11.3, P + 2.9, .6], n: 97 }, { t: '05 · Regalo', a: [12.0, P + 2.7, 6.4], n: 203 }];
  Z.forEach(z => { const d = document.createElement('div'); d.className = 'zlab'; d.style.opacity = 0; d.innerHTML = '<span>' + z.t + '</span><b>0</b><em>interacciones</em>'; ov.appendChild(d); z.el = d; z.b = d.querySelector('b'); });
  const PL = [{ a: [7, P, -.7], t: '14,00 m', c: 'red' }, { a: [Wd + .8, P, 4.5], t: '9,00 m', c: 'red' }, { a: [2.1, P, 8.3], t: 'ENTRADA' }, { a: [3.4, P, 2.0], t: 'PHOTOCALL' }, { a: [7.4, P, 5.4], t: 'PRUEBA DE PRODUCTO' }, { a: [11.3, P, 3.6], t: 'ZONA CHILL' }, { a: [12.0, P, 7.9], t: 'REGALO · SALIDA' }];
  PL.forEach(l => { const d = document.createElement('div'); d.className = 'plab' + (l.c ? ' ' + l.c : ''); d.textContent = l.t; d.style.opacity = 0; ov.appendChild(d); l.el = d; });
  const dimV = [0, P, -.7, Wd, P, -.7, 0, P, -.85, 0, P, -.55, Wd, P, -.85, Wd, P, -.55, Wd + .8, P, 0, Wd + .8, P, Dp, Wd + .65, P, 0, Wd + .95, P, 0, Wd + .65, P, Dp, Wd + .95, P, Dp];
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(dimV, 3)); const dimMat = new THREE.LineBasicMaterial({ color: 0xD93333, transparent: true, opacity: 0 }); scene.add(new THREE.LineSegments(dg, dimMat));
  const v3 = new THREE.Vector3(); let W = 1, Hh = 1;
  const proj = a => { v3.set(a[0], a[1], a[2]).project(camera); return [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * Hh]; };
  function resize() { W = root.clientWidth || 1; Hh = root.clientHeight || 1; renderer.setSize(W, Hh, false); composer.setSize(W, Hh); camera.aspect = W / Hh; camera.updateProjectionMatrix(); }
  resize();

  const T = new THREE.Vector3(7.2, .6, 4.4), tmp = new THREE.Color();
  let last = [0, null, false, 0];
  function set(p, cam, hideCo, time = 0) {
    last = [p, cam, hideCo, time]; cam = cam || {};
    const plan = cl(p / .2), tilt = ez(cl((p - .2) / .2)), rise = ez(cl((p - .26) / .2)), fill = cl((p - .44) / .12), gfxA = cl((p - .5) / .1), path = ez(cl((p - .56) / .14)), ppl = cl((p - .68) / .06), walk = cl((p - .68) / .3), lit = ez(cl((p - .86) / .12));
    planMat.opacity = (1 - .8 * rise) * (1 - fill); dimMat.opacity = cl((plan - .5) / .4) * (1 - fill); areaEdge.material.opacity = cl((plan - .3) / .4) * (1 - fill) * .5;
    pg.setDrawRange(0, Math.floor(nPlan * cl(plan * 1.1) / 2) * 2);
    grid.material.opacity = (1 - fill) * .9; grid.visible = fill < .999;
    base.scale.y = Math.max(.0001, rise); base.visible = rise > .002;
    const eo = rise > .002 ? (1 - fill) * .85 : 0; edgeMat.opacity = eo; edgeMat.visible = eo > .01;
    mats.forEach(m => { m.opacity = fill; m.transparent = fill < .999; m.depthWrite = fill > .4; });
    gfx.forEach(m => m.opacity = gfxA);
    pops.forEach(([g, t]) => { const k = eb(cl((p - t) / .04)); g.scale.setScalar(Math.max(.0001, k)); g.visible = k > .001; });
    // el recorrido se dibuja punto a punto (con una línea a trazos durante el plano)
    pathLine.material.opacity = cl((plan - .6) / .3) * (1 - fill); dots.material.opacity = path > 0 ? 1 : 0; dots.count = Math.floor(NDOT * path);
    // personas
    pMat.opacity = hMat.opacity = ppl; bodies.visible = heads.visible = ppl > 0;
    people.forEach((q, i) => { let x, z, ry = 0, bob = 0; const app = cl((walk - q.t * .25) / .08);
      if (q.stay) { [x, z] = q.pos; ry = i * 1.3; }
      else { const u = (q.u + walk * .7 * q.sp + time * .012 * q.sp) % 1, v = curve.getPointAt(u); curve.getTangentAt(u, tan); x = v.x - tan.z * q.off; z = v.z + tan.x * q.off; ry = Math.atan2(tan.x, tan.z); bob = Math.abs(Math.sin((walk * 60 + time * 2) * q.sp + i)) * .03; }
      dm.position.set(x, P + bob, z); dm.rotation.set(0, ry, 0); dm.scale.setScalar(Math.max(.0001, q.s * eb(app))); dm.updateMatrix(); bodies.setMatrixAt(i, dm.matrix); heads.setMatrixAt(i, dm.matrix); });
    bodies.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true;
    // noche
    scene.background.copy(CREAM).lerp(NIGHT, lit); scene.fog.color.copy(scene.background); floorMat.color.copy(tmp.set(0xffffff).lerp(new THREE.Color(0x2e2c2a), lit));
    hemi.intensity = lerp(.9, .14, lit); sun.intensity = lerp(3.3, .2, lit);
    warm.forEach(([l, i]) => l.intensity = i * lit);
    mGlow.emissiveIntensity = lit * 3; mRing.emissiveIntensity = lit * 1.6; mProd.emissiveIntensity = lit * 1.4; neon.material.emissiveIntensity = .1 + lit * 2.2; scr.material.emissiveIntensity = .1 + lit * .7;
    mats.forEach(m => m.envMapIntensity = m.userData.env * lerp(1, .2, lit));
    renderer.toneMappingExposure = lerp(1, 1.08, lit); gtao.enabled = fill > .95 && W > 700; bloom.strength = .08 + .38 * lit;
    // cámara
    const R0 = 21.5 * (1 + .18 * (1 - tilt)) * Math.pow(Math.max(1, 1.3 / (W / Hh)), .85) * (cam.s ? 1 / cam.s : 1);
    const polar = .02 + .98 * tilt + (cam.a || 0), az = .6 * tilt + (cam.b || 0);
    const tx = T.x + (cam.x || 0) * .1, tz = T.z - (cam.y || 0) * .1;
    camera.position.set(tx + R0 * Math.sin(polar) * Math.sin(az), T.y + R0 * Math.cos(polar), tz + R0 * Math.sin(polar) * Math.cos(az));
    camera.lookAt(tx, T.y + (W / Hh < 1 ? -.6 : -.2), tz); camera.updateMatrixWorld();
    composer.render();
    // etiquetas de zona: nombre durante la construcción, contador cuando llega la gente
    const zo = hideCo ? 0 : cl((p - .5) / .05);
    Z.forEach((z, i) => { z.el.style.opacity = zo; if (zo <= 0) return; const [x, y] = proj(z.a); z.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;
      const c = cl((walk - .05 - i * .08) / .55); z.el.classList.toggle('count', walk > .02); z.b.textContent = Math.round(z.n * c); });
    const po = cl((plan - .55) / .35) * (1 - cl((p - .26) / .06));
    PL.forEach(l => { l.el.style.opacity = po; if (po <= 0) return; const [x, y] = proj(l.a); l.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`; });
    return lit > .5;
  }
  return { set, resize: () => { resize(); set(...last); }, redraw: (time) => set(last[0], last[1], last[2], time) };
}
