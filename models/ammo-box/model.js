// Параметрична модель короба під стрічку 7.62×54R з м'яким чохлом Multicam.
// Усі розміри — у міліметрах. Система координат: Y — вгору, пластиковий
// торець із кришкою дивиться в +Z, тканинний корпус іде назад у −Z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const DIMENSIONS = { height: 250, width: 104, depth: 151 };

const H = DIMENSIONS.height; // висота (по торцю)
const W = DIMENSIONS.width; // ширина торця
const D = 145; // глибина тканинного корпусу від площини торця
const R = 45; // радіус заокруглення дальніх кутів чохла
const Z_FABRIC = -4; // де тканина стикується з пластиком
const BULGE = 3; // наскільки м'яка стінка випинається посередині
const TEX_MM = 220; // період камуфляжної текстури, мм
const TEX_PX = 1024;

/* ------------------------------------------------------------------ */
/* Процедурні текстури                                                  */
/* ------------------------------------------------------------------ */

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Безшовний value-noise: решітка з періодом px × py.
function makeNoise(seed) {
  const rnd = mulberry32(seed);
  const perm = new Uint8Array(512);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const hash = (i, j) => perm[(perm[i & 255] + j) & 511] / 255;
  const noise = (x, y, px, py) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let xf = x - xi;
    let yf = y - yi;
    xf = xf * xf * (3 - 2 * xf);
    yf = yf * yf * (3 - 2 * yf);
    const x0 = ((xi % px) + px) % px;
    const y0 = ((yi % py) + py) % py;
    const x1 = (x0 + 1) % px;
    const y1 = (y0 + 1) % py;
    const a = hash(x0, y0);
    const b = hash(x1, y0);
    const c = hash(x0, y1);
    const d = hash(x1, y1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (u, v, px, py, octaves) => {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      const f = 1 << o;
      sum += amp * noise(u * px * f, v * py * f, px * f, py * f);
      norm += amp;
      amp *= 0.5;
    }
    return sum / norm;
  };
}

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Висота переплетення кордури: період 4 px ≈ 1.2 мм.
function weaveHeight(x, y) {
  const cell = ((x >> 1) + (y >> 1)) & 1;
  return cell ? (y & 1 ? 0.85 : 0.45) : x & 1 ? 0.8 : 0.4;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function camoTexture() {
  const size = TEX_PX;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const nWarp = makeNoise(11);
  const nBase = makeNoise(23);
  const nGreen = makeNoise(37);
  const nBrown = makeNoise(41);
  const nDark = makeNoise(53);
  const nCream = makeNoise(67);

  const tan = hex(0xa89877);
  const sand = hex(0x978a6b);
  const khaki = hex(0x898a62);
  const green = hex(0x5f6b3d);
  const greenDeep = hex(0x4b5831);
  const brown = hex(0x6e5540);
  const dark = hex(0x35281e);
  const cream = hex(0xcfc4a4);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const wu = u + 0.05 * (nWarp(u, v, 4, 4, 2) - 0.5);
      const wv = v + 0.05 * (nWarp(u + 0.37, v + 0.61, 4, 4, 2) - 0.5);

      const t0 = nBase(wu, wv, 3, 3, 3);
      let c = t0 < 0.5 ? mix(sand, tan, smooth(0.35, 0.5, t0)) : mix(tan, khaki, smooth(0.5, 0.68, t0));

      const g = nGreen(wu, wv, 4, 5, 4);
      c = mix(c, mix(green, greenDeep, smooth(0.55, 0.75, nBase(u, v, 6, 6, 2))), smooth(0.49, 0.53, g));

      const b = nBrown(wu, wv, 3, 5, 4);
      c = mix(c, brown, smooth(0.555, 0.575, b));

      const cr = nCream(wu, wv, 7, 9, 3);
      c = mix(c, cream, smooth(0.665, 0.675, cr));

      const d = nDark(wu, wv, 5, 8, 4);
      c = mix(c, dark, smooth(0.615, 0.625, d));

      const w = 0.9 + 0.12 * weaveHeight(x, y);
      const i = (y * size + x) * 4;
      img.data[i] = Math.min(255, c[0] * w);
      img.data[i + 1] = Math.min(255, c[1] * w);
      img.data[i + 2] = Math.min(255, c[2] * w);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.name = 'multicam';
  return tex;
}

// Карта нормалей з карти висот (0…1), рядки канви йдуть згори вниз.
function normalsFromHeight(heights, w, h, strength, wrap) {
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const at = (x, y) => {
    if (wrap) return heights[((y + h) % h) * w + ((x + w) % w)];
    return heights[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const gy = (at(x, y - 1) - at(x, y + 1)) * strength;
      const len = Math.hypot(gx, gy, 1);
      const i = (y * w + x) * 4;
      img.data[i] = ((-gx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-gy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  if (wrap) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function weaveNormalTexture() {
  const size = TEX_PX;
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) heights[y * size + x] = weaveHeight(x, y);
  const tex = normalsFromHeight(heights, size, size, 1.1, true);
  tex.name = 'cordura-weave';
  return tex;
}

// Малює рельєф на канві (світле — вище) і повертає карту нормалей.
function reliefTexture(wMm, hMm, pxPerMm, draw, strength = 5) {
  const w = Math.round(wMm * pxPerMm);
  const h = Math.round(hMm * pxPerMm);
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.filter = `blur(${pxPerMm * 0.3}px)`;
  // мм → px, вісь Y канви донизу
  ctx.setTransform(pxPerMm, 0, 0, -pxPerMm, 0, h);
  draw(ctx);
  ctx.restore();
  const data = ctx.getImageData(0, 0, w, h).data;
  const heights = new Float32Array(w * h);
  const rnd = mulberry32(5);
  for (let i = 0; i < w * h; i++) heights[i] = data[i * 4] / 255 + (rnd() - 0.5) * 0.012; // литтєва шорсткість
  return normalsFromHeight(heights, w, h, strength, false);
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ------------------------------------------------------------------ */
/* Геометричні помічники                                                */
/* ------------------------------------------------------------------ */

// Бічний профіль чохла у площині (z, y) з нормалями назовні.
function profilePath(closed) {
  const zF = Z_FABRIC;
  const zB = zF - D;
  const r = 3;
  const segs = [];
  const zStart = closed ? zF - r : zF;
  segs.push({ line: [zStart, 0, zB + R, 0], n: [0, -1] });
  segs.push({ arc: [zB + R, R, R, -Math.PI / 2, -Math.PI] });
  segs.push({ line: [zB, R, zB, H - R], n: [-1, 0] });
  segs.push({ arc: [zB + R, H - R, R, Math.PI, Math.PI / 2] });
  segs.push({ line: [zB + R, H, closed ? zF - r : zF, H], n: [0, 1] });
  if (closed) {
    segs.push({ arc: [zF - r, H - r, r, Math.PI / 2, 0] });
    segs.push({ line: [zF, H - r, zF, r], n: [1, 0] });
    segs.push({ arc: [zF - r, r, r, 0, -Math.PI / 2] });
  }

  const pts = [];
  for (const seg of segs) {
    if (seg.line) {
      const [z0, y0, z1, y1] = seg.line;
      const n = Math.max(1, Math.ceil(Math.hypot(z1 - z0, y1 - y0) / 8));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        pts.push({ z: z0 + (z1 - z0) * t, y: y0 + (y1 - y0) * t, nz: seg.n[0], ny: seg.n[1] });
      }
    } else {
      const [cz, cy, rad, a0, a1] = seg.arc;
      const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * rad) / 2.5));
      for (let k = 0; k < n; k++) {
        const a = a0 + ((a1 - a0) * k) / n;
        pts.push({ z: cz + rad * Math.cos(a), y: cy + rad * Math.sin(a), nz: Math.cos(a), ny: Math.sin(a) });
      }
    }
  }
  if (closed) pts.push({ ...pts[0] });
  else pts.push({ z: zF, y: H, nz: 0, ny: 1 });

  let s = 0;
  pts[0].s = 0;
  for (let i = 1; i < pts.length; i++) {
    s += Math.hypot(pts[i].z - pts[i - 1].z, pts[i].y - pts[i - 1].y);
    pts[i].s = s;
  }
  return { pts, length: s };
}

// Точка профілю на довжині дуги s: позиція, нормаль, дотична.
function pathAt(path, s) {
  const { pts } = path;
  let i = 1;
  while (i < pts.length - 1 && pts[i].s < s) i++;
  const a = pts[i - 1];
  const b = pts[i];
  const t = (s - a.s) / (b.s - a.s || 1);
  const nz = a.nz + (b.nz - a.nz) * t;
  const ny = a.ny + (b.ny - a.ny) * t;
  const nl = Math.hypot(nz, ny);
  const tz = b.z - a.z;
  const ty = b.y - a.y;
  const tl = Math.hypot(tz, ty) || 1;
  return {
    z: a.z + (b.z - a.z) * t,
    y: a.y + (b.y - a.y) * t,
    n: new THREE.Vector3(0, ny / nl, nz / nl),
    t: new THREE.Vector3(0, ty / tl, tz / tl),
  };
}

// Протягування замкненого перерізу вздовж набору рамок {p, u, v, s}.
function sweep(frames, section, { closePath = false } = {}) {
  const fr = closePath ? [...frames, { ...frames[0], s: frames.at(-1).s + frames.at(-1).p.distanceTo(frames[0].p) }] : frames;
  const sec = [...section, section[0]];
  const perim = [0];
  for (let k = 1; k < sec.length; k++) {
    perim.push(perim[k - 1] + Math.hypot(sec[k][0] - sec[k - 1][0], sec[k][1] - sec[k - 1][1]));
  }
  const pos = [];
  const uv = [];
  const idx = [];
  const tmp = new THREE.Vector3();
  for (const f of fr) {
    for (let k = 0; k < sec.length; k++) {
      tmp.copy(f.p).addScaledVector(f.u, sec[k][0]).addScaledVector(f.v, sec[k][1]);
      pos.push(tmp.x, tmp.y, tmp.z);
      uv.push(f.s / TEX_MM, perim[k] / TEX_MM);
    }
  }
  const row = sec.length;
  for (let i = 0; i < fr.length - 1; i++) {
    for (let k = 0; k < row - 1; k++) {
      const a = i * row + k;
      const b = (i + 1) * row + k;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function squircle(cx, cy, rx, ry, n = 18, p = 0.55) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    out.push([cx + rx * Math.sign(c) * Math.abs(c) ** p, cy + ry * Math.sign(s) * Math.abs(s) ** p]);
  }
  return out;
}

function planarUV(geo, x0, y0, w, h) {
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getX(i) - x0) / w;
    uv[i * 2 + 1] = (p.getY(i) - y0) / h;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

function roundedRectShape(x0, y0, x1, y1, r) {
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

// Видавлює плаский контур уперед від площини zBack на depth.
function slab(shape, zBack, depth, bevel = 0.6) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, depth - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geo.translate(0, 0, zBack + bevel);
  return geo;
}

// Видавлює профіль (z, y) уздовж X від x0 до x1.
function profileAlongX(points, x0, x1, bevel = 0.5) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: x1 - x0 - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: 2,
  });
  // (z, y, x) → (x, y, z)
  geo.rotateY(-Math.PI / 2);
  geo.translate(x1 - bevel, 0, 0);
  return geo;
}

