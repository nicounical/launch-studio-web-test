// «Una sala, tres eventos»: la misma sala se transforma mientras bajas (bajar avanza, subir retrocede).
// Sala vacía → conferencia → cóctel → cena de gala. Paleta azul noche con luz dorada.
// Cuatro encuadres: A · Balcón, B · Frontal, C · Desde arriba, D · A pie de sala.
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

const io = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2, out = x => 1 - Math.pow(1 - x, 4), soft = x => x * x * (3 - 2 * x);
const NAVY = 0x14203a, DEEP = 0x0b1222, GOLD = 0xC8A266;
// tramos de la línea de tiempo: [aparece desde, aparece hasta, se va desde, se va hasta]
const CONF = [.08, .24, .36, .44], COCK = [.42, .54, .62, .68], GALA = [.66, .82, 2, 2];

function screenTex(title, sub, kicker) {
  return canvasTex(2048, 1024, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#0c1424'); gr.addColorStop(.6, '#16253f'); gr.addColorStop(1, '#2a2416'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(200,162,102,.45)'; g.lineWidth = 3; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(w * .84, h * .5, 110 + i * 70, 0, 7); g.stroke(); }
    drawLogo(g, 160, 160, 160, '#ffffff');
    g.fillStyle = '#C8A266'; g.font = '400 46px "DM Mono", monospace'; g.textBaseline = 'alphabetic'; spaced(g, kicker, 164, 470, 10);
    g.fillStyle = '#fff'; g.font = '800 200px Poppins, sans-serif'; spaced(g, title, 150, 680, -9);
    g.fillStyle = 'rgba(255,255,255,.72)'; g.font = '400 50px "DM Mono", monospace'; spaced(g, sub, 160, 790, 10);
  });
}
function menuTex() { return canvasTex(256, 360, (g, w, h) => { g.fillStyle = '#F4EFE4'; g.fillRect(0, 0, w, h); drawLogo(g, 104, 40, 50, '#14203a'); g.fillStyle = '#14203a'; g.font = '400 20px Poppins, sans-serif'; g.textAlign = 'center'; g.fillText('GALA DINNER', w / 2, 150); g.fillStyle = '#C8A266'; g.fillRect(w / 2 - 30, 170, 60, 2); g.fillStyle = 'rgba(20,32,58,.6)'; for (let i = 0; i < 5; i++) g.fillRect(50, 200 + i * 26, w - 100, 6); }); }

