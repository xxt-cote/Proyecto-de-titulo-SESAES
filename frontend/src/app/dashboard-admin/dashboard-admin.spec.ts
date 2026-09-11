import { ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';

import { AuthService } from '../auth.service';
import { Permission } from '../shared/auth/permission.model';
import { ToastService } from '../shared/toast/toast.service';
import { DashboardAdminComponent } from './dashboard-admin';

/**
 * SA-1.1 — Identidad real del shell/topbar.
 *
 * Mismo patrón de mock de AuthService que ya usa rbac-frontend.spec.ts en
 * este mismo dashboard (auth como objeto plano con los métodos usados,
 * cast a AuthService), en vez de una instancia real respaldada por
 * sessionStorage, para quedar consistente con el resto de la suite de
 * este componente.
 *
 * Cubre únicamente los 4 getters de identidad agregados en esta fase
 * (nombreUsuario, fotoUsuarioUrl, rolVisual, inicialesUsuario). El resto
 * del shell (agenda, XLSX, RBAC, etc.) ya está cubierto por
 * rbac-frontend.spec.ts y no se toca ni se duplica aquí.
 */
function crearShell(opciones: {
  nombre?: string | null;
  fotoUrl?: string | null;
  rol?: string | null;
} = {}) {
  const auth = {
    getNombre: vi.fn(() => opciones.nombre ?? null),
    getFotoUrl: vi.fn(() => opciones.fotoUrl ?? null),
    getRol: vi.fn(() => opciones.rol ?? null),
    hasPermission: vi.fn(() => false),
    getUsuarioId: vi.fn(() => null)
  } as unknown as AuthService;

  const router = {} as Router;
  const http = {} as HttpClient;
 const toast = {
  success: vi.fn(),
  error: vi.fn()
} as unknown as ToastService;
  const cdr = {} as ChangeDetectorRef;

  return new DashboardAdminComponent(router, http, cdr, toast, auth);
}

describe('DashboardAdminComponent — identidad real del topbar (SA-1.1)', () => {
  // ── 1. ADMIN: nombre real + rol visual "Administrador" ────────────
  it('ADMIN: muestra el nombre real de la sesión y rol visual "Administrador"', () => {
    const component = crearShell({ nombre: 'Claudia Pérez', rol: 'admin' });

    expect(component.nombreUsuario).toBe('Claudia Pérez');
    expect(component.rolVisual).toBe('Administrador');
  });

  // ── 2. SUPERADMIN: nombre real + rol visual "Superadministrador" ──
  it('SUPERADMIN: muestra el nombre real de la sesión y rol visual "Superadministrador"', () => {
    const component = crearShell({ nombre: 'Superadministrador SESAES', rol: 'superadmin' });

    expect(component.nombreUsuario).toBe('Superadministrador SESAES');
    expect(component.rolVisual).toBe('Superadministrador');
  });

  // ── 3. El nombre del topbar es independiente de configCentro.nombre_admin ──
  it('el nombre del topbar no proviene de configCentro.nombre_admin', () => {
    const component = crearShell({ nombre: 'Claudia Pérez', rol: 'admin' });
    // configCentro simula el valor legacy que el topbar mostraba antes de SA-1.1.
    (component as any).configCentro.nombre_admin = 'Admin SESAES';

    expect(component.nombreUsuario).toBe('Claudia Pérez');
    expect(component.nombreUsuario).not.toBe('Admin SESAES');
  });

  // ── 4. La foto del topbar proviene de foto_url de sesión ──────────
  it('usa la foto_url de la sesión para el avatar del topbar, no configCentro.foto_admin_url', () => {
    const component = crearShell({ fotoUrl: 'https://cdn.sesaes.cl/fotos/claudia.jpg' });
    (component as any).configCentro.foto_admin_url = 'https://legacy.example.com/otra-foto.jpg';

    expect(component.fotoUsuarioUrl).toBe('https://cdn.sesaes.cl/fotos/claudia.jpg');
    expect(component.fotoUsuarioUrl).not.toBe('https://legacy.example.com/otra-foto.jpg');
  });

  // ── 5. Sin foto: iniciales derivadas del nombre real ──────────────
  it('sin foto_url, genera iniciales desde el nombre real (no un "AD" fijo para todos)', () => {
    const superadmin = crearShell({ nombre: 'Superadministrador SESAES' });
    expect(superadmin.fotoUsuarioUrl).toBeNull();
    expect(superadmin.inicialesUsuario).toBe('SS');

    const admin = crearShell({ nombre: 'Claudia Pérez' });
    expect(admin.inicialesUsuario).toBe('CP');
  });

  // ── 6. Fallback final sin nombre de sesión -> "AD" ────────────────
  it('sin nombre de sesión, las iniciales caen a "AD" como último fallback', () => {
    const component = crearShell();

    expect(component.inicialesUsuario).toBe('AD');
  });
});

/**
 * SA-1.2 — Mi Perfil sobre Usuario (GET/PATCH /usuarios/me) y
 * coordinación con el cambio de contraseña.
 *
 * Mismo patrón de instanciación directa (sin TestBed) que el describe
 * de SA-1.1 de arriba, ampliado con un mock de `http` que registra las
 * llamadas (get/patch) para poder afirmar CUÁNTAS y EN QUÉ ORDEN se
 * disparan — es justamente lo que corrige el bug de la entrega
 * anterior (PATCH de perfil disparado antes de validar la contraseña).
 *
 * `auth.actualizarIdentidadSesion` se mockea con estado real (no un
 * simple vi.fn() vacío): actualiza variables locales que
 * `getNombre`/`getFotoUrl` vuelven a leer, para poder comprobar que el
 * topbar (nombreUsuario/fotoUsuarioUrl, getters de SA-1.1) refleja el
 * cambio sin relogin, tal como hace la implementación real de
 * AuthService contra sessionStorage.
 */
function crearShellConPerfil(opciones: {
  nombre?: string | null;
  fotoUrl?: string | null;
  rol?: string | null;
  getUsuarioMeResponse?: any;
  patchUsuarioMeResponse?: any;
  patchUsuarioMeError?: any;
  patchPasswordError?: any;
} = {}) {
  let nombreSesion = opciones.nombre ?? null;
  let fotoSesion   = opciones.fotoUrl ?? null;

  const actualizarIdentidadSesion = vi.fn((datos: { nombre?: string; foto_url?: string | null }) => {
    if (datos.nombre !== undefined) nombreSesion = datos.nombre;
    if (datos.foto_url !== undefined) fotoSesion = datos.foto_url ?? null;
  });

  const auth = {
    getNombre: vi.fn(() => nombreSesion),
    getFotoUrl: vi.fn(() => fotoSesion),
    getRol: vi.fn(() => opciones.rol ?? null),
    hasPermission: vi.fn(() => false),
    getUsuarioId: vi.fn(() => null),
    actualizarIdentidadSesion
  } as unknown as AuthService;

  const patchCalls: { url: string; body: any }[] = [];
  const getCalls: string[] = [];

  const http = {
    get: vi.fn((url: string) => {
      getCalls.push(url);
      return of(opciones.getUsuarioMeResponse ?? {});
    }),
    patch: vi.fn((url: string, body: any) => {
      patchCalls.push({ url, body });
      if (url.includes('/usuarios/me')) {
        if (opciones.patchUsuarioMeError) return throwError(() => opciones.patchUsuarioMeError);
        return of(opciones.patchUsuarioMeResponse ?? { ...body });
      }
      if (url.includes('cambiar-password')) {
        if (opciones.patchPasswordError) return throwError(() => opciones.patchPasswordError);
        return of({ message: 'Contraseña actualizada correctamente' });
      }
      return of({});
    })
  } as unknown as HttpClient;

  const router = {} as Router;
  const toast = {
    success: vi.fn(),
    error: vi.fn()
  } as unknown as ToastService;
  const cdr = { detectChanges: vi.fn() } as unknown as ChangeDetectorRef;

  const component = new DashboardAdminComponent(router, http, cdr, toast, auth);
  return { component, http, auth, patchCalls, getCalls, actualizarIdentidadSesion };
}

describe('DashboardAdminComponent — Mi Perfil sobre Usuario (SA-1.2)', () => {
  // ── 1. Carga: estado antes/después de GET /usuarios/me ────────────
  it('cargarMiPerfil(): perfilCargado pasa de false a true tras un GET exitoso, sin datos inventados de por medio', () => {
    const { component } = crearShellConPerfil({
      getUsuarioMeResponse: { id: 7, nombre: 'Admin SESAES', correo: 'admin@utem.cl', telefono: null, foto_url: null, rol: 'admin', activo: true }
    });

    expect(component.perfilCargado).toBe(false);
    expect(component.cargandoPerfil).toBe(false);

    component.cargarMiPerfil();

    expect(component.cargandoPerfil).toBe(false); // el observable síncrono de test ya resolvió
    expect(component.perfilCargado).toBe(true);
    expect(component.usuarioPerfil.nombre).toBe('Admin SESAES');
  });

  // ── 2. Contraseñas nuevas no coinciden -> CERO requests ────────────
  it('contraseña nueva y confirmación distintas -> no dispara ningún PATCH (ni perfil ni contraseña)', () => {
    const { component, patchCalls } = crearShellConPerfil();

    component.onGuardarPerfilAdmin({
      nombre: 'Nuevo Nombre', telefono: '+56911111111',
      contrasena_actual: 'actual123', contrasena_nueva: 'nueva123', contrasena_conf: 'otra-distinta'
    });

    expect(patchCalls.length).toBe(0);
    expect(component.mensajeError).toBe('Las contraseñas nuevas no coinciden.');
  });

  // ── 2.1 a 2.4. SA-1.2 v3 — estados incompletos de contraseña ───────
  // Regla: si CUALQUIERA de los tres campos de contraseña tiene
  // contenido, se exigen los tres. Falta cualquiera -> CERO requests.
  it('solo contraseña actual -> 0 PATCH, "Completa todos los campos de contraseña."', () => {
    const { component, patchCalls } = crearShellConPerfil();

    component.onGuardarPerfilAdmin({
      nombre: 'Nuevo Nombre', telefono: '+56911111111',
      contrasena_actual: 'actual123', contrasena_nueva: '', contrasena_conf: ''
    });

    expect(patchCalls.length).toBe(0);
    expect(component.mensajeError).toBe('Completa todos los campos de contraseña.');
  });

  it('solo nueva + confirmación (sin actual) -> 0 PATCH, "Completa todos los campos de contraseña."', () => {
    const { component, patchCalls } = crearShellConPerfil();

    component.onGuardarPerfilAdmin({
      nombre: 'Nuevo Nombre', telefono: '+56911111111',
      contrasena_actual: '', contrasena_nueva: 'nueva123', contrasena_conf: 'nueva123'
    });

    expect(patchCalls.length).toBe(0);
    expect(component.mensajeError).toBe('Completa todos los campos de contraseña.');
  });

  it('nueva sin confirmación -> 0 PATCH, "Completa todos los campos de contraseña."', () => {
    const { component, patchCalls } = crearShellConPerfil();

    component.onGuardarPerfilAdmin({
      nombre: 'Nuevo Nombre', telefono: '+56911111111',
      contrasena_actual: 'actual123', contrasena_nueva: 'nueva123', contrasena_conf: ''
    });

    expect(patchCalls.length).toBe(0);
    expect(component.mensajeError).toBe('Completa todos los campos de contraseña.');
  });

  it('los tres completos pero no coinciden -> 0 PATCH, "Las contraseñas nuevas no coinciden."', () => {
    const { component, patchCalls } = crearShellConPerfil();

    component.onGuardarPerfilAdmin({
      nombre: 'Nuevo Nombre', telefono: '+56911111111',
      contrasena_actual: 'actual123', contrasena_nueva: 'nueva123', contrasena_conf: 'nueva456'
    });

    expect(patchCalls.length).toBe(0);
    expect(component.mensajeError).toBe('Las contraseñas nuevas no coinciden.');
  });

  it('los tres completos y coinciden -> flujo normal (2 PATCH, perfil + contraseña)', () => {
    const { component, patchCalls } = crearShellConPerfil({
      patchUsuarioMeResponse: { id: 7, nombre: 'Nuevo Nombre', correo: 'admin@utem.cl', telefono: '+56911111111', foto_url: null, rol: 'admin', activo: true }
    });

    component.onGuardarPerfilAdmin({
      nombre: 'Nuevo Nombre', telefono: '+56911111111',
      contrasena_actual: 'actual123', contrasena_nueva: 'nueva123', contrasena_conf: 'nueva123'
    });

    expect(patchCalls.length).toBe(2);
    expect(patchCalls[0].url).toContain('/usuarios/me');
    expect(patchCalls[1].url).toContain('cambiar-password');
    expect(component.mensajeExito).toBe('Perfil y contraseña actualizados correctamente.');
  });

  // ── 3. Perfil falla -> nunca se intenta el cambio de contraseña ────
  it('si PATCH /usuarios/me falla, no se intenta PATCH de contraseña aunque se haya solicitado', () => {
    const { component, patchCalls } = crearShellConPerfil({
      patchUsuarioMeError: { error: { detail: 'boom' } }
    });

    component.onGuardarPerfilAdmin({
      nombre: 'Nuevo Nombre', telefono: '+56911111111',
      contrasena_actual: 'actual123', contrasena_nueva: 'nueva123', contrasena_conf: 'nueva123'
    });

    expect(patchCalls.length).toBe(1);
    expect(patchCalls[0].url).toContain('/usuarios/me');
    expect(component.mensajeError).toBe('No se pudo actualizar el perfil.');
  });

  // ── 4. Perfil OK, sin cambio de contraseña -> mensaje "Perfil actualizado" ──
  it('perfil OK sin cambio de contraseña -> mensaje "Perfil actualizado correctamente."', () => {
    const { component, patchCalls } = crearShellConPerfil({
      patchUsuarioMeResponse: { id: 7, nombre: 'Nuevo Nombre', correo: 'admin@utem.cl', telefono: '+56911111111', foto_url: null, rol: 'admin', activo: true }
    });

    component.onGuardarPerfilAdmin({
      nombre: 'Nuevo Nombre', telefono: '+56911111111',
      contrasena_actual: '', contrasena_nueva: '', contrasena_conf: ''
    });

    expect(patchCalls.length).toBe(1);
    expect(component.mensajeExito).toBe('Perfil actualizado correctamente.');
  });

  // ── 5. Perfil OK + contraseña OK -> mensaje conjunto ───────────────
  it('perfil OK + contraseña OK -> mensaje "Perfil y contraseña actualizados correctamente."', () => {
    const { component, patchCalls } = crearShellConPerfil({
      patchUsuarioMeResponse: { id: 7, nombre: 'Nuevo Nombre', correo: 'admin@utem.cl', telefono: '+56911111111', foto_url: null, rol: 'admin', activo: true }
    });

    component.onGuardarPerfilAdmin({
      nombre: 'Nuevo Nombre', telefono: '+56911111111',
      contrasena_actual: 'actual123', contrasena_nueva: 'nueva123', contrasena_conf: 'nueva123'
    });

    expect(patchCalls.length).toBe(2);
    expect(patchCalls[0].url).toContain('/usuarios/me');
    expect(patchCalls[1].url).toContain('cambiar-password');
    expect(component.mensajeExito).toBe('Perfil y contraseña actualizados correctamente.');
  });

  // ── 6. Perfil OK + contraseña falla -> mensaje parcial, nunca "ambos OK" ──
  it('perfil OK + contraseña falla -> informa que el perfil sí se guardó y la contraseña no cambió', () => {
    const { component, patchCalls } = crearShellConPerfil({
      patchUsuarioMeResponse: { id: 7, nombre: 'Nuevo Nombre', correo: 'admin@utem.cl', telefono: '+56911111111', foto_url: null, rol: 'admin', activo: true },
      patchPasswordError: { error: { detail: 'Contraseña actual incorrecta' } }
    });

    component.onGuardarPerfilAdmin({
      nombre: 'Nuevo Nombre', telefono: '+56911111111',
      contrasena_actual: 'mala', contrasena_nueva: 'nueva123', contrasena_conf: 'nueva123'
    });

    expect(patchCalls.length).toBe(2);
    expect(component.mensajeExito).toBe(''); // nunca afirma éxito conjunto
    expect(component.mensajeError).toContain('Perfil actualizado');
    expect(component.mensajeError).toContain('contraseña no se pudo cambiar');
  });

  // ── 7. actualizarIdentidadSesion se llama tras perfil OK ───────────
  it('tras PATCH /usuarios/me exitoso, llama a AuthService.actualizarIdentidadSesion con nombre/foto_url', () => {
    const { component, actualizarIdentidadSesion } = crearShellConPerfil({
      patchUsuarioMeResponse: { id: 7, nombre: 'Nuevo Nombre', correo: 'admin@utem.cl', telefono: null, foto_url: 'data:image/png;base64,ABC', rol: 'admin', activo: true }
    });

    component.onGuardarPerfilAdmin({
      nombre: 'Nuevo Nombre', telefono: '',
      contrasena_actual: '', contrasena_nueva: '', contrasena_conf: ''
    });

    expect(actualizarIdentidadSesion).toHaveBeenCalledWith({
      nombre: 'Nuevo Nombre',
      foto_url: 'data:image/png;base64,ABC'
    });
  });

  // ── 8. El topbar refleja el nuevo nombre/foto sin relogin ──────────
  it('el topbar (nombreUsuario/fotoUsuarioUrl) refleja el cambio inmediatamente, sin relogin', () => {
    const { component } = crearShellConPerfil({
      nombre: 'Nombre Viejo', fotoUrl: null,
      patchUsuarioMeResponse: { id: 7, nombre: 'Nombre Actualizado', correo: 'admin@utem.cl', telefono: null, foto_url: 'https://cdn.sesaes.cl/nueva.jpg', rol: 'admin', activo: true }
    });

    expect(component.nombreUsuario).toBe('Nombre Viejo');
    expect(component.fotoUsuarioUrl).toBeNull();

    component.onGuardarPerfilAdmin({
      nombre: 'Nombre Actualizado', telefono: '',
      contrasena_actual: '', contrasena_nueva: '', contrasena_conf: ''
    });

    expect(component.nombreUsuario).toBe('Nombre Actualizado');
    expect(component.fotoUsuarioUrl).toBe('https://cdn.sesaes.cl/nueva.jpg');
  });

  // ── 9. Sin cambio de contraseña -> nunca se dispara cambiar-password ──
  it('sin contrasena_nueva, nunca dispara PATCH /configuracion-centro/cambiar-password', () => {
    const { component, patchCalls } = crearShellConPerfil({
      patchUsuarioMeResponse: { id: 7, nombre: 'X', correo: 'admin@utem.cl', telefono: null, foto_url: null, rol: 'admin', activo: true }
    });

    component.onGuardarPerfilAdmin({
      nombre: 'X', telefono: '',
      contrasena_actual: '', contrasena_nueva: '', contrasena_conf: ''
    });

    expect(patchCalls.some(c => c.url.includes('cambiar-password'))).toBe(false);
  });
});

/**
 * SA-4 — UI Administradores: gating a nivel shell.
 *
 * No se usa TestBed/fixture acá: mismo patrón que rbac-frontend.spec.ts
 * en este mismo directorio (instanciación directa de
 * DashboardAdminComponent con AuthService/HttpClient/Router/ToastService
 * mockeados). Estos tests cubren exactamente la condición booleana que
 * el template evalúa en dashboard-admin.html:
 *   - nav:  *ngIf="puedeAccederSeccion('administradores')"
 *   - hijo: *ngIf="seccionActiva==='administradores' && puedeAccederSeccion('administradores')"
 * sin necesitar compilar la plantilla completa (que arrastra ~10
 * componentes hijos y no aporta cobertura adicional sobre esta regla
 * de gating puntual).
 */
function crearShellConPermisos(permisos: Permission[]) {
  const permitidos = new Set<Permission>(permisos);

  const auth = {
    hasPermission: vi.fn((permission: Permission) => permitidos.has(permission)),
    getNombre: vi.fn(() => null),
    getFotoUrl: vi.fn(() => null),
    getRol: vi.fn(() => null),
    getUsuarioId: vi.fn(() => null),
    cargarAccesoAdministrativo: vi.fn(
      () => of({})
    )
  } as unknown as AuthService;

  const http = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } as unknown as HttpClient;
  const toast = { success: vi.fn(), error: vi.fn() } as unknown as ToastService;
  const router = {} as Router;
  const cdr = { detectChanges: vi.fn() } as unknown as ChangeDetectorRef;

  return new DashboardAdminComponent(router, http, cdr, toast, auth);
}

