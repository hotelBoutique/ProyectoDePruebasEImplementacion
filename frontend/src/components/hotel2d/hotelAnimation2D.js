import { DESIGN_H, DESIGN_W, SCENES } from './scenes.js';
import { STATION_SECONDS } from './stations.js';

// Animación 2D por fotogramas: los personajes y objetos avanzan a 12 fps (como la
// animación tradicional) y la cámara a 24 fps para que el paneo no se vea a saltos.
const SPRITE_FPS = 12;
const CAMERA_FPS = 24;
const FADE_SECONDS = 0.8;
const JUMP_FADE_SECONDS = 0.4;
const MAX_ZOOM = 1.75;
const MAX_LAYER_RESOLUTION = 2;
// Solo se guardan los fondos de la escena actual y la siguiente para limitar memoria.
const CACHED_SCENES = 2;

function getFocusX(layout, width) {
  if (layout !== 'background' || width < 900) return 0.5;
  return Math.min(0.78, 0.75 + 100 / width);
}

function paintLayer(draw, resolution) {
  const layer = document.createElement('canvas');
  layer.width = Math.round(DESIGN_W * resolution);
  layer.height = Math.round(DESIGN_H * resolution);
  const ctx = layer.getContext('2d');
  ctx.scale(resolution, resolution);
  draw(ctx);
  return layer;
}

export function createHotelExperience(container, { overlay, onStationChange, reducedMotion = false, layout = 'panel' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'hotel2d-canvas';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let width = 1;
  let height = 1;
  let dpr = 1;
  let layerResolution = 1;
  const layers = new Map();

  function getLayers(index) {
    const cached = layers.get(index);
    if (cached && Math.abs(cached.resolution - layerResolution) / layerResolution < 0.2) return cached;
    const scene = SCENES[index];
    layers.delete(index);
    while (layers.size >= CACHED_SCENES) {
      const oldest = [...layers.keys()].find((key) => key !== active);
      if (oldest === undefined) break;
      layers.delete(oldest);
    }
    const entry = {
      resolution: layerResolution,
      back: paintLayer((layerCtx) => scene.back(layerCtx), layerResolution),
      front: scene.front ? paintLayer((layerCtx) => scene.front(layerCtx), layerResolution) : null,
    };
    layers.set(index, entry);
    return entry;
  }

  function resize() {
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const visibleWidth = layout === 'background' && width >= 900 ? width * (1 - getFocusX(layout, width)) * 2 : width;
    const baseScale = Math.max(height / DESIGN_H, visibleWidth / DESIGN_W);
    layerResolution = Math.min(MAX_LAYER_RESOLUTION, Math.max(0.5, baseScale * dpr * MAX_ZOOM));
    lastDraw = -1;
  }

  let active = 0;
  const idle = window.requestIdleCallback || ((callback) => setTimeout(callback, 200));
  let elapsed = 0;
  let jump = null;
  let lastDraw = -1;

  function setFade(value) {
    if (overlay) overlay.style.opacity = String(Math.max(0, Math.min(1, value)));
  }

  function activate(index) {
    active = index;
    elapsed = 0;
    getLayers(index);
    onStationChange?.(index);
    // Prepara en segundo plano el fondo de la siguiente escena.
    const next = (index + 1) % SCENES.length;
    idle(() => { if (!disposed && active === index) getLayers(next); });
  }

  function draw() {
    const scene = SCENES[active];
    const { back, front } = getLayers(active);
    const progress = Math.min(1, elapsed / STATION_SECONDS);
    const cameraTime = reducedMotion ? 0.5 : Math.floor(progress * STATION_SECONDS * CAMERA_FPS) / (STATION_SECONDS * CAMERA_FPS);
    const camera = scene.camera(reducedMotion ? 0.5 : cameraTime);
    const frame = Math.floor(elapsed * SPRITE_FPS);
    const spriteTime = frame / SPRITE_FPS;

    const focusX = getFocusX(layout, width);
    const visibleWidth = layout === 'background' && width >= 900 ? width * (1 - focusX) * 2 : width;
    const scale = Math.max(height / DESIGN_H, visibleWidth / DESIGN_W) * camera.zoom * dpr;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = scene.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, focusX * width * dpr - camera.x * scale, (height * dpr) / 2 - camera.y * scale);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(back, 0, 0, DESIGN_W, DESIGN_H);
    scene.mid?.(ctx, spriteTime, frame);
    if (front) ctx.drawImage(front, 0, 0, DESIGN_W, DESIGN_H);
    scene.over?.(ctx, spriteTime, frame);
  }

  let previous = performance.now();
  let rafId = 0;
  let running = false;
  let visible = true;
  let disposed = false;

  function tick(now) {
    rafId = requestAnimationFrame(tick);
    const delta = Math.min(0.25, (now - previous) / 1000);
    previous = now;

    if (jump) {
      jump.t += delta;
      setFade(jump.t / JUMP_FADE_SECONDS);
      if (jump.t >= JUMP_FADE_SECONDS) {
        activate(jump.to);
        jump = null;
      }
    } else {
      elapsed += delta;
      if (elapsed >= STATION_SECONDS) activate((active + 1) % SCENES.length);
      const fadeIn = elapsed < FADE_SECONDS ? 1 - elapsed / FADE_SECONDS : 0;
      const fadeOut = elapsed > STATION_SECONDS - FADE_SECONDS ? (elapsed - (STATION_SECONDS - FADE_SECONDS)) / FADE_SECONDS : 0;
      setFade(Math.max(fadeIn, fadeOut));
    }

    // Solo se redibuja cuando cambia el fotograma de cámara (24 fps).
    const drawStep = Math.floor(elapsed * CAMERA_FPS) + active * 100000;
    if (drawStep !== lastDraw) {
      lastDraw = drawStep;
      draw();
    }
  }

  function syncLoop() {
    const shouldRun = visible && !document.hidden && !disposed;
    if (shouldRun === running) return;
    running = shouldRun;
    if (running) {
      previous = performance.now();
      rafId = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafId);
    }
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncLoop();
  });
  visibilityObserver.observe(container);
  document.addEventListener('visibilitychange', syncLoop);

  resize();
  activate(0);
  setFade(1);
  syncLoop();


  return {
    goTo(index) {
      if (index === active || jump) return;
      jump = { to: index, t: 0 };
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      document.removeEventListener('visibilitychange', syncLoop);
      layers.clear();
      canvas.remove();
    },
  };
}
