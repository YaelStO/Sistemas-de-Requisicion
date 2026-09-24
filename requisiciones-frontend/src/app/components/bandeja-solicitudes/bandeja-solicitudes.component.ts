import { Component, OnInit, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AreaService, Area } from '../../services/area.service';
import { RequisicionService, Requisicion, Sugerencia, HistoricoEvento } from '../../services/requisicion.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { CurrencyInputDirective } from '../../directives/currency-input.directive';

const MAX_MARCA = 300;
const MAX_MODELO = 200;
const URL_PATRON = /^https?:\/\/[\w.-]+\.[a-z]{2,}(\/\S*)?$/i;

interface NodoArea {
  area: Area;
  hijos: NodoArea[];
  requisiciones: Requisicion[];
  total: number;
  expandido: boolean;
}

@Component({
  selector: 'app-bandeja-solicitudes',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SidebarComponent, CurrencyInputDirective],
  templateUrl: './bandeja-solicitudes.component.html',
  styleUrl: './bandeja-solicitudes.component.scss'
})
export class BandejaSolicitudesComponent implements OnInit {
  readonly maxMarca = MAX_MARCA;
  readonly maxModelo = MAX_MODELO;

  requisiciones: Requisicion[] = [];
  cargando = true;
  error = '';
  filtro: string[] = ['TODAS'];

  requisicionSeleccionada: Requisicion | null = null;
  cargandoDetalle = false;
  errorDetalle = '';
  mensajeAccion = '';
  mostrarRechazo = false;
  justificacionRechazo = '';
  editando = false;
  editForm!: FormGroup;

  vista: 'arbol' | 'lista' = 'arbol';
  areas: Area[] = [];
  nodosRaiz: NodoArea[] = [];

  areaId: number | null = null;
  nodoActual: NodoArea | null = null;
  nodosNivel: NodoArea[] = [];
  breadcrumb: NodoArea[] = [];
  private padrePorId = new Map<number, NodoArea>();

  mostrarHistorial = false;
  historialEventos: HistoricoEvento[] = [];
  cargandoHistorial = false;
  errorHistorial = '';
  pagHistorial = 1;
  porPaginaHistorial = 10;

  private requisicionService = inject(RequisicionService);
  private areaService = inject(AreaService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  protected router = inject(Router);
  private route = inject(ActivatedRoute);

  get esDireccionGeneral(): boolean {
    return this.authService.rol === 'ROLE_DIRECCION_GENERAL';
  }

  get esDireccion(): boolean {
    return this.authService.rol === 'ROLE_DIRECCION';
  }

  get esCoordinacion(): boolean {
    return this.authService.rol === 'ROLE_COORDINACION';
  }

  get esDepartamento(): boolean {
    return this.authService.rol === 'ROLE_DEPARTAMENTO';
  }

  get esMateriales(): boolean {
    return this.authService.rol === 'ROLE_MATERIALES';
  }

  partidaFiltro = '';

  get partidasDisponibles(): string[] {
    const claves = new Set<string>();
    for (const r of this.requisiciones) {
      if (r.estadoGlobal === 'APROBADA') {
        claves.add(r.partidaCodigo ? `${r.partidaCodigo} · ${r.partidaNombre}` : r.partidaNombre);
      }
    }
    return Array.from(claves).sort((a, b) => a.localeCompare(b, 'es'));
  }

  get totalEstimadoMateriales(): number {
    return this.requisicionesFiltradas.reduce(
      (suma, r) => suma + (Number(r.precioEstimado) || 0) * (Number(r.cantidad) || 0),
      0
    );
  }

  cambiarPartida(clave: string): void {
    this.partidaFiltro = clave;
    this.cerrarDetalle();
    this.cdr.markForCheck();
  }

  get titulo(): string {
    if (this.esDireccionGeneral) return 'Solicitudes Recibidas · Dirección General';
    if (this.esDireccion) return 'Solicitudes Recibidas · Dirección';
    if (this.esCoordinacion) return 'Solicitudes Recibidas · Coordinación';
    return 'Mis Solicitudes';
  }

  get requisicionesFiltradas(): Requisicion[] {
    let base = this.requisiciones;
    if (this.esMateriales) {
      base = base.filter((r) => r.estadoGlobal === 'APROBADA');
    }
    if (this.partidaFiltro) {
      base = base.filter((r) => {
        const clave = r.partidaCodigo ? `${r.partidaCodigo} · ${r.partidaNombre}` : r.partidaNombre;
        return clave === this.partidaFiltro;
      });
    }
    if (this.filtro.includes('TODAS')) {
      return base;
    }
    return base.filter((r) => this.filtro.includes(r.estadoGlobal));
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('areaId');
      this.areaId = id ? Number(id) : null;
      this.cerrarDetalle();
      this.cargar();
    });
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    forkJoin({
      requisiciones: this.requisicionService.listar(),
      areas: this.areaService.listar()
    })
      .pipe(finalize(() => {
        this.cargando = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: ({ requisiciones, areas }) => {
          this.requisiciones = requisiciones;
          this.areas = areas;
          if (this.esMateriales) {
            this.vista = 'lista';
          }
          this.armarArbol();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = typeof err.error === 'string' ? err.error : 'No se pudieron cargar las solicitudes. Verifica que el backend esté disponible.';
        }
      });
  }

