/**
 * Normaliza texto para comparaciones de búsqueda/filtro que deben ignorar
 * mayúsculas, tildes y espacios extra (ver Documento Maestro §6.5 y §6.1:
 * "Filtro/búsqueda de profesional debe ignorar mayúsculas, espacios y tildes").
 *
 * Comportamiento puro y neutral — sin paleta ni dependencia de ningún
 * dashboard — para que Estudiante, Profesional y Admin puedan reutilizarlo
 * sin acoplar sus estilos.
 */
export function normalizarTexto(valor: string | null | undefined): string {
  if (!valor) return '';
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes/diacríticos
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' '); // colapsa espacios múltiples
}

/** true si `texto` contiene `busqueda`, ignorando mayúsculas/tildes/espacios. */
export function coincideBusqueda(texto: string | null | undefined, busqueda: string | null | undefined): boolean {
  const b = normalizarTexto(busqueda);
  if (!b) return true;
  return normalizarTexto(texto).includes(b);
}