function crearShellConPermisosYHttp(permisos: Permission[]) {
  const permitidos = new Set<Permission>(permisos);

  const auth = {
    hasPermission: vi.fn((permission: Permission) => permitidos.has(permission)),
    getNombre: vi.fn(() => null),
    getFotoUrl: vi.fn(() => null),
    getRol: vi.fn(() => null),
    getUsuarioId: vi.fn(() => null),
    cargarAccesoAdministrativo: vi.fn(() => of({}))
  } as unknown as AuthService;

  const http = {
    get: vi.fn((url: string) => of([])),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  };
  const toast = { success: vi.fn(), error: vi.fn() } as unknown as ToastService;
  const router = {} as Router;
  const cdr = { detectChanges: vi.fn() } as unknown as ChangeDetectorRef;

  return {
    component: new DashboardAdminComponent(
      router,
      http as unknown as HttpClient,
      cdr,
      toast,
      auth
    ),
    http
  };
}

describe('DashboardAdminComponent — SA-10.2B handlers fail-closed', () => {
  it('sin agenda.gestionar, los handlers de Agenda/Inicio/Citas no producen POST/PATCH/DELETE', () => {
    const { component, http } = crearShellConPermisosYHttp([]);

    component.nuevaCita = {
      fecha: '2026-09-08',
      hora: '10:00',
      estudiante_id: 10,
      profesional_id: 20,
      observaciones: '',
      urgente: false,
      sobrecupo: false
    };
    component.nuevoDiaCerrado = { fecha: '2026-09-18', motivo: 'Mantención' };

    component.marcarInasistencia({ id: 1, estudiante: 'Ana' });
    component.cancelarCitaAdmin({ id: 2, estudiante: 'Bruno' });
    component.marcarPrioridadCita({ id: 3 }, true);
    component.crearCitaDesdeHorario();
    component.aprobarSolicitudHorario({ id: 4, profesional_nombre: 'Prof.' });
    component.rechazarSolicitudHorario({ id: 5, profesional_nombre: 'Prof.' });
    component.crearDiaCerrado();
    component.reabrirDiaCerrado({ id: 6, fecha: '2026-09-18' });

    expect(http.post).not.toHaveBeenCalled();
    expect(http.patch).not.toHaveBeenCalled();
    expect(http.delete).not.toHaveBeenCalled();
  });

  it('sin profesionales.gestionar, los handlers CRUD de profesionales no producen POST/PATCH/DELETE', () => {
    const { component, http } = crearShellConPermisosYHttp([]);
    const profesional = { id: 7, nombre: 'Profesional Read Only' };

    component.onCrearProfesional({ nombre: 'Nuevo' });
    component.onCambiarEstadoProfesional({ profesional, nuevoEstado: 'licencia', motivo: 'test' });
    component.onCambiarDuracionProfesional({ profesional, duracionMin: 30 });
    component.onCambiarTratamientoProfesional({ profesional, tratamiento: 'Dr.' });
    component.onCambiarColorIdentificador({ profesional, color: '#4F8EF7' });
    component.onEliminarProfesional(profesional);

    expect(http.post).not.toHaveBeenCalled();
    expect(http.patch).not.toHaveBeenCalled();
    expect(http.delete).not.toHaveBeenCalled();
  });

  it('al invalidar el contexto se cierran los modales de mutación de Agenda', () => {
    const { component } = crearShellConPermisosYHttp([]);
    component.modalCitaAbierto = true;
    component.sobrecupoConfirmAbierto = true;
    component.sobrecupoPendiente = {
      fecha: '2026-09-08',
      hora: '10:00',
      motivoTexto: 'el horario habitual de'
    };

    (component as any).limpiarDatosVisiblesDeAccesoAnterior();

    expect(component.modalCitaAbierto).toBe(false);
    expect(component.sobrecupoConfirmAbierto).toBe(false);
    expect(component.sobrecupoPendiente).toBeNull();
  });
});

