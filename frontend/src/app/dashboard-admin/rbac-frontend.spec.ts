import { ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { AuthService } from '../auth.service';
import { Permission } from '../shared/auth/permission.model';
import { ToastService } from '../shared/toast/toast.service';
import { DashboardAdminComponent } from './dashboard-admin';
import { AdminConfiguracionComponent } from './configuracion/admin-configuracion';
import { AdminHistorialComponent } from './historial/admin-historial';
import { AdminReportesComponent } from './reportes/admin-reportes';


function crearShell(
  permisos: Permission[],
  usuarioId: number | null = 15
) {
  const permitidos = new Set<Permission>(permisos);

  const auth = {
    hasPermission: vi.fn((permission: Permission) => permitidos.has(permission)),
    getUsuarioId: vi.fn(() => usuarioId)
  } as unknown as AuthService;

  const http = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  } as unknown as HttpClient;

  const toast = {
    success: vi.fn(),
    error: vi.fn()
  } as unknown as ToastService;

  const router = {} as Router;
  const cdr = { detectChanges: vi.fn() } as unknown as ChangeDetectorRef;

  return {
    component: new DashboardAdminComponent(router, http, cdr, toast, auth),
    http,
    toast
  };
}


describe('Fase 3.5B — integración frontend RBAC', () => {
  it('ADMIN puede entrar a Configuración por agenda sin obtener configuración global', () => {
    const { component } = crearShell([
      'usuarios.gestionar',
      'profesionales.gestionar',
      'agenda.gestionar',
      'reportes.ver'
    ]);

    expect(component.puedeAccederSeccion('configuracion')).toBe(true);
    expect(component.puedeConfigGeneral).toBe(false);
    expect(component.puedeConfigCitas).toBe(false);
    expect(component.puedeConfigHorarios).toBe(true);
    expect(component.puedeConfigUsuarios).toBe(true);
    expect(component.puedeVerAuditoria).toBe(false);
  });

  it('SUPERADMIN ve configuración global, CGR y auditoría', () => {
    const { component } = crearShell([
      'usuarios.gestionar',
      'profesionales.gestionar',
      'agenda.gestionar',
      'configuracion.gestionar',
      'reportes.ver',
      'reportes.cgr.exportar',
      'auditoria.ver',
      'auditoria.gestionar',
      'roles.gestionar'
    ]);

    expect(component.puedeConfigGeneral).toBe(true);
    expect(component.puedeConfigCitas).toBe(true);
    expect(component.puedeExportarCgr).toBe(true);
    expect(component.puedeVerAuditoria).toBe(true);
    expect(component.puedeGestionarAuditoria).toBe(true);
  });

  it('no consulta auditoría si falta auditoria.ver', () => {
    const { component, http } = crearShell(['reportes.ver']);

    component.cargarActividadReciente();
    component.cargarAuditoria();

    expect(http.get).not.toHaveBeenCalled();
    expect(component.actividadReciente).toEqual([]);
    expect(component.auditoria).toEqual([]);
  });

  it('no consulta configuración global si falta configuracion.gestionar', () => {
    const { component, http } = crearShell(['agenda.gestionar']);

    component.cargarConfiguracionCitas();

    expect(http.get).not.toHaveBeenCalled();
  });

  it('bloquea navegación manual a una sección sin permiso', () => {
    const { component, toast } = crearShell(['reportes.ver']);

    component.navegarA('profesional');

    expect(component.seccionActiva).toBe('inicio');
    expect(toast.error).toHaveBeenCalled();
  });

  it('los componentes presentacionales ocultan privilegios sensibles por defecto', () => {
    const config = new AdminConfiguracionComponent();
    const historial = new AdminHistorialComponent();
    const reportes = new AdminReportesComponent();

    expect(config.puedeVerAuditoria).toBe(false);
    expect(config.puedeGestionarAuditoria).toBe(false);
    expect(historial.puedeExportarCgr).toBe(false);
    expect(reportes.puedeExportarCgr).toBe(false);
  });

  it('marcar todas las notificaciones usa el Usuario.id de AuthService', () => {
    const { component, http } = crearShell(['usuarios.gestionar'], 15);

    (http.patch as any).mockReturnValue({
      subscribe: vi.fn()
    });

    component.marcarTodasLeidas();

    expect(http.patch).toHaveBeenCalledWith(
      expect.stringContaining('/notificaciones/leer-todas/15'),
      {}
    );
  });

  it('sin Usuario.id válido no envía request ni usa un fallback fijo', () => {
    localStorage.setItem('usuario_id', '11');

    try {
      const { component, http } = crearShell(['usuarios.gestionar'], null);

      component.marcarTodasLeidas();

      expect(http.patch).not.toHaveBeenCalled();
    } finally {
      localStorage.removeItem('usuario_id');
    }
  });
});
