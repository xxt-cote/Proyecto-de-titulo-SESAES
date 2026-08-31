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
});
