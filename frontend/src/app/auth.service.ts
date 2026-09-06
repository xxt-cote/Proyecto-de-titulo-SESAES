import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from './config';
import { normalizarRol } from './shared/auth/role.model';
import { ROLE_DEFAULT_PERMISSIONS, Permission } from './shared/auth/permission.model';
export interface LoginResponse {
  message: string;
  access_token: string;
  token_type: string;
  rol: 'estudiante' | 'profesional' | 'admin' | 'superadmin';
  id: number;
  nombre: string;
  foto_url: string | null;
  debe_cambiar_password: boolean;
}
@Injectable({ providedIn: 'root' })
export class AuthService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  login(correo: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, {
      correo,
      password
    });
  }

  // Se usa sessionStorage (no localStorage) a propósito: sessionStorage es
  // aislado por pestaña, lo que permite tener sesiones distintas abiertas
  // en pestañas distintas del mismo navegador (ej. estudiante en una,
  // profesional en otra) sin que una pise los datos de la otra.
  guardarSesion(data: LoginResponse): void {
    sessionStorage.setItem('access_token', data.access_token);
    sessionStorage.setItem('rol', data.rol);
    sessionStorage.setItem('id', String(data.id));
    sessionStorage.setItem('usuario_id', String(data.id));
    sessionStorage.setItem('nombre', data.nombre ?? '');
    sessionStorage.setItem('foto_url', data.foto_url ?? '');
    sessionStorage.setItem('debe_cambiar_password', String(!!data.debe_cambiar_password));
  }

  getToken(): string | null {
    return sessionStorage.getItem('access_token');
  }

  getRol(): string | null {
    return sessionStorage.getItem('rol');
  }

  /**
   * Nombre real del Usuario autenticado (guardado por guardarSesion()).
   * Fail-safe: sin sesión o valor vacío -> null. Nunca usa un fallback
   * fijo ni una fuente distinta a la sesión (p. ej. ConfiguracionCentro).
   */
  getNombre(): string | null {
    const nombre = sessionStorage.getItem('nombre');
    return nombre && nombre.trim() ? nombre : null;
  }

  /**
   * URL de la foto de perfil del Usuario autenticado (guardado por
   * guardarSesion()). Fail-safe: sin sesión o valor vacío -> null.
   */
  getFotoUrl(): string | null {
    const fotoUrl = sessionStorage.getItem('foto_url');
    return fotoUrl && fotoUrl.trim() ? fotoUrl : null;
  }

  /**
   * Usuario.id de la sesión activa.
   *
   * Nunca usa un fallback fijo ni localStorage. Si la sesión no contiene
   * una identidad numérica positiva, falla cerrado devolviendo null.
   */
  getUsuarioId(): number | null {
    const raw = sessionStorage.getItem('usuario_id');
    if (!raw) return null;

    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  logout(): void {
    sessionStorage.clear();
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token || !this.getRol()) return false;
    return !this.tokenExpirado(token);
  }

  /**
   * Resuelve si el usuario de la sesión activa tiene `permission`, según
   * los DEFAULT permissions de su rol (ver permission.model.ts).
   *
   * IMPORTANTE: esto es solo UX (mostrar/ocultar acciones). El backend
   * sigue siendo la única autoridad real de seguridad — cualquier
   * endpoint protegido valida el permiso de nuevo server-side.
   *
   * Fail-closed: sin sesión, rol desconocido, o permiso no listado para
   * ese rol → false.
   */
  hasPermission(permission: Permission): boolean {
    const rol = normalizarRol(this.getRol());
    if (!rol) return false;
    return ROLE_DEFAULT_PERMISSIONS[rol].includes(permission);
  }

  /**
   * Decodifica (sin verificar firma, eso lo hace el backend) el payload
   * del JWT para leer su 'exp' y así poder cerrar sesión en el cliente
   * apenas expire, sin esperar a que un request falle con 401.
   */
  private tokenExpirado(token: string): boolean {
    try {
      const payloadBase64 = token.split('.')[1];
      const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
      if (!payload.exp) return false;
      return Date.now() >= payload.exp * 1000;
    } catch {
      return true; // token con formato inválido -> tratarlo como expirado
    }
  }
}