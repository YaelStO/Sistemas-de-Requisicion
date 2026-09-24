import { Component, OnInit, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { RequisicionService, Notificacion } from '../../services/requisicion.service';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-centro-notificaciones',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CommonModule, RouterModule, SidebarComponent],
  templateUrl: './centro-notificaciones.component.html',
  styleUrl: './centro-notificaciones.component.scss'
})
export class CentroNotificacionesComponent implements OnInit {
  notificaciones: Notificacion[] = [];
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
    this.requisicionService.notificaciones().subscribe({
      next: (data) => {
        this.notificaciones = data;
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = typeof err.error === 'string' ? err.error : 'No se pudieron cargar las notificaciones. Verifica que el backend esté disponible.';
        this.cargando = false;
        this.cdr.markForCheck();
      }
    });
  }

  formatoFecha(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  tipoClase(n: Notificacion): string {
    const accion = n.accion.toLowerCase();
    if (accion.includes('rechaz')) return 'tipo-rechazo';
    if (accion.includes('aprob')) return 'tipo-aprobacion';
    return 'tipo-modificacion';
  }

  tipoIcono(n: Notificacion): string {
    const accion = n.accion.toLowerCase();
    if (accion.includes('rechaz')) return 'bi-x-octagon';
    if (accion.includes('aprob')) return 'bi-check-circle';
    return 'bi-pencil-square';
  }

  mostrarDetalle(n: Notificacion): boolean {
    return n.accion.includes('Modificó') && !!n.campo;
  }
}