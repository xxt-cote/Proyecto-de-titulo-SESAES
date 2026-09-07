import { HttpClient } from '@angular/common/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';

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

  it('ADMIN y SUPERADMIN fallan cerrado sin contexto efectivo', () => {
    sessionStorage.setItem('rol', 'admin');

    expect(
      service.hasPermission('agenda.gestionar')
    ).toBe(false);

    sessionStorage.setItem('rol', 'superadmin');

    expect(
      service.hasPermission('roles.gestionar')
    ).toBe(false);
  });

  it('carga permisos ADMIN desde backend y no desde defaults de rol', () => {
    const http = {
      get: vi.fn(() => of({
        rol: 'admin',
        perfil: 'administrador_especialidad',
        permisos: [
          'agenda.ver',
          'profesionales.ver'
        ],
        alcance: {
          tipo: 'especialidades',
          especialidades: [
            'Nutricion'
          ]
        }
      }))
    } as unknown as HttpClient;

    const auth = new AuthService(http);

    sessionStorage.setItem(
      'rol',
      'admin'
    );

    auth.cargarAccesoAdministrativo().subscribe();

    expect(http.get).toHaveBeenCalledWith(
      expect.stringContaining(
        '/usuarios/me/acceso-administrativo'
      )
    );

    expect(
      auth.hasPermission('agenda.ver')
    ).toBe(true);

    expect(
      auth.hasPermission('profesionales.ver')
    ).toBe(true);

    expect(
      auth.hasPermission('agenda.gestionar')
    ).toBe(false);

    // El contexto efectivo vive solo en memoria.
    expect(
      sessionStorage.getItem('permisos')
    ).toBeNull();

    expect(
      sessionStorage.getItem('alcance')
    ).toBeNull();

    expect(
      sessionStorage.getItem('perfil_acceso')
    ).toBeNull();
  });

  it('sincroniza el rol persistido con el rol actual del backend', () => {
    const http = {
      get: vi.fn(() => of({
        rol: 'superadmin',
        perfil: null,
        permisos: [
          'roles.gestionar'
        ],
        alcance: {
          tipo: 'institucional',
          especialidades: []
        }
      }))
    } as unknown as HttpClient;

    const auth = new AuthService(http);

    // Simula una sesion cuyo rol local quedo antiguo.
    sessionStorage.setItem(
      'rol',
      'admin'
    );

    auth.cargarAccesoAdministrativo().subscribe();

    expect(
      auth.getRol()
    ).toBe('superadmin');

    expect(
      auth.hasPermission('roles.gestionar')
    ).toBe(true);
  });

  it('actualizarRolSesion invalida el contexto administrativo anterior', () => {
    const http = {
      get: vi.fn(() => of({
        rol: 'superadmin',
        perfil: null,
        permisos: [
          'roles.gestionar'
        ],
        alcance: {
          tipo: 'institucional',
          especialidades: []
        }
      }))
    } as unknown as HttpClient;

    const auth = new AuthService(http);

    sessionStorage.setItem(
      'rol',
      'superadmin'
    );

    auth.cargarAccesoAdministrativo().subscribe();

    expect(
      auth.hasPermission('roles.gestionar')
    ).toBe(true);

    auth.actualizarRolSesion('admin');

    expect(
      auth.getRol()
    ).toBe('admin');

    expect(
      auth.hasPermission('roles.gestionar')
    ).toBe(false);

    expect(
      auth.getContextoAccesoAdministrativo()
    ).toBeNull();
  });

  it('profesional y estudiante conservan temporalmente sus defaults', () => {
    sessionStorage.setItem(
      'rol',
      'profesional'
    );

    expect(
      service.hasPermission('agenda.ver_profesional')
    ).toBe(true);

    expect(
      service.hasPermission('agenda.gestionar')
    ).toBe(false);

    sessionStorage.setItem(
      'rol',
      'estudiante'
    );

    expect(
      service.hasPermission('perfil.ver_propio')
    ).toBe(true);

    expect(
      service.hasPermission('reportes.ver')
    ).toBe(false);
  });

  it('rechaza contexto administrativo invalido y conserva fail-closed', () => {
    const http = {
      get: vi.fn(() => of({
        rol: 'admin',
        perfil: null,
        permisos: [
          'agenda.gestionar'
        ],
        alcance: {
          tipo: 'institucional',
          especialidades: []
        }
      }))
    } as unknown as HttpClient;

    const auth = new AuthService(http);

    sessionStorage.setItem(
      'rol',
      'admin'
    );

    let errorRecibido: unknown = null;

    auth.cargarAccesoAdministrativo().subscribe({
      error: error => {
        errorRecibido = error;
      }
    });

    expect(
      errorRecibido
    ).toBeTruthy();

    expect(
      auth.getContextoAccesoAdministrativo()
    ).toBeNull();

    expect(
      auth.hasPermission('agenda.gestionar')
    ).toBe(false);
  });


});
