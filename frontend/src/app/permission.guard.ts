import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { normalizarRol, Role } from './shared/auth/role.model';
import { isPermission } from './shared/auth/permission.model';

/**
 * permissionGuard — Fase 3.3.
 *
 * IMPORTANTE — permissionGuard solo controla UX/navegación en el
 * frontend. El sessionStorage/JWT del navegador puede ser leído o
 * manipulado por el propio usuario; este guard NUNCA es la barrera de
 * seguridad real. El backend sigue siendo la única autoridad: cada
 * endpoint protegido vuelve a validar el permiso server-side vía
 * require_permission (backend/app/rbac/permissions.py). Este guard NO
 * valida firmas JWT (eso también es responsabilidad exclusiva del
 * backend) y no lleva secretos de ningún tipo.
 *
 * Uso: data: { permission: 'agenda.gestionar' } en la definición de la
 * ruta. Todavía NO está conectado a ninguna ruta productiva (eso queda
 * para una fase posterior que además decida cómo tratar el shell
 * monolítico de dashboard/admin — ver Fase 3.4).
 *
 * Fail-closed en todos los casos:
 * - sin sesión válida (sin token, token expirado, o rol persistido pero
 *   sin token) → false, redirige a /login.
 * - rol desconocido/no normalizable → false, redirige a /login.
 * - route.data.permission ausente, vacío, o no perteneciente al
 *   catálogo de 18 Permission (isPermission) → false.
 * - permission válido pero no concedido por ROLE_DEFAULT_PERMISSIONS del
 *   rol actual → false, redirige al destino de rechazo del rol (ver
 *   destinoRechazo).
 *
 * SUPERADMIN no tiene dashboard propio todavía (no existe
 * /dashboard/superadmin y esta fase no lo crea). Si se le deniega un
 * permission, el destino de rechazo es /login como fallback temporal
 * hasta que una fase posterior agregue una navegación administrativa
 * compatible con Superadmin. No se redirige a /dashboard/admin porque
 * esa ruta usa rolGuard('admin') y rechazaría a un superadmin.
 */

/**
 * Destino al que se redirige cuando la sesión es válida pero el
 * permission fue denegado. Puro helper local, sin rutas inventadas.
 */
function destinoRechazo(rol: Role): string[] {
  switch (rol) {
    case 'admin':
      return ['/dashboard/admin'];
    case 'profesional':
      return ['/dashboard/profesional'];
    case 'estudiante':
      return ['/dashboard/estudiante'];
    case 'superadmin':
      // No existe /dashboard/superadmin todavía (fallback temporal).
      return ['/login'];
  }
}

export const permissionGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Sesión inválida (sin token, token expirado, o rol persistido pero
  // sin token): fail-closed, siempre a /login, sin evaluar nada más.
  if (!auth.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  const rol = normalizarRol(auth.getRol());
  if (!rol) {
    router.navigate(['/login']);
    return false;
  }

  const permissionRequerido = route.data?.['permission'];
  if (!isPermission(permissionRequerido)) {
    // Metadata ausente, vacía, o manipulada/desconocida → false.
    // No hay permission válido con el que decidir un destino de
    // rechazo específico del rol, así que no se navega a otro lado.
    return false;
  }

  if (auth.hasPermission(permissionRequerido)) {
    return true;
  }

  router.navigate(destinoRechazo(rol));
  return false;
};
