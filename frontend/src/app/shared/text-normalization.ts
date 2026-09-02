/**
 * Normaliza texto para búsquedas de UI: ignora espacios extremos,
 * mayúsculas/minúsculas y diacríticos (tildes).
 */
export function normalizarTexto(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
