import { CanDeactivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Se ejecuta cada vez que Angular intenta sacar al usuario de un dashboard,
 * ya sea por un link interno o por el botón "atrás/adelante" del navegador
 * (el Router de Angular evalúa este guard también en esos casos).
 *
 * Si el usuario confirma, se cierra la sesión y se permite la navegación.
 * Si cancela, la navegación se bloquea y el usuario se queda donde estaba
 * (incluyendo si el intento vino del botón "atrás" del navegador).
 */
export const leaveDashboardGuard: CanDeactivateFn<unknown> = () => {
  const confirmado = window.confirm('¿Seguro que quieres salir? Se cerrará tu sesión.');

  if (confirmado) {
    inject(AuthService).logout();
  }

  return confirmado;
};
