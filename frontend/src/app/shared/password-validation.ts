/**
 * Checklist de complejidad de contraseña en vivo, compartido entre
 * Estudiante y Profesional (Documento Maestro §7.4: "adoptar el mismo
 * patrón funcional del Estudiante... checklist... con estilos propios").
 *
 * Es comportamiento puro, sin markup ni colores — cada dashboard renderiza
 * su propio checklist visual a partir de este resultado, con su propio CSS.
 * La misma política se re-valida en el backend (ver security.errores_password
 * en el backend) — esto es solo para feedback en vivo, nunca la única barrera.
 */
export interface ChecklistPassword {
  longitud: boolean;   // al menos 8 caracteres
  mayuscula: boolean;  // al menos una letra mayúscula
  numero: boolean;     // al menos un número
  especial: boolean;   // al menos un carácter especial
  valida: boolean;     // true solo si se cumplen los 4 anteriores
}

const CARACTERES_ESPECIALES = /[!@#$%^&*()_+\-=[\]{}|;:'",.<>/?`~\\]/;

export function evaluarPassword(password: string | null | undefined): ChecklistPassword {
  const p = password || '';
  const longitud = p.length >= 8;
  const mayuscula = /[A-ZÁÉÍÓÚÑ]/.test(p);
  const numero = /[0-9]/.test(p);
  const especial = CARACTERES_ESPECIALES.test(p);
  return { longitud, mayuscula, numero, especial, valida: longitud && mayuscula && numero && especial };
}
