import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UsuarioInfo } from './auth.service';
import { environment } from '../../environments/environment';

export interface UsuarioRequest {
  nombreCompleto: string;
  rol: string;
  areaId: number | null;
}

export interface UsuarioRegistro extends UsuarioInfo {
  passwordTemporal: string | null;
}

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/auth/usuarios`;

  listar(): Observable<UsuarioInfo[]> {
    return this.http.get<UsuarioInfo[]>(this.apiUrl);
  }

  crear(data: UsuarioRequest): Observable<UsuarioRegistro> {
    return this.http.post<UsuarioRegistro>(this.apiUrl, data);
  }

  cambiarEstado(id: number, activo: boolean): Observable<UsuarioInfo> {
    return this.http.patch<UsuarioInfo>(`${this.apiUrl}/${id}/estado`, { activo });
  }
}