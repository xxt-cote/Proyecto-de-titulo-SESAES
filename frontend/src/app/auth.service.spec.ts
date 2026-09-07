import { HttpClient } from '@angular/common/http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AuthService } from './auth.service';


describe('AuthService — identidad de sesión', () => {
  let service: AuthService;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();

    service = new AuthService({} as HttpClient);
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('devuelve usuario_id válido desde sessionStorage', () => {
    sessionStorage.setItem('usuario_id', '15');

    expect(service.getUsuarioId()).toBe(15);
  });

  it('sin usuario_id devuelve null', () => {
    expect(service.getUsuarioId()).toBeNull();
  });

  it('rechaza usuario_id no numérico o no positivo', () => {
    sessionStorage.setItem('usuario_id', 'abc');
    expect(service.getUsuarioId()).toBeNull();

    sessionStorage.setItem('usuario_id', '0');
    expect(service.getUsuarioId()).toBeNull();

    sessionStorage.setItem('usuario_id', '-3');
    expect(service.getUsuarioId()).toBeNull();
  });

  it('no consulta localStorage como fallback', () => {
    localStorage.setItem('usuario_id', '11');

    expect(service.getUsuarioId()).toBeNull();
  });
  it('actualizarRolSesion cambia el rol sin alterar la identidad', () => {
    sessionStorage.setItem('rol', 'superadmin');
    sessionStorage.setItem('usuario_id', '15');
    sessionStorage.setItem('nombre', 'Super Admin');
    sessionStorage.setItem('access_token', 'token-prueba');

    service.actualizarRolSesion('admin');

    expect(service.getRol()).toBe('admin');
    expect(service.getUsuarioId()).toBe(15);
    expect(service.getNombre()).toBe('Super Admin');
    expect(service.getToken()).toBe('token-prueba');
  });

  it('actualizarRolSesion recalcula inmediatamente los permisos por rol', () => {
    sessionStorage.setItem('rol', 'superadmin');

    expect(service.hasPermission('roles.gestionar')).toBe(true);

    service.actualizarRolSesion('admin');

    expect(service.hasPermission('roles.gestionar')).toBe(false);
  });


});
