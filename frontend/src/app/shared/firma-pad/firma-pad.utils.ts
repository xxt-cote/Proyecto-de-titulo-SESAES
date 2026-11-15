/**
 * Funciones puras de la firma manuscrita digitalizada (recorte, límites y
 * limpieza de fondo). Están separadas del componente para poder probarlas sin
 * un navegador real. Los límites coinciden con los del backend
 * (firma_profesional_service.py): si cambian allá, cambian aquí.
 */
export const FIRMA_MIN_ANCHO = 40;
export const FIRMA_MIN_ALTO = 15;
export const FIRMA_MAX_ANCHO = 1200;
export const FIRMA_MAX_ALTO = 600;
export const FIRMA_MAX_BYTES = 300_000;

export interface Caja { x: number; y: number; ancho: number; alto: number; }

/** Rectángulo mínimo que contiene todos los píxeles "con tinta" (alfa sobre el umbral). null si no hay. */
export function cajaDeTinta(
  datos: ArrayLike<number>, ancho: number, alto: number, umbralAlfa = 10,
): Caja | null {
  let minX = ancho, minY = alto, maxX = -1, maxY = -1;
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      if (datos[(y * ancho + x) * 4 + 3] > umbralAlfa) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, ancho: maxX - minX + 1, alto: maxY - minY + 1 };
}

/** Reduce (nunca agranda) manteniendo la proporción para que quepa en los máximos. */
export function ajustarALimites(
  ancho: number, alto: number, maxAncho = FIRMA_MAX_ANCHO, maxAlto = FIRMA_MAX_ALTO,
): { ancho: number; alto: number; escala: number } {
  const escala = Math.min(1, maxAncho / ancho, maxAlto / alto);
  return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)), escala };
}

/**
 * Para firmas subidas desde una foto o un escaneo: vuelve transparentes los
 * píxeles casi blancos (el papel) para que la firma no salga con un recuadro
 * blanco sobre el PDF. Modifica `datos` y devuelve cuántos píxeles cambió.
 */
export function volverTransparenteElFondoClaro(datos: Uint8ClampedArray, umbral = 225): number {
  let cambiados = 0;
  for (let i = 0; i < datos.length; i += 4) {
    const brillo = (datos[i] + datos[i + 1] + datos[i + 2]) / 3;
    if (datos[i + 3] > 0 && brillo > umbral) {
      datos[i + 3] = 0;
      cambiados++;
    }
  }
  return cambiados;
}

/** Tamaño aproximado, en bytes, de la imagen contenida en un data URL base64. */
export function bytesDeDataUrl(dataUrl: string): number {
  const coma = dataUrl.indexOf(',');
  const base64 = coma >= 0 ? dataUrl.slice(coma + 1) : dataUrl;
  return Math.floor(base64.length * 0.75);
}
