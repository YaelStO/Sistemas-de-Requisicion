import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { CatalogoService } from '../../services/catalogo.service';
import { AuthService } from '../../services/auth.service';
import { RequisicionService, Sugerencia } from '../../services/requisicion.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { Partida, UnidadMedida } from '../../models/partida.model';
import { CurrencyInputDirective } from '../../directives/currency-input.directive';

const MAX_MARCA = 300;
const MAX_MODELO = 200;
const URL_PATRON = /^https?:\/\/[\w.-]+\.[a-z]{2,}(\/\S*)?$/i;

@Component({
  selector: 'app-nueva-requisicion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SidebarComponent, CurrencyInputDirective],
  templateUrl: './nueva-requisicion.component.html',
  styleUrl: './nueva-requisicion.component.scss'
})
export class NuevaRequisicionComponent implements OnInit {
  readonly maxMarca = MAX_MARCA;
  readonly maxModelo = MAX_MODELO;

  requisicionForm!: FormGroup;
  partidasList: Partida[] = [];
  unidadesMedidaList: UnidadMedida[] = [];
  partidaSeleccionada: Partida | null = null;
  fechaSolicitud = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  archivosPdf: File[] = [];
  mensaje = '';
  error = '';
  guardando = false;

  private authService = inject(AuthService);
  private requisicionService = inject(RequisicionService);
  private cdr = inject(ChangeDetectorRef);

  get nombreSolicitante(): string {
    return this.authService.usuario?.nombreCompleto ?? 'XXXXXXXXX';
  }

  get areaSolicitante(): string {
    return this.authService.usuario?.area ?? 'Redes';
  }

  constructor(
    private fb: FormBuilder,
    private catalogoService: CatalogoService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.cargarDatos();
  }

  initForm(): void {
    this.requisicionForm = this.fb.group({
      fechaRequerida: ['', Validators.required],
      partidaId: ['', Validators.required],
      materialSolicitado: ['', Validators.required],
      cantidad: [1, [Validators.required, Validators.min(1)]],
      unidadMedida: ['', Validators.required],
      precioEstimadoUnitario: [0, [Validators.required, Validators.min(0.01)]],
      descripcion: [''],
      justificacion: ['', Validators.required],
      sugerencias: this.fb.array([])
    });

    this.requisicionForm.get('sugerencias')?.valueChanges.subscribe(() => {
      this.syncArchivos();
    });
  }

  cargarDatos(): void {
    this.catalogoService.getPartidas().subscribe({
      next: (data) => {
        this.partidasList = data;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error al conectar con el backend:', err);
        this.cdr.markForCheck();
      }
    });

    this.catalogoService.getUnidadesMedida().subscribe({
      next: (data) => {
        this.unidadesMedidaList = data;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error al cargar unidades:', err);
        this.cdr.markForCheck();
      }
    });
  }

  onPartidaChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const id = Number(selectElement.value);
    this.partidaSeleccionada = this.partidasList.find(p => p.id === id) || null;
  }

  verDescripcion(): void {
    if (!this.partidaSeleccionada) {
      alert('Selecciona primero una partida específica.');
      return;
    }
    alert(this.partidaSeleccionada.nombre + '\n\n' + this.partidaSeleccionada.descripcion);
  }

  get sugerencias(): FormArray {
    return this.requisicionForm.get('sugerencias') as FormArray;
  }

  get totalEstimado(): number {
    const cantidad = Number(this.requisicionForm.get('cantidad')?.value) || 0;
    const precio = Number(this.requisicionForm.get('precioEstimadoUnitario')?.value) || 0;
    return cantidad * precio;
  }

  formatMoney(valor: unknown): string {
    const n = Number(valor) || 0;
    return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }

  agregarSugerencia(): void {
    const sugerenciaGroup = this.fb.group({
      marca: ['', [Validators.maxLength(MAX_MARCA)]],
      modelo: ['', [Validators.maxLength(MAX_MODELO)]],
      precioEstimadoUnitario: [0, [Validators.min(0)]],
      enlaceUrl: ['', [Validators.pattern(URL_PATRON)]]
    });
    this.sugerencias.push(sugerenciaGroup);
  }

  eliminarSugerencia(index: number): void {
    this.sugerencias.removeAt(index);
    this.archivosPdf[index] = undefined as unknown as File;
    this.archivosPdf = this.archivosPdf.filter(() => true);
  }

  syncArchivos(): void {
    const count = this.sugerencias.length;
    while (this.archivosPdf.length < count) {
      this.archivosPdf.push(undefined as unknown as File);
    }
  }

  onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }
    const file = input.files[0];
    if (file.type !== 'application/pdf') {
      alert('Solo se aceptan archivos PDF.');
      input.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('El archivo excede el tamaño máximo de 10 MB.');
      input.value = '';
      return;
    }
    if (this.sugerencias.length === 0) {
      this.agregarSugerencia();
    }
    this.archivosPdf[this.sugerencias.length - 1] = file;
  }

  abrirPdf(index: number): void {
    const file = this.archivosPdf[index];
    if (!file) {
      return;
    }
    const url = URL.createObjectURL(file);
    window.open(url, '_blank');
  }

  guardarRequisicion(): void {
    this.mensaje = '';
    this.error = '';
    if (this.requisicionForm.invalid) {
      this.requisicionForm.markAllAsTouched();
      this.error = 'Completa correctamente los campos obligatorios del formulario.';
      this.cdr.markForCheck();
      return;
    }

    const f = this.requisicionForm.value;
    const partida = this.partidasList.find(p => p.id === Number(f.partidaId)) ?? this.partidaSeleccionada;
    if (!partida) {
      this.error = 'Selecciona una partida específica válida.';
      return;
    }
    this.guardando = true;
    this.mensaje = '';

    const indicesPdf = this.archivosPdf.map((archivo, i) => (archivo ? i : -1)).filter((i) => i >= 0);
    const archivos = indicesPdf.map((i) => this.archivosPdf[i]);

    if (archivos.length === 0) {
      this.enviarRequisicion(f, partida, []);
      return;
    }

    this.requisicionService.subirArchivos(archivos).subscribe({
      next: (subidos) => {
        this.enviarRequisicion(f, partida, subidos);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.guardando = false;
        const detalle = err.error?.error ?? err.error?.message ?? err.error;
        this.error = typeof detalle === 'string' && detalle
          ? detalle
          : 'No se pudieron subir los archivos PDF. Intenta de nuevo.';
        this.cdr.markForCheck();
      }
    });
  }

  private enviarRequisicion(f: any, partida: Partida, archivosSubidos: { url: string }[]): void {
    const indicesPdf = this.archivosPdf.map((archivo, i) => (archivo ? i : -1)).filter((i) => i >= 0);
    const sugerencias: Sugerencia[] = (f.sugerencias ?? []).map((s: any, i: number) => {
      const j = indicesPdf.indexOf(i);
      return {
        marca: s.marca,
        modelo: s.modelo,
        precioEstimado: Number(s.precioEstimadoUnitario) || 0,
        enlaceUrl: s.enlaceUrl,
        archivoPdfNombre: this.archivosPdf[i]?.name ?? null,
        archivoPdfUrl: j >= 0 ? archivosSubidos[j].url : null
      };
    });

    this.requisicionService.crear({
      nombreSolicitante: this.nombreSolicitante,
      area: this.areaSolicitante,
      fechaRequerida: this.formatDate(f.fechaRequerida),
      partidaCodigo: String(partida.codigo),
      partidaNombre: partida.nombre,
      material: f.materialSolicitado,
      cantidad: Number(f.cantidad),
      unidad: f.unidadMedida,
      precioEstimado: Number(f.precioEstimadoUnitario),
      descripcion: f.descripcion ?? '',
      justificacion: f.justificacion,
      sugerencias
    }).subscribe({
      next: (creada) => {
        this.guardando = false;
        this.mensaje = `Requisición ${creada.folio} enviada a Coordinación para revisión.`;
        this.requisicionForm.reset({ cantidad: 1, precioEstimadoUnitario: 0 });
        (this.requisicionForm.get('sugerencias') as FormArray).clear();
        this.archivosPdf = [];
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.guardando = false;
        const detalle = err.error?.error ?? err.error?.message ?? err.error;
        this.error = typeof detalle === 'string' && detalle
          ? detalle
          : 'No se pudo guardar la requisición. Revisa tu conexión con el backend.';
        this.cdr.markForCheck();
      }
    });
  }

  private formatDate(iso: string | null): string {
    if (!iso) {
      return '';
    }
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
}
