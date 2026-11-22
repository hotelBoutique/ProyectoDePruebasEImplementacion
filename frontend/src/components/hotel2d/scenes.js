import {
  PALETTE, beam, circle, ellipse, foliage, glow, hexA, line, linear, marbleVeins, monogram, person, poly, rect,
  rounded, seeded, steam, text,
} from './draw.js';

// Cada escena se dibuja en un lienzo de diseño de 1600 x 1000:
//   back  → fondo estático (se pinta una vez)
//   mid   → elementos animados por fotogramas detrás del primer plano
//   front → primer plano estático
//   over  → elementos animados por delante
//   camera(p) → encuadre a lo largo de la sección (p de 0 a 1)
export const DESIGN_W = 1600;
export const DESIGN_H = 1000;
const W = DESIGN_W;
const H = DESIGN_H;

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const easeOut = (value) => 1 - (1 - value) ** 3;
const easeInOut = (value) => (value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const cameraBetween = (from, to) => (progress) => {
  const t = easeInOut(progress);
  return { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t), zoom: lerp(from.zoom, to.zoom, t) };
};

function warmWindow(ctx, x, y, w, h, seed) {
  const random = seeded(seed);
  rect(ctx, x, y, w, h, linear(ctx, x, y, x, y + h, [[0, '#ffe3b4'], [0.55, '#f2b46e'], [1, '#b8733f']]));
  glow(ctx, x + w * (0.3 + random() * 0.4), y + h * 0.35, w * 0.7, '#fff1d6', 0.35);
  rect(ctx, x, y, w * 0.16, h, 'rgba(245, 228, 205, 0.55)');
  rect(ctx, x + w * 0.84, y, w * 0.16, h, 'rgba(245, 228, 205, 0.55)');
  if (random() > 0.5) rect(ctx, x + w * 0.3, y + h * 0.66, w * 0.4, h * 0.34, 'rgba(60, 38, 24, 0.45)');
}

/* ----------------------------------------------------------------------------
   1. Fachada: llegada nocturna. Un auto se detiene, el huésped camina con su
   maleta y el portero lo saluda; ventanas que se encienden y se apagan.
---------------------------------------------------------------------------- */
const FACADE_WINDOWS = (() => {
  const windows = [];
  for (let floor = 0; floor < 4; floor += 1) {
    const y = 292 + floor * 88;
    for (let i = 0; i < 4; i += 1) {
      const x = 352 + i * 66;
      windows.push({ x, y, w: 50, h: 62 });
      windows.push({ x: W - x - 50, y, w: 50, h: 62 });
    }
  }
  return windows;
})();

