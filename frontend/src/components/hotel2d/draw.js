import { MONOGRAM_BOUNDS, MONOGRAM_PATHS } from '../brand.js';

// Herramientas de dibujo para la animación 2D. Todo se dibuja en un lienzo de
// diseño de 1600 x 1000 unidades; el motor escala el resultado a la pantalla.

export const PALETTE = {
  night: '#0b1218',
  navy: '#1a2e3b',
  navySoft: '#2d4655',
  gold: '#c5a880',
  goldBright: '#f0cf98',
  cream: '#f2ece2',
  warm: '#ffd59c',
  warmDeep: '#e8a65c',
  skin: ['#e0b48f', '#b9845d', '#8a5a3c', '#f1c9a5'],
};

export function hexA(hex, alpha) {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

export function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function linear(ctx, x0, y0, x1, y1, stops) {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
  return gradient;
}

export function rect(ctx, x, y, w, h, fill) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

export function rounded(ctx, x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function circle(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function ellipse(ctx, x, y, rx, ry, fill, rotation = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function line(ctx, x0, y0, x1, y1, stroke, width = 1) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

export function poly(ctx, points, fill) {
  ctx.beginPath();
  points.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

// Halo de luz aditivo (lámparas, ventanas, letreros).
export function glow(ctx, x, y, radius, color, alpha = 1) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, hexA(color, alpha));
  gradient.addColorStop(0.35, hexA(color, alpha * 0.35));
  gradient.addColorStop(1, hexA(color, 0));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

// Cono de luz (focos, faros) que se desvanece con la distancia.
export function beam(ctx, x, y, length, spread, angle, color, alpha = 0.35) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const gradient = ctx.createLinearGradient(0, 0, length, 0);
  gradient.addColorStop(0, hexA(color, alpha));
  gradient.addColorStop(1, hexA(color, 0));
  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath();
  ctx.moveTo(0, -spread * 0.08);
  ctx.lineTo(length, -spread);
  ctx.lineTo(length, spread);
  ctx.lineTo(0, spread * 0.08);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();
}

// Vetas de mármol sobre un rectángulo.
export function marbleVeins(ctx, x, y, w, h, color, seed = 1, count = 9) {
  const random = seeded(seed);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = color;
  for (let i = 0; i < count; i += 1) {
    ctx.lineWidth = 0.6 + random() * 1.6;
    ctx.globalAlpha = 0.25 + random() * 0.45;
    ctx.beginPath();
    let px = x + random() * w;
    let py = y - 10;
    ctx.moveTo(px, py);
    while (py < y + h + 10) {
      px += (random() - 0.45) * 38;
      py += 14 + random() * 26;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function monogram(ctx, cx, cy, height, color, { glowColor = null, weight = 1 } = {}) {
  const scale = height / MONOGRAM_BOUNDS.height;
  ctx.save();
  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = height * 0.6;
  }
  ctx.translate(cx - (MONOGRAM_BOUNDS.x + MONOGRAM_BOUNDS.width / 2) * scale, cy - (MONOGRAM_BOUNDS.y + MONOGRAM_BOUNDS.height / 2) * scale);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.lineCap = 'butt';
  [[MONOGRAM_PATHS.stems, 2.6], [MONOGRAM_PATHS.details, 2], [MONOGRAM_PATHS.serifs, 1.4]].forEach(([path, width]) => {
    ctx.lineWidth = width * weight;
    ctx.stroke(new Path2D(path));
  });
  ctx.restore();
}

export function text(ctx, value, x, y, { size = 20, family = '"Plus Jakarta Sans", sans-serif', weight = 600, color = PALETTE.cream, align = 'center', spacing = 0, glowColor = null } = {}) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (spacing) ctx.letterSpacing = `${spacing}px`;
  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = size * 0.8;
  }
  ctx.fillText(value, x, y);
  ctx.restore();
}

// Follaje: racimo de manchas superpuestas con luz desde arriba.
export function foliage(ctx, x, y, radius, { seed = 1, dark = '#1d2e22', mid = '#2c4530', light = '#41613f', sway = 0 } = {}) {
  const random = seeded(seed);
  const blobs = Array.from({ length: 9 }, () => ({
    dx: (random() - 0.5) * radius * 1.4,
    dy: (random() - 0.5) * radius * 1.1,
    r: radius * (0.42 + random() * 0.32),
  }));
  blobs.forEach(({ dx, dy, r }) => circle(ctx, x + dx + sway * (1 - (dy + radius) / (radius * 2)), y + dy, r, dark));
  blobs.forEach(({ dx, dy, r }) => circle(ctx, x + dx * 0.9 + sway, y + dy * 0.9 - r * 0.18, r * 0.78, mid));
  blobs.slice(0, 5).forEach(({ dx, dy, r }) => circle(ctx, x + dx * 0.8 + sway * 1.1, y + dy * 0.8 - r * 0.35, r * 0.42, light));
}

const WALK = Array.from({ length: 8 }, (_, frame) => Math.sin((frame / 8) * Math.PI * 2));

// Personaje articulado. (x, y) es el punto entre los pies; altura de 100 unidades
// multiplicada por `scale`. `frame` avanza las poses del ciclo (por fotogramas).
export function person(ctx, {
  x, y, scale = 1, frame = 0, facing = 1, action = 'stand',
  coat = PALETTE.navySoft, pants = '#1b2026', skin = PALETTE.skin[0], hair = '#2a1d14',
  accent = null, suitcase = false, hairLong = false,
}) {
  const cycle = WALK[((frame % 8) + 8) % 8];
  const walking = action === 'walk';
  const leg = walking ? cycle * 0.42 : 0;
  const bob = walking ? -Math.abs(cycle) * 2.2 : action === 'idle' ? (frame % 4 < 2 ? 0 : -0.8) : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * facing, scale);

  // Sombra en el piso.
  ellipse(ctx, 0, 0, 18, 3.5, 'rgba(0, 0, 0, 0.28)');
  ctx.translate(0, bob);

  const limb = (ox, oy, length, width, angle, fill, foot = null) => {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(angle);
    rounded(ctx, -width / 2, 0, width, length, width / 2, fill);
    if (foot) rounded(ctx, -width / 2 - 1, length - 3, width + 7, 5, 2, foot);
    ctx.restore();
  };

  const shoe = '#141414';
  // Pierna trasera y brazo trasero (más oscuros).
  limb(-2, -50, 50, 9, -leg, pants, shoe);

  let backArm = walking ? -cycle * 0.5 : 0.08;
  let frontArm = walking ? cycle * 0.5 : -0.08;
  let frontForearm = 0;
  if (action === 'type') {
    backArm = -1.1 + (frame % 2) * 0.12;
    frontArm = -1.2 + ((frame + 1) % 2) * 0.12;
  } else if (action === 'wave') {
    frontArm = -2.6 + (frame % 4 < 2 ? 0.35 : -0.15);
  } else if (action === 'pour') {
    frontArm = -1.35 + Math.sin(frame / 3) * 0.12;
    frontForearm = 1;
  } else if (action === 'sip') {
    const lifting = frame % 24 < 9;
    frontArm = lifting ? -2.3 : -0.9;
  } else if (action === 'give') {
    frontArm = -1.45;
  }
  if (suitcase) backArm = 0.12;

  limb(-1, -78, 30, 7, backArm, coat, null);
  if (suitcase) {
    const handX = Math.sin(-backArm) * 30 - 1;
    const handY = -78 + Math.cos(backArm) * 30;
    line(ctx, handX, handY, handX - 4, handY + 6, '#222', 1.6);
    rounded(ctx, handX - 20, handY + 4, 26, 30, 3, accent || '#7a4a2c');
    rect(ctx, handX - 20, handY + 15, 26, 2, 'rgba(0, 0, 0, 0.3)');
    circle(ctx, handX - 15, handY + 35, 2, '#111');
    circle(ctx, handX + 1, handY + 35, 2, '#111');
  }
  // Pierna delantera.
  limb(2, -50, 50, 9.5, leg, pants, shoe);

  // Torso (abrigo) y cuello.
  rounded(ctx, -12, -82, 24, 38, 7, coat);
  rect(ctx, -3, -86, 6, 6, skin);
  if (accent) rect(ctx, -12, -60, 24, 3, accent);

  // Cabeza y cabello.
  circle(ctx, 0, -93, 9.5, skin);
  ctx.beginPath();
  ctx.arc(0, -95, 10, Math.PI * 1.05, Math.PI * 2.05);
  ctx.fillStyle = hair;
  ctx.fill();
  if (hairLong) rounded(ctx, -10.5, -96, 6, 20, 3, hair);
  circle(ctx, 4.5, -94, 1.1, '#1a1a1a');

  // Brazo delantero (con antebrazo para servir).
  ctx.save();
  ctx.translate(1, -78);
  ctx.rotate(frontArm);
  rounded(ctx, -3.5, 0, 7, 17, 3.5, coat);
  ctx.translate(0, 15);
  ctx.rotate(frontForearm);
  rounded(ctx, -3.2, 0, 6.4, 15, 3.2, coat);
  circle(ctx, 0, 16, 3.4, skin);
  if (action === 'pour') {
    rounded(ctx, -4, 14, 12, 10, 2, '#d9dcdf');
  }
  if (action === 'sip') {
    rounded(ctx, -3, 12, 8, 7, 2, '#f4f0ea');
  }
  if (action === 'give') {
    rounded(ctx, -2, 15, 10, 6, 1, PALETTE.goldBright);
  }
  ctx.restore();

  ctx.restore();
}

// Bocanada de vapor: tres círculos que suben y se desvanecen según el fotograma.
export function steam(ctx, x, y, frame, { height = 60, size = 9, alpha = 0.35 } = {}) {
  for (let i = 0; i < 3; i += 1) {
    const local = ((frame + i * 4) % 12) / 12;
    const rise = local * height;
    circle(ctx, x + Math.sin((frame + i * 3) * 0.7) * 5, y - rise, size * (0.6 + local), `rgba(240, 236, 228, ${alpha * (1 - local)})`);
  }
}
