import { useId } from 'react';
import { BRAND_NAME, MONOGRAM_PATHS } from './brand.js';

function Monogram({ withDiamond = true }) {
  return (
    <g className="brand-monogram" fill="none" strokeLinecap="butt">
      <path d={MONOGRAM_PATHS.stems} strokeWidth="2.6" />
      <path d={MONOGRAM_PATHS.details} strokeWidth="2" />
      <path d={MONOGRAM_PATHS.serifs} strokeWidth="1.4" />
      {withDiamond && <path className="brand-monogram-diamond" d={MONOGRAM_PATHS.diamond} />}
    </g>
  );
}

// Marca compacta: arco (puerta de hotel) con el monograma HB.
export function BrandMark({ className = '' }) {
  return (
    <svg className={`brand-mark ${className}`.trim()} viewBox="0 0 48 56" aria-hidden="true" focusable="false">
      <path className="brand-mark-arch" d="M5 55V23A19 19 0 0 1 43 23V55Z" />
      <path className="brand-mark-line" d="M8.5 55V23.5A15.5 15.5 0 0 1 39.5 23.5V55" fill="none" strokeWidth=".9" />
      <Monogram />
    </svg>
  );
}

// Sello completo: el nombre recorre el círculo y el monograma queda al centro.
export function BrandEmblem({ className = '' }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className={`brand-emblem ${className}`.trim()} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <defs>
        <path id={`ring-${id}`} d="M60 60m-45 0a45 45 0 1 1 90 0a45 45 0 1 1 -90 0" />
      </defs>
      <circle className="brand-emblem-disc" cx="60" cy="60" r="58" />
      <circle className="brand-emblem-line" cx="60" cy="60" r="54" fill="none" strokeWidth=".8" />
      <circle className="brand-emblem-line" cx="60" cy="60" r="36" fill="none" strokeWidth=".8" />
      <text className="brand-emblem-text">
        <textPath href={`#ring-${id}`} textLength="279" lengthAdjust="spacing">
          HOTEL • BOUTIQUE • GESTIÓN HOTELERA •
        </textPath>
      </text>
      <g transform="translate(24 5.25) scale(1.5)">
        <Monogram withDiamond={false} />
      </g>
    </svg>
  );
}

// Logotipo de cabecera: marca + nombre.
export function BrandLockup({ href = '/' }) {
  return (
    <a className="brand" href={href} aria-label={`${BRAND_NAME}, inicio`}>
      <BrandMark />
      <span className="brand-word">
        <span className="brand-word-top">HOTEL</span>
        <span className="brand-word-main">Boutique<span className="brand-period">.</span></span>
      </span>
    </a>
  );
}
