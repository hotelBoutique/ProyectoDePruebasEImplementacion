import { useEffect, useRef, useState } from 'react';
import { STATION_SECONDS, STATIONS } from './stations.js';
import { BrandEmblem } from '../BrandLogo.jsx';

function supportsCanvas() {
  try {
    return Boolean(document.createElement('canvas').getContext('2d'));
  } catch {
    return false;
  }
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export default function HotelShowcase({ fallback = null, variant = 'panel' }) {
  const stageRef = useRef(null);
  const fadeRef = useRef(null);
  const experienceRef = useRef(null);
  const [station, setStation] = useState(0);
  const [status, setStatus] = useState(() => (supportsCanvas() ? 'loading' : 'unsupported'));
  const [reducedMotion] = useState(prefersReducedMotion);

  useEffect(() => {
    if (status === 'unsupported') return undefined;
    let cancelled = false;

    (async () => {
      try {
        // Los letreros usan la tipografía de la marca; se espera a que cargue para dibujarlos.
        await document.fonts?.load('600 64px "Cormorant Garamond"').catch(() => {});
        const { createHotelExperience } = await import('./hotelAnimation2D.js');
        if (cancelled || !stageRef.current) return;
        experienceRef.current = createHotelExperience(stageRef.current, {
          overlay: fadeRef.current,
          reducedMotion,
          layout: variant,
          onStationChange: (index) => {
            if (cancelled) return;
            setStation(index);
            setStatus('ready');
          },
        });
      } catch (error) {
        console.warn('No fue posible iniciar la animación del hotel', error);
        if (!cancelled) setStatus('unsupported');
      }
    })();

    return () => {
      cancelled = true;
      experienceRef.current?.dispose();
      experienceRef.current = null;
    };
  }, [status === 'unsupported', reducedMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'unsupported') return fallback;

  const current = STATIONS[station];

  return (
    <div className={`hotel3d hotel3d--${variant}${status === 'ready' ? ' hotel3d-ready' : ''}`}>
      <div className="hotel3d-stage" ref={stageRef} aria-hidden="true" />
      <div className="hotel3d-fade" ref={fadeRef} aria-hidden="true" />
      <div className="hotel3d-vignette" aria-hidden="true" />
      {status !== 'ready' && (
        <div className="hotel3d-loading" role="status">
          <BrandEmblem className="hotel3d-loading-mark" />
          Preparando el recorrido…
        </div>
      )}
      <div className="hotel3d-caption" aria-live="polite">
        <span className="hotel3d-eyebrow">
          {String(station + 1).padStart(2, '0')} / {String(STATIONS.length).padStart(2, '0')} · {current.eyebrow}
        </span>
        <strong className="hotel3d-title">{current.title}</strong>
        <span className="hotel3d-text">{current.text}</span>
        <div className="hotel3d-progress" role="group" aria-label="Secciones del recorrido">
          {STATIONS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`hotel3d-step${index === station ? ' is-active' : ''}${index < station ? ' is-done' : ''}`}
              onClick={() => experienceRef.current?.goTo(index)}
              aria-label={`Ver ${item.title}`}
              aria-current={index === station ? 'step' : undefined}
            >
              <span
                key={index === station ? `active-${station}` : 'idle'}
                style={index === station ? { animationDuration: `${STATION_SECONDS}s` } : undefined}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
