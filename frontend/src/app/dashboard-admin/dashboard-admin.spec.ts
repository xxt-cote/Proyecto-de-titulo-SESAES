import { ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { AuthService } from '../auth.service';
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
  const toast = {} as ToastService;
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