  cambiarFiltro(filtros: string[]): void {
    this.filtro = filtros;
    this.armarArbol();
  }

  esMiTurno(r: Requisicion): boolean {
    const rol = this.authService.rol;
    if (rol === 'ROLE_COORDINACION') return r.estadoGlobal === 'EN_REVISION_COORD';
    if (rol === 'ROLE_DIRECCION') return r.estadoGlobal === 'EN_REVISION_DIRECCION';
    if (rol === 'ROLE_DIRECCION_GENERAL') return r.estadoGlobal === 'EN_REVISION_DIRECCION_GENERAL';
    return false;
  }

  get esMiTurnoSeleccionada(): boolean {
    const r = this.requisicionSeleccionada;
    return r ? this.esMiTurno(r) : false;
  }

  get puedeModificarSeleccionada(): boolean {
    const r = this.requisicionSeleccionada;
    if (!r) return false;
    const rol = this.authService.rol;
    if (r.estadoGlobal === 'RECHAZADA') return false;
    if (rol === 'ROLE_DEPARTAMENTO') return false;
    if (rol === 'ROLE_COORDINACION') return r.estadoCoord === 'PENDIENTE';
    if (rol === 'ROLE_DIRECCION') return r.estadoDir === 'PENDIENTE';
    if (rol === 'ROLE_DIRECCION_GENERAL') return r.estadoDirGral === 'PENDIENTE';
    return false;
  }

