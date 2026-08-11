import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../config';

const API = environment.apiUrl;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {

  correo = '';
  password = '';
  error = '';
  cargando = false;
  cargandoLento = false;
  private timeoutLento: any;
  recordarme = false;
  mostrarPassword = false;
  errorCorreo = false;

  constructor(private auth: AuthService, private router: Router, private http: HttpClient) {}

  togglePassword(): void { this.mostrarPassword = !this.mostrarPassword; }

  validarCorreo(): void {
    this.errorCorreo = this.correo.length > 0 && !this.correo.endsWith('@utem.cl');
  }

  onLogin(): void {
    this.validarCorreo();
    if (this.errorCorreo) return;

    this.error         = '';
    this.cargando       = true;
    this.cargandoLento  = false;

    // Si la respuesta tarda (ej. el backend en Render estaba "dormido"),
    // avisamos para que no parezca que la app quedó pegada.
    this.timeoutLento = setTimeout(() => { this.cargandoLento = true; }, 4000);

    this.auth.login(this.correo, this.password).subscribe({
      next: (res) => {
        this.auth.guardarSesion(res);
        localStorage.setItem('correo', this.correo);

        if (res.rol === 'profesional') {
          this.http.get<any>(`${API}/profesional/buscar-por-usuario/${res.id}`).subscribe({
            next: (prof) => {
              localStorage.setItem('prof_db_id', String(prof.id));
              this.finalizarCarga();
              this.redirigir(res.rol);
            },
            error: () => {
              this.finalizarCarga();
              this.error = 'Tu cuenta de profesional no está vinculada correctamente. Contacta al administrador.';
            }
          });
        } else {
          this.finalizarCarga();
          this.redirigir(res.rol);
        }
      },
      error: (err) => {
        this.error = err?.error?.detail || 'Correo o contraseña incorrectos.';
        this.finalizarCarga();
      }
    });
  }

  private finalizarCarga(): void {
    clearTimeout(this.timeoutLento);
    this.cargando      = false;
    this.cargandoLento = false;
  }

  private redirigir(rol: string): void {
    const rutas: Record<string, string> = {
      estudiante:  '/dashboard/estudiante',
      profesional: '/dashboard/profesional',
      admin:       '/dashboard/admin'
    };
    this.router.navigate([rutas[rol] ?? '/login']);
  }
}