function box(w, h, d, r, x, y, z) {
  const geo = new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) - 0.001);
  geo.translate(x, y, z);
  return geo;
}

function mesh(geo, mat, name) {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ------------------------------------------------------------------ */
/* Модель                                                              */
/* ------------------------------------------------------------------ */

export function buildAmmoBox() {
  const camo = camoTexture();
  const weave = weaveNormalTexture();

  const mat = {
    fabric: new THREE.MeshStandardMaterial({
      name: 'Multicam cordura',
      map: camo,
      normalMap: weave,
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughness: 0.93,
      side: THREE.DoubleSide,
    }),
    webbing: new THREE.MeshStandardMaterial({
      name: 'Multicam webbing',
      map: camo,
      normalMap: weave,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughness: 0.9,
      side: THREE.DoubleSide,
    }),
    coyote: new THREE.MeshStandardMaterial({
      name: 'Coyote binding',
      color: 0x5f4a31,
      normalMap: weave,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 0.9,
      side: THREE.DoubleSide,
    }),
    zipperTeeth: new THREE.MeshStandardMaterial({ name: 'Coyote zipper teeth', color: 0x524029, roughness: 0.55 }),
    zipperMetal: new THREE.MeshStandardMaterial({ name: 'Coyote slider', color: 0x5a4731, metalness: 0.6, roughness: 0.45 }),
    plastic: new THREE.MeshStandardMaterial({ name: 'Olive plastic', color: 0x2b3123, roughness: 0.66 }),
    steel: new THREE.MeshStandardMaterial({ name: 'Black steel', color: 0x1d1e1f, metalness: 0.55, roughness: 0.42 }),
    spring: new THREE.MeshStandardMaterial({ name: 'Spring steel', color: 0x8d8f91, metalness: 1, roughness: 0.32 }),
    screw: new THREE.MeshStandardMaterial({ name: 'Black screw', color: 0x151515, metalness: 0.3, roughness: 0.35 }),
    cavity: new THREE.MeshStandardMaterial({ name: 'Feed opening', color: 0x0b0c09, roughness: 1 }),
  };

  const root = new THREE.Group();
  root.name = 'AmmoBox_7.62x54R';

  /* ---------- тканинний корпус ---------- */
  const fabric = new THREE.Group();
  fabric.name = 'Pouch';
  root.add(fabric);

  const gussetPath = profilePath(false);
  const outline = profilePath(true);

  // Стрічка стінок, що огинає профіль (дно → спинка → верх).
  {
    const nx = 26;
    const pos = [];
    const uv = [];
    const idx = [];
    for (const pt of gussetPath.pts) {
      for (let j = 0; j <= nx; j++) {
        const x = -W / 2 + (W * j) / nx;
        const t = (2 * x) / W;
        const b = BULGE * Math.max(0, 1 - t * t) ** 0.6;
        pos.push(x, pt.y + pt.ny * b, pt.z + pt.nz * b);
        uv.push(pt.s / TEX_MM, (x + W / 2) / TEX_MM + 0.5);
      }
    }
    const row = nx + 1;
    for (let i = 0; i < gussetPath.pts.length - 1; i++) {
      for (let j = 0; j < nx; j++) {
        const a = i * row + j;
        const b = (i + 1) * row + j;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    fabric.add(mesh(geo, mat.fabric, 'Pouch_Gusset'));
  }

  // Бічні панелі з ущільнювачем.
  for (const side of [1, -1]) {
    const pts2 = outline.pts.slice(0, -1).map((p) => new THREE.Vector2(side > 0 ? -p.z : p.z, p.y));
    const geo = new THREE.ShapeGeometry(new THREE.Shape(pts2), 1);
    geo.rotateY((side * Math.PI) / 2);
    geo.translate((side * W) / 2, 0, 0);
    const p = geo.attributes.position;
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      uv[i * 2] = (-side * p.getZ(i)) / TEX_MM + (side > 0 ? 0.21 : 0.63);
      uv[i * 2 + 1] = p.getY(i) / TEX_MM + (side > 0 ? 0 : 0.4);
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    fabric.add(mesh(geo, mat.fabric, side > 0 ? 'Pouch_Side_R' : 'Pouch_Side_L'));

    // Окантовка стропою по периметру панелі.
    const frames = outline.pts.slice(0, -1).map((p) => ({
      p: new THREE.Vector3((side * W) / 2, p.y, p.z),
      u: new THREE.Vector3(side, 0, 0),
      v: new THREE.Vector3(0, p.ny, p.nz),
      s: p.s,
    }));
    fabric.add(mesh(sweep(frames, squircle(-1.2, -1.2, 3.5, 3.5), { closePath: true }), mat.coyote, 'Binding_' + (side > 0 ? 'R' : 'L')));
  }

  // Окантовка переднього краю верхньої та нижньої стінок.
  for (const top of [0, 1]) {
    const y = top ? H : 0;
    const ny = top ? 1 : -1;
    const frames = [];
    for (let j = 0; j <= 12; j++) {
      const x = -W / 2 + 2 + ((W - 4) * j) / 12;
      frames.push({ p: new THREE.Vector3(x, y, Z_FABRIC), u: new THREE.Vector3(0, ny, 0), v: new THREE.Vector3(0, 0, 1), s: x });
    }
    const sec = squircle(1.0, -1.4, 3.6, 4.2);
    fabric.add(mesh(sweep(frames, sec), mat.coyote, top ? 'Binding_Top_Front' : 'Binding_Bottom_Front'));
  }

  // Блискавка по центру стінок: від верху через спинку до низу.
  {
    const sStart = 50;
    const sEnd = gussetPath.length - 95;
    const frames = [];
    for (let s = sStart; s <= sEnd; s += 4) {
      const a = pathAt(gussetPath, s);
      frames.push({
        p: new THREE.Vector3(0, a.y + a.n.y * BULGE, a.z + a.n.z * BULGE),
        u: new THREE.Vector3(1, 0, 0),
        v: a.n,
        s,
      });
    }
    const tape = [[-12, 0], [12, 0], [12.2, 0.9], [-12.2, 0.9]];
    fabric.add(mesh(sweep(frames, tape), mat.coyote, 'Zipper_Tape'));

    const tooth = new THREE.BoxGeometry(6.6, 2, 1.6);
    const teeth = [];
    const m = new THREE.Matrix4();
    let k = 0;
    for (let s = sStart + 4; s <= sEnd - 1; s += 2.3, k++) {
      const a = pathAt(gussetPath, s);
      const x = k % 2 ? 0.7 : -0.7;
      m.makeBasis(new THREE.Vector3(1, 0, 0), a.n, a.t);
      m.setPosition(x, a.y + a.n.y * (BULGE + 1.8), a.z + a.n.z * (BULGE + 1.8));
      teeth.push(tooth.clone().applyMatrix4(m));
    }
    fabric.add(mesh(mergeGeometries(teeth), mat.zipperTeeth, 'Zipper_Teeth'));

    // Бігунок із пулером на нижній стінці.
    const a = pathAt(gussetPath, sStart + 4);
    m.makeBasis(new THREE.Vector3(1, 0, 0), a.n, a.t);
    const slider = new THREE.Group();
    slider.name = 'Zipper_Slider';
    slider.applyMatrix4(m);
    slider.position.set(0, a.y + a.n.y * (BULGE + 3), a.z + a.n.z * (BULGE + 3));
    slider.add(mesh(box(11, 4.4, 17, 1.6, 0, 0, 0), mat.zipperMetal, 'Slider_Body'));
    slider.add(mesh(box(6, 1.6, 13, 0.7, 0, 2.6, -9), mat.zipperMetal, 'Slider_Pull'));
    fabric.add(slider);

    // Паракорд від пулера з вузлом на кінці.
    const cordPts = [];
    for (const [s, lift, x] of [[sStart - 12, 4.8, 0], [sStart - 18, 6.6, 1.2], [sStart - 26, 6.8, -1.5], [sStart - 34, 6.8, 0.8], [sStart - 40, 6.8, 0]]) {
      const c = pathAt(gussetPath, s);
      cordPts.push(new THREE.Vector3(x, c.y + c.n.y * (BULGE + lift), c.z + c.n.z * (BULGE + lift)));
    }
    const cord = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cordPts), 40, 1.5, 8);
    fabric.add(mesh(cord, mat.coyote, 'Paracord'));
    const knotAt = cordPts.at(-1);
    const knot = new THREE.IcosahedronGeometry(3.1, 2);
    knot.translate(knotAt.x, knotAt.y, knotAt.z);
    fabric.add(mesh(knot, mat.coyote, 'Paracord_Knot'));

    // Клапан-«гараж» для бігунка.
    const flap = box(72, 2.2, 38, 1, 0, -(BULGE + 1.1), Z_FABRIC - 27);
    const fp = flap.attributes.position;
    for (let i = 0; i < fp.count; i++) flap.attributes.uv.setXY(i, fp.getX(i) / TEX_MM + 0.3, fp.getZ(i) / TEX_MM + 0.1);
    fabric.add(mesh(flap, mat.fabric, 'Zipper_Garage'));
  }

  // Ручка зі стропи на верхній стінці.
  {
    const y0 = H + BULGE + 1.2;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, y0, Z_FABRIC - 10),
      new THREE.Vector3(0, y0, Z_FABRIC - 24),
      new THREE.Vector3(0, y0 + 20, Z_FABRIC - 32),
      new THREE.Vector3(0, y0 + 40, Z_FABRIC - 52),
      new THREE.Vector3(0, y0 + 38, Z_FABRIC - 76),
      new THREE.Vector3(0, y0 + 16, Z_FABRIC - 88),
      new THREE.Vector3(0, y0, Z_FABRIC - 92),
      new THREE.Vector3(0, y0, Z_FABRIC - 104),
    ]);
    const n = 90;
    const frames = [];
    const len = curve.getLength();
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      frames.push({ p, u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, -tan.z, tan.y), s: t * len });
    }
    const strap = [[-12.5, -1], [12.5, -1], [12.5, 1], [-12.5, 1]];
    fabric.add(mesh(sweep(frames, strap), mat.webbing, 'Handle'));
  }

  /* ---------- пластиковий торець ---------- */
  const plastic = new THREE.Group();
  plastic.name = 'Frame';
  root.add(plastic);

  const xL = -W / 2 + 1;
  const xR = W / 2 - 1;
  const lidBottom = 204;

  // Основна плита з рельєфом рамки й поля для маркування.
  {
    const faceRelief = reliefTexture(W, H, 4, (ctx) => {
      ctx.translate(W / 2, 0);
      ctx.strokeStyle = '#5a5a5a';
      ctx.lineWidth = 1.2;
      roundRectPath(ctx, -W / 2 + 4.5, 5, W - 9, lidBottom - 14, 4);
      ctx.stroke();
      ctx.fillStyle = '#6c6c6c';
      roundRectPath(ctx, -30, 18, 60, 44, 3);
      ctx.fill();
      ctx.strokeStyle = '#9a9a9a';
      ctx.lineWidth = 0.9;
      roundRectPath(ctx, -27, 21, 54, 38, 2);
      ctx.stroke();
    });
    const face = new THREE.MeshStandardMaterial({ name: 'Olive plastic (face)', color: 0x2b3123, roughness: 0.66, normalMap: faceRelief });
    const geo = planarUV(slab(roundedRectShape(xL, 1, xR, H - 1, 6), -6.4, 8.4, 1.2), -W / 2, 0, W, H);
    plastic.add(mesh(geo, face, 'Frame_Plate'));
  }

  // Бортики, у які вкручуються гвинти чохла.
  {
    const ring = roundedRectShape(xL + 0.5, 1.5, xR - 0.5, H - 1.5, 5);
    ring.holes.push(roundedRectShape(xL + 2.5, 3.5, xR - 2.5, H - 3.5, 3));
    plastic.add(mesh(slab(ring, -24, 18, 0), mat.plastic, 'Frame_Walls'));
  }

  // Поріг під кришкою.
  plastic.add(mesh(box(W + 1, 6.5, 8, 1.4, 0, lidBottom - 3.2, 2.2), mat.plastic, 'Frame_LidLedge'));
  plastic.add(mesh(box(8, 4, 5, 1, xR - 3, lidBottom - 7.5, 3.5), mat.plastic, 'Frame_LidCatch'));

  // Горизонтальні ребра-упори зліва.
  for (let i = 0; i < 4; i++) {
    plastic.add(mesh(box(22, 3.4, 3.2, 1, -35.5, 169 - i * 11, 3.2), mat.plastic, `Frame_Rib_${i + 1}`));
  }
  plastic.add(mesh(box(3, 48, 3.2, 1, -48, 152, 3.2), mat.plastic, 'Frame_Rib_Rail'));

  // Рамка-майданчик під приймачем стрічки.
  {
    const ring = roundedRectShape(-21, 131, 49, 193, 3.5);
    ring.holes.push(roundedRectShape(-18, 134, 46, 190, 2));
    plastic.add(mesh(slab(ring, 1.5, 2.2, 0.4), mat.plastic, 'Frame_Pad'));
  }

  /* ---------- металеве кріплення до кулемета ---------- */
  const mount = new THREE.Group();
  mount.name = 'Mount';
  root.add(mount);
  {
    const plate = roundedRectShape(-32, 82, 31, 127, 3);
    plate.holes.push(roundedRectShape(-15, 104, -7, 123, 1.8));
    mount.add(mesh(slab(plate, 1.8, 3.2, 0.5), mat.steel, 'Mount_Plate'));

    for (const [x, y] of [[-27, 88], [25, 88], [-27, 114], [25, 120]]) {
      const g = new THREE.SphereGeometry(2.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      g.scale(1, 0.45, 1);
      g.rotateX(Math.PI / 2);
      g.translate(x, y, 5);
      mount.add(mesh(g, mat.spring, 'Mount_Screw'));
    }

    // Засувка-зуб з уступом.
    mount.add(mesh(profileAlongX([[2, 119], [14, 119], [14, 150], [11, 154], [11, 160], [7, 166], [2, 166]], -24, 2), mat.steel, 'Mount_Latch'));
    for (const y of [130, 146]) {
      const g = new THREE.SphereGeometry(1.9, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      g.scale(1, 0.45, 1);
      g.rotateZ(-Math.PI / 2);
      g.translate(2, y, 8);
      mount.add(mesh(g, mat.spring, 'Mount_Latch_Screw'));
    }

    // Похила напрямна і поличка праворуч від засувки.
    const guide = box(28, 24, 1.8, 0.6, 0, 0, 0);
    guide.rotateY(0.34);
    guide.translate(15.5, 154, 7.8);
    mount.add(mesh(guide, mat.steel, 'Mount_Guide'));
    mount.add(mesh(box(27, 2, 8, 0.6, 15.5, 141, 6), mat.steel, 'Mount_Shelf'));

    // Два L-подібні гаки знизу.
    for (const [x0, x1] of [[-47, -21], [5, 31]]) {
      mount.add(mesh(profileAlongX([[2, 88], [11, 88], [11, 79], [9, 79], [9, 86], [2, 86]], x0, x1, 0.4), mat.steel, 'Mount_Hook'));
    }
  }

  /* ---------- кришка на пружинному шарнірі ---------- */
  const hingeY = H - 1.5;
  const hingeZ = 6.2;
  const lid = new THREE.Group();
  lid.name = 'Lid';
  lid.position.set(0, hingeY, hingeZ);
  root.add(lid);
  {
    const lidW = W - 3;
    const lidH = H - 1 - lidBottom;
    const lidRelief = reliefTexture(lidW, lidH, 6, (ctx) => {
      ctx.translate(lidW / 2, 0);
      ctx.strokeStyle = '#a8a8a8';
      ctx.lineWidth = 1.4;
      roundRectPath(ctx, -lidW / 2 + 3.5, 3, lidW - 7, lidH - 10, 2.5);
      ctx.stroke();

      // Напис калібру (канва перевернута по Y — розвертаємо локально).
      ctx.save();
      ctx.translate(0, 29.5);
      ctx.scale(1, -1);
      ctx.fillStyle = '#b4b4b4';
      ctx.font = '600 6.4px Arial, Helvetica, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('7.62 x 54 мм R', 0, 0);
      ctx.restore();

      // Силует патрона.
      const cy = 16;
      const top = [[-31, 3.6], [-29.6, 3.6], [-29.6, 3.0], [-28.4, 3.0], [-28.4, 3.6], [6, 3.25], [10, 2.0], [14, 2.0], [18, 1.95], [24, 1.6], [28, 0.95], [31, 0]];
      ctx.beginPath();
      top.forEach(([x, y], i) => (i ? ctx.lineTo(x, cy + y) : ctx.moveTo(x, cy + y)));
      [...top].reverse().forEach(([x, y]) => ctx.lineTo(x, cy - y));
      ctx.closePath();
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = '#b0b0b0';
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(14, cy - 2);
      ctx.lineTo(14, cy + 2);
      ctx.stroke();
    });
    const lidMat = new THREE.MeshStandardMaterial({ name: 'Olive plastic (lid)', color: 0x2d3325, roughness: 0.64, normalMap: lidRelief });
    const geo = planarUV(slab(roundedRectShape(-lidW / 2, lidBottom + 0.5, lidW / 2, H - 1, 3.5), 2, 3.4, 0.8), -lidW / 2, lidBottom, lidW, lidH);
    geo.translate(0, -hingeY, -hingeZ);
    lid.add(mesh(geo, lidMat, 'Lid_Panel'));

    const knuckle = new THREE.CylinderGeometry(3.6, 3.6, 25, 20);
    knuckle.rotateZ(Math.PI / 2);
    lid.add(mesh(knuckle, mat.plastic, 'Lid_Knuckle'));
  }

  // Темний проріз подачі під кришкою.
  plastic.add(mesh(box(W - 16, H - lidBottom - 12, 1, 0.4, 0, lidBottom + (H - lidBottom) / 2 - 1, 1.7), mat.cavity, 'Frame_FeedOpening'));

  // Нерухомі частини шарніра: крайні кісточки, вісь і дві пружини.
  {
    for (const [x0, x1] of [[xL, -30], [30, xR]]) {
      const g = new THREE.CylinderGeometry(3.6, 3.6, x1 - x0, 20);
      g.rotateZ(Math.PI / 2);
      g.translate((x0 + x1) / 2, hingeY, hingeZ);
      plastic.add(mesh(g, mat.plastic, 'Hinge_Knuckle'));
      plastic.add(mesh(box(x1 - x0, 4, 5, 1, (x0 + x1) / 2, hingeY - 1.5, 2.5), mat.plastic, 'Hinge_Web'));
    }
    const pin = new THREE.CylinderGeometry(1.2, 1.2, W - 1, 12);
    pin.rotateZ(Math.PI / 2);
    pin.translate(0, hingeY, hingeZ);
    plastic.add(mesh(pin, mat.spring, 'Hinge_Pin'));

    for (const xc of [-21.5, 21.5]) {
      const turns = 12;
      const len = 16;
      const pts = [];
      for (let i = 0; i <= turns * 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        pts.push(new THREE.Vector3(xc - len / 2 + (len * i) / (turns * 24), hingeY + 2.6 * Math.sin(a), hingeZ + 2.6 * Math.cos(a)));
      }
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, 0.55, 6);
      plastic.add(mesh(g, mat.spring, 'Hinge_Spring'));
    }
  }

  /* ---------- гвинти, що тримають чохол ---------- */
  {
    const head = new THREE.SphereGeometry(3.8, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    head.scale(1, 0.5, 1);
    const zs = Z_FABRIC - 10;
    const place = (normal, x, y, z) => {
      const g = head.clone();
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal));
      g.translate(x, y, z);
      return g;
    };
    const heads = [];
    for (const y of [30, 92, 158, 220]) {
      heads.push(place(new THREE.Vector3(1, 0, 0), W / 2 + 0.3, y, zs));
      heads.push(place(new THREE.Vector3(-1, 0, 0), -W / 2 - 0.3, y, zs));
    }
    for (const x of [-26, 26]) {
      heads.push(place(new THREE.Vector3(0, 1, 0), x, H + BULGE - 0.4, zs));
      heads.push(place(new THREE.Vector3(0, -1, 0), x, -BULGE + 0.4, zs));
    }
    root.add(mesh(mergeGeometries(heads), mat.screw, 'Pouch_Screws'));
  }

  const setLidOpen = (t) => {
    lid.rotation.x = -THREE.MathUtils.degToRad(115) * t;
  };

  return { root, lid, setLidOpen, materials: mat };
}
