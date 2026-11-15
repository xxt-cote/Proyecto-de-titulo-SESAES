import { describe, it, expect } from 'vitest';
import {
  ajustarALimites, bytesDeDataUrl, cajaDeTinta, volverTransparenteElFondoClaro,
  FIRMA_MAX_ALTO, FIRMA_MAX_ANCHO,
} from './firma-pad.utils';

/** Imagen RGBA de ancho x alto, transparente, con píxeles de tinta en las posiciones indicadas. */
function imagen(ancho: number, alto: number, tinta: [number, number][] = []): Uint8ClampedArray {
  const d = new Uint8ClampedArray(ancho * alto * 4);
  for (const [x, y] of tinta) d[(y * ancho + x) * 4 + 3] = 255;
  return d;
}

describe('cajaDeTinta', () => {
  it('devuelve null si el lienzo está en blanco', () => {
    expect(cajaDeTinta(imagen(50, 20), 50, 20)).toBeNull();
  });

  it('encuentra el rectángulo mínimo que contiene todo el trazo', () => {
    const d = imagen(100, 50, [[10, 5], [40, 30], [25, 12]]);
    expect(cajaDeTinta(d, 100, 50)).toEqual({ x: 10, y: 5, ancho: 31, alto: 26 });
  });

  it('un solo píxel da una caja de 1x1', () => {
    expect(cajaDeTinta(imagen(10, 10, [[3, 4]]), 10, 10)).toEqual({ x: 3, y: 4, ancho: 1, alto: 1 });
  });

  it('ignora el ruido casi transparente (alfa bajo el umbral)', () => {
    const d = imagen(10, 10);
    d[(2 * 10 + 2) * 4 + 3] = 5;
    expect(cajaDeTinta(d, 10, 10)).toBeNull();
  });
});

describe('ajustarALimites', () => {
  it('no agranda una imagen que ya cabe', () => {
    expect(ajustarALimites(300, 100)).toEqual({ ancho: 300, alto: 100, escala: 1 });
  });

  it('reduce manteniendo la proporción cuando se pasa del ancho', () => {
    const r = ajustarALimites(2400, 400);
    expect(r.ancho).toBe(FIRMA_MAX_ANCHO);
    expect(r.alto).toBe(200);
  });

  it('reduce cuando se pasa del alto', () => {
    const r = ajustarALimites(600, 1200);
    expect(r.alto).toBe(FIRMA_MAX_ALTO);
    expect(r.ancho).toBe(300);
  });

  it('nunca devuelve 0', () => {
    const r = ajustarALimites(100000, 1);
    expect(r.alto).toBeGreaterThanOrEqual(1);
  });
});

describe('volverTransparenteElFondoClaro', () => {
  it('borra el papel blanco y conserva la tinta oscura', () => {
    const d = new Uint8ClampedArray([
      255, 255, 255, 255,   // papel
      20, 20, 60, 255,      // tinta
      240, 240, 240, 255,   // sombra clara del papel
    ]);
    const cambiados = volverTransparenteElFondoClaro(d);
    expect(cambiados).toBe(2);
    expect(d[3]).toBe(0);
    expect(d[7]).toBe(255);
    expect(d[11]).toBe(0);
  });

  it('no cuenta píxeles que ya eran transparentes', () => {
    const d = new Uint8ClampedArray([255, 255, 255, 0]);
    expect(volverTransparenteElFondoClaro(d)).toBe(0);
  });
});

describe('bytesDeDataUrl', () => {
  it('estima el tamaño de la imagen a partir del base64', () => {
    expect(bytesDeDataUrl('data:image/png;base64,AAAA')).toBe(3);
    expect(bytesDeDataUrl('data:image/png;base64,' + 'A'.repeat(400))).toBe(300);
  });
});
