import { Component, OnInit, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { RequisicionService, Requisicion } from '../../services/requisicion.service';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-solicitudes-en-proceso',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CommonModule, RouterModule, SidebarComponent],
  templateUrl: './solicitudes-en-proceso.component.html',
  styleUrl: './solicitudes-en-proceso.component.scss'
})
export class SolicitudesEnProcesoComponent implements OnInit {
  requisiciones: Requisicion[] = [];
  cargando = true;
  error = '';

  private requisicionService = inject(RequisicionService);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.requisicionService.enProceso().subscribe({
      next: (data) => {
        this.requisiciones = data;
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = typeof err.error === 'string' ? err.error : 'No se pudieron cargar tus solicitudes. Verifica que el backend esté disponible.';
        this.cargando = false;
        this.cdr.markForCheck();
      }
    });
  }

  etapaActual(r: Requisicion): string {
    switch (r.estadoGlobal) {
      case 'EN_REVISION_COORD': return 'En Coordinación';
      case 'EN_REVISION_DIRECCION': return 'En Dirección de Área';
      case 'EN_REVISION_DIRECCION_GENERAL': return 'En Dirección General';
      case 'APROBADA': return 'Aprobada';
      case 'RECHAZADA': return 'Rechazada';
      default: return r.estadoGlobal.replaceAll('_', ' ');
    }
  }

  estadoClase(estado: string): string {
    if (estado === 'APROBADO' || estado === 'APROBADA') return 'aprobado';
    if (estado === 'RECHAZADO' || estado === 'RECHAZADA') return 'rechazado';
    if (estado === 'NO_APLICA') return 'na';
    if (estado.startsWith('EN_REVISION')) return 'en-revision';
    return 'pendiente';
  }

  estadoEtiqueta(estado: string): string {
    if (estado === 'NO_APLICA') return 'N/A';
    return estado.replaceAll('_', ' ');
  }

  formatMoney(v: number | undefined): string {
    return (Number(v) ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }
}