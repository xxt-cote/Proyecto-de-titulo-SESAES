import { Routes } from '@angular/router';
import { LoginComponent } from './login/login';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },

  {
    path: 'dashboard/estudiante',
    loadComponent: () =>
      import('./dashboard-estudiante/dashboard-estudiante')
      .then(m => m.DashboardEstudianteComponent)
  },
  {
    path: 'dashboard/profesional',
    loadComponent: () =>
      import('./dashboard-profesional/dashboard-profesional')
      .then(m => m.DashboardProfesionalComponent)
  },
  {
    path: 'dashboard/admin',
    loadComponent: () =>
      import('./dashboard-admin/dashboard-admin')
      .then(m => m.DashboardAdminComponent)
  },

  { path: '**', redirectTo: 'login' }
];