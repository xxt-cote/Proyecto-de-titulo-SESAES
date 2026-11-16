import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { environment } from '../config';

/**
 * "¿Olvidaste tu contraseña?": pide el correo y el backend envía un enlace de un
 * solo uso. El mensaje de resultado es siempre el mismo, exista o no el correo,
 * para no revelar qué cuentas están registradas.
 */
@Component({
  selector: 'app-recuperar-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './recuperar-password.html',
  styleUrl: './recuperar-password.css',
})
export class RecuperarPasswordComponent {
  correo = '';
  enviando = false;
  mensaje = '';
  error = '';

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  get correoValido(): boolean {
    return this.correo.trim().toLowerCase().endsWith('@utem.cl');
  }

  enviar(): void {
    if (this.enviando) return;
    this.error = '';
    if (!this.correoValido) {
      this.error = 'Escribe tu correo institucional (termina en @utem.cl).';
      this.cdr.markForCheck();
      return;
    }
    this.enviando = true;
    this.http.post<{ message: string }>(`${environment.apiUrl}/recuperar-password`, { correo: this.correo.trim() }).subscribe({
      next: (r) => {
        this.enviando = false;
        this.mensaje = r.message;
        this.cdr.markForCheck();
      },
      error: (e: HttpErrorResponse) => {
        this.enviando = false;
        this.error = e.status === 429
          ? 'Hiciste muchas solicitudes seguidas. Espera un rato e inténtalo de nuevo.'
          : 'No pudimos procesar la solicitud. Inténtalo de nuevo en unos minutos.';
        this.cdr.markForCheck();
      },
    });
  }
}
