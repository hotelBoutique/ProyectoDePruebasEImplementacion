export const BRAND_NAME = 'Hotel Boutique';

// Monograma "HB": la B comparte el trazo vertical derecho de la H, con remates
// tipo serif. Coordenadas en un lienzo de 48 x 56 (el mismo de la marca en arco).
// Lo usan el logo SVG y el letrero de la escena 3D.
export const MONOGRAM_PATHS = {
  stems: 'M15 26V47M25 26V47',
  details: 'M15 36.5H25M25 26.6H29.2A4.7 4.7 0 0 1 29.2 36H25M25 36.5H30A5.25 5.25 0 0 1 30 47H25',
  serifs: 'M12.6 26H17.4M12.6 47H17.4M22.6 26H25M22.6 47H25',
  diamond: 'M24 9.5L26 12L24 14.5L22 12Z',
};

// Caja que ocupa el monograma (sin el rombo) dentro del lienzo de 48 x 56.
export const MONOGRAM_BOUNDS = { x: 12.6, y: 26, width: 22.65, height: 21 };