describe('DashboardAdminComponent — SA-10.2C lectura *.ver', () => {
  it('agenda.ver abre Agenda y Citas sin conceder agenda.gestionar', () => {
    const component = crearShellConPermisos(['agenda.ver']);

    expect(component.puedeAccederSeccion('horario')).toBe(true);
    expect(component.puedeAccederSeccion('citas')).toBe(true);
    expect(component.hasPermission('agenda.gestionar')).toBe(false);
  });

  it('profesionales.ver abre Profesionales y usuarios.ver abre Estudiantes', () => {
    const profesionales = crearShellConPermisos(['profesionales.ver']);
    const estudiantes = crearShellConPermisos(['usuarios.ver']);

    expect(profesionales.puedeAccederSeccion('profesional')).toBe(true);
    expect(profesionales.hasPermission('profesionales.gestionar')).toBe(false);
    expect(estudiantes.puedeAccederSeccion('estudiantes')).toBe(true);
    expect(estudiantes.hasPermission('usuarios.gestionar')).toBe(false);
  });

  it('agenda.ver carga datos de lectura y catálogo operacional, pero no solicitudes de horario', () => {
    const { component, http } = crearShellConPermisosYHttp(['agenda.ver']);

    component.cargarDatos();

    const urls = http.get.mock.calls.map(call => String(call[0]));
    expect(urls.some(url => url.includes('/admin/proximas-citas'))).toBe(true);
    expect(urls.some(url => url.includes('/admin/resumen-dia'))).toBe(true);
    expect(urls.some(url => url.includes('/admin/dias-cerrados'))).toBe(true);
    expect(urls.some(url => url.includes('/agenda/profesionales'))).toBe(true);
    expect(urls.some(url => url.includes('/admin/solicitudes-horario'))).toBe(false);
  });

  it('profesionales.ver usa /admin/profesionales y no el catálogo mínimo de Agenda', () => {
    const { component, http } = crearShellConPermisosYHttp(['profesionales.ver']);

    component.cargarDatos();

    const urls = http.get.mock.calls.map(call => String(call[0]));
    expect(urls.some(url => url.includes('/admin/profesionales'))).toBe(true);
    expect(urls.some(url => url.includes('/agenda/profesionales'))).toBe(false);
  });

  it('usuarios.ver permite búsqueda global de estudiantes sin usuarios.gestionar', () => {
    const { component, http } = crearShellConPermisosYHttp(['usuarios.ver']);
    component.busquedaGlobal = 'ana';

    component.buscarGlobal();

    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/admin/estudiantes?q=ana'));
  });
});

