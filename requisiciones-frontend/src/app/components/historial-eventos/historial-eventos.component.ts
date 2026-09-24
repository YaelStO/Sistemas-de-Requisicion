import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { RequisicionService, Requisicion, HistoricoEvento } from '../../services/requisicion.service';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-historial-eventos',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarComponent],
  templateUrl: './historial-eventos.component.html',
  styleUrl: './historial-eventos.component.scss'
})
export class HistorialEventosComponent implements OnInit {
  requesiciones: Requisicion[] = [];
  eventos: HistoricoEvento[] = [];
  cargando = false;
  error = '';
  folioActual = '';
  idActual: number | null = null;

  pagActual = 1;
  porPagina = 10;

  private requisicionService = inject(RequisicionService);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.idActual = idParam ? Number(idParam) : null;
    this.cargarRequisiciones();
  }

  cargarRequisiciones(): void {
    this.requisicionService.listar().subscribe({
      next: (data) => {
        this.requesiciones = data;
        this.cdr.markForCheck();
        if (this.idActual != null) {
          this.cargarHistorial(this.idActual);
        } else if (data.length > 0) {
          this.onRequisicionCambio(data[0].id);
        }
      },
      error: (err) => {
        this.error = this.mensajeError(err, 'No se pudieron cargar las requisiciones.');
        this.cdr.markForCheck();
      }
    });
  }

  onRequisicionCambio(id: number): void {
    this.cargarHistorial(id);
  }

  onSeleccion(event: Event): void {
    const valor = (event.target as HTMLSelectElement).value;
    if (valor) {
      this.cargarHistorial(Number(valor));
    }
  }

  cargarHistorial(id: number): void {
    if (!id) {
      return;
    }
    this.cargando = true;
    this.error = '';
    this.pagActual = 1;
    this.requisicionService.historial(id).subscribe({
      next: (data) => {
        this.eventos = data;
        const folio = this.requesiciones.find((r) => r.id === id)?.folio;
        this.folioActual = folio ?? (this.requesiciones.length > 0 ? `#${id}` : '');
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = this.mensajeError(err, 'No se pudo cargar el historial.');
        this.eventos = [];
        this.cargando = false;
        this.cdr.markForCheck();
      }
    });
  }

  private mensajeError(err: unknown, fallback: string): string {
    const cuerpo = (err as { error?: unknown })?.error;
    return typeof cuerpo === 'string' ? cuerpo : fallback;
  }

  get paginas(): number[] {
    const total = Math.ceil(this.eventos.length / this.porPagina);
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  get eventosPagina(): HistoricoEvento[] {
    const inicio = (this.pagActual - 1) * this.porPagina;
    return this.eventos.slice(inicio, inicio + this.porPagina);
  }

  irPagina(p: number): void {
    if (p >= 1 && p <= this.paginas.length) {
      this.pagActual = p;
    }
  }

  filaClase(e: HistoricoEvento): string {
    const accion = e.accion.toLowerCase();
    if (accion.includes('rechaz')) return 'row-rechazado';
    if (accion.includes('aprob')) return 'row-aprobado';
    if (accion.includes('modific')) return 'row-mod';
    return '';
  }

  formatFecha(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}