const facade = {
  id: 'facade',
  background: '#0d1520',
  back(ctx) {
    rect(ctx, 0, 0, W, 760, linear(ctx, 0, 0, 0, 760, [[0, '#07101b'], [0.45, '#172a40'], [0.8, '#4b4a5d'], [1, '#b47c5c']]));
    glow(ctx, 1300, 150, 170, '#f6e7c8', 0.3);
    circle(ctx, 1300, 150, 38, '#f3ead8');
    [[1288, 140, 7], [1312, 162, 5], [1296, 168, 3]].forEach(([x, y, r]) => circle(ctx, x, y, r, '#e1d4ba'));

    // Ciudad lejana.
    const random = seeded(4);
    let x = -30;
    while (x < W) {
      const width = 40 + random() * 70;
      const height = 70 + random() * 170;
      rect(ctx, x, 700 - height, width, height, '#132030');
      for (let wy = 700 - height + 10; wy < 690; wy += 12) {
        for (let wx = x + 6; wx < x + width - 6; wx += 10) {
          if (random() > 0.72) rect(ctx, wx, wy, 4, 5, hexA(random() > 0.3 ? '#ffd59c' : '#a9cdf0', 0.55 + random() * 0.4));
        }
      }
      x += width + 4 + random() * 12;
    }

    // Plaza y calle.
    rect(ctx, 0, 700, W, 300, linear(ctx, 0, 700, 0, 1000, [[0, '#20262c'], [1, '#0d1013']]));
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
    ctx.lineWidth = 1.2;
    for (let gx = -1600; gx <= 3200; gx += 90) line(ctx, 800 + (gx - 800) * 0.25, 760, gx, 1000, 'rgba(255, 255, 255, 0.045)', 1.2);
    [775, 795, 822, 856, 900].forEach((gy) => line(ctx, 0, gy, W, gy, 'rgba(255, 255, 255, 0.045)', 1.2));
    ctx.restore();
    rect(ctx, 0, 905, W, 95, '#0f1215');
    rect(ctx, 0, 902, W, 4, '#2c3237');
    for (let dx = 20; dx < W; dx += 120) rect(ctx, dx, 952, 60, 4, 'rgba(240, 207, 152, 0.28)');

    // Alas del edificio.
    rect(ctx, 330, 240, 940, 520, '#2a3036');
    rect(ctx, 318, 228, 964, 16, '#14181b');
    for (let floor = 0; floor <= 4; floor += 1) rect(ctx, 330, 282 + floor * 88, 940, 8, '#171b1f');
    [[330, 18], [484, 16], [608, 32]].forEach(([px, pw]) => {
      [px, W - px - pw].forEach((sx) => {
        rect(ctx, sx, 240, pw, 400, linear(ctx, sx, 0, sx + pw, 0, [[0, '#5b6168'], [1, '#474d53']]));
        glow(ctx, sx + pw / 2, 300, 40, '#ffd59c', 0.18);
      });
    });
    FACADE_WINDOWS.forEach((win, index) => {
      warmWindow(ctx, win.x, win.y, win.w, win.h, index + 3);
      rect(ctx, win.x + win.w / 2 - 1, win.y, 2, win.h, 'rgba(20, 24, 28, 0.7)');
      if (index % 4 < 2) {
        rect(ctx, win.x - 4, win.y + win.h - 16, win.w + 8, 2, 'rgba(220, 230, 235, 0.45)');
        foliage(ctx, win.x + (index % 2 ? 6 : win.w - 6), win.y + win.h - 20, 8, { seed: index });
      }
    });

    // Planta baja vidriada.
    rect(ctx, 330, 640, 940, 120, linear(ctx, 0, 640, 0, 760, [[0, '#f8cf92'], [1, '#9b6136']]));
    for (let gx = 330; gx <= 1270; gx += 47) rect(ctx, gx, 640, 3, 120, '#171b1f');
    glow(ctx, 450, 700, 120, '#ffe1b0', 0.18);
    glow(ctx, 1150, 700, 120, '#ffe1b0', 0.18);

    // Torre de mármol oscuro con atrio.
    rect(ctx, 640, 140, 320, 620, '#1b1f23');
    marbleVeins(ctx, 640, 140, 320, 620, 'rgba(175, 175, 180, 0.6)', 9, 14);
    rect(ctx, 624, 128, 352, 18, '#0f1215');
    rect(ctx, 630, 146, 340, 3, PALETTE.goldBright);
    rect(ctx, 700, 230, 200, 380, linear(ctx, 0, 230, 0, 610, [[0, '#f3c68c'], [0.55, '#b9834f'], [1, '#583c25']]));
    glow(ctx, 800, 360, 160, '#ffe0aa', 0.28);
    for (let gx = 700; gx <= 900; gx += 40) rect(ctx, gx - 1.5, 230, 3, 380, '#15191c');
    for (let gy = 230; gy <= 610; gy += 54) rect(ctx, 700, gy - 1.5, 200, 3, '#15191c');
    [690, 910].forEach((sx) => {
      rect(ctx, sx - 2, 160, 4, 480, '#ffd8a0');
      for (let gy = 180; gy < 640; gy += 60) glow(ctx, sx, gy, 26, '#ffcf8f', 0.35);
    });
    monogram(ctx, 800, 182, 34, PALETTE.goldBright, { glowColor: 'rgba(255, 210, 150, 0.9)' });
    text(ctx, 'HOTEL BOUTIQUE', 805, 214, { size: 13, spacing: 6, family: '"Cormorant Garamond", Georgia, serif', color: PALETTE.goldBright, glowColor: 'rgba(255, 210, 150, 0.8)' });

    // Marquesina, entrada y columnas.
    rect(ctx, 690, 652, 220, 108, linear(ctx, 0, 652, 0, 760, [[0, '#ffe3b6'], [1, '#c58a50']]));
    [690, 745, 800, 855, 910].forEach((dx) => rect(ctx, dx - 1.5, 652, 3, 108, '#15191c'));
    ellipse(ctx, 800, 748, 26, 6, '#2a2017');
    [[-10, 0], [8, -4], [0, -10], [-4, 6], [12, 4]].forEach(([ox, oy]) => circle(ctx, 800 + ox, 726 + oy, 7, '#f6f0e6'));
    rect(ctx, 606, 626, 388, 20, '#101316');
    rect(ctx, 606, 645, 388, 2.5, PALETTE.goldBright);
    for (let dx = 650; dx <= 950; dx += 60) {
      circle(ctx, dx, 649, 3, '#fff3dc');
      beam(ctx, dx, 650, 110, 26, Math.PI / 2, '#ffe2b4', 0.16);
    }
    monogram(ctx, 800, 636, 11, PALETTE.goldBright);
    [628, 952].forEach((cx) => {
      rect(ctx, cx, 646, 22, 114, '#1f2428');
      rect(ctx, cx + 10, 654, 2, 98, PALETTE.goldBright);
    });
    [560, 1000].forEach((px) => {
      rounded(ctx, px, 722, 40, 38, 4, '#1b1f22');
      foliage(ctx, px + 20, 706, 26, { seed: px });
    });
    glow(ctx, 800, 800, 260, '#ffcf8f', 0.22);

    // Faroles de la calle.
    [110, 1490].forEach((lx) => {
      rect(ctx, lx - 3, 690, 6, 214, '#1c2024');
      rounded(ctx, lx - 14, 676, 28, 16, 4, '#1c2024');
      glow(ctx, lx, 694, 120, '#ffd59c', 0.35);
    });
  },
  front(ctx) {
    [[0, 420], [1180, 1600]].forEach(([a, b], side) => {
      for (let hx = a + 20; hx < b; hx += 46) foliage(ctx, hx, 885, 30, { seed: hx + side * 7 });
    });
    for (let bx = 470; bx <= 1130; bx += 220) {
      rect(ctx, bx - 4, 830, 8, 30, '#1d2124');
      glow(ctx, bx, 832, 40, '#ffd59c', 0.55);
    }
  },
  mid(ctx, t, frame) {
    // Estrellas que titilan.
    const random = seeded(12);
    for (let i = 0; i < 80; i += 1) {
      const sx = random() * W;
      const sy = random() * 420;
      const period = 6 + Math.floor(random() * 10);
      if (Math.hypot(sx - 1300, sy - 150) < 70) continue;
      const bright = (frame + i) % period === 0;
      circle(ctx, sx, sy, bright ? 1.8 : 1, `rgba(255, 250, 235, ${bright ? 0.95 : 0.4})`);
    }
    // Nubes que avanzan.
    [[120, 210, 0.07], [900, 120, 0.05], [1500, 300, 0.06]].forEach(([start, cy, alpha], i) => {
      const cx = ((start + t * (10 + i * 4)) % (W + 500)) - 250;
      [[0, 0, 110, 22], [60, -10, 80, 20], [-70, 6, 70, 16]].forEach(([dx, dy, rx, ry]) => ellipse(ctx, cx + dx, cy + dy, rx, ry, `rgba(205, 195, 210, ${alpha})`));
    });
    // Ventanas que se apagan y encienden (huéspedes en sus habitaciones).
    FACADE_WINDOWS.forEach((win, index) => {
      if (index % 3 !== 0) return;
      const period = 36 + (index * 13) % 40;
      if ((frame + index * 11) % period < period * 0.38) rect(ctx, win.x, win.y, win.w, win.h, 'rgba(13, 17, 22, 0.86)');
    });
    // Candelabro del atrio girando.
    [[330, 62, 9], [400, 46, 7], [460, 32, 5]].forEach(([cy, rx, ry], ring) => {
      ctx.beginPath();
      ctx.ellipse(800, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 230, 190, 0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      for (let k = 0; k < 6; k += 1) {
        const angle = (frame * 0.28 * (ring % 2 ? -1 : 1)) + (k / 6) * Math.PI * 2;
        circle(ctx, 800 + Math.cos(angle) * rx, cy + Math.sin(angle) * ry + 5, 1.8, '#fff6e6');
      }
      glow(ctx, 800, cy, rx * 1.2, '#ffd59c', 0.22);
    });
    // Pulso de las líneas LED.
    const pulse = 0.18 + 0.12 * (frame % 6 < 3 ? 1 : 0);
    [690, 910].forEach((sx) => glow(ctx, sx, 400, 60, '#ffcf8f', pulse));
    // Árboles meciéndose (cuatro poses).
    const sway = [0, 3, 5, 3, 0, -3, -5, -3][frame % 8];
    [[230, 860, 1], [1370, 860, 2]].forEach(([tx, ty, seed]) => {
      rect(ctx, tx - 7, ty - 150, 14, 150, '#2d2119');
      foliage(ctx, tx, ty - 200, 80, { seed, sway });
      foliage(ctx, tx - 40, ty - 150, 52, { seed: seed + 5, sway: sway * 0.8 });
      foliage(ctx, tx + 45, ty - 160, 56, { seed: seed + 9, sway: sway * 0.9 });
    });

    // Auto que llega y se detiene frente a la entrada.
    const arrive = easeOut(clamp01(t / 3.4));
    const carX = lerp(-360, 470, arrive);
    const moving = arrive < 1;
    const carY = 905;
    if (moving) beam(ctx, carX + 250, carY - 26, 340, 46, 0.04, '#fff2cf', 0.28);
    ctx.save();
    ctx.translate(carX, carY);
    ellipse(ctx, 140, -2, 150, 8, 'rgba(0, 0, 0, 0.45)');
    poly(ctx, [[0, -14], [10, -40], [70, -44], [110, -76], [200, -78], [240, -46], [272, -40], [280, -14]], linear(ctx, 0, -78, 0, -10, [[0, '#3a4652'], [0.5, '#1e262e'], [1, '#12171c']]));
    poly(ctx, [[118, -70], [196, -72], [226, -46], [104, -46]], linear(ctx, 104, -72, 226, -46, [[0, '#5d7487'], [1, '#2a3b48']]));
    poly(ctx, [[130, -68], [150, -68], [128, -48], [112, -48]], 'rgba(255, 255, 255, 0.18)');
    rect(ctx, 160, -72, 4, 26, '#12171c');
    rect(ctx, 112, -44, 2, 30, 'rgba(0, 0, 0, 0.35)');
    rect(ctx, 176, -44, 2, 30, 'rgba(0, 0, 0, 0.35)');
    rect(ctx, 6, -36, 266, 3, 'rgba(255, 255, 255, 0.18)');
    rect(ctx, 268, -38, 10, 8, '#ffefc4');
    rect(ctx, 0, -34, 8, 8, '#d0412f');
    glow(ctx, 274, -34, 26, '#fff2cf', 0.6);
    [62, 222].forEach((wx) => {
      circle(ctx, wx, -14, 20, '#0a0c0e');
      circle(ctx, wx, -14, 11, '#4a5157');
      const spin = moving ? frame * 0.9 : 0;
      for (let k = 0; k < 4; k += 1) {
        const angle = spin + (k * Math.PI) / 2;
        line(ctx, wx, -14, wx + Math.cos(angle) * 10, -14 + Math.sin(angle) * 10, '#22272b', 2);
      }
    });
    ctx.restore();

    // Portero y huésped.
    const walk = clamp01((t - 3.8) / 4.6);
    const guestX = lerp(600, 770, walk);
    const guestY = lerp(880, 790, walk);
    const guestNear = walk > 0.6;
    person(ctx, {
      x: 730, y: 778, scale: 0.46, frame, facing: 1, action: guestNear ? 'wave' : 'idle',
      coat: '#1a2e3b', accent: PALETTE.gold, skin: PALETTE.skin[1],
    });
    if (t > 3.6) {
      person(ctx, {
        x: guestX, y: guestY, scale: lerp(0.56, 0.47, walk), frame, facing: 1,
        action: walk > 0 && walk < 1 ? 'walk' : 'idle', coat: '#6b4a3a', skin: PALETTE.skin[3], hair: '#3b2a1c',
        hairLong: true, suitcase: true, accent: '#2b4a5e',
      });
    }
  },
  camera: cameraBetween({ x: 800, y: 520, zoom: 1 }, { x: 760, y: 715, zoom: 1.7 }),
};

/* ----------------------------------------------------------------------------
   2. Recepción: la recepcionista trabaja, llega un huésped, suena la campana
   y le entrega la llave.
---------------------------------------------------------------------------- */
const lobby = {
  id: 'lobby',
  background: '#1c1612',
  back(ctx) {
    rect(ctx, 0, 0, W, 640, linear(ctx, 0, 0, 0, 640, [[0, '#2a1f18'], [1, '#3b2b20']]));
    for (let sx = 0; sx < W; sx += 14) {
      if (sx > 470 && sx < 1130) continue;
      rect(ctx, sx, 90, 12, 550, sx % 28 ? '#5a3f2b' : '#4a3323');
    }
    rect(ctx, 0, 0, W, 90, '#18130f');
    rect(ctx, 0, 88, W, 3, '#ffd59c');
    for (let gx = 40; gx < W; gx += 120) glow(ctx, gx, 92, 70, '#ffcf8f', 0.25);
    for (let dx = 100; dx < W; dx += 200) {
      circle(ctx, dx, 94, 5, '#fff3dc');
      beam(ctx, dx, 96, 240, 70, Math.PI / 2, '#ffe2b4', 0.06);
    }
    [[120, 170], [1430, 1480]].forEach(([a, b], i) => {
      rect(ctx, a, 90, b - a, 550, '#22262a');
      marbleVeins(ctx, a, 90, b - a, 550, 'rgba(190, 185, 175, 0.5)', 40 + i, 5);
    });
    rect(ctx, 480, 90, 640, 550, '#1d2125');
    marbleVeins(ctx, 480, 90, 640, 550, 'rgba(195, 190, 180, 0.55)', 7, 16);
    [492, 1108].forEach((sx) => {
      rect(ctx, sx - 1.5, 100, 3, 530, '#ffd8a0');
      for (let gy = 140; gy < 640; gy += 80) glow(ctx, sx, gy, 30, '#ffcf8f', 0.3);
    });
    glow(ctx, 800, 290, 220, '#ffcf8f', 0.12);
    monogram(ctx, 800, 268, 76, PALETTE.goldBright, { glowColor: 'rgba(255, 210, 150, 0.9)', weight: 1.1 });
    text(ctx, 'HOTEL BOUTIQUE', 808, 346, { size: 24, spacing: 10, family: '"Cormorant Garamond", Georgia, serif', color: PALETTE.goldBright, glowColor: 'rgba(255, 210, 150, 0.7)' });

    // Piso de mármol en perspectiva con reflejos.
    rect(ctx, 0, 640, W, 360, linear(ctx, 0, 640, 0, 1000, [[0, '#cdbfaa'], [1, '#eee6d9']]));
    marbleVeins(ctx, 0, 640, W, 360, 'rgba(150, 135, 115, 0.35)', 3, 18);
    [662, 692, 734, 788, 856, 940].forEach((gy) => line(ctx, 0, gy, W, gy, 'rgba(110, 95, 75, 0.25)', 1.4));
    for (let gx = -1600; gx <= 3200; gx += 170) line(ctx, 800 + (gx - 800) * 0.32, 640, gx, 1000, 'rgba(110, 95, 75, 0.22)', 1.4);
    ctx.save();
    ctx.globalAlpha = 0.25;
    rect(ctx, 470, 700, 660, 70, linear(ctx, 0, 700, 0, 770, [[0, '#6a4a32'], [1, 'rgba(106, 74, 50, 0)']]));
    ctx.restore();
    glow(ctx, 800, 712, 300, '#ffcf8f', 0.18);

    [[230, 'left'], [1370, 'right']].forEach(([px], i) => {
      rounded(ctx, px - 34, 520, 68, 120, 8, '#e9e2d6');
      foliage(ctx, px, 470, 70, { seed: 20 + i });
      foliage(ctx, px - 20, 410, 46, { seed: 30 + i });
    });
  },
  mid(ctx, t, frame) {
    // Candelabro de anillos con cristales que giran.
    [[140, 160, 22], [176, 116, 16], [206, 74, 11]].forEach(([cy, rx, ry], ring) => {
      line(ctx, 800 - rx * 0.7, 90, 800 - rx * 0.7, cy, 'rgba(201, 164, 107, 0.6)', 1);
      line(ctx, 800 + rx * 0.7, 90, 800 + rx * 0.7, cy, 'rgba(201, 164, 107, 0.6)', 1);
      ctx.beginPath();
      ctx.ellipse(800, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffe2b4';
      ctx.lineWidth = 3;
      ctx.stroke();
      const drops = 14;
      for (let k = 0; k < drops; k += 1) {
        const angle = frame * 0.16 * (ring % 2 ? -1 : 1) + (k / drops) * Math.PI * 2;
        const dx = 800 + Math.cos(angle) * rx;
        const dy = cy + Math.sin(angle) * ry;
        const front = Math.sin(angle) > 0;
        line(ctx, dx, dy, dx, dy + 14 + (k % 3) * 6, 'rgba(255, 240, 215, 0.5)', 1);
        circle(ctx, dx, dy + 16 + (k % 3) * 6, front ? 3 : 2, front ? '#fff8ec' : 'rgba(255, 240, 215, 0.6)');
        if ((frame + k * 5) % 17 === 0) glow(ctx, dx, dy + 16, 14, '#ffffff', 0.9);
      }
      glow(ctx, 800, cy, rx * 1.1, '#ffd59c', 0.24);
    });

    // Recepcionistas detrás del mostrador.
    const handing = t > 6.2;
    person(ctx, {
      x: 940, y: 700, scale: 2.35, frame, facing: -1, action: handing ? 'give' : 'type',
      coat: '#1a2e3b', accent: PALETTE.gold, skin: PALETTE.skin[0], hair: '#2a1d14', hairLong: true,
    });
    person(ctx, {
      x: 640, y: 700, scale: 2.25, frame: frame + 3, facing: 1, action: 'type',
      coat: '#1a2e3b', accent: PALETTE.gold, skin: PALETTE.skin[2], hair: '#151010',
    });
  },
  front(ctx) {
    rect(ctx, 470, 560, 660, 140, '#5c3d27');
    for (let sx = 474; sx < 1126; sx += 16) rect(ctx, sx, 566, 10, 128, sx % 32 ? '#6f4b31' : '#61412a');
    rect(ctx, 455, 545, 690, 18, '#eee6da');
    marbleVeins(ctx, 455, 545, 690, 18, 'rgba(150, 130, 105, 0.6)', 13, 6);
    rect(ctx, 470, 696, 660, 4, '#ffd59c');
    for (let gx = 500; gx < 1130; gx += 70) glow(ctx, gx, 700, 40, '#ffcf8f', 0.35);
    [[580, '#3a5d78'], [1000, '#3a5d78']].forEach(([mx, screen]) => {
      rect(ctx, mx - 44, 488, 88, 54, '#0e1114');
      rect(ctx, mx - 40, 492, 80, 46, screen);
      glow(ctx, mx, 515, 50, '#8fc0e6', 0.2);
      rect(ctx, mx - 4, 542, 8, 6, '#0e1114');
    });
    ellipse(ctx, 740, 543, 14, 3, '#9a7a45');
    ctx.beginPath();
    ctx.arc(740, 543, 11, Math.PI, 0);
    ctx.fillStyle = '#d9b26a';
    ctx.fill();
    circle(ctx, 740, 530, 2.5, '#d9b26a');
    rect(ctx, 497, 520, 6, 26, '#c9a46b');
    poly(ctx, [[482, 520], [518, 520], [510, 494], [490, 494]], '#f5e8d2');
    glow(ctx, 500, 505, 70, '#ffcf8f', 0.5);
    rounded(ctx, 1080, 520, 26, 26, 4, '#f2ede4');
    line(ctx, 1093, 520, 1090, 470, '#4b6b3f', 2);
    [[1086, 474], [1098, 482], [1084, 490]].forEach(([ox, oy]) => ellipse(ctx, ox, oy, 8, 5, '#f4e9f2'));

    // Sala de espera en primer plano.
    rounded(ctx, 1280, 800, 260, 90, 18, '#2d4352');
    rounded(ctx, 1270, 760, 280, 60, 22, '#34505f');
    rounded(ctx, 1255, 800, 40, 100, 14, '#2a3e4b');
    rounded(ctx, 1525, 800, 40, 100, 14, '#2a3e4b');
    ellipse(ctx, 1150, 900, 80, 14, '#e8e0d2');
    rect(ctx, 1146, 900, 8, 60, '#c9a46b');
  },
  over(ctx, t, frame) {
    const walk = clamp01((t - 0.8) / 4.6);
    const guestX = lerp(1720, 1050, easeOut(walk));
    person(ctx, {
      x: guestX, y: 940, scale: 2.7, frame, facing: -1, action: walk < 1 ? 'walk' : 'idle',
      coat: '#6b4a3a', skin: PALETTE.skin[3], hair: '#3b2a1c', hairLong: true, suitcase: true, accent: '#2b4a5e',
    });
    // Campana de recepción.
    const ding = Math.floor((t - 5.6) * 12);
    if (ding >= 0 && ding < 8) {
      const radius = 10 + ding * 5;
      for (let k = 0; k < 8; k += 1) {
        const angle = (k / 8) * Math.PI * 2;
        line(ctx, 740 + Math.cos(angle) * radius, 526 + Math.sin(angle) * radius, 740 + Math.cos(angle) * (radius + 8), 526 + Math.sin(angle) * (radius + 8), `rgba(255, 230, 180, ${1 - ding / 8})`, 2);
      }
    }
  },
  camera: cameraBetween({ x: 760, y: 500, zoom: 1.05 }, { x: 860, y: 540, zoom: 1.16 }),
};

/* ----------------------------------------------------------------------------
   3. Habitación: noche tranquila; cortinas que se mecen, luces de la ciudad,
   una estrella fugaz y el té humeante en la mesa de noche.
---------------------------------------------------------------------------- */
const roomWindow = { x: 1030, y: 130, w: 480, h: 520 };

const room = {
  id: 'room',
  background: '#2a221c',
  back(ctx) {
    rect(ctx, 0, 0, W, 700, linear(ctx, 0, 0, 0, 700, [[0, '#8c7d6b'], [1, '#a59581']]));
    rect(ctx, 0, 0, W, 54, '#6d6051');
    rect(ctx, 0, 52, W, 2, '#ffd59c');
    for (let gx = 60; gx < W; gx += 140) glow(ctx, gx, 56, 60, '#ffcf8f', 0.2);

    const { x, y, w, h } = roomWindow;
    rect(ctx, x - 14, y - 14, w + 28, h + 28, '#2a2f33');
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    rect(ctx, x, y, w, h, linear(ctx, 0, y, 0, y + h, [[0, '#08111d'], [0.6, '#22344c'], [1, '#7d5a48']]));
    glow(ctx, x + 380, y + 90, 90, '#f6e7c8', 0.35);
    circle(ctx, x + 380, y + 90, 24, '#f3ead8');
    const random = seeded(22);
    let bx = x - 10;
    while (bx < x + w) {
      const bw = 30 + random() * 50;
      const bh = 110 + random() * 230;
      rect(ctx, bx, y + h - bh, bw, bh, '#111c29');
      bx += bw + 3;
    }
    ctx.restore();
    rect(ctx, x + w / 2 - 5, y, 10, h, '#2a2f33');
    rect(ctx, x, y + h * 0.48, w, 8, '#2a2f33');

    // Piso de madera.
    rect(ctx, 0, 700, W, 300, linear(ctx, 0, 700, 0, 1000, [[0, '#6a4630'], [1, '#4d3221']]));
    for (let py = 712; py < 1000; py += 24) {
      line(ctx, 0, py, W, py, 'rgba(25, 14, 8, 0.45)', 1.5);
      const offset = (py * 37) % 220;
      for (let px = -offset; px < W; px += 220) line(ctx, px, py - 24, px, py, 'rgba(25, 14, 8, 0.35)', 1.2);
    }

    // Cabecero tapizado y apliques.
    rect(ctx, 350, 230, 660, 340, '#5b3e2a');
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const px = 372 + col * 156;
        const py = 252 + row * 152;
        rounded(ctx, px, py, 148, 144, 12, linear(ctx, 0, py, 0, py + 144, [[0, '#3c566a'], [1, '#2a4050']]));
        circle(ctx, px + 74, py + 72, 3, '#1e2f3b');
      }
    }
    [300, 1060].forEach((sx) => glow(ctx, sx, 300, 90, '#ffcf8f', 0.35));

    // Cuadro.
    rect(ctx, 110, 210, 170, 220, '#c9a46b');
    rect(ctx, 120, 220, 150, 200, '#efe7da');
    circle(ctx, 175, 290, 40, '#1a2e3b');
    rect(ctx, 150, 330, 90, 60, '#c5a880');
    circle(ctx, 225, 360, 26, '#486b55');
  },
  mid(ctx, t, frame) {
    const { x, y, w, h } = roomWindow;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const random = seeded(31);
    for (let i = 0; i < 70; i += 1) {
      const lx = x + random() * w;
      const ly = y + h - 20 - random() * 210;
      const period = 10 + Math.floor(random() * 30);
      const on = (frame + i * 7) % period > 2;
      if (on) rect(ctx, lx, ly, 3, 4, hexA(random() > 0.3 ? '#ffd59c' : '#a9cdf0', 0.8));
    }
    // Estrella fugaz.
    const shoot = Math.floor((t - 4.2) * 12);
    if (shoot >= 0 && shoot < 10) {
      const sx = x + 60 + shoot * 26;
      const sy = y + 60 + shoot * 9;
      line(ctx, sx, sy, sx - 60, sy - 21, 'rgba(255, 250, 235, 0.85)', 2);
      glow(ctx, sx, sy, 12, '#ffffff', 0.9);
    }
    ctx.restore();

    // Cortinas que se mecen (cuatro poses).
    const sway = [0, 4, 7, 4][Math.floor(frame / 3) % 4];
    const curtain = (left, width, fill) => {
      ctx.beginPath();
      ctx.moveTo(left, y - 20);
      for (let py = y - 20; py <= y + h + 20; py += 20) {
        const wave = Math.sin(py / 30 + frame * 0.3) * 4 + sway * ((py - y) / h);
        ctx.lineTo(left + wave, py);
      }
      for (let py = y + h + 20; py >= y - 20; py -= 20) {
        const wave = Math.sin(py / 30 + frame * 0.3 + 1) * 4 + sway * ((py - y) / h);
        ctx.lineTo(left + width + wave, py);
      }
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };
    curtain(x - 70, 130, 'rgba(245, 238, 226, 0.28)');
    curtain(x + w - 60, 120, 'rgba(245, 238, 226, 0.22)');
    curtain(x - 100, 60, '#7a6450');
    curtain(x + w + 40, 60, '#7a6450');
    rect(ctx, x - 110, y - 26, w + 220, 6, '#c9a46b');
  },
  front(ctx) {
    [[270, 360], [1000, 1090]].forEach(([a, b]) => {
      rect(ctx, a, 560, b - a, 100, '#5b3e2a');
      rect(ctx, a + 8, 600, b - a - 16, 2, '#c9a46b');
    });
    [315, 1045].forEach((lx) => {
      rect(ctx, lx - 3, 500, 6, 60, '#c9a46b');
      poly(ctx, [[lx - 30, 500], [lx + 30, 500], [lx + 22, 458], [lx - 22, 458]], '#f5e8d2');
      glow(ctx, lx, 485, 110, '#ffcf8f', 0.55);
    });
    rect(ctx, 380, 600, 600, 80, '#5b3e2a');
    rect(ctx, 392, 560, 576, 52, '#f6f3ee');
    rect(ctx, 385, 576, 590, 124, linear(ctx, 0, 576, 0, 700, [[0, '#f4f1ea'], [1, '#d8d1c4']]));
    rect(ctx, 385, 576, 590, 22, '#e7e1d5');
    for (let fx = 430; fx < 960; fx += 90) line(ctx, fx, 600, fx + 20, 700, 'rgba(150, 140, 125, 0.25)', 2);
    rect(ctx, 385, 642, 590, 32, '#2f4656');
    rect(ctx, 385, 648, 590, 2, '#c9a46b');
    [[420, 482, 230, 72], [710, 482, 230, 72]].forEach(([px, py, pw, ph]) => {
      rounded(ctx, px, py, pw, ph, 22, '#fbf9f4');
      line(ctx, px + 14, py + ph - 10, px + pw - 14, py + ph - 10, 'rgba(150, 140, 125, 0.3)', 2);
    });
    [[500, 520], [790, 520]].forEach(([px, py]) => rounded(ctx, px, py, 90, 50, 16, '#c5a880'));
    poly(ctx, [[330, 700], [1030, 700], [1160, 930], [200, 930]], '#d8ccb8');
    poly(ctx, [[360, 712], [1000, 712], [1110, 912], [250, 912]], 'rgba(47, 70, 86, 0)');
    ctx.save();
    ctx.strokeStyle = '#2f4656';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(360, 714); ctx.lineTo(1000, 714); ctx.lineTo(1110, 912); ctx.lineTo(250, 912); ctx.closePath();
    ctx.stroke();
    ctx.restore();
    rect(ctx, 1052, 548, 18, 12, '#f4f0ea');
    rounded(ctx, 1180, 690, 180, 120, 26, '#2f4656');
    rounded(ctx, 1170, 640, 200, 70, 26, '#3c566a');
    rect(ctx, 1520, 640, 60, 90, '#e9e2d6');
    foliage(ctx, 1550, 580, 70, { seed: 44 });
  },
  over(ctx, t, frame) {
    steam(ctx, 1061, 544, frame, { height: 70, size: 7, alpha: 0.45 });
  },
  camera: cameraBetween({ x: 700, y: 520, zoom: 1.06 }, { x: 920, y: 480, zoom: 1.16 }),
};

