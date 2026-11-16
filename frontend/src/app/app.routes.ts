import { Routes } from '@angular/router';
import { LoginComponent } from './login/login';
import { authGuard } from './auth.guard';
import { rolGuard } from './rol.guard';
import { leaveDashboardGuard } from './leave-dashboard.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    // Públicas (sin sesión): recuperar la contraseña por correo.
    path: 'recuperar',
    loadComponent: () =>
      import('./recuperar-password/recuperar-password')
        .then(m => m.RecuperarPasswordComponent)
  },
  {
    path: 'restablecer',
    loadComponent: () =>
      import('./recuperar-password/restablecer-password')
        .then(m => m.RestablecerPasswordComponent)
  },
  {
    // Pública (sin sesión): validar receta/justificativo por código o QR.
    path: 'validar-documento',
    loadComponent: () =>
      import('./validar-documento/validar-documento')
        .then(m => m.ValidarDocumentoComponent)
  },

  {
    path: 'dashboard/estudiante',
    canActivate: [authGuard, rolGuard],
    canDeactivate: [leaveDashboardGuard],
    data: { roles: ['estudiante'] },
    loadComponent: () =>
      import('./dashboard-estudiante/dashboard-estudiante')
        .then(m => m.DashboardEstudianteComponent)
  },
  {
    path: 'dashboard/profesional',
    canActivate: [authGuard, rolGuard],
    canDeactivate: [leaveDashboardGuard],
    data: { roles: ['profesional'] },
    loadComponent: () =>
      import('./dashboard-profesional/dashboard-profesional')
        .then(m => m.DashboardProfesionalComponent)
  },
  {
    path: 'dashboard/admin',
    canActivate: [authGuard, rolGuard],
    canDeactivate: [leaveDashboardGuard],
    data: { roles: ['admin', 'superadmin'] },
    loadComponent: () =>
      import('./dashboard-admin/dashboard-admin')
        .then(m => m.DashboardAdminComponent)
  },

  { path: '**', redirectTo: 'login' }
];
