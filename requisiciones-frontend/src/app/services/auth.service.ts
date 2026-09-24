import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface UsuarioInfo {
  id: number;
  username: string;
  nombreCompleto: string;
  rol: string;
  areaId: number | null;
  area: string | null;
  passwordExpirada: boolean;
  activo?: boolean;
}

export interface LoginResponse {
  token: string;
  id: number;
  username: string;
  nombreCompleto: string;
  rol: string;
  areaId: number | null;
  area: string | null;
  passwordExpirada: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/auth`;
  private TOKEN_KEY = 'auth_token';
  private USER_KEY = 'auth_user';

  private get storage(): Storage | null {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  }

  get token(): string | null {
    return this.storage?.getItem(this.TOKEN_KEY) ?? null;
  }

  get usuario(): UsuarioInfo | null {
    const raw = this.storage?.getItem(this.USER_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as UsuarioInfo;
    } catch {
      return null;
    }
  }

  get rol(): string | null {
    return this.usuario?.rol ?? null;
  }

  get passwordExpirada(): boolean {
    return this.usuario?.passwordExpirada ?? false;
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/login`, { username, password })
      .pipe(
        tap((res) => {
          this.storage?.setItem(this.TOKEN_KEY, res.token);
          this.storage?.setItem(this.USER_KEY, JSON.stringify({
            id: res.id,
            username: res.username,
            nombreCompleto: res.nombreCompleto,
            rol: res.rol,
            areaId: res.areaId,
            area: res.area,
            passwordExpirada: res.passwordExpirada,
            activo: true
          } satisfies UsuarioInfo));
        })
      );
  }

  cambiarPassword(passwordActual: string, passwordNueva: string, usernameNuevo: string | null): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.apiUrl}/cambiar-password`, {
      usernameNuevo,
      passwordActual,
      passwordNueva
    });
  }

  actualizarUsuarioLocal(username: string): void {
    const u = this.usuario;
    if (!u) {
      return;
    }
    u.username = username;
    this.storage?.setItem(this.USER_KEY, JSON.stringify(u));
  }

  marcarPasswordActualizada(): void {
    const u = this.usuario;
    if (!u) {
      return;
    }
    u.passwordExpirada = false;
    this.storage?.setItem(this.USER_KEY, JSON.stringify(u));
  }

  logout(): void {
    this.storage?.removeItem(this.TOKEN_KEY);
    this.storage?.removeItem(this.USER_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }
}