  abrirDetalle(id: number): void {
    this.cargandoDetalle = true;
    this.cdr.markForCheck();
    this.errorDetalle = '';
    this.mensajeAccion = '';
    this.requisicionService
      .obtener(id)
      .pipe(finalize(() => {
        this.cargandoDetalle = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (r) => {
          this.requisicionSeleccionada = r;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.requisicionSeleccionada = null;
          this.errorDetalle = typeof err.error === 'string' ? err.error : 'No se pudo cargar la requisicion. Verifica que el backend esté disponible.';
        }
      });
  }

  cerrarDetalle(): void {
    this.requisicionSeleccionada = null;
    this.cargandoDetalle = false;
    this.errorDetalle = '';
    this.mensajeAccion = '';
    this.mostrarRechazo = false;
    this.justificacionRechazo = '';
    this.editando = false;
  }

  aprobar(): void {
    const r = this.requisicionSeleccionada;
    if (!r) return;
    this.requisicionService.aprobar(r.id).subscribe({
      next: (actualizada) => {
        this.actualizarLista(actualizada);
        this.mensajeAccion = `Requisición ${actualizada.folio} aprobada en tu nivel.`;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.errorDetalle = err.error ?? 'No se pudo aprobar la requisicion.';
        this.cdr.markForCheck();
      }
    });
  }

  abrirRechazo(): void {
    this.mostrarRechazo = true;
    this.justificacionRechazo = '';
    this.errorDetalle = '';
  }

  cerrarRechazo(): void {
    this.mostrarRechazo = false;
  }

  confirmarRechazo(): void {
    const r = this.requisicionSeleccionada;
    if (!r) return;
    if (!this.justificacionRechazo.trim()) {
      this.errorDetalle = 'Debes capturar una justificacion para rechazar.';
      return;
    }
    this.requisicionService.rechazar(r.id, this.justificacionRechazo.trim()).subscribe({
      next: (actualizada) => {
        this.actualizarLista(actualizada);
        this.mostrarRechazo = false;
        this.mensajeAccion = `Requisición ${actualizada.folio} rechazada.`;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.errorDetalle = err.error ?? 'No se pudo rechazar la requisicion.';
        this.cdr.markForCheck();
      }
    });
  }

  iniciarEdicion(): void {
    const r = this.requisicionSeleccionada;
    if (!r) return;
    this.editando = true;
    this.editForm = this.fb.group({
      material: [r.material, Validators.required],
      cantidad: [r.cantidad, [Validators.required, Validators.min(1)]],
      unidad: [r.unidad, Validators.required],
      precioEstimado: [r.precioEstimado, [Validators.required, Validators.min(0.01)]],
      descripcion: [r.descripcion],
      justificacion: [r.justificacion, Validators.required],
      sugerencias: this.fb.array((r.sugerencias ?? []).map((s) => this.fb.group({
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
      enlaceUrl: ['', [Validators.pattern(URL_PATRON)]],
      archivoPdfNombre: [null],
      archivoPdfUrl: [null]
    }));
  }

  eliminarSugerenciaEdit(i: number): void {
    this.sugerencias.removeAt(i);
  }

  cancelarEdicion(): void {
    this.editando = false;
  }

  guardarEdicion(): void {
    const r = this.requisicionSeleccionada;
    if (!r) return;
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      this.errorDetalle = 'Corrige los campos marcados en la edición (longitudes, URL o precios).';
      this.cdr.markForCheck();
      return;
    }
    const f = this.editForm.value;
    const sugerencias: Sugerencia[] = (f.sugerencias ?? []).map((s: any) => ({
      marca: s.marca,
      modelo: s.modelo,
      precioEstimado: Number(s.precioEstimado) || 0,
      enlaceUrl: s.enlaceUrl,
      archivoPdfNombre: s.archivoPdfNombre ?? null,
      archivoPdfUrl: s.archivoPdfUrl ?? null
    }));
    this.requisicionService.modificar(r.id, {
      material: f.material,
      cantidad: Number(f.cantidad),
      unidad: f.unidad,
      precioEstimado: Number(f.precioEstimado),
      descripcion: f.descripcion ?? '',
      justificacion: f.justificacion,
      sugerencias
    }).subscribe({
      next: (actualizada) => {
        this.actualizarLista(actualizada);
        this.editando = false;
        this.mensajeAccion = `Requisición ${actualizada.folio} modificada. Los cambios quedaron registrados en la bitacora.`;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.errorDetalle = err.error ?? 'No se pudo modificar la requisicion.';
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
        this.errorDetalle = 'No se pudo abrir el PDF. Verifica tu sesion o que el archivo exista.';
        this.cdr.markForCheck();
      }
    });
  }

  verHistorial(id: number): void {
    this.router.navigate(['/historial-eventos', id]);
  }

  iconoNivel(nivel: string): string {
    switch (nivel) {
      case 'DIRECCION_GENERAL': return 'bi-bank';
      case 'DIRECCION': return 'bi-building';
      case 'COORDINACION': return 'bi-people-fill';
      default: return 'bi-diagram-3';
    }
  }

  etiquetaNivel(nivel: string): string {
    switch (nivel) {
      case 'DIRECCION_GENERAL': return 'Dir. General';
      case 'DIRECCION': return 'Dirección';
      case 'COORDINACION': return 'Coordinación';
      default: return 'Departamento';
    }
  }

  nivelClaseArbol(nivel: string): string {
    switch (nivel) {
      case 'DIRECCION_GENERAL': return 'dg';
      case 'DIRECCION': return 'dir';
      case 'COORDINACION': return 'coord';
      default: return 'depto';
    }
  }

  textoTotal(total: number): string {
    return total === 1 ? '1 requerimiento' : `${total} requerimientos`;
  }

  private armarArbol(): void {
    const visibles = this.requisicionesFiltradas;
    const porId = new Map<number, NodoArea>();
    const areaPorNombre = new Map<string, NodoArea>();
    this.padrePorId.clear();
    for (const a of this.areas) {
      const nodo: NodoArea = { area: a, hijos: [], requisiciones: [], total: 0, expandido: false };
      porId.set(a.id, nodo);
      areaPorNombre.set(a.nombre, nodo);
    }
    const raices: NodoArea[] = [];
    for (const nodo of porId.values()) {
      const padre = nodo.area.parentId != null ? porId.get(nodo.area.parentId) : undefined;
      if (padre) {
        padre.hijos.push(nodo);
        this.padrePorId.set(nodo.area.id, padre);
      } else {
        raices.push(nodo);
      }
    }
    const sinArea = new Map<string, Requisicion[]>();
    for (const r of visibles) {
      const nodo = areaPorNombre.get(r.area);
      if (nodo) {
        nodo.requisiciones.push(r);
      } else {
        const grupo = sinArea.get(r.area) ?? [];
        grupo.push(r);
        sinArea.set(r.area, grupo);
      }
    }
    sinArea.forEach((reqs, nombre) => {
      raices.push({
        area: { id: -1, nombre, nivel: 'DEPARTAMENTO', parentId: null, activo: true },
        hijos: [],
        requisiciones: reqs,
        total: 0,
        expandido: false
      });
    });

    const rankNivel = (nivel: string): number =>
      nivel === 'DIRECCION_GENERAL' ? 3 : nivel === 'DIRECCION' ? 2 : nivel === 'COORDINACION' ? 1 : 0;
    const ordenar = (lista: NodoArea[]): NodoArea[] =>
      lista.sort((a, b) => {
        const dif = rankNivel(b.area.nivel) - rankNivel(a.area.nivel);
        return dif !== 0 ? dif : a.area.nombre.localeCompare(b.area.nombre, 'es');
      });
    const preparar = (nodo: NodoArea): number => {
      nodo.hijos = ordenar(nodo.hijos);
      let total = nodo.requisiciones.length;
      const hijosVisibles: NodoArea[] = [];
      for (const h of nodo.hijos) {
        const sub = preparar(h);
        if (sub > 0) {
          hijosVisibles.push(h);
        }
        total += sub;
      }
      nodo.hijos = hijosVisibles;
      nodo.total = total;
      return total;
    };

    ordenar(raices);
    for (const r of raices) {
      preparar(r);
    }
    const activos = raices.filter((r) => r.total > 0);
    activos.forEach((r) => {
      r.expandido = true;
    });
    this.nodosRaiz = activos;
    this.reconstruirNivel();
  }

  get requisicionesNodo(): Requisicion[] {
    return this.nodoActual?.requisiciones ?? [];
  }

  irA(n: NodoArea): void {
    this.cerrarDetalle();
    this.router.navigate(['/bandeja-solicitudes/area', n.area.id]);
  }

  irInicio(): void {
    this.cerrarDetalle();
    this.router.navigate(['/bandeja-solicitudes']);
  }

  private reconstruirNivel(): void {
    this.nodoActual = null;
    this.nodosNivel = [];
    this.breadcrumb = [];

    if (this.areaId != null) {
      const nodo = this.buscarNodoPorId(this.nodosRaiz, this.areaId);
      if (!nodo) {
        this.router.navigate(['/bandeja-solicitudes'], { replaceUrl: true });
        return;
      }
      this.nodoActual = nodo;
      this.nodosNivel = nodo.hijos;
      this.breadcrumb = this.rutaHasta(nodo);
      return;
    }

    const nombreArea = this.authService.usuario?.area ?? null;
    const miNodo = nombreArea ? this.buscarNodoPorNombre(this.nodosRaiz, nombreArea) : null;
    if (miNodo) {
      this.nodosNivel = miNodo.hijos;
      this.breadcrumb = [miNodo];
      return;
    }

    const dg = this.nodosRaiz.find((r) => r.area.nivel === 'DIRECCION_GENERAL');
    this.nodosNivel = dg ? dg.hijos : this.nodosRaiz;
    this.breadcrumb = dg ? [dg] : [];
  }

  private rutaHasta(nodo: NodoArea): NodoArea[] {
    const ruta: NodoArea[] = [];
    let actual: NodoArea | null = nodo;
    let pasos = 0;
    while (actual && pasos < 64) {
      ruta.unshift(actual);
      actual = this.padrePorId.get(actual.area.id) ?? null;
      pasos++;
    }
    return ruta;
  }

  private buscarNodoPorId(nodos: NodoArea[], id: number): NodoArea | null {
    for (const n of nodos) {
      if (n.area.id === id) return n;
      const sub = this.buscarNodoPorId(n.hijos, id);
      if (sub) return sub;
    }
    return null;
  }

  private buscarNodoPorNombre(nodos: NodoArea[], nombre: string): NodoArea | null {
    for (const n of nodos) {
      if (n.area.nombre === nombre) return n;
      const sub = this.buscarNodoPorNombre(n.hijos, nombre);
      if (sub) return sub;
    }
    return null;
  }

  abrirHistorial(): void {
    const r = this.requisicionSeleccionada;
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

  private actualizarLista(actualizada: Requisicion): void {
    this.requisicionSeleccionada = actualizada;
    this.requisiciones = this.requisiciones.map((r) => (r.id === actualizada.id ? actualizada : r));
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

  estadoGlobalEtiqueta(): string {
    return this.requisicionSeleccionada?.estadoGlobal.replaceAll('_', ' ') ?? '';
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

  verDetalle(id: number): void {
    this.abrirDetalle(id);
  }

  formatMoney(v: number | undefined): string {
    return (Number(v) ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }
}