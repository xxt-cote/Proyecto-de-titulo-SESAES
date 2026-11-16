import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { environment } from '../config';
import { evaluarPassword } from '../shared/password-validation';

/**
 * Pantalla a la que llega el enlace del correo: /restablecer?token=...
 * El token se lee una sola vez y se quita de la barra de direcciones (para que
 * no quede en el historial del navegador ni se filtre por el encabezado Referer).
 */
@Component({
  selector: 'app-restablecer-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './restablecer-password.html',
  styleUrl: './recuperar-password.css',
})
export class RestablecerPasswordComponent implements OnInit {
  token = '';
  nueva = '';
  repetir = '';
  mostrar = false;
  enviando = false;
  listo = false;
  enlaceInvalido = false;
  error = '';

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.enlaceInvalido = true;
      return;
    }
    this.router.navigate([], { queryParams: { token: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  get reglas() { return evaluarPassword(this.nueva); }
  get coinciden(): boolean { return this.nueva.length > 0 && this.nueva === this.repetir; }
  get puedeEnviar(): boolean { return this.reglas.valida && this.coinciden && !this.enviando; }

  readonly listaReglas: { clave: 'minimo8' | 'mayuscula' | 'minuscula' | 'numero' | 'especial' | 'sinEspacios'; texto: string }[] = [
    { clave: 'minimo8', texto: '8 caracteres o más' },
    { clave: 'mayuscula', texto: 'Una mayúscula' },
    { clave: 'minuscula', texto: 'Una minúscula' },
    { clave: 'numero', texto: 'Un número' },
    { clave: 'especial', texto: 'Un carácter especial' },
    { clave: 'sinEspacios', texto: 'Sin espacios' },
  ];

  enviar(): void {
    if (!this.puedeEnviar) return;
    this.enviando = true;
    this.error = '';
    this.http.post(`${environment.apiUrl}/restablecer-password`, { token: this.token, nueva_password: this.nueva }).subscribe({
      next: () => {
        this.enviando = false;
        this.listo = true;
        this.nueva = '';
        this.repetir = '';
        this.cdr.markForCheck();
      },
      error: (e: HttpErrorResponse) => {
        this.enviando = false;
        const detalle = typeof e.error?.detail === 'string' ? e.error.detail : '';
        if (e.status === 400 && detalle.includes('enlace')) {
          this.enlaceInvalido = true;
        } else {
          this.error = e.status === 429
            ? 'Hiciste muchos intentos seguidos. Espera un rato e inténtalo de nuevo.'
            : (detalle || 'No pudimos cambiar la contraseña. Inténtalo de nuevo.');
        }
        this.cdr.markForCheck();
      },
    });
  }
}
