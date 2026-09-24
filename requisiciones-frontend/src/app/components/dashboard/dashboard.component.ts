import { Component, OnInit, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { RequisicionService, Dashboard, Requisicion } from '../../services/requisicion.service';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CommonModule, RouterModule, SidebarComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  dashboard: Dashboard | null = null;
  requisiciones: Requisicion[] = [];
  cargando = true;
  error = '';

  private requisicionService = inject(RequisicionService);
  private cdr = inject(ChangeDetectorRef);
  protected router = inject(Router);

  get total() { return this.dashboard?.total ?? 0; }
  get enRevision() { return this.dashboard?.enRevision ?? 0; }
  get aprobadas() { return this.dashboard?.aprobadas ?? 0; }
  get rechazadas() { return this.dashboard?.rechazadas ?? 0; }

  ngOnInit(): void {
    this.requisicionService
      .dashboard()
      .pipe(finalize(() => {
        this.cargando = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (d) => {
          this.dashboard = d;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = typeof err.error === 'string' ? err.error : 'No se pudo cargar el dashboard. Verifica que el backend esté disponible.';
        }
      });

    this.requisicionService
      .listar()
      .pipe(finalize(() => {
        this.cargando = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (data) => {
          this.requisiciones = data;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = typeof err.error === 'string' ? err.error : 'No se pudieron cargar las solicitudes.';
        }
      });
  }

  estadoClase(estado: string): string {
    if (estado === 'APROBADO') return 'aprobado';
    if (estado === 'RECHAZADO') return 'rechazado';
    if (estado === 'NO_APLICA') return 'na';
    return 'pendiente';
  }

  nivelEtiqueta(estado: string): string {
    switch (estado) {
      case 'APROBADO': return 'Aprobado';
      case 'RECHAZADO': return 'Rechazado';
      case 'NO_APLICA': return 'N/A';
      default: return 'Pendiente';
    }
  }

  semaforoGlobalClase(): string {
    if (!this.dashboard) return '';
    const { rechazadas, aprobadas, enRevision } = this.dashboard;
    if (rechazadas > 0) return 'rojo';
    if (enRevision > 0) return 'amarillo';
    if (aprobadas > 0) return 'verde';
    return 'gris';
  }

  verDetalle(id: number): void {
    this.router.navigate(['/autorizacion-detalle', id]);
  }
}