/* ----------------------------------------------------------------------------
   4. Cafetería: la barista sirve, sale vapor de la cafetera, una clienta toma su
   café y las lámparas colgantes se mecen.
---------------------------------------------------------------------------- */
const cafe = {
  id: 'cafe',
  background: '#1a130f',
  back(ctx) {
    rect(ctx, 0, 70, W, 570, '#d1bfa2');
    const random = seeded(9);
    for (let row = 0; row < 22; row += 1) {
      const by = 72 + row * 26;
      const offset = row % 2 ? 35 : 0;
      for (let bx = -70 + offset; bx < W; bx += 70) {
        const r = 128 + random() * 40;
        rounded(ctx, bx + 2, by + 2, 66, 22, 2, `rgb(${r}, ${66 + random() * 20}, ${48 + random() * 14})`);
      }
    }
    ctx.save();
    ctx.globalAlpha = 0.35;
    rect(ctx, 0, 70, W, 570, linear(ctx, 0, 70, 0, 640, [[0, '#000'], [0.5, 'rgba(0,0,0,0)'], [1, '#000']]));
    ctx.restore();
    rect(ctx, 0, 0, W, 72, '#1c1612');
    for (let bx = 0; bx < W; bx += 200) rect(ctx, bx, 0, 30, 72, '#2a211a');

    // Pizarra del menú.
    rect(ctx, 556, 136, 488, 268, '#c9a46b');
    rect(ctx, 562, 142, 476, 256, '#1c2224');
    text(ctx, 'Café Boutique', 800, 184, { size: 38, family: '"Cormorant Garamond", Georgia, serif', color: PALETTE.goldBright });
    text(ctx, '— se carga a la cuenta de tu habitación —', 800, 214, { size: 11, color: '#c5a880', weight: 500 });
    [['Espresso', '6.000'], ['Capuchino', '9.500'], ['Latte de vainilla', '11.000'], ['Croissant', '8.000'], ['Tarta de frutos rojos', '12.500']].forEach(([name, price], i) => {
      const iy = 246 + i * 30;
      text(ctx, name, 600, iy, { size: 15, align: 'left', family: 'Georgia, serif', weight: 400, color: '#efe6d6' });
      text(ctx, `$ ${price}`, 1000, iy, { size: 15, align: 'right', family: 'Georgia, serif', weight: 400, color: '#d9b98a' });
      line(ctx, 600, iy + 12, 1000, iy + 12, 'rgba(239, 230, 214, 0.18)', 1);
    });

    // Repisas.
    [[150, 450, 270], [150, 450, 350], [1150, 1450, 270], [1150, 1450, 350]].forEach(([a, b, sy], i) => {
      rect(ctx, a, sy, b - a, 8, '#6b4a31');
      for (let cx = a + 25; cx < b - 10; cx += 45) {
        if (i % 2) {
          rounded(ctx, cx - 14, sy - 46, 28, 46, 5, 'rgba(220, 230, 235, 0.35)');
          rect(ctx, cx - 12, sy - 26, 24, 24, '#5b3a22');
        } else {
          rounded(ctx, cx - 12, sy - 22, 24, 22, 4, '#f4f0ea');
        }
      }
    });
    rect(ctx, 0, 640, W, 360, linear(ctx, 0, 640, 0, 1000, [[0, '#3b2a1e'], [1, '#22170f']]));
    for (let py = 660; py < 1000; py += 28) line(ctx, 0, py, W, py, 'rgba(10, 5, 2, 0.5)', 1.5);
  },
  mid(ctx, t, frame) {
    // Barista y colega detrás de la barra.
    person(ctx, {
      x: 700, y: 720, scale: 2.4, frame, facing: -1, action: 'pour',
      coat: '#2b2622', accent: PALETTE.gold, skin: PALETTE.skin[1], hair: '#1a1210', hairLong: true,
    });
    person(ctx, {
      x: 905, y: 720, scale: 2.3, frame: frame + 2, facing: 1, action: 'type',
      coat: '#2b2622', accent: PALETTE.gold, skin: PALETTE.skin[0], hair: '#3b2a1c',
    });
    // Lámparas colgantes que se mecen.
    const swing = [0, 0.03, 0.05, 0.03, 0, -0.03, -0.05, -0.03][Math.floor(frame / 2) % 8];
    [400, 800, 1200].forEach((px, i) => {
      ctx.save();
      ctx.translate(px, 0);
      ctx.rotate(swing * (i % 2 ? -1 : 1));
      line(ctx, 0, 0, 0, 230, '#111', 2);
      ctx.beginPath();
      ctx.arc(0, 262, 34, Math.PI, 0);
      ctx.fillStyle = '#c9a46b';
      ctx.fill();
      circle(ctx, 0, 264, 10, '#fff1d6');
      glow(ctx, 0, 270, 110, '#ffcf8f', 0.55);
      beam(ctx, 0, 268, 300, 120, Math.PI / 2, '#ffe2b4', 0.12);
      ctx.restore();
    });
  },
  front(ctx) {
    rect(ctx, 300, 560, 1000, 150, '#6a4a31');
    for (let sx = 304; sx < 1296; sx += 18) rect(ctx, sx, 566, 12, 138, sx % 36 ? '#7b5638' : '#6c4a30');
    rect(ctx, 285, 545, 1030, 18, '#efe8dc');
    marbleVeins(ctx, 285, 545, 1030, 18, 'rgba(150, 130, 105, 0.6)', 21, 8);
    rect(ctx, 300, 704, 1000, 4, '#ffd59c');
    for (let gx = 330; gx < 1300; gx += 80) glow(ctx, gx, 708, 40, '#ffcf8f', 0.3);

    // Cafetera espresso.
    rounded(ctx, 380, 462, 200, 84, 10, linear(ctx, 380, 0, 580, 0, [[0, '#9ea5ab'], [0.45, '#f0f3f5'], [1, '#7f878d']]));
    rect(ctx, 392, 474, 176, 22, '#a64a2e');
    [440, 520].forEach((gx) => {
      rounded(ctx, gx - 14, 500, 28, 16, 4, '#5a6066');
      rect(ctx, gx - 3, 516, 6, 10, '#3a3f44');
      rounded(ctx, gx - 10, 530, 20, 14, 3, '#f4f0ea');
    });
    circle(ctx, 412, 485, 7, '#f4f4f0');
    circle(ctx, 548, 485, 7, '#f4f4f0');
    for (let i = 0; i < 6; i += 1) rounded(ctx, 394 + i * 30, 448, 20, 14, 3, '#f4f0ea');
    rect(ctx, 610, 490, 34, 56, '#1b1f22');
    poly(ctx, [[604, 490], [650, 490], [640, 455], [614, 455]], 'rgba(120, 80, 50, 0.6)');

    // Caja y vitrina de postres.
    rounded(ctx, 760, 500, 80, 46, 4, '#1b1f22');
    rect(ctx, 768, 506, 64, 22, '#3a5d78');
    rect(ctx, 960, 470, 220, 76, 'rgba(220, 235, 240, 0.18)');
    rect(ctx, 960, 506, 220, 2, 'rgba(255, 255, 255, 0.4)');
    glow(ctx, 1070, 490, 90, '#fff3df', 0.25);
    [[990, 495, '#d79a5e'], [1040, 495, '#9e2b3a'], [1090, 495, '#c98a45'], [1140, 495, '#d79a5e'], [1010, 532, '#c98a45'], [1070, 532, '#f2e3cf'], [1130, 532, '#9e2b3a']].forEach(([cx, cy, color]) => {
      ellipse(ctx, cx, cy, 18, 8, color);
      ellipse(ctx, cx, cy - 4, 14, 5, 'rgba(255, 255, 255, 0.25)');
    });

    // Taburetes.
    [420, 640, 960, 1180].forEach((sx) => {
      ellipse(ctx, sx, 740, 40, 10, '#6b3f26');
      [-24, 24].forEach((dx) => line(ctx, sx + dx * 0.6, 742, sx + dx, 860, '#c9a46b', 4));
      ellipse(ctx, sx, 810, 26, 5, 'rgba(201, 164, 107, 0)');
      line(ctx, sx - 18, 812, sx + 18, 812, '#c9a46b', 3);
    });
  },
  over(ctx, t, frame) {
    steam(ctx, 440, 528, frame, { height: 60, size: 8 });
    steam(ctx, 520, 528, frame + 5, { height: 60, size: 8 });
    steam(ctx, 470, 446, frame + 2, { height: 90, size: 12, alpha: 0.25 });
    // Chorro de café al servir.
    if (frame % 12 < 8) rect(ctx, 438.5, 516, 3, 14, '#5a3416');

    // Clienta en primer plano tomando café.
    person(ctx, {
      x: 1420, y: 1040, scale: 2.9, frame, facing: -1, action: 'sip',
      coat: '#486b55', skin: PALETTE.skin[3], hair: '#6b3f26', hairLong: true,
    });
    ellipse(ctx, 1300, 930, 120, 22, '#efe8dc');
    rect(ctx, 1294, 930, 12, 70, '#c9a46b');
    rounded(ctx, 1270, 912, 30, 18, 5, '#f4f0ea');
    steam(ctx, 1285, 910, frame + 3, { height: 50, size: 6, alpha: 0.35 });
  },
  camera: cameraBetween({ x: 640, y: 520, zoom: 1.08 }, { x: 960, y: 540, zoom: 1.16 }),
};

export const SCENES = [facade, lobby, room, cafe];