export async function createGala(root, opt = {}) {
  const mode = opt.mode || 'A';
  try { await Promise.all([document.fonts.load('800 80px Poppins'), document.fonts.load('400 40px "DM Mono"')]); } catch (e) { }
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'; root.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(DEEP); scene.fog = new THREE.Fog(DEEP, 30, 70);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), .03).texture;
  const camera = new THREE.PerspectiveCamera(mode === 'D' ? 38 : 32, 1, .1, 200);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 2, 2); gtao.updateGtaoMaterial({ radius: .5, distanceExponent: 1.8, thickness: 1, scale: 1.1, samples: 16 }); composer.addPass(gtao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), .22, .4, .88); composer.addPass(bloom); composer.addPass(new OutputPass());

  /* luz: cada evento tiene su ambiente */
  const hemi = new THREE.HemisphereLight(0xc8d4ff, 0x1a2236, .55); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xdfe6ff, 1.1); key.position.set(-6, 16, 16); key.target.position.set(8, 0, 5.5); key.castShadow = true; key.shadow.mapSize.set(4096, 4096); Object.assign(key.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 50 }); key.shadow.bias = -.0003; key.shadow.normalBias = .02; scene.add(key, key.target);
  const groups = { conf: [], cock: [], gala: [], all: [] };   // [luz, intensidad]
  const spot = (x, y, z, tx, ty, tz, i, ang, col, set, sh) => { const s = new THREE.SpotLight(col, 0, 20, ang, .65, 1.4); s.position.set(x, y, z); s.target.position.set(tx, ty, tz); s.castShadow = !!sh; if (sh) { s.shadow.mapSize.set(1024, 1024); s.shadow.bias = -.0005; } scene.add(s, s.target); groups[set].push([s, i]); return s; };
  const point = (x, y, z, i, d, col, set) => { const l = new THREE.PointLight(col, 0, d, 2); l.position.set(x, y, z); scene.add(l); groups[set].push([l, i]); return l; };

  /* materiales */
  const tile = (t, x, y) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(x, y); return t; };
  const M = (o, env = .5) => { const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: .8 }, o)); m.envMapIntensity = env; return m; };
  const mWall = M({ map: tile(noiseTex('#1b2a48', .05, 2), 4, 1), roughness: .95 }, .25);
  const mPanel = M({ map: tile(noiseTex('#22355a', .06, 5), 1, 2), roughness: .9 }, .25);
  const mGold = M({ color: GOLD, roughness: .28, metalness: .95 }, 1.1);
  const mCarpet = M({ map: tile(canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#16223c'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(200,162,102,.18)'; g.lineWidth = 2; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.beginPath(); g.arc(i * 64 + 32, j * 64 + 32, 18, 0, 7); g.stroke(); } const r = rnd(3); for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(255,255,255,${r() * .035})`; g.fillRect(r() * w, r() * h, 2, 2); } }), 14, 10), roughness: 1 }, .15);
  const mStage = M({ map: tile(woodTex([70, 52, 40], 5, 1024), 2, 1), roughness: .45 }, .6);
  const mScreenOff = M({ color: 0x090c14, roughness: .2, metalness: .3 }, .8);
  const mChairConf = M({ map: tile(noiseTex('#2d3f66', .07, 4), 2, 2), roughness: .95 }, .3), mChrome = M({ color: 0xd9d4ca, roughness: .2, metalness: 1 }, 1);
  const mCloth = M({ color: 0xF3EEE3, roughness: .92, side: THREE.DoubleSide }, .4), mClothGold = M({ color: 0xC8A266, roughness: .5, metalness: .3, side: THREE.DoubleSide }, .7);
  const mVelvet = M({ map: tile(noiseTex('#8a2a24', .07, 7), 2, 2), roughness: .9 }, .3);
  const mGalaChair = M({ color: 0xC8A266, roughness: .35, metalness: .85 }, 1), mSeatCream = M({ color: 0xEDE4D3, roughness: .9 }, .35);
  const mBar = M({ color: 0x101827, roughness: .35, metalness: .2 }, .7), mMarble = M({ map: tile(noiseTex('#ece6da', .05, 9), 1, 1), roughness: .25 }, .9);
  const mGlass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .05, transmission: .9, thickness: .05, ior: 1.45, transparent: true, opacity: .55 });
  const mLeaf = M({ color: 0x3f5a3a, roughness: .8 }, .3), mWhiteFl = M({ color: 0xf6f1e8, roughness: .7 }, .3), mRedFl = M({ color: 0xc4221d, roughness: .6 }, .3);
  const mCandle = M({ color: 0xfff3dc, emissive: 0xffbf6a, emissiveIntensity: 0, roughness: .6 }, .2);
  const mLamp = M({ color: 0xfff1d6, emissive: 0xffcf8a, emissiveIntensity: 0, roughness: .4 }, .3);
  const mLed = M({ color: 0xfff0d2, emissive: 0xffc77a, emissiveIntensity: 0 }, .2);

  /* sala: azul noche, paneles con moldura dorada */
  const Wd = 16, Dp = 12, H = 5;
  const add = (par, geo, mat, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; m.castShadow = o.cast !== false; m.receiveShadow = true; par.add(m); return m; };
  const room = new THREE.Group(); scene.add(room);
  const floor = add(room, new THREE.PlaneGeometry(Wd, Dp), mCarpet, Wd / 2, 0, Dp / 2, { rx: -Math.PI / 2, cast: false });
  add(room, new THREE.PlaneGeometry(80, 80), M({ color: 0x0a0f1c, roughness: 1 }, .1), Wd / 2, -.01, Dp / 2, { rx: -Math.PI / 2, cast: false });
  add(room, new THREE.BoxGeometry(Wd, H, .2), mWall, Wd / 2, H / 2, -.1);
  add(room, new THREE.BoxGeometry(.2, H, Dp), mWall, -.1, H / 2, Dp / 2);
  add(room, new THREE.BoxGeometry(.2, H, Dp), mWall, Wd + .1, H / 2, Dp / 2);
  // paneles tapizados con moldura dorada en las paredes laterales
  for (let i = 0; i < 4; i++) { const z = 2.4 + i * 2.6; [[.02, Math.PI / 2], [Wd - .02, -Math.PI / 2]].forEach(([x, ry]) => {
    add(room, new THREE.BoxGeometry(2.0, 3.0, .04), mPanel, x, 2.2, z, { ry }); add(room, new THREE.BoxGeometry(2.06, .03, .06), mGold, x, 3.72, z, { ry }); add(room, new THREE.BoxGeometry(2.06, .03, .06), mGold, x, .68, z, { ry });
    const sc = add(room, new THREE.CylinderGeometry(.09, .05, .22, 20), mLamp, x + (x < 1 ? .1 : -.1), 3.95, z); groups.all.push([point(x + (x < 1 ? .3 : -.3), 4.1, z, 1.2, 4, 0xffc98a, 'all'), 0]); }); }
  groups.all = groups.all.filter(e => e[1] !== 0 || e[0].isPointLight === false);
  // zócalo y cornisa dorados
  add(room, new THREE.BoxGeometry(Wd, .06, .06), mGold, Wd / 2, 4.4, .03); add(room, new THREE.BoxGeometry(.06, .06, Dp), mGold, .03, 4.4, Dp / 2); add(room, new THREE.BoxGeometry(.06, .06, Dp), mGold, Wd - .03, 4.4, Dp / 2);
  // escenario y pantalla, que se quedan en los tres eventos
  add(room, new THREE.BoxGeometry(8, .5, 2.6), mStage, 8, .25, 1.4); add(room, new THREE.BoxGeometry(8, .04, .04), mGold, 8, .5, 2.72);
  const stageLed = add(room, new THREE.BoxGeometry(8, .02, .02), mLed, 8, .02, 2.72, { cast: false });
  add(room, new THREE.BoxGeometry(6.8, 3.4, .12), mScreenOff, 8, 2.6, .12);
  const SCREENS = [screenTex('Keynote', 'CONFERENCIA · 09:30', 'LAUNCH STUDIO PRESENTS'), screenTex('Welcome', 'COCKTAIL · 19:00', 'GOOD EVENING'), screenTex('Gala', 'DINNER · 21:00', 'A NIGHT TO REMEMBER')];
  const scrMats = SCREENS.map(t => new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0, toneMapped: true }));
  scrMats.forEach((m, i) => { const s = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 3.24), m); s.position.set(8, 2.6, .182 + i * .001); scene.add(s); });
  // cortinas a los lados del escenario
  const drape = new THREE.CylinderGeometry(.9, .9, 4.6, 24, 1, true, 0, Math.PI); drape.scale(1, 1, .25);
  [3.4, 12.6].forEach(x => add(room, drape, mVelvet, x, 2.3, .35, { ry: Math.PI }));

  /* ── 1 · Conferencia: butacas en filas, atril y focos blancos ── */
  const ni = g => g.index ? g.toNonIndexed() : g;
  const seat = new RoundedBoxGeometry(.46, .09, .44, 2, .03).translate(0, .46, 0), back = new RoundedBoxGeometry(.46, .5, .07, 2, .03).translate(0, .78, .2);
  const legs = mergeGeometries([[-.19, -.17], [.19, -.17], [-.19, .17], [.19, .17]].map(([a, b]) => ni(new THREE.CylinderGeometry(.012, .012, .44, 6).translate(a, .22, b))));
  const confChairs = new THREE.InstancedMesh(mergeGeometries([mergeGeometries([ni(seat), ni(back)]), legs], true), [mChairConf, mChrome], 112); confChairs.castShadow = confChairs.receiveShadow = true; scene.add(confChairs);
  const CC = []; for (let r = 0; r < 7; r++) for (let i = 0; i < 16; i++) CC.push([i < 8 ? 3.5 + i * .54 : 8.7 + (i - 8) * .54, 4.0 + r * .95, r, i]);
  const conf = new THREE.Group(); scene.add(conf);
  add(conf, new THREE.BoxGeometry(.6, 1.15, .45), mBar, 10.4, .5 + .575, 1.9); add(conf, new THREE.BoxGeometry(.62, .03, .47), mGold, 10.4, 1.66, 1.9);
  const aisleC = add(conf, new THREE.PlaneGeometry(1.0, 6.8), M({ color: 0x8a2a24, roughness: 1 }, .1), 8, .005, 6.9, { rx: -Math.PI / 2, cast: false });
  [6.8, 8, 9.2].forEach((x, i) => spot(x, 4.8, 5.5, x, .5, 1.6, 34, .3, 0xf2f4ff, 'conf', i === 1));
  [4.5, 11.5].forEach(x => spot(x, 4.8, 9, x, 0, 6, 10, .6, 0xe6ecff, 'conf'));

  /* ── 2 · Cóctel: mesas altas, barra y zona lounge ── */
  const cock = new THREE.Group(); scene.add(cock); const COCKP = [];
  const flowers = (par, s, seed, y) => { const r = rnd(seed); for (let i = 0; i < 30; i++) { const a = r() * 6.28, rr = r() * .12 * s; add(par, new THREE.SphereGeometry((.028 + r() * .022) * s, 8, 6), r() > .78 ? mRedFl : r() > .35 ? mWhiteFl : mLeaf, Math.cos(a) * rr, y + r() * .09 * s, Math.sin(a) * rr); } };
  [[4.0, 5.0], [6.5, 6.2], [9.5, 6.2], [12.0, 5.0], [4.6, 8.4], [8, 8.8], [11.4, 8.4], [8, 4.6]].forEach(([x, z], k) => { const g = new THREE.Group(); g.position.set(x, 0, z);
    add(g, new THREE.CylinderGeometry(.4, .58, 1.08, 40, 1, true), mClothGold, 0, .54, 0); add(g, new THREE.CylinderGeometry(.41, .41, .025, 40), mMarble, 0, 1.09, 0);
    add(g, new THREE.CylinderGeometry(.03, .025, .16, 16), mGlass, .12, 1.18, .05, { cast: false }); add(g, new THREE.CylinderGeometry(.03, .025, .16, 16), mGlass, -.1, 1.18, -.08, { cast: false });
    add(g, new THREE.CylinderGeometry(.02, .02, .08, 12), mCandle, 0, 1.14, 0); cock.add(g); COCKP.push({ g, t: k });
    point(x, 1.35, z, .25, 1.8, 0xffb05c, 'cock'); });
  const bar = new THREE.Group(); bar.position.set(1.0, 0, 7.2); add(bar, new THREE.BoxGeometry(.8, 1.1, 5.2), mBar, 0, .55, 0); add(bar, new THREE.BoxGeometry(.92, .06, 5.32), mMarble, 0, 1.13, 0);
  add(bar, new THREE.BoxGeometry(.02, .02, 5.0), mLed, .42, .08, 0, { cast: false }); add(bar, new THREE.BoxGeometry(.02, .6, 4.6), mGold, -.45, .55, 0);
  for (let b = 0; b < 14; b++) add(bar, new THREE.CylinderGeometry(.035, .035, .28, 10), mGlass, -.2, 1.3, -2.2 + b * .34, { cast: false });
  cock.add(bar); COCKP.push({ g: bar, t: 8, slide: [0, 0, 6] });
  const lounge = new THREE.Group(); lounge.position.set(13.6, 0, 9.6);
  add(lounge, new RoundedBoxGeometry(2.2, .42, .85, 3, .08), mVelvet, 0, .21, 0); add(lounge, new RoundedBoxGeometry(2.2, .5, .22, 3, .08), mVelvet, 0, .55, .32);
  add(lounge, new THREE.CylinderGeometry(.35, .35, .4, 32), mGold, 0, .2, -1.0); cock.add(lounge); COCKP.push({ g: lounge, t: 9 });
  [[4, 6], [12, 6], [8, 9.5]].forEach(([x, z]) => spot(x, 4.8, z, x, 0, z, 9, .65, 0xffc27a, 'cock'));
  point(1.2, 2.6, 7.2, 3, 5, 0xffb870, 'cock');

  /* ── 3 · Cena de gala: mesas redondas, sillas doradas, centros y lámparas colgantes ── */
  const gala = new THREE.Group(); scene.add(gala); const GALAP = [];
  const chairG = mergeGeometries([ni(new THREE.CylinderGeometry(.21, .2, .08, 20).translate(0, .46, 0)), ni(new THREE.TorusGeometry(.2, .018, 8, 24, Math.PI).translate(0, .95, .17)),
    ...[[-.15, -.12], [.15, -.12], [-.15, .15], [.15, .15]].map(([a, b]) => ni(new THREE.CylinderGeometry(.013, .011, .45, 8).translate(a, .225, b))), ni(new THREE.CylinderGeometry(.013, .013, .5, 8).translate(-.19, .72, .17)), ni(new THREE.CylinderGeometry(.013, .013, .5, 8).translate(.19, .72, .17))]);
  const GT = [[4.4, 4.6], [8, 4.4], [11.6, 4.6], [3.4, 7.6], [6.4, 7.8], [9.6, 7.8], [12.6, 7.6], [5.0, 10.6], [8, 10.8], [11, 10.6]];
  const galaChairs = new THREE.InstancedMesh(chairG, mGalaChair, GT.length * 8), galaSeats = new THREE.InstancedMesh(new THREE.CylinderGeometry(.19, .19, .05, 20).translate(0, .52, 0), mSeatCream, GT.length * 8);
  galaChairs.castShadow = galaSeats.castShadow = true; scene.add(galaChairs, galaSeats); const GC = [];
  const menu = menuTex();
  GT.forEach(([x, z], k) => { const g = new THREE.Group(); g.position.set(x, 0, z);
    add(g, new THREE.CylinderGeometry(.82, .98, .76, 48, 1, true), mCloth, 0, .38, 0); add(g, new THREE.CylinderGeometry(.83, .83, .02, 48), mCloth, 0, .76, 0);
    for (let c = 0; c < 8; c++) { const a = c / 8 * Math.PI * 2;
      add(g, new THREE.CylinderGeometry(.12, .12, .01, 24), mWhiteFl, Math.sin(a) * .6, .775, Math.cos(a) * .6, { cast: false });
      add(g, new THREE.CylinderGeometry(.025, .02, .13, 12), mGlass, Math.sin(a + .25) * .58, .835, Math.cos(a + .25) * .58, { cast: false });
      GC.push([x + Math.sin(a) * 1.18, z + Math.cos(a) * 1.18, a + Math.PI, k]); }
    const cp = new THREE.Group(); cp.position.y = .77; add(cp, new THREE.CylinderGeometry(.05, .07, .5, 16), mGold, 0, .25, 0); flowers(cp, 2.6, 40 + k, .52); g.add(cp);
    [[-.25, 0], [.25, 0], [0, .25]].forEach(([a, b]) => add(g, new THREE.CylinderGeometry(.022, .022, .12, 12), mCandle, a, .84, b));
    const mn = add(g, new THREE.PlaneGeometry(.12, .17), new THREE.MeshStandardMaterial({ map: menu, roughness: .8 }), 0, .78, .6, { rx: -Math.PI / 2, cast: false });
    gala.add(g); GALAP.push({ g, t: k });
    point(x, .95, z, .6, 2.6, 0xffb05c, 'gala'); });
  // lámparas colgantes sobre cada mesa
  const pend = new THREE.Group(); scene.add(pend);
  GT.forEach(([x, z]) => { const p = new THREE.Group(); p.position.set(x, 0, z); add(p, new THREE.SphereGeometry(.28, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mGold, 0, 0, 0, { rx: Math.PI }); add(p, new THREE.SphereGeometry(.12, 16, 12), mLamp, 0, -.06, 0, { cast: false });
    add(p, new THREE.CylinderGeometry(.006, .006, 4, 6), mChrome, 0, 2, 0, { cast: false }); pend.add(p); });
  [[8, 1.6]].forEach(([x, z]) => spot(x, 4.8, 6, x, .5, z, 22, .4, 0xffd9a8, 'gala', true));
  [[4, 7], [12, 7]].forEach(([x, z]) => spot(x, 4.9, z, x, 0, z, 6, .7, 0xffc27a, 'gala'));

  /* coreografía */
  const dm = new THREE.Object3D();
  const phase = (p, r) => p < r[2] ? cl((p - r[0]) / (r[1] - r[0])) : 1 - cl((p - r[2]) / (r[3] - r[2]));   // 0 → 1 al montar, 1 → 0 al desmontar
  const arrive = (p, r, t0, t1) => cl((p - lerp(r[0], r[1], t0)) / ((r[1] - r[0]) * (t1 - t0)));
  const leave = (p, r, t0, t1) => cl((p - lerp(r[2], r[3], t0)) / ((r[3] - r[2]) * (t1 - t0)));
  function pieceAt(g, home, k, l, slide) { // k: llegada 0→1, l: retirada 0→1
    const a = out(k), d = io(l); g.visible = k > 0 && l < 1;
    if (slide) g.position.set(home[0] + slide[0] * (1 - a), 0, home[2] + slide[2] * (1 - a) + 4 * d);
    else g.position.set(home[0], (1 - a) * .55 + d * .55, home[2]);
    g.scale.setScalar(Math.max(.0001, 1 - d * .15)); }
  COCKP.forEach(e => e.home = [e.g.position.x, 0, e.g.position.z]); GALAP.forEach(e => e.home = [e.g.position.x, 0, e.g.position.z]);
  pend.children.forEach(p => p.userData.home = p.position.clone());

  /* cámara */
  let W = 1, Hh = 1;
  function shot(p) { const asp = W / Hh, far = Math.pow(Math.max(1, 1.3 / asp), .85), c = io(cl(p / .95));
    const orbit = (R, pol, az, tx, ty, tz) => { camera.position.set(tx + R * Math.sin(pol) * Math.sin(az), ty + R * Math.cos(pol), tz + R * Math.sin(pol) * Math.cos(az)); camera.lookAt(tx, ty, tz); };
    if (mode === 'A') orbit((22.5 - 1.5 * c) * far, .94 - .04 * c, .62 - .06 * c, 8, .3, 6);
    else if (mode === 'B') orbit((20 - 1.2 * c) * far, 1.1 - .04 * c, 0, 8, 1.2, 5.4);
    else if (mode === 'C') orbit((23 - 2 * c) * far, .2 + .35 * c, .35 * c, 8, 0, 6.2);
    else { camera.position.set(8 + 2.4 * Math.sin(c * .9), 2.2 + .3 * c, (17.5 - 1.6 * c) * Math.max(1, far * .85)); camera.lookAt(8 - .4 * c, 1.3, 3); } }

  function resize() { W = root.clientWidth || 1; Hh = root.clientHeight || 1; renderer.setSize(W, Hh, false); composer.setSize(W, Hh); camera.aspect = W / Hh; camera.updateProjectionMatrix(); }
  resize();
  let last = 0;
  function set(p) { last = p;
    const pc = phase(p, CONF), pk = phase(p, COCK), pg = phase(p, GALA), base = soft(cl(p / .08));
    // conferencia: filas desde el escenario hacia atrás; se retiran desde atrás hacia delante
    CC.forEach(([x, z, r, i], n) => { const order = (r * 16 + (i < 8 ? 7 - i : i)) / 112;
      const k = arrive(p, CONF, order * .7, order * .7 + .3), l = leave(p, CONF, (1 - r / 7) * .6, (1 - r / 7) * .6 + .4), a = out(k), d = io(l);
      dm.position.set(x + (i < 8 ? -1 : 1) * d * 2.2, (1 - a) * .4, z); dm.rotation.set(0, 0, 0); dm.scale.setScalar(k > 0 && l < 1 ? 1 : .0001); dm.updateMatrix(); confChairs.setMatrixAt(n, dm.matrix); });
    confChairs.instanceMatrix.needsUpdate = true;
    conf.visible = pc > 0; conf.children.forEach(m => m.position.y = m.userData.y0 ?? (m.userData.y0 = m.position.y)); conf.children[0].position.y = conf.children[0].userData.y0 + (1 - out(pc)) * .6; conf.children[1].position.y = conf.children[1].userData.y0 + (1 - out(pc)) * .6; aisleC.scale.set(1, Math.max(.0001, io(pc)), 1);
    // cóctel
    COCKP.forEach(e => pieceAt(e.g, e.home, arrive(p, COCK, e.t * .06, e.t * .06 + .4), leave(p, COCK, e.t * .05, e.t * .05 + .5), e.slide));
    // gala: mesas, luego sillas, luego centros (dentro de cada mesa) y lámparas que bajan
    GALAP.forEach(e => pieceAt(e.g, e.home, arrive(p, GALA, e.t * .03, e.t * .03 + .3), 0));
    GC.forEach(([x, z, ry, k], n) => { const a = out(arrive(p, GALA, .32 + k * .025 + (n % 8) * .004, .32 + k * .025 + (n % 8) * .004 + .2)), a2 = cl(a);
      const rr = 1.18 + (1 - a2) * .45, ang = ry - Math.PI; dm.position.set(GT[k][0] + Math.sin(ang) * rr, 0, GT[k][1] + Math.cos(ang) * rr); dm.rotation.set(0, ang, 0); dm.scale.setScalar(a2 > 0 ? 1 : .0001); dm.updateMatrix(); galaChairs.setMatrixAt(n, dm.matrix); galaSeats.setMatrixAt(n, dm.matrix); });
    galaChairs.instanceMatrix.needsUpdate = galaSeats.instanceMatrix.needsUpdate = true;
    const dropP = io(arrive(p, GALA, .62, 1)); pend.visible = dropP > 0; pend.children.forEach(q => q.position.y = 2.7 + (1 - dropP) * 3.5);
    // pantalla: cambia con el evento
    [pc, pk, pg].forEach((v, i) => scrMats[i].opacity = soft(cl(v * 1.3 - .25)));
    // luz: conferencia fría y clara, cóctel ámbar, gala dorada y baja
    groups.conf.forEach(([l, i]) => l.intensity = i * soft(pc)); groups.cock.forEach(([l, i]) => l.intensity = i * soft(pk)); groups.gala.forEach(([l, i]) => l.intensity = i * soft(pg));
    groups.all.forEach(([l, i]) => l.intensity = i * base);
    const night = soft(pk * .5 + pg);
    hemi.intensity = lerp(.55, .18, night) * (.4 + .6 * base) + .12 * pc; key.intensity = lerp(1.1, .25, night) + .5 * pc;
    mCandle.emissiveIntensity = 2 * soft(pk * .6 + pg); mLamp.emissiveIntensity = .4 * base + 2.2 * dropP; mLed.emissiveIntensity = 1.6 * base;
    bloom.strength = .12 + .25 * night; renderer.toneMappingExposure = 1.05 + .1 * night; gtao.enabled = W > 700;
    shot(p); composer.render(); }
  return { set, resize: () => { resize(); set(last); } };
}
