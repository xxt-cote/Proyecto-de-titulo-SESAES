/**
 * SESAES — RBAC frontend: roles (Fase 3.1)
 *
 * Los STRING VALUES coinciden EXACTAMENTE con
 * backend/app/rbac/roles.py (Role). No se inventan nombres distintos
 * en el frontend.
 *
 * Roles reales verificados en AuthService/LoginResponse (sessionStorage,
 * clave 'rol'): 'estudiante' | 'profesional' | 'admin'. 'superadmin' no
 * existe todavía en el código productivo, pero se agrega acá como rol
 * canónico igual que en el backend.
 */

export type Role = 'superadmin' | 'admin' | 'profesional' | 'estudiante';

export const ROLES: readonly Role[] = [
  'superadmin',
  'admin',
  'profesional',
  'estudiante',
] as const;

/**
 * Normaliza un valor de rol crudo (ej. AuthService.getRol()) a un Role
 * válido. Fail-closed: null, vacío o desconocido → null. Nunca hace
 * fallback a 'admin'/'superadmin'.
 */
export function normalizarRol(value: string | null | undefined): Role | null {
  if (!value) return null;
  const normalizado = value.trim().toLowerCase();
  return (ROLES as readonly string[]).includes(normalizado) ? (normalizado as Role) : null;
}
