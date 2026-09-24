import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Area {
  id: number;
  nombre: string;
  nivel: string;
  parentId: number | null;
  padreNombre?: string;
  activo?: boolean;
}

export interface AreaRequest {
  nombre: string;
  nivel: string;
  parentId: number | null;
}

@Injectable({ providedIn: 'root' })
export class AreaService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/areas`;

  listar(): Observable<Area[]> {
    return this.http.get<Area[]>(this.apiUrl);
  }

  crear(data: AreaRequest): Observable<Area> {
    return this.http.post<Area>(this.apiUrl, data);
  }

  actualizar(id: number, data: AreaRequest): Observable<Area> {
    return this.http.patch<Area>(`${this.apiUrl}/${id}`, data);
  }

  cambiarEstado(id: number, activo: boolean): Observable<Area> {
    return this.http.patch<Area>(`${this.apiUrl}/${id}/estado`, { activo });
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}