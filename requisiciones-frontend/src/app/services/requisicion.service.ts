import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { environment } from '../../environments/environment';

const TIEMPO_ESPERA_MS = 15000;

export interface Sugerencia {
  id?: number;
  marca: string;
  modelo: string;
  precioEstimado: number;
  enlaceUrl?: string;
  archivoPdfNombre?: string;
  archivoPdfUrl?: string;
}

export interface ArchivoSubido {
  nombre: string;
  nombreInterno: string;
  url: string;
  tamano: number;
}

export interface Requisicion {
  id: number;
  folio: string;
  nombreSolicitante: string;
  area: string;
  fechaRequerida: string;
  fechaSolicitud: string;
  partidaCodigo: string;
  partidaNombre: string;
  material: string;
  cantidad: number;
  unidad: string;
  precioEstimado: number;
  descripcion: string;
  justificacion: string;
  estadoCoord: string;
  estadoDir: string;
  estadoDirGral: string;
  estadoGlobal: string;
  justificacionRechazo?: string;
  creadoPorId: number;
  modificadoPor?: string;
  sugerencias: Sugerencia[];
  estadoMateriales: string;
  mesCompra: string;
  proveedor?: string;
  estadoCompra?: string;
  tipoCosto?: string;
  precioCompra?: number;
  marcaSeleccionada?: string;
}

export interface HistoricoEvento {
  id: number;
  fechaHora: string;
  usuario: string;
  rol: string;
  accion: string;
  campo: string;
  valorAnterior: string;
  valorNuevo: string;
}

export interface Notificacion {
  folio: string;
  requisicionId: number;
  fechaHora: string;
  usuario: string;
  rol: string;
  accion: string;
  campo: string;
  valorAnterior: string;
  valorNuevo: string;
}

export interface DashboardPorArea {
  area: string;
  total: number;
  pendientes: number;
  aprobadas: number;
  rechazadas: number;
}

export interface Dashboard {
  total: number;
  pendientes: number;
  aprobadas: number;
  rechazadas: number;
  enRevision: number;
  porArea: DashboardPorArea[];
}

@Injectable({ providedIn: 'root' })
export class RequisicionService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/requisiciones`;

  subirArchivos(files: File[]): Observable<ArchivoSubido[]> {
    const formData = new FormData();
    files.forEach((f) => formData.append('archivos', f));
    return this.http.post<ArchivoSubido[]>(`${environment.apiUrl}/archivos`, formData).pipe(timeout(TIEMPO_ESPERA_MS));
  }

  verArchivo(url: string): Observable<Blob> {
    return this.http.get(url, { responseType: 'blob' }).pipe(timeout(TIEMPO_ESPERA_MS));
  }

  listar(): Observable<Requisicion[]> {
    return this.http.get<Requisicion[]>(this.apiUrl).pipe(timeout(TIEMPO_ESPERA_MS));
  }

  listarMateriales(): Observable<Requisicion[]> {
    return this.http.get<Requisicion[]>(`${this.apiUrl}/materiales`).pipe(timeout(TIEMPO_ESPERA_MS));
  }

  autorizarCompra(id: number, proveedor: string, sugerenciaId: number | null, costoPropio: number | null): Observable<Requisicion> {
    return this.http.post<Requisicion>(`${this.apiUrl}/${id}/autorizar-compra`, { proveedor, sugerenciaId, costoPropio }).pipe(timeout(TIEMPO_ESPERA_MS));
  }

  marcarComprado(id: number): Observable<Requisicion> {
    return this.http.post<Requisicion>(`${this.apiUrl}/${id}/comprado`, {}).pipe(timeout(TIEMPO_ESPERA_MS));
  }

  marcarEntregado(id: number): Observable<Requisicion> {
    return this.http.post<Requisicion>(`${this.apiUrl}/${id}/entregado`, {}).pipe(timeout(TIEMPO_ESPERA_MS));
  }

  reasignarPartida(id: number, partidaCodigo: string, partidaNombre: string): Observable<Requisicion> {
    return this.http.patch<Requisicion>(`${this.apiUrl}/${id}/partida`, { partidaCodigo, partidaNombre }).pipe(timeout(TIEMPO_ESPERA_MS));
  }

  reasignarMes(id: number, mesCompra: string, justificacion: string): Observable<Requisicion> {
    return this.http.patch<Requisicion>(`${this.apiUrl}/${id}/mes-compra`, { mesCompra, justificacion }).pipe(timeout(TIEMPO_ESPERA_MS));
  }

  enProceso(): Observable<Requisicion[]> {
    return this.http.get<Requisicion[]>(`${this.apiUrl}/en-proceso`).pipe(timeout(TIEMPO_ESPERA_MS));
  }

  notificaciones(): Observable<Notificacion[]> {
    return this.http.get<Notificacion[]>(`${this.apiUrl}/notificaciones`).pipe(timeout(TIEMPO_ESPERA_MS));
  }

  obtener(id: number): Observable<Requisicion> {
    return this.http.get<Requisicion>(`${this.apiUrl}/${id}`).pipe(timeout(TIEMPO_ESPERA_MS));
  }

  crear(body: {
    nombreSolicitante: string;
    area: string;
    fechaRequerida: string;
    partidaCodigo: string;
    partidaNombre: string;
    material: string;
    cantidad: number;
    unidad: string;
    precioEstimado: number;
    descripcion: string;
    justificacion: string;
    sugerencias: Sugerencia[];
  }): Observable<Requisicion> {
    return this.http.post<Requisicion>(this.apiUrl, body).pipe(timeout(TIEMPO_ESPERA_MS));
  }

  aprobar(id: number): Observable<Requisicion> {
    return this.http.post<Requisicion>(`${this.apiUrl}/${id}/aprobar`, {}).pipe(timeout(TIEMPO_ESPERA_MS));
  }

  rechazar(id: number, justificacion: string): Observable<Requisicion> {
    return this.http.post<Requisicion>(`${this.apiUrl}/${id}/rechazar`, { justificacion }).pipe(timeout(TIEMPO_ESPERA_MS));
  }

  modificar(
    id: number,
    body: {
      material: string;
      cantidad: number;
      unidad: string;
      precioEstimado: number;
      descripcion: string;
      justificacion: string;
      sugerencias: Sugerencia[];
    }
  ): Observable<Requisicion> {
    return this.http.patch<Requisicion>(`${this.apiUrl}/${id}/modificar`, body).pipe(timeout(TIEMPO_ESPERA_MS));
  }

  historial(id: number): Observable<HistoricoEvento[]> {
    return this.http.get<HistoricoEvento[]>(`${this.apiUrl}/${id}/historial`).pipe(timeout(TIEMPO_ESPERA_MS));
  }

  dashboard(): Observable<Dashboard> {
    return this.http.get<Dashboard>(`${this.apiUrl}/dashboard`).pipe(timeout(TIEMPO_ESPERA_MS));
  }
}