describe('DashboardAdminComponent — SA-4 gating de "administradores" (roles.gestionar)', () => {
  // ── 1. Sin roles.gestionar: la sección no aparece en el menú ──────
  it('roles.gestionar=false -> puedeAccederSeccion(\'administradores\') es false (Administradores oculto)', () => {
    const component = crearShellConPermisos(['usuarios.gestionar', 'agenda.gestionar']);
    expect(component.puedeAccederSeccion('administradores')).toBe(false);
  });

  // ── 2. Con roles.gestionar: la sección aparece en el menú ─────────
  it('roles.gestionar=true -> puedeAccederSeccion(\'administradores\') es true (Administradores visible)', () => {
    const component = crearShellConPermisos(['roles.gestionar']);
    expect(component.puedeAccederSeccion('administradores')).toBe(true);
  });

  // ── 3. Seleccionar Administradores navega y habilita el render del hijo ──
  it('con permiso, navegarA(\'administradores\') activa la sección y la condición de render del hijo es true', () => {
    const component = crearShellConPermisos(['roles.gestionar']);

    component.navegarA('administradores');

    expect(component.seccionActiva).toBe('administradores');
    // Misma condición combinada que usa el *ngIf del hijo en el template.
    expect(component.seccionActiva === 'administradores' && component.puedeAccederSeccion('administradores')).toBe(true);
  });

  // ── 4. Sección forzada internamente sin permiso: el hijo NO se renderiza ──
  it('si seccionActiva se fuerza a \'administradores\' sin roles.gestionar, la condición de render del hijo es false', () => {
    const component = crearShellConPermisos(['usuarios.gestionar']); // sin roles.gestionar

    // navegarA() ya bloquea la navegación normal (probado en el describe
    // RBAC de este mismo archivo/rbac-frontend.spec.ts), pero esta prueba
    // cubre el caso más estricto: aunque algo fuerce seccionActiva
    // internamente (bug, estado inconsistente, etc.), el *ngIf del hijo
    // vuelve a evaluar el permiso y no debe renderizarlo.
    (component as any).seccionActiva = 'administradores';

    expect(component.seccionActiva === 'administradores' && component.puedeAccederSeccion('administradores')).toBe(false);
  });
});
describe('DashboardAdminComponent - SA-6.2 salida de seccion tras perder permiso', () => {
  it('sale de Administradores hacia Inicio cuando la sesion pierde roles.gestionar', () => {
    const component = crearShellConPermisos(['roles.gestionar']);

    component.navegarA('administradores');

    expect(component.seccionActiva).toBe('administradores');
    expect(component.puedeAccederSeccion('administradores')).toBe(true);

    // Simula el AuthService despues de que la propia cuenta fue degradada.
    const auth = (component as any).auth as {
      hasPermission: ReturnType<typeof vi.fn>;
    };

    auth.hasPermission.mockReturnValue(false);

    vi
      .spyOn(component, 'cargarDatos')
      .mockImplementation(() => {});

    component.onSesionAdministrativaActualizada();

    expect(component.seccionActiva).toBe('inicio');
    expect(component.puedeAccederSeccion('administradores')).toBe(false);
  });

  it('permanece en la seccion actual si el nuevo rol todavia conserva acceso', () => {
    const component = crearShellConPermisos(['roles.gestionar']);

    component.navegarA('administradores');
    vi
      .spyOn(component, 'cargarDatos')
      .mockImplementation(() => {});

    component.onSesionAdministrativaActualizada();

    expect(component.seccionActiva).toBe('administradores');
  });
});

describe('DashboardAdminComponent — SA-10.2D matriz read-only vs gestionar', () => {
  it('cada permiso *.ver abre solo su dominio y no concede permisos de gestión', () => {
    const agenda = crearShellConPermisos(['agenda.ver']);
    const profesionales = crearShellConPermisos(['profesionales.ver']);
    const estudiantes = crearShellConPermisos(['usuarios.ver']);

    expect(agenda.puedeAccederSeccion('horario')).toBe(true);
    expect(agenda.puedeAccederSeccion('citas')).toBe(true);
    expect(agenda.puedeAccederSeccion('profesional')).toBe(false);
    expect(agenda.puedeAccederSeccion('estudiantes')).toBe(false);
    expect(agenda.hasPermission('agenda.gestionar')).toBe(false);

    expect(profesionales.puedeAccederSeccion('profesional')).toBe(true);
    expect(profesionales.puedeAccederSeccion('horario')).toBe(false);
    expect(profesionales.puedeAccederSeccion('citas')).toBe(false);
    expect(profesionales.puedeAccederSeccion('estudiantes')).toBe(false);
    expect(profesionales.hasPermission('profesionales.gestionar')).toBe(false);

    expect(estudiantes.puedeAccederSeccion('estudiantes')).toBe(true);
    expect(estudiantes.puedeAccederSeccion('horario')).toBe(false);
    expect(estudiantes.puedeAccederSeccion('citas')).toBe(false);
    expect(estudiantes.puedeAccederSeccion('profesional')).toBe(false);
    expect(estudiantes.hasPermission('usuarios.gestionar')).toBe(false);
  });

  it('agenda.ver permite lecturas pero una invocación directa de handlers no produce mutaciones', () => {
    const { component, http } = crearShellConPermisosYHttp(['agenda.ver']);

    component.nuevaCita = {
      fecha: '2026-09-22',
      hora: '10:00',
      estudiante_id: 10,
      profesional_id: 20,
      observaciones: '',
      urgente: false,
      sobrecupo: false
    };
    component.nuevoDiaCerrado = {
      fecha: '2026-09-23',
      motivo: 'Read-only'
    };

    component.marcarInasistencia({ id: 1 });
    component.cancelarCitaAdmin({ id: 2 });
    component.marcarPrioridadCita({ id: 3 }, true);
    component.crearCitaDesdeHorario();
    component.aprobarSolicitudHorario({ id: 4 });
    component.rechazarSolicitudHorario({ id: 5 });
    component.crearDiaCerrado();
    component.reabrirDiaCerrado({ id: 6, fecha: '2026-09-23' });

    expect(http.post).not.toHaveBeenCalled();
    expect(http.patch).not.toHaveBeenCalled();
    expect(http.delete).not.toHaveBeenCalled();
  });

  it('profesionales.ver permite lectura pero una invocación directa de CRUD no produce mutaciones', () => {
    const { component, http } = crearShellConPermisosYHttp(['profesionales.ver']);
    const profesional = { id: 7, nombre: 'Profesional Read-only' };

    component.onCrearProfesional({ nombre: 'No crear' });
    component.onCambiarEstadoProfesional({
      profesional,
      nuevoEstado: 'licencia',
      motivo: 'test'
    });
    component.onCambiarDuracionProfesional({ profesional, duracionMin: 30 });
    component.onCambiarTratamientoProfesional({ profesional, tratamiento: 'Dr.' });
    component.onCambiarColorIdentificador({ profesional, color: '#123456' });
    component.onEliminarProfesional(profesional);

    expect(http.post).not.toHaveBeenCalled();
    expect(http.patch).not.toHaveBeenCalled();
    expect(http.delete).not.toHaveBeenCalled();
  });

  it('sin permisos *.ver los loaders directos de Agenda, Profesionales y Estudiantes no consultan esos módulos', () => {
    const { component, http } = crearShellConPermisosYHttp([]);

    component.filtroProfesionalId = '20';
    component.cargarResumenDia();
    component.cargarProximasCitas();
    component.cargarDiasCerrados();
    component.cargarHorarioProfesional();
    component.cargarProfesionales();
    (component as any).cargarProfesionalesAgenda();
    component.cargarEstudiantes();
    component.verPerfilEstudianteAdmin({ id: 10 });
    component.busquedaGlobal = 'ana';
    component.buscarGlobal();

    const urls = http.get.mock.calls.map(call => String(call[0]));

    expect(urls.some(url => url.includes('/admin/resumen-dia'))).toBe(false);
    expect(urls.some(url => url.includes('/admin/proximas-citas'))).toBe(false);
    expect(urls.some(url => url.includes('/admin/dias-cerrados'))).toBe(false);
    expect(urls.some(url => url.includes('/agenda/profesional/'))).toBe(false);
    expect(urls.some(url => url.includes('/admin/profesionales'))).toBe(false);
    expect(urls.some(url => url.includes('/agenda/profesionales'))).toBe(false);
    expect(urls.some(url => url.includes('/admin/estudiantes'))).toBe(false);
  });

  it('usuarios.ver permite listado, perfil y búsqueda de estudiantes sin usuarios.gestionar', () => {
    const { component, http } = crearShellConPermisosYHttp(['usuarios.ver']);

    component.cargarEstudiantes();
    component.verPerfilEstudianteAdmin({ id: 10 });
    component.busquedaGlobal = 'ana';
    component.buscarGlobal();

    const urls = http.get.mock.calls.map(call => String(call[0]));

    expect(urls.some(url => url.includes('/admin/estudiantes/listado'))).toBe(true);
    expect(urls.some(url => url.includes('/admin/estudiantes/10/perfil'))).toBe(true);
    expect(urls.some(url => url.includes('/admin/estudiantes?q=ana'))).toBe(true);
    expect(component.hasPermission('usuarios.gestionar')).toBe(false);
  });

  it('al perder el permiso de lectura de la sección activa vuelve a Inicio y limpia datos visibles', () => {
    const { component } = crearShellConPermisosYHttp(['agenda.ver']);

    component.navegarA('horario');
    component.proximasCitas = [{ id: 1 }];
    component.resumenDia = [{ id: 2 }];

    const auth = (component as any).auth as {
      hasPermission: ReturnType<typeof vi.fn>;
    };
    auth.hasPermission.mockReturnValue(false);

    component.onSesionAdministrativaActualizada();

    expect(component.seccionActiva).toBe('inicio');
    expect(component.proximasCitas).toEqual([]);
    expect(component.resumenDia).toEqual([]);
  });
});


describe('DashboardAdminComponent — A.2B.2 Angular Semana', () => {
  const setSemana = (component: DashboardAdminComponent, inicio = '2026-09-07'): void => {
    const [anio, mes, dia] = inicio.split('-').map(Number);
    const lunes = new Date(anio, mes - 1, dia);
    component.semanaActual = Array.from({ length: 7 }, (_, i) => {
      const fecha = new Date(lunes);
      fecha.setDate(lunes.getDate() + i);
      const f = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
      return { fecha: f };
    });
  };

  const respuestaRango = (
    profesionalId: number,
    fechaInicio: string,
    fechaFin: string,
    slots: Array<{ fecha: string; hora: string; disponible: boolean; motivo: string | null }>
  ) => ({
    profesional_id: profesionalId,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    duracion_min: 60,
    dias: Array.from(new Set(slots.map(slot => slot.fecha))).map(fecha => ({
      fecha,
      slots: slots
        .filter(slot => slot.fecha === fecha)
        .map(slot => ({
          hora: slot.hora,
          disponible: slot.disponible,
          motivo: slot.motivo,
          overridable_con_sobrecupo: slot.motivo === 'en_colacion' || slot.motivo === 'fuera_de_jornada'
        }))
    }))
  });

  it('consulta una sola disponibilidad por profesional y rango semanal exacto', () => {
    const { component, http } = crearShellConPermisosYHttp(['agenda.ver']);
    component.filtroProfesionalId = '20';
    setSemana(component);

    (http.get as any).mockImplementation((url: string) => {
      if (url.includes('/disponibilidad')) {
        return of(respuestaRango(20, '2026-09-07', '2026-09-13', [
          { fecha: '2026-09-07', hora: '08:00', disponible: true, motivo: null }
        ]));
      }
      return of([]);
    });

    component.cargarHorarioProfesional();

    const urlsDisponibilidad = http.get.mock.calls
      .map(call => String(call[0]))
      .filter(url => url.includes('/disponibilidad'));

    expect(urlsDisponibilidad).toHaveLength(1);
    expect(urlsDisponibilidad[0]).toContain('/agenda/profesional/20/disponibilidad');
    expect(urlsDisponibilidad[0]).toContain('fecha_inicio=2026-09-07');
    expect(urlsDisponibilidad[0]).toContain('fecha_fin=2026-09-13');
  });

  it('al cambiar de semana consulta el nuevo rango y no hace requests por celda', () => {
    const { component, http } = crearShellConPermisosYHttp(['agenda.ver']);
    component.filtroProfesionalId = '20';
    setSemana(component);

    (http.get as any).mockImplementation((url: string) => {
      if (url.includes('/disponibilidad')) {
        const inicio = url.includes('2026-09-14') ? '2026-09-14' : '2026-09-07';
        const fin = inicio === '2026-09-14' ? '2026-09-20' : '2026-09-13';
        return of(respuestaRango(20, inicio, fin, []));
      }
      return of([]);
    });

    component.cargarHorarioProfesional();
    component.semanaSiguiente();

    const urlsDisponibilidad = http.get.mock.calls
      .map(call => String(call[0]))
      .filter(url => url.includes('/disponibilidad'));

    expect(urlsDisponibilidad).toHaveLength(2);
    expect(urlsDisponibilidad[0]).toContain('fecha_inicio=2026-09-07');
    expect(urlsDisponibilidad[0]).toContain('fecha_fin=2026-09-13');
    expect(urlsDisponibilidad[1]).toContain('fecha_inicio=2026-09-14');
    expect(urlsDisponibilidad[1]).toContain('fecha_fin=2026-09-20');
  });

  it('prioriza una cita real sobre el estado de disponibilidad backend', () => {
    const { component, http } = crearShellConPermisosYHttp(['agenda.ver']);
    component.filtroProfesionalId = '20';
    setSemana(component);

    (http.get as any).mockImplementation((url: string) => {
      if (url.includes('/citas')) {
        return of([{ id: 1, fecha: '2026-09-07', hora: '08:00', estado: 'pendiente', urgente: true, sobrecupo: false, estudiante: 'Ana' }]);
      }
      if (url.includes('/disponibilidad')) {
        return of(respuestaRango(20, '2026-09-07', '2026-09-13', [
          { fecha: '2026-09-07', hora: '08:00', disponible: true, motivo: null }
        ]));
      }
      return of([]);
    });

    component.cargarHorarioProfesional();

    expect(component.getBloqueEstado('2026-09-07', '08:00')).toBe('urgente');
    expect(component.getBloqueInfo('2026-09-07', '08:00')).toBe('Ana');
  });

  it('mapea únicamente presentación desde motivos backend y no inventa disponibilidad', () => {
    const { component, http } = crearShellConPermisosYHttp(['agenda.ver']);
    component.filtroProfesionalId = '20';
    setSemana(component);

    (http.get as any).mockImplementation((url: string) => {
      if (url.includes('/disponibilidad')) {
        return of(respuestaRango(20, '2026-09-07', '2026-09-13', [
          { fecha: '2026-09-07', hora: '08:00', disponible: true, motivo: null },
          { fecha: '2026-09-07', hora: '09:00', disponible: false, motivo: 'en_colacion' },
          { fecha: '2026-09-07', hora: '10:00', disponible: false, motivo: 'fuera_de_jornada' },
          { fecha: '2026-09-07', hora: '11:00', disponible: false, motivo: 'dia_cerrado' },
          { fecha: '2026-09-07', hora: '12:00', disponible: false, motivo: 'profesional_inactivo' },
          { fecha: '2026-09-07', hora: '13:00', disponible: false, motivo: 'slot_ocupado' }
        ]));
      }
      return of([]);
    });

    component.cargarHorarioProfesional();

    expect(component.getBloqueEstado('2026-09-07', '08:00')).toBe('disponible');
    expect(component.getBloqueEstado('2026-09-07', '09:00')).toBe('colacion');
    expect(component.getBloqueEstado('2026-09-07', '10:00')).toBe('fuera-horario');
    expect(component.getBloqueEstado('2026-09-07', '11:00')).toBe('cerrado-centro');
    expect(component.getBloqueEstado('2026-09-07', '12:00')).toBe('bloqueado');
    expect(component.getBloqueEstado('2026-09-07', '13:00')).toBe('ocupado');
    expect(component.getBloqueEstado('2026-09-07', '14:00')).toBe('sin-datos');
    expect(component.getBloqueInfo('2026-09-07', '09:00')).toBe('Colación');
  });

  it('mientras carga y si falla disponibilidad permanece fail-closed en sin-datos', () => {
    const { component, http } = crearShellConPermisosYHttp(['agenda.ver']);
    const disponibilidad$ = new Subject<any>();
    component.filtroProfesionalId = '20';
    setSemana(component);

    (http.get as any).mockImplementation((url: string) => {
      if (url.includes('/disponibilidad')) return disponibilidad$;
      return of([]);
    });

    component.cargarHorarioProfesional();

    expect(component.disponibilidadCargando).toBe(true);
    expect(component.getBloqueEstado('2026-09-07', '08:00')).toBe('sin-datos');

    disponibilidad$.error(new Error('backend no disponible'));

    expect(component.disponibilidadCargando).toBe(false);
    expect(component.disponibilidadError).toBe(true);
    expect(component.getBloqueEstado('2026-09-07', '08:00')).toBe('sin-datos');
  });

  it('ignora una respuesta stale de profesional anterior', () => {
    const { component, http } = crearShellConPermisosYHttp(['agenda.ver']);
    const primera$ = new Subject<any>();
    const segunda$ = new Subject<any>();
    component.filtroProfesionalId = '20';
    setSemana(component);

    (http.get as any).mockImplementation((url: string) => {
      if (url.includes('/disponibilidad')) {
        return url.includes('/20/') ? primera$ : segunda$;
      }
      return of([]);
    });

    component.cargarHorarioProfesional();
    component.filtroProfesionalId = '21';
    component.cargarHorarioProfesional();

    segunda$.next(respuestaRango(21, '2026-09-07', '2026-09-13', [
      { fecha: '2026-09-07', hora: '08:00', disponible: true, motivo: null }
    ]));
    segunda$.complete();

    expect(component.getBloqueEstado('2026-09-07', '08:00')).toBe('disponible');

    primera$.next(respuestaRango(20, '2026-09-07', '2026-09-13', [
      { fecha: '2026-09-07', hora: '08:00', disponible: false, motivo: 'en_colacion' }
    ]));
    primera$.complete();

    expect(component.getBloqueEstado('2026-09-07', '08:00')).toBe('disponible');
  });


  it('ignora una respuesta stale de la semana anterior', () => {
    const { component, http } = crearShellConPermisosYHttp(['agenda.ver']);
    const primera$ = new Subject<any>();
    const segunda$ = new Subject<any>();
    component.filtroProfesionalId = '20';
    setSemana(component);

    let disponibilidadIndex = 0;
    (http.get as any).mockImplementation((url: string) => {
      if (url.includes('/disponibilidad')) {
        disponibilidadIndex += 1;
        return disponibilidadIndex === 1 ? primera$ : segunda$;
      }
      return of([]);
    });

    component.cargarHorarioProfesional();
    component.semanaSiguiente();

    segunda$.next(respuestaRango(20, '2026-09-14', '2026-09-20', [
      { fecha: '2026-09-14', hora: '08:00', disponible: true, motivo: null }
    ]));
    segunda$.complete();

    expect(component.getBloqueEstado('2026-09-14', '08:00')).toBe('disponible');

    primera$.next(respuestaRango(20, '2026-09-07', '2026-09-13', [
      { fecha: '2026-09-07', hora: '08:00', disponible: false, motivo: 'dia_cerrado' }
    ]));
    primera$.complete();

    expect(component.getBloqueEstado('2026-09-14', '08:00')).toBe('disponible');
    expect(component.getBloqueEstado('2026-09-07', '08:00')).toBe('sin-datos');
  });


  it('sin agenda.ver no consulta citas ni disponibilidad', () => {
    const { component, http } = crearShellConPermisosYHttp([]);
    component.filtroProfesionalId = '20';
    setSemana(component);

    component.cargarHorarioProfesional();

    const urls = http.get.mock.calls.map(call => String(call[0]));
    expect(urls.some(url => url.includes('/agenda/profesional/20/citas'))).toBe(false);
    expect(urls.some(url => url.includes('/agenda/profesional/20/disponibilidad'))).toBe(false);
    expect(component.getBloqueEstado('2026-09-07', '08:00')).toBe('sin-datos');
  });

  it('sin-datos no abre cita ni sobrecupo aunque exista agenda.gestionar', () => {
    const { component } = crearShellConPermisosYHttp(['agenda.ver', 'agenda.gestionar']);
    component.filtroProfesionalId = '20';
    setSemana(component);
    const abrirSpy = vi.spyOn(component, 'abrirModalNuevaCitaConFechaHora');

    component.clickBloque('2026-09-07', '08:00');

    expect(abrirSpy).not.toHaveBeenCalled();
    expect(component.sobrecupoConfirmAbierto).toBe(false);
    expect(component.diaSeleccionado).toBeNull();
  });
});

describe('DashboardAdminComponent — A.2B v2: correcciones de smoke visual', () => {
  const setSemana = (component: DashboardAdminComponent, inicio = '2026-09-07'): void => {
    const [anio, mes, dia] = inicio.split('-').map(Number);
    const lunes = new Date(anio, mes - 1, dia);
    component.semanaActual = Array.from({ length: 7 }, (_, i) => {
      const fecha = new Date(lunes);
      fecha.setDate(lunes.getDate() + i);
      const f = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
      return { fecha: f };
    });
  };

  const respuestaRango = (
    profesionalId: number,
    fechaInicio: string,
    fechaFin: string,
    slots: Array<{ fecha: string; hora: string; disponible: boolean; motivo: string | null }>
  ) => ({
    profesional_id: profesionalId,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    duracion_min: 60,
    dias: Array.from(new Set(slots.map(slot => slot.fecha))).map(fecha => ({
      fecha,
      slots: slots
        .filter(slot => slot.fecha === fecha)
        .map(slot => ({
          hora: slot.hora,
          disponible: slot.disponible,
          motivo: slot.motivo,
          overridable_con_sobrecupo: slot.motivo === 'en_colacion' || slot.motivo === 'fuera_de_jornada'
        }))
    }))
  });

  // ── Punto 1: diaSeleccionado no debe sobrevivir a un cambio de semana
  //    si la fecha seleccionada ya no pertenece al rango visible ──

  it('semanaSiguiente limpia diaSeleccionado si ya no pertenece a la nueva semana', () => {
    const { component } = crearShellConPermisosYHttp(['agenda.ver']);
    setSemana(component, '2026-09-07');
    component.diaSeleccionado = '2026-09-07';

    component.semanaSiguiente();

    expect(component.diaSeleccionado).toBeNull();
  });

  it('semanaAnterior limpia diaSeleccionado si ya no pertenece a la nueva semana', () => {
    const { component } = crearShellConPermisosYHttp(['agenda.ver']);
    setSemana(component, '2026-09-07');
    component.diaSeleccionado = '2026-09-10';

    component.semanaAnterior();

    expect(component.diaSeleccionado).toBeNull();
  });

  it('generarSemanaActual conserva diaSeleccionado si sigue perteneciendo a la semana visible', () => {
    const { component } = crearShellConPermisosYHttp(['agenda.ver']);
    const hoy = new Date();
    const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    component.diaSeleccionado = hoyStr;

    component.generarSemanaActual();

    expect(component.diaSeleccionado).toBe(hoyStr);
  });

  // ── Punto 2: un clic en un bloque no agendable (histórico, día cerrado,
  //    etc.) debe igualmente actualizar el panel contextual al día correcto ──

  it('clic en un bloque bloqueado (p. ej. fecha pasada) actualiza diaSeleccionado sin abrir cita ni sobrecupo', () => {
    const { component, http } = crearShellConPermisosYHttp(['agenda.ver', 'agenda.gestionar']);
    component.filtroProfesionalId = '20';
    setSemana(component);
    const abrirSpy = vi.spyOn(component, 'abrirModalNuevaCitaConFechaHora');

    (http.get as any).mockImplementation((url: string) => {
      if (url.includes('/disponibilidad')) {
        return of(respuestaRango(20, '2026-09-07', '2026-09-13', [
          { fecha: '2026-09-07', hora: '08:00', disponible: false, motivo: 'fecha_pasada' }
        ]));
      }
      return of([]);
    });

    component.cargarHorarioProfesional();
    expect(component.getBloqueEstado('2026-09-07', '08:00')).toBe('bloqueado');

    component.clickBloque('2026-09-07', '08:00');

    expect(component.diaSeleccionado).toBe('2026-09-07');
    expect(abrirSpy).not.toHaveBeenCalled();
    expect(component.sobrecupoConfirmAbierto).toBe(false);
  });

  it('clic en un día cerrado (centro cerrado) actualiza diaSeleccionado sin abrir cita', () => {
    const { component, http } = crearShellConPermisosYHttp(['agenda.ver', 'agenda.gestionar']);
    component.filtroProfesionalId = '20';
    setSemana(component);
    const abrirSpy = vi.spyOn(component, 'abrirModalNuevaCitaConFechaHora');

    (http.get as any).mockImplementation((url: string) => {
      if (url.includes('/disponibilidad')) {
        return of(respuestaRango(20, '2026-09-07', '2026-09-13', [
          { fecha: '2026-09-07', hora: '08:00', disponible: false, motivo: 'dia_cerrado' }
        ]));
      }
      return of([]);
    });

    component.cargarHorarioProfesional();
    expect(component.getBloqueEstado('2026-09-07', '08:00')).toBe('cerrado-centro');

    component.clickBloque('2026-09-07', '08:00');

    expect(component.diaSeleccionado).toBe('2026-09-07');
    expect(abrirSpy).not.toHaveBeenCalled();
  });

  it('clic en una cita histórica (ocupada, no cancelada) actualiza diaSeleccionado al día correcto', () => {
    const { component, http } = crearShellConPermisosYHttp(['agenda.ver', 'agenda.gestionar']);
    component.filtroProfesionalId = '20';
    setSemana(component);

    (http.get as any).mockImplementation((url: string) => {
      if (url.includes('/citas')) {
        return of([{
          id: 1, fecha: '2026-09-07', hora: '08:00', estado: 'completada',
          urgente: false, sobrecupo: false, estudiante: 'Ana'
        }]);
      }
      if (url.includes('/disponibilidad')) {
        return of(respuestaRango(20, '2026-09-07', '2026-09-13', []));
      }
      return of([]);
    });

    component.cargarHorarioProfesional();
    expect(component.getBloqueEstado('2026-09-07', '08:00')).toBe('ocupado');

    component.clickBloque('2026-09-07', '08:00');

    expect(component.diaSeleccionado).toBe('2026-09-07');
  });

  it('sin-datos sigue sin actualizar diaSeleccionado (no hay nada real que mostrar todavía)', () => {
    const { component } = crearShellConPermisosYHttp(['agenda.ver', 'agenda.gestionar']);
    component.filtroProfesionalId = '20';
    setSemana(component);

    component.clickBloque('2026-09-07', '08:00');

    expect(component.getBloqueEstado('2026-09-07', '08:00')).toBe('sin-datos');
    expect(component.diaSeleccionado).toBeNull();
  });

  // ── Punto 3: una fecha histórica nunca debe abrir "Nueva cita" ──

  it('abrirModalNuevaCitaConFechaHora rechaza una fecha histórica', () => {
    const { component } = crearShellConPermisosYHttp(['agenda.ver', 'agenda.gestionar']);
    component.filtroProfesionalId = '20';

    component.abrirModalNuevaCitaConFechaHora('2020-01-01', '08:00', false);

    expect(component.modalCitaAbierto).toBe(false);
  });

  it('el botón de "Nueva cita" no abre el modal si diaSeleccionado quedó en una fecha histórica', () => {
    const { component } = crearShellConPermisosYHttp(['agenda.ver', 'agenda.gestionar']);
    component.filtroProfesionalId = '20';
    component.diaSeleccionado = '2020-01-01';

    component.abrirModalNuevaCita();

    expect(component.modalCitaAbierto).toBe(false);
  });

  it('abrirModalNuevaCitaConFechaHora sigue permitiendo una fecha futura', () => {
    const { component } = crearShellConPermisosYHttp(['agenda.ver', 'agenda.gestionar']);
    component.filtroProfesionalId = '20';
    const futura = new Date();
    futura.setFullYear(futura.getFullYear() + 1);
    const futuraStr = `${futura.getFullYear()}-${String(futura.getMonth() + 1).padStart(2, '0')}-${String(futura.getDate()).padStart(2, '0')}`;

    component.abrirModalNuevaCitaConFechaHora(futuraStr, '08:00', false);

    expect(component.modalCitaAbierto).toBe(true);
  });

  it('confirmarSobrecupo sobre una fecha histórica tampoco abre el modal (defensa adicional)', () => {
    const { component } = crearShellConPermisosYHttp(['agenda.ver', 'agenda.gestionar']);
    component.filtroProfesionalId = '20';
    component.sobrecupoConfirmAbierto = true;
    component.sobrecupoPendiente = { fecha: '2020-01-01', hora: '08:00', motivoTexto: 'el horario habitual de' };

    component.confirmarSobrecupo();

    expect(component.modalCitaAbierto).toBe(false);
  });
});
