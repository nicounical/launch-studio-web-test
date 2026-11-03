// Stand de Launch Studio en 3D real (Three.js): plano → líneas → volúmenes → materiales → montaje → luz.
// createStand(contenedor) devuelve set(p, cam, ocultarNotas), con p de 0 a 1.
import * as THREE from './vendor/three/three.module.min.js';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';
import { RoundedBoxGeometry } from './vendor/three/RoundedBoxGeometry.js';

const cl = x => Math.max(0, Math.min(1, x));
const ez = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const RED = 0xC4221D, INK = 0x0b0b0b, WHITE = 0xF4F3EE, CREAM = 0xF6F5F0;

/* ── Texturas dibujadas ── */
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function woodTex() {
  return canvasTex(1024, 1024, (g, w, h) => {
    const r = rnd(7), pw = 64;
    for (let y = 0; y < h; y += pw) {
      let x = -Math.floor(r() * 400);
      while (x < w) {
        const len = 260 + r() * 380, t = r();
        const base = [214 + t * 22, 186 + t * 20, 148 + t * 18];
        g.fillStyle = `rgb(${base.map(v => v | 0).join(',')})`; g.fillRect(x, y, len, pw);
        for (let i = 0; i < 26; i++) { // veta
          g.strokeStyle = `rgba(120,80,40,${.04 + r() * .07})`; g.lineWidth = .6 + r() * 1.4;
          const yy = y + r() * pw; g.beginPath(); g.moveTo(x, yy);
          for (let xx = x; xx < x + len; xx += 40) g.lineTo(xx, yy + Math.sin(xx * .01 + i) * 2.2 * r());
          g.stroke();
        }
        g.fillStyle = 'rgba(70,45,20,.35)'; g.fillRect(x, y, 2, pw); x += len;
      }
      g.fillStyle = 'rgba(70,45,20,.3)'; g.fillRect(0, y, w, 1.5);
    }
  });
}
function concreteTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#d9d7d0'; g.fillRect(0, 0, w, h); const r = rnd(3);
    for (let i = 0; i < 9000; i++) { const v = 180 + r() * 60 | 0; g.fillStyle = `rgba(${v},${v},${v - 4},.25)`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
  });
}
function textTex(lines, opt = {}) {
  const { w = 1024, h = 256, color = '#fff', bg = null, font = '800', size = 150, track = -6, align = 'center', sub = null } = opt;
  return canvasTex(w, h, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
    g.fillStyle = color; g.textBaseline = 'middle'; g.textAlign = align;
    g.font = `${font} ${size}px Poppins, sans-serif`; if ('letterSpacing' in g) g.letterSpacing = track + 'px';
    const x = align === 'center' ? w / 2 : align === 'left' ? w * .06 : w * .94;
    const lh = size * .95, y0 = h / 2 - (lines.length - 1) * lh / 2 - (sub ? size * .25 : 0);
    lines.forEach((l, i) => g.fillText(l, x, y0 + i * lh));
    if (sub) { g.font = `400 ${size * .22}px "DM Mono", monospace`; if ('letterSpacing' in g) g.letterSpacing = '6px'; g.fillText(sub, x, y0 + lines.length * lh); }
  });
}
function logoTex(fill, circle = '#D93333', size = 512) {
  return canvasTex(size, size, (g, w) => {
    const s = w / 1600; g.save(); g.scale(s, s); g.translate(-200, -100);
    const p = new Path2D('M462 283H935V1467A353 353 0 0 0 1027 1703H935A473 473 0 0 1 462 1230Z');
    g.fillStyle = fill; g.fill(p); g.fillStyle = circle; g.beginPath(); g.arc(1288, 1467, 237, 0, 7); g.fill(); g.restore();
  });
}
function screenTex() {
  return canvasTex(512, 300, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2b1a18'); gr.addColorStop(.5, '#D93333'); gr.addColorStop(1, '#f1e4d8');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.92)'; g.font = '800 64px Poppins, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText('Launch', 36, h - 70);
    g.font = '400 18px "DM Mono", monospace'; g.fillText('BUILD TO STAND OUT', 40, h - 38);
  });
}

export async function createStand(root, imgBase = '../assets/img/') {
  try { await Promise.all([document.fonts.load('800 100px Poppins'), document.fonts.load('400 20px "DM Mono"')]); } catch (e) { }
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  root.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(CREAM); scene.fog = new THREE.Fog(CREAM, 26, 60);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(renderer), .04).texture;
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 200);
  const loader = new THREE.TextureLoader(); let redraw = () => { };
  const photo = (f) => { const t = loader.load(imgBase + f, () => redraw()); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

  /* luces */
  const hemi = new THREE.HemisphereLight(0xffffff, 0xcfc8b8, .95); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3e2, 3.8); sun.position.set(-6, 14, 12); sun.target.position.set(5, 0, 3.5);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 }); sun.shadow.bias = -.0004; sun.shadow.radius = 6;
  scene.add(sun, sun.target);

  /* materiales (se funden de transparente a opaco) */
  const mats = [];
  const M = (o) => { const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: .85, metalness: 0, transparent: true, opacity: 0, envMapIntensity: .45 }, o)); mats.push(m); return m; };
  const mWall = M({ color: WHITE, roughness: .92 }), mRed = M({ color: RED, roughness: .5 }), mBlack = M({ color: 0x1c1c1c, roughness: .35 }),
    mFab = M({ color: 0xE7E1D5, roughness: 1 }), mFab2 = M({ color: 0xC9BBA5, roughness: 1 }), mDark = M({ color: 0x2a2a2a, roughness: .6 }),
    mLeaf = M({ color: 0x4a6236, roughness: .75, side: THREE.DoubleSide }), mLeaf2 = M({ color: 0x66804a, roughness: .75, side: THREE.DoubleSide }), mMetal = M({ color: 0x222222, roughness: .3, metalness: .8 });
  const wood = woodTex(); wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(2.6, 1.8);
  const mWood = M({ map: wood, roughness: .55 }), mOak = M({ color: 0xB98B5E, roughness: .5 });
  const conc = concreteTex(); conc.wrapS = conc.wrapT = THREE.RepeatWrapping; conc.repeat.set(30, 30);

  const edgeMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0 });
  const groups = [], all = new THREE.Group(); scene.add(all);
  // cada pieza: grupo anclado al suelo que crece en altura, con sus aristas dibujadas
  function piece(geo, mat, x, y, z, opt = {}) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const mesh = new THREE.Mesh(geo, mat); mesh.position.y = y; mesh.castShadow = opt.cast !== false; mesh.receiveShadow = true;
    if (opt.rot) mesh.rotation.y = opt.rot;
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edgeMat); e.position.copy(mesh.position); e.rotation.copy(mesh.rotation);
    g.add(mesh, e); (opt.parent || all).add(g); if (!opt.parent) groups.push(g); return { g, mesh };
  }
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const RB = (w, h, d, r = .06) => new RoundedBoxGeometry(w, h, d, 3, r);
  const P = .12; // altura de la tarima

  // tarima con suelo de madera
  const platGeo = B(10.3, P, 7.3); const plat = new THREE.Mesh(platGeo, [mWall, mWall, mWood, mWall, mWall, mWall]); plat.position.set(5, P / 2, 3.5); plat.receiveShadow = true; all.add(plat);
  const platEdge = new THREE.LineSegments(new THREE.EdgesGeometry(platGeo), edgeMat); platEdge.position.copy(plat.position); all.add(platEdge);
  // suelo del pabellón
  const hall = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ map: conc, color: 0xd6d3cb, roughness: .7 })); hall.rotation.x = -Math.PI / 2; hall.receiveShadow = true; scene.add(hall);
  const grid = new THREE.GridHelper(40, 80, 0xb9b6ad, 0xd2cfc6); grid.position.set(5, .002, 3.5); grid.material.transparent = true; scene.add(grid);

  const Y = h => P + h / 2;
  piece(B(10, 3, .14), mWall, 5, Y(3), .07);                       // pared del fondo
  piece(B(.14, 3, 4.7), mWall, .07, Y(3), .14 + 2.35);              // pared lateral
  const alm = piece(B(2.4, 2.8, 2.1), mWall, 8.7, Y(2.8), .14 + 1.05); // almacén
  piece(B(3.3, .82, .78), mRed, 5.8, Y(.82), 5.65);                 // mostrador
  piece(B(3.38, .05, .86), mBlack, 5.8, P + .845, 5.65);             // encimera
  [5.15, 6.45].forEach(x => { piece(new THREE.CylinderGeometry(.2, .2, .06, 32), mBlack, x, P + .68, 4.95); piece(new THREE.CylinderGeometry(.025, .025, .64, 12), mMetal, x, P + .32, 4.95); });
  piece(B(.8, 2.8, .8), mRed, 1.0, Y(2.8), 6.0);                    // tótem
  piece(RB(2.5, .42, .85, .08), mFab, 2.9, P + .21, 2.95);          // sofá
  piece(RB(2.5, .5, .22, .08), mFab, 2.9, P + .55, 2.6);
  [3.25, 4.35].forEach(z => { piece(RB(.82, .42, .82, .1), mFab2, 5.05, P + .21, z); piece(RB(.82, .42, .18, .07), mFab2, 5.05, P + .5, z - .32); });
  piece(RB(1.3, .34, .72, .03), mOak, 3.0, P + .17, 4.1);           // mesa baja
  // macetas con planta
  [[1.0, 2.55], [9.35, 6.6], [7.2, 6.65]].forEach(([x, z], k) => {
    const p = piece(new THREE.CylinderGeometry(.28, .22, .55, 32), mDark, x, P + .275, z);
    const r = rnd(11 + k), leafGeo = new THREE.SphereGeometry(.07, 6, 4);
    for (let i = 0; i < 420; i++) {
      const a = r() * 6.28, rr = Math.sqrt(r()) * .5, hh = .65 + r() * 1.1 * (1 - rr * .8);
      const l = new THREE.Mesh(leafGeo, r() > .5 ? mLeaf : mLeaf2); l.position.set(Math.cos(a) * rr, P + hh, Math.sin(a) * rr); l.scale.set(.35 + r() * .3, .12, 1.0 + r() * .8); l.rotation.set(r() * 3, r() * 3, r() * 3); l.castShadow = true; p.g.add(l);
    }
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(.03, .04, .9, 8), mOak); tr.position.y = P + .9; p.g.add(tr);
  });
  // focos de brazo sobre la pared
  const spots = [];
  [1.9, 4.0, 6.1].forEach(x => {
    piece(B(.12, .1, .5), mBlack, x, P + 3.05, .38);
    const s = new THREE.SpotLight(0xffd9a0, 0, 9, .55, .6, 1.6); s.position.set(x, P + 2.95, .6); s.target.position.set(x + .2, 0, 3.2); s.castShadow = true; s.shadow.mapSize.set(1024, 1024); scene.add(s, s.target); spots.push(s);
  });

  /* gráficas (planos con textura, aparecen después) */
  const gfx = [], gm = (map, o = {}) => { const m = new THREE.MeshStandardMaterial(Object.assign({ map, transparent: true, opacity: 0, roughness: .7 }, o)); gfx.push(m); return m; };
  const plane = (w, h, m, x, y, z, ry = 0) => { const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); me.position.set(x, y, z); me.rotation.y = ry; me.receiveShadow = true; all.add(me); return me; };
  const ceram = photo('servicios/servicio-diseno-grafico-ceramica.jpg');
  plane(4.2, 2.3, gm(ceram), 2.45, P + 1.85, .146);
  plane(4.2, .6, gm(textTex(['Launch Studio'], { w: 1024, h: 150, bg: '#C4221D', size: 92, align: 'left', track: -4 })), 2.45, P + .42, .146);
  const scrM = gm(screenTex(), { emissive: 0xffffff, emissiveIntensity: 0, roughness: .2, metalness: .1 }); scrM.emissiveMap = scrM.map;
  plane(2.0, 1.15, gm(null, { color: 0x111111, roughness: .2 }), 5.9, P + 1.9, .147); plane(1.9, 1.07, scrM, 5.9, P + 1.9, .149);
  plane(3.5, .3, gm(textTex(['BRAND · SPACE · EXPERIENCE'], { w: 1024, h: 90, color: '#2a2a2a', font: '400', size: 40, track: 10 })), 5.9, P + 1.05, .147);
  plane(1.25, 2.2, gm(textTex(['Launch', 'Studio'], { w: 500, h: 880, bg: '#C4221D', size: 120, track: -5 })), 8.15, P + 1.35, .14 + 2.102);
  
  plane(1.8, .8, gm(textTex(['Launch'], { w: 900, h: 400, color: '#fff', size: 230 })), 1.0, P + 1.55, 6.401).rotation.z = Math.PI / 2;
  plane(.8, .8, gm(logoTex('#0b0b0b')), 1.401, P + 2.3, 6.0, Math.PI / 2);
  plane(2.6, .6, gm(textTex(['Launch'], { w: 900, h: 220, color: '#fff', size: 170 })), 5.8, P + .42, 6.041);
  const door = plane(.86, 2.05, gm(null, { color: 0xe6e4dd, roughness: .5 }), 9.3, P + 1.03, 2.252);
  // tira LED
  const ledM = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffd49a, emissiveIntensity: 0, transparent: true, opacity: 0 }); gfx.push(ledM);
  plane(9.6, .04, ledM, 5, P + 3.0 - .03, .146); plane(3.2, .04, ledM, 5.8, P + .04, 6.042);

  /* aro colgante */
  const ring = new THREE.Group(); scene.add(ring);
  const RW = 5.4, RD = 3.4, RH = .62, RT = .12;
  [[RW, RT, 0, -RD / 2], [RW, RT, 0, RD / 2], [RT, RD, -RW / 2, 0], [RT, RD, RW / 2, 0]].forEach(([w, d, x, z]) => {
    const m = new THREE.Mesh(B(w, RH, d), mRed); m.position.set(x, 0, z); m.castShadow = true; ring.add(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(B(w, RH, d)), edgeMat); e.position.copy(m.position); ring.add(e);
  });
  const rt1 = new THREE.Mesh(new THREE.PlaneGeometry(4.2, .5), gm(textTex(['Launch Studio'], { w: 1400, h: 170, size: 120, track: -4 }))); rt1.position.set(0, 0, RD / 2 + RT / 2 + .002); ring.add(rt1);
  const rt2 = new THREE.Mesh(new THREE.PlaneGeometry(2.6, .5), gm(textTex(['Launch'], { w: 900, h: 170, size: 120 }))); rt2.position.set(-RW / 2 - RT / 2 - .002, 0, 0); rt2.rotation.y = -Math.PI / 2; ring.add(rt2);
  const ringLed = new THREE.Mesh(new THREE.PlaneGeometry(RW, .03), ledM); ringLed.position.set(0, -RH / 2 - .005, RD / 2 + .062); ring.add(ringLed);
  [[-RW / 2, -RD / 2], [RW / 2, -RD / 2], [-RW / 2, RD / 2], [RW / 2, RD / 2]].forEach(([x, z]) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, 6, 6), mMetal); c.position.set(x, 3.3, z); ring.add(c); });
  ring.position.set(5, 12, 3.3);

  /* plano en el suelo (líneas que se dibujan) */
  const rect = (x0, z0, x1, z1) => [x0, z0, x1, z0, x1, z0, x1, z1, x1, z1, x0, z1, x0, z1, x0, z0];
  const segs = [].concat(rect(0, 0, 10, .14), rect(0, .14, .14, 4.84), rect(7.5, .14, 9.9, 2.24), rect(4.15, 5.26, 7.45, 6.04), rect(.6, 5.6, 1.4, 6.4), rect(1.65, 2.5, 4.15, 3.37), rect(4.64, 2.84, 5.46, 4.76), rect(2.35, 3.74, 3.65, 4.46));
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI / 2, b = (i + 1) / 16 * Math.PI / 2; segs.push(7.75 + Math.cos(a) * .9, 2.24 + Math.sin(a) * .9, 7.75 + Math.cos(b) * .9, 2.24 + Math.sin(b) * .9); }
  segs.push(7.75, 2.24, 7.75, 3.14);
  [[1.0, 2.55], [9.35, 6.6], [7.2, 6.65]].forEach(([x, z]) => { for (let i = 0; i < 20; i++) { const a = i / 20 * 6.283, b = (i + 1) / 20 * 6.283; segs.push(x + Math.cos(a) * .28, z + Math.sin(a) * .28, x + Math.cos(b) * .28, z + Math.sin(b) * .28); } });
  const pg = new THREE.BufferGeometry(), pv = []; for (let i = 0; i < segs.length; i += 4) pv.push(segs[i], P + .004, segs[i + 1], segs[i + 2], P + .004, segs[i + 3]);
  pg.setAttribute('position', new THREE.Float32BufferAttribute(pv, 3));
  const planMat = new THREE.LineBasicMaterial({ color: INK, transparent: true }); const planLines = new THREE.LineSegments(pg, planMat); scene.add(planLines);
  const nPlan = pv.length / 3;
  const dimV = [0, P, -.6, 10, P, -.6, 0, P, -.75, 0, P, -.45, 10, P, -.75, 10, P, -.45, 10.7, P, 0, 10.7, P, 7, 10.55, P, 0, 10.85, P, 0, 10.55, P, 7, 10.85, P, 7, 0, P, 0, 10, P, 0, 10, P, 0, 10, P, 7, 10, P, 7, 0, P, 7, 0, P, 7, 0, P, 0];
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(dimV, 3));
  const dimMat = new THREE.LineBasicMaterial({ color: 0xD93333, transparent: true, opacity: 0 }); scene.add(new THREE.LineSegments(dg, dimMat));
  const ringPlan = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(RW, RD).rotateX(-Math.PI / 2)), new THREE.LineDashedMaterial({ color: 0xD93333, dashSize: .2, gapSize: .15, transparent: true, opacity: 0 }));
  ringPlan.position.set(5, P + .006, 3.3); ringPlan.computeLineDistances(); scene.add(ringPlan);

  /* notas y textos del plano (HTML sobre el lienzo) */
  const ov = document.createElement('div'); ov.className = 'callouts'; root.appendChild(ov);
  ov.innerHTML = '<svg></svg>';
  const svg = ov.firstChild;
  const CO = [
    { a: [2.2, P + 3.0, .14], r: [.36, .62], t: 'Altura 3 m', s: 'Paredes autoportantes', dx: -170, dy: -60 },
    { a: [8.7, P + 2.0, 2.24], r: [.4, .62], t: 'Almacén', s: '2,4 × 2,1 m · con llave', dx: 90, dy: -70 },
    { a: [2.0, P + 1.8, .15], r: [.64, .82], t: 'Pared gráfica', s: 'Impresión textil · 4,2 × 2,3 m', dx: -210, dy: -40 },
    { a: [5.8, P + .7, 6.04], r: [.64, .82], t: 'Mostrador', s: 'Frontal lacado · encimera negra', dx: 70, dy: 70 },
    { a: 'ring', r: [.86, 1.1], t: 'Aro colgante', s: '5,4 × 3,4 m · marca a 360°', dx: -210, dy: -50 },
    { a: [6.1, P + 3.0, .5], r: [.86, 1.1], t: 'Iluminación', s: 'Focos LED orientables', dx: 90, dy: -70 }];
  const PL = [{ a: [5, P, -.6], t: '10,00 m', c: 'red' }, { a: [10.7, P, 3.5], t: '7,00 m', c: 'red' }, { a: [3.6, P, 1.3], t: '70 m²', c: 'big' }, { a: [8.7, P, 1.2], t: 'ALMACÉN' }, { a: [5.8, P, 5.65], t: 'MOSTRADOR' }, { a: [2.9, P, 3.0], t: 'LOUNGE' }, { a: [1.0, P, 6.75], t: 'TÓTEM' }, { a: [5, P, 3.3], t: 'ARO COLGANTE · COTA +3,40', c: 'red' }];
  CO.forEach(c => { const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.innerHTML = '<line/><circle r="4.5"/>'; g.style.opacity = 0; svg.appendChild(g); c.g = g; const d = document.createElement('div'); d.className = 'co'; d.style.opacity = 0; d.innerHTML = '<b>' + c.t + '</b><span>' + c.s + '</span>'; ov.appendChild(d); c.el = d; });
  PL.forEach(l => { const d = document.createElement('div'); d.className = 'plab' + (l.c ? ' ' + l.c : ''); d.textContent = l.t; d.style.opacity = 0; ov.appendChild(d); l.el = d; });
  const v3 = new THREE.Vector3();
  const proj = (a) => { v3.set(a[0], a[1], a[2]).project(camera); return [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H]; };

  let W = 1, H = 1;
  function resize() { W = root.clientWidth || 1; H = root.clientHeight || 1; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); }
  resize();

  const T = new THREE.Vector3(5, .6, 3.5);
  let last = [0, null, false];
  function set(p, cam, hideCo) {
    last = [p, cam, hideCo]; cam = cam || {};
    const plan = cl(p / .24), tilt = ez(cl((p - .24) / .2)), rise = ez(cl((p - .3) / .24)), fill = cl((p - .52) / .14), gfxA = cl((p - .6) / .12), ban = ez(cl((p - .74) / .2)), lit = cl((p - .86) / .1);
    // plano
    planLines.geometry.setDrawRange(0, Math.floor(nPlan * cl(plan * 1.15) / 2) * 2); planMat.opacity = (1 - .85 * rise) * (1 - fill);
    dimMat.opacity = cl((plan - .5) / .4) * (1 - fill); ringPlan.material.opacity = cl((plan - .6) / .3) * (1 - rise);
    grid.material.opacity = (1 - .75 * fill) * .9;
    // volúmenes
    const sy = Math.max(.0001, rise); groups.forEach(g => { g.scale.y = sy; g.visible = rise > .002; });
    plat.visible = platEdge.visible = rise > .002; plat.scale.y = sy; platEdge.scale.y = sy;
    edgeMat.opacity = rise > .002 ? (1 - .9 * fill) * .9 : 0;
    mats.forEach(m => { m.opacity = fill; m.transparent = fill < .999; m.depthWrite = fill > .5; });
    gfx.forEach(m => { m.opacity = gfxA; });
    // aro y luz
    ring.position.y = P + 3.55 + (1 - ban) * 9; ring.visible = ban > .001;
    spots.forEach(s => s.intensity = lit * 140); ledM.emissiveIntensity = lit * 3; scrM.emissiveIntensity = .2 + lit * .9;
    hemi.intensity = .95 - .35 * lit; sun.intensity = 3.8 - 1.4 * lit; renderer.toneMappingExposure = .95 + .08 * lit;
    // cámara
    const narrow = W / H < 1, R0 = 14.2 * Math.pow(Math.max(1, 1.3 / (W / H)), .85) * (cam.s ? 1 / cam.s : 1);
    const polar = .02 + (1.02 - .02) * tilt + (cam.a || 0), az = .62 * tilt + (cam.b || 0) - .12 * ban;
    const tz = T.z - (cam.y || 0) * .08, tx = T.x + (cam.x || 0) * .08;
    camera.position.set(tx + R0 * Math.sin(polar) * Math.sin(az), T.y + R0 * Math.cos(polar), tz + R0 * Math.sin(polar) * Math.cos(az));
    camera.up.set(0, 1, 0); camera.lookAt(tx, T.y + (narrow ? -.6 : -.2), tz); camera.updateMatrixWorld();
    renderer.render(scene, camera);
    // notas
    CO.forEach(c => {
      const on = !hideCo && p >= c.r[0] && p < c.r[1]; c.g.style.opacity = c.el.style.opacity = on ? 1 : 0; if (!on) return;
      const [x, y] = proj(c.a === 'ring' ? [3.2, ring.position.y + .2, 3.3 + RD / 2] : c.a), sc = W < 700 ? .55 : 1, lw = c.el.offsetWidth, lh = c.el.offsetHeight;
      let lx = x + c.dx * sc, ly = y + c.dy * sc; lx = Math.max(8, Math.min(W - lw - 8, lx)); ly = Math.max(W < 700 ? 150 : 180, Math.min(H - lh - 110, ly));
      c.el.style.transform = `translate(${lx.toFixed(1)}px,${ly.toFixed(1)}px)`;
      const ln = c.g.firstChild, ci = c.g.lastChild; ln.setAttribute('x1', x); ln.setAttribute('y1', y); ln.setAttribute('x2', lx + (c.dx < 0 ? lw : 0)); ln.setAttribute('y2', ly + lh / 2); ci.setAttribute('cx', x); ci.setAttribute('cy', y);
    });
    const po = cl((plan - .55) / .35) * (1 - cl((p - .3) / .06));
    PL.forEach(l => { l.el.style.opacity = po; if (po <= 0) return; const [x, y] = proj(l.a); l.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`; });
  }
  redraw = () => set(...last);
  return { set, resize: () => { resize(); redraw(); } };
}
