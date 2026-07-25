import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LoginResponse {
  message: string;
  rol: 'estudiante' | 'profesional' | 'admin';
  id: number;
  nombre: string;
  foto_url: string | null;
}
@Injectable({ providedIn: 'root' })
export class AuthService {

  private apiUrl = 'http://localhost:8080';

  constructor(private http: HttpClient) {}

  login(correo: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, {
      correo,
      password
    });
  }

  guardarSesion(data: LoginResponse): void {
    localStorage.setItem('rol', data.rol);
    localStorage.setItem('id', String(data.id));
    localStorage.setItem('usuario_id', String(data.id));
    localStorage.setItem('nombre', data.nombre ?? '');
    localStorage.setItem('foto_url', data.foto_url ?? '');
  }

  getRol(): string | null {
    return localStorage.getItem('rol');
  }

  logout(): void {
    localStorage.clear();
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('rol');
  }
}