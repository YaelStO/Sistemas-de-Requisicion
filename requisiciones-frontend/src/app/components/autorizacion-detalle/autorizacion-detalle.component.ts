import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { RequisicionService, Requisicion, Sugerencia, HistoricoEvento } from '../../services/requisicion.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { CurrencyInputDirective } from '../../directives/currency-input.directive';

const MAX_MARCA = 300;
const MAX_MODELO = 200;
const URL_PATRON = /^https?:\/\/[\w.-]+\.[a-z]{2,}(\/\S*)?$/i;

@Component({
  selector: 'app-autorizacion-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SidebarComponent, CurrencyInputDirective],
  templateUrl: './autorizacion-detalle.component.html',
  styleUrl: './autorizacion-detalle.component.scss'
})
export class AutorizacionDetalleComponent implements OnInit {
  readonly maxMarca = MAX_MARCA;
  readonly maxModelo = MAX_MODELO;

  requisicion: Requisicion | null = null;
  cargando = true;
  error = '';
  mensaje = '';

  mostrarModalRechazo = false;
  mostrarModalAprobacion = false;
  justificacionRechazo = '';
  editando = false;
  editForm!: FormGroup;

  mostrarHistorial = false;
  historialEventos: HistoricoEvento[] = [];
  cargandoHistorial = false;
  errorHistorial = '';
  pagHistorial = 1;
  porPaginaHistorial = 10;

  private requisicionService = inject(RequisicionService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  protected router = inject(Router);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.cargar(id);
  }

  cargar(id: number): void {
    this.cargando = true;
    this.error = '';
    this.cdr.markForCheck();
    this.requisicionService.obtener(id).subscribe({
      next: (r) => {
        this.requisicion = r;
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err.error ?? 'No se pudo cargar la requisición.';
        this.cargando = false;
        this.cdr.markForCheck();
      }
    });
  }

  get rol(): string | null {
    return this.authService.rol;
  }

  volver(): void {
    if (this.authService.rol === 'ROLE_DEPARTAMENTO') {
      this.router.navigate(['/solicitudes-en-proceso']);
    } else {
      this.router.navigate(['/bandeja-solicitudes']);
    }
  }

  get esMiTurno(): boolean {
    const rol = this.authService.rol;
    const eg = this.requisicion?.estadoGlobal;
    if (rol === 'ROLE_COORDINACION') return eg === 'EN_REVISION_COORD';
    if (rol === 'ROLE_DIRECCION') return eg === 'EN_REVISION_DIRECCION';
    if (rol === 'ROLE_DIRECCION_GENERAL') return eg === 'EN_REVISION_DIRECCION_GENERAL';
    return false;
  }

  get puedeModificar(): boolean {
    const rol = this.authService.rol;
    if (!this.requisicion) return false;
    const eg = this.requisicion.estadoGlobal;
    const esRechazada = eg === 'RECHAZADA';
    if (esRechazada) return false;
    if (rol === 'ROLE_DEPARTAMENTO') return false;
    if (rol === 'ROLE_COORDINACION') return this.requisicion.estadoCoord === 'PENDIENTE';
    if (rol === 'ROLE_DIRECCION') return this.requisicion.estadoDir === 'PENDIENTE';
    if (rol === 'ROLE_DIRECCION_GENERAL') return this.requisicion.estadoDirGral === 'PENDIENTE';
    return false;
  }

  nivelClase(estado: string): string {
    if (estado === 'APROBADO') return 'success';
    if (estado === 'RECHAZADO') return 'danger';
    if (estado === 'NO_APLICA') return 'na';
    return 'pending';
  }

  nivelNombre(estado: string): string {
    switch (estado) {
      case 'APROBADO': return 'Aprobado';
      case 'RECHAZADO': return 'Rechazado';
      case 'NO_APLICA': return 'No aplica';
      default: return 'Pendiente';
    }
  }

  formatMoney(v: number | undefined): string {
    return (Number(v) ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }

  estadoGlobalEtiqueta(): string {
    if (!this.requisicion) return '';
    return this.requisicion.estadoGlobal.replaceAll('_', ' ');
  }

  // ===== ACCIONES =====

  aprobar(): void {
    if (!this.requisicion) return;
    this.mensaje = '';
    this.error = '';
    this.requisicionService.aprobar(this.requisicion.id).subscribe({
      next: (r) => {
        this.requisicion = r;
        this.mensaje = `Requisición ${r.folio} aprobada en tu nivel.`;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err.error ?? 'No se pudo aprobar la requisición.';
        this.cdr.markForCheck();
      }
    });
  }

  abrirModalRechazo(): void {
    this.mostrarModalRechazo = true;
    this.justificacionRechazo = '';
  }

  confirmarRechazo(): void {
    if (!this.requisicion) return;
    if (!this.justificacionRechazo.trim()) {
      this.error = 'Debes capturar una justificación para rechazar.';
      return;
    }
    this.mostrarModalRechazo = false;
    this.requisicionService.rechazar(this.requisicion.id, this.justificacionRechazo.trim()).subscribe({
      next: (r) => {
        this.requisicion = r;
        this.mensaje = `Requisición ${r.folio} rechazada.`;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err.error ?? 'No se pudo rechazar la requisición.';
        this.cdr.markForCheck();
      }
    });
  }

  abrirModalAprobacion(): void {
    this.mostrarModalAprobacion = true;
  }

  confirmarAprobacion(): void {
    this.mostrarModalAprobacion = false;
    this.aprobar();
  }

  // ===== MODIFICACIÓN (solo niveles superiores) =====

  iniciarEdicion(): void {
    if (!this.requisicion) return;
    this.editando = true;
    this.editForm = this.fb.group({
      material: [this.requisicion.material, Validators.required],
      cantidad: [this.requisicion.cantidad, [Validators.required, Validators.min(1)]],
      unidad: [this.requisicion.unidad, Validators.required],
      precioEstimado: [this.requisicion.precioEstimado, [Validators.required, Validators.min(0.01)]],
      descripcion: [this.requisicion.descripcion],
      justificacion: [this.requisicion.justificacion, Validators.required],
      sugerencias: this.fb.array(this.requisicion.sugerencias.map((s) => this.fb.group({
        marca: [s.marca, [Validators.maxLength(MAX_MARCA)]],
        modelo: [s.modelo, [Validators.maxLength(MAX_MODELO)]],
        precioEstimado: [s.precioEstimado, [Validators.min(0)]],
        enlaceUrl: [s.enlaceUrl, [Validators.pattern(URL_PATRON)]],
        archivoPdfNombre: [s.archivoPdfNombre],
        archivoPdfUrl: [s.archivoPdfUrl]
      })))
    });
  }

  get sugerencias(): FormArray {
    return this.editForm.get('sugerencias') as FormArray;
  }

  agregarSugerenciaEdit(): void {
    this.sugerencias.push(this.fb.group({
      marca: ['', [Validators.maxLength(MAX_MARCA)]],
      modelo: ['', [Validators.maxLength(MAX_MODELO)]],
      precioEstimado: [0, [Validators.min(0)]],
      enlaceUrl: ['', [Validators.pattern(URL_PATRON)]]
    }));
  }

  eliminarSugerenciaEdit(i: number): void {
    this.sugerencias.removeAt(i);
  }

  cancelarEdicion(): void {
    this.editando = false;
  }

  guardarEdicion(): void {
    if (!this.requisicion) return;
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      this.error = 'Corrige los campos marcados en la edición (longitudes, URL o precios).';
      this.cdr.markForCheck();
      return;
    }
    const f = this.editForm.value;
    const sugerencias: Sugerencia[] = f.sugerencias.map((s: any) => ({
      marca: s.marca,
      modelo: s.modelo,
      precioEstimado: Number(s.precioEstimado) || 0,
      enlaceUrl: s.enlaceUrl,
      archivoPdfNombre: s.archivoPdfNombre ?? null,
      archivoPdfUrl: s.archivoPdfUrl ?? null
    }));
    this.requisicionService.modificar(this.requisicion.id, {
      material: f.material,
      cantidad: Number(f.cantidad),
      unidad: f.unidad,
      precioEstimado: Number(f.precioEstimado),
      descripcion: f.descripcion ?? '',
      justificacion: f.justificacion,
      sugerencias
    }).subscribe({
      next: (r) => {
        this.requisicion = r;
        this.editando = false;
        this.mensaje = `Requisición ${r.folio} modificada. Los cambios quedaron registrados en la bitácora.`;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err.error ?? 'No se pudo modificar la requisición.';
        this.cdr.markForCheck();
      }
    });
  }

  verPdf(url: string): void {
    this.requisicionService.verArchivo(url).subscribe({
      next: (blob) => {
        const objectUrl = URL.createObjectURL(blob);
        window.open(objectUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'No se pudo abrir el PDF. Verifica tu sesión o que el archivo exista.';
        this.cdr.markForCheck();
      }
    });
  }

  verHistorial(): void {
    if (!this.requisicion) return;
    this.router.navigate(['/historial-eventos', this.requisicion.id]);
  }

  abrirHistorial(): void {
    const r = this.requisicion;
    if (!r) return;
    this.mostrarHistorial = true;
    this.errorHistorial = '';
    this.cargandoHistorial = true;
    this.historialEventos = [];
    this.pagHistorial = 1;
    this.requisicionService.historial(r.id).subscribe({
      next: (data) => {
        this.historialEventos = data;
        this.cargandoHistorial = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.errorHistorial = typeof err.error === 'string' ? err.error : 'No se pudo cargar el historial de esta requisición.';
        this.cargandoHistorial = false;
        this.cdr.markForCheck();
      }
    });
  }

  cerrarHistorial(): void {
    this.mostrarHistorial = false;
    this.historialEventos = [];
    this.errorHistorial = '';
  }

  get paginasHistorial(): number[] {
    const total = Math.ceil(this.historialEventos.length / this.porPaginaHistorial);
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  get historialEventosPagina(): HistoricoEvento[] {
    const inicio = (this.pagHistorial - 1) * this.porPaginaHistorial;
    return this.historialEventos.slice(inicio, inicio + this.porPaginaHistorial);
  }

  irPaginaHistorial(p: number): void {
    if (p >= 1 && p <= this.paginasHistorial.length) {
      this.pagHistorial = p;
    }
  }

  filaClaseHistorial(e: HistoricoEvento): string {
    const accion = e.accion.toLowerCase();
    if (accion.includes('rechaz')) return 'row-rechazado';
    if (accion.includes('aprob')) return 'row-aprobado';
    if (accion.includes('modific')) return 'row-mod';
    return '';
  }

  formatFechaHistorial(iso: string): string {
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