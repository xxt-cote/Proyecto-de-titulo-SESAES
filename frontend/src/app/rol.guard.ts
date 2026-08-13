import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Protege cada dashboard según el rol de la sesión activa.
 * Se usa junto a authGuard (que ya valida que exista sesión).
 * Se aplica pasando el rol permitido como "data: { rol: 'estudiante' }"
 * en la definición de la ruta.
 *
 * Si el rol de la sesión no coincide con el rol esperado por la ruta,
 * redirige al dashboard que SÍ le corresponde en vez de dejarlo pasar
 * o mandarlo al login (para no cerrarle la sesión innecesariamente).
 */
export const rolGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const rolEsperado = route.data?.['rol'] as string | undefined;
  const rolActual = auth.getRol();

  if (!rolActual) {
    router.navigate(['/login']);
    return false;
  }

  if (rolEsperado && rolActual !== rolEsperado) {
    router.navigate([`/dashboard/${rolActual}`]);
    return false;
  }

  return true;
};
