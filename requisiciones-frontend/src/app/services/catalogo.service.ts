import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Partida, UnidadMedida } from '../models/partida.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CatalogoService {
  private apiUrl = `${environment.apiUrl}/catalogo`;

  constructor(private http: HttpClient) {}

  getPartidas(): Observable<Partida[]> {
    return this.http.get<Partida[]>(`${this.apiUrl}/partidas`);
  }

  getUnidadesMedida(): Observable<UnidadMedida[]> {
    return this.http.get<UnidadMedida[]>(`${this.apiUrl}/unidades-medida`);
  }
}