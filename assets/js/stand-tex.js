// Texturas y utilidades compartidas por las escenas 3D del stand.
import * as THREE from './vendor/three/three.module.min.js';
export const cl = x => Math.max(0, Math.min(1, x));
export const ez = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
export const lerp = (a, b, t) => a + (b - a) * t;
export const INK = 0x0b0b0b, CREAM = new THREE.Color(0xF4F3EE), NIGHT = new THREE.Color(0x141312);
export function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

/* ── Texturas dibujadas ── */
export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
export function woodTex(base, seed, plank = 64) {
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
export function noiseTex(base, amp, seed, veins = 0) {
  return canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h); const r = rnd(seed);
    for (let i = 0; i < 26000; i++) { const v = r() > .5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${r() * amp})`; g.fillRect(r() * w, r() * h, 1 + r() * 2.5, 1 + r() * 2.5); }
    for (let k = 0; k < veins; k++) { g.strokeStyle = `rgba(140,120,95,${.08 + r() * .1})`; g.lineWidth = .6 + r() * 1.5; g.beginPath(); let x = r() * w, y = 0; g.moveTo(x, y); while (y < h) { x += (r() - .5) * 40; y += 20 + r() * 30; g.lineTo(x, y); } g.stroke(); }
  });
}
export const LOGO = 'M462 283H935V1467A353 353 0 0 0 1027 1703H935A473 473 0 0 1 462 1230Z';
export function drawLogo(g, x, y, hgt, fill, dot = '#D93333') {
  const s = hgt / 1470; g.save(); g.translate(x, y); g.scale(s, s); g.translate(-440, -260);
  g.fillStyle = fill; g.fill(new Path2D(LOGO)); g.fillStyle = dot; g.beginPath(); g.arc(1288, 1467, 237, 0, 7); g.fill(); g.restore();
}
export function spaced(g, txt, x, y, sp) { if ('letterSpacing' in g) { g.letterSpacing = sp + 'px'; g.fillText(txt, x, y); g.letterSpacing = '0px'; return; } let cx = x; for (const ch of txt) { g.fillText(ch, cx, y); cx += g.measureText(ch).width + sp; } }
export function wallGfxTex() { // logotipo de la pared negra
  return canvasTex(1024, 1024, (g) => {
    drawLogo(g, 150, 150, 170, '#EDE6D8');
    g.fillStyle = '#EDE6D8'; g.textBaseline = 'alphabetic';
    g.font = '400 82px Poppins, sans-serif'; spaced(g, 'LAUNCH', 150, 470, 30); spaced(g, 'STUDIO', 150, 580, 30);
    g.fillRect(152, 650, 60, 4);
    g.font = '400 40px Poppins, sans-serif'; ['EVENTS', 'EXHIBITIONS', 'BRAND EXPERIENCES'].forEach((t, i) => spaced(g, t, 150, 740 + i * 62, 8));
  });
}
export function counterGfxTex() {
  return canvasTex(1024, 256, (g) => { drawLogo(g, 250, 92, 78, '#1d1b19'); g.fillStyle = '#1d1b19'; g.font = '400 54px Poppins, sans-serif'; g.textBaseline = 'middle'; spaced(g, 'LAUNCH STUDIO', 330, 132, 16); });
}
export function columnGfxTex() {
  return canvasTex(256, 1536, (g) => {
    g.save(); g.translate(150, 1080); g.rotate(-Math.PI / 2); g.fillStyle = '#EDE6D8'; g.font = '400 74px Poppins, sans-serif'; g.textBaseline = 'middle'; spaced(g, 'LAUNCH STUDIO', 0, 0, 22); g.restore();
    drawLogo(g, 92, 1180, 96, '#EDE6D8');
  });
}
export function leafTex() {
  return canvasTex(128, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#93a37a'); gr.addColorStop(.5, '#5f7246'); gr.addColorStop(1, '#3d4b2c');
    g.fillStyle = gr; g.beginPath(); g.moveTo(2, h / 2); g.quadraticCurveTo(w * .45, -h * .05, w - 2, h / 2); g.quadraticCurveTo(w * .45, h * 1.05, 2, h / 2); g.fill();
    g.strokeStyle = 'rgba(220,230,190,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(4, h / 2); g.lineTo(w - 6, h / 2); g.stroke();
  });
}

