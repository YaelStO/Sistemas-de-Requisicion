import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { RequisicionService, Requisicion } from '../../services/requisicion.service';
import { CatalogoService } from '../../services/catalogo.service';
import { Partida } from '../../models/partida.model';
import { SidebarComponent } from '../sidebar/sidebar.component';

type Vista = 'aprobadas' | 'autorizar' | 'proceso';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

interface TotalPartida {
  codigo: string;
  nombre: string;
  total: number;
  cantidad: number;
}

@Component({
  selector: 'app-materiales',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './materiales.component.html',
  styleUrl: './materiales.component.scss'
})
export class MaterialesComponent implements OnInit {
  vista: Vista = 'aprobadas';

  requisiciones: Requisicion[] = [];
  partidas: Partida[] = [];
  cargando = true;
  error = '';
  mensaje = '';

  mesSeleccionado = '';
  mesEdit: Record<number, string> = {};

  partidaFiltro = '';

  autorizarTarget: Requisicion | null = null;
  proveedor = '';
  costoTipo: 'SUGERENCIA' | 'PROPIO' = 'SUGERENCIA';
  sugerenciaElegida: number | null = null;
  costoPropio: number | null = null;

  mostrarCambioMes = false;
  cambioMesTarget: Requisicion | null = null;
  mesNuevo = '';
  justificacionCambioMes = '';

  mostrarModificarPartida = false;
  modificarPartidaTarget: Requisicion | null = null;
  partidaNueva: Partida | undefined;

  guardando = false;

  private requisicionService = inject(RequisicionService);
  private catalogoService = inject(CatalogoService);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  private partidaPorId = new Map<number, Partida>();

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      this.vista = (data['vista'] ?? 'aprobadas') as Vista;
      this.partidaFiltro = '';
      this.cargar();
    });
    if (this.partidaPorId.size === 0) {
      this.catalogoService.getPartidas().subscribe({
        next: (ps) => {
          this.partidas = ps;
          for (const p of ps) {
            this.partidaPorId.set(p.id, p);
          }
          this.cdr.markForCheck();
        },
        error: () => undefined
      });
    }
  }

  get titulo(): string {
    if (this.vista === 'autorizar') {
      return `Autorizar Compra · ${this.autorizarTarget?.folio ?? ''}`;
    }
    return this.vista === 'proceso'
      ? 'En Proceso de Compra'
      : 'Requisiciones Aprobadas · Materiales';
  }

  get subtitulo(): string {
    if (this.vista === 'autorizar') {
      return 'Revisa quién solicita, la justificación y decide entre usar una sugerencia o un costo propio';
    }
    return this.vista === 'proceso'
      ? 'Seguimiento de materiales autorizados para compra hasta su entrega'
      : 'Materiales aprobados por Dirección General, listos para adjudicar la compra';
  }

  /** En la vista de aprobadas se cuentan las pendientes; en proceso, las autorizadas. */
  get baseMes(): Requisicion[] {
    if (this.vista === 'proceso') {
      return this.requisiciones.filter((r) => r.estadoMateriales === 'APROBADO');
    }
    return this.requisiciones.filter((r) => r.estadoMateriales === 'PENDIENTE');
  }

  get meses(): string[] {
    const set = new Set(this.baseMes.map((r) => r.mesCompra));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }

  private get baseMesDelMes(): Requisicion[] {
    if (!this.mesSeleccionado) {
      return this.baseMes;
    }
    return this.baseMes.filter((r) => r.mesCompra === this.mesSeleccionado);
  }

  clavePartida(r: Requisicion): string {
    return r.partidaCodigo ? `${r.partidaCodigo} · ${r.partidaNombre}` : (r.partidaNombre || 'Sin partida');
  }

  get partidasDisponibles(): string[] {
    const set = new Set(this.baseMesDelMes.map((r) => this.clavePartida(r)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }

  get requisicionesMes(): Requisicion[] {
    const base = this.baseMesDelMes;
    if (!this.partidaFiltro) {
      return base;
    }
    return base.filter((r) => this.clavePartida(r) === this.partidaFiltro);
  }

  cantidadDeMes(mes: string): number {
    return this.baseMes.filter((r) => r.mesCompra === mes).length;
  }

  get totalMes(): number {
    return this.requisicionesMes.reduce(
      (s, r) => s + (Number(r.precioEstimado) || 0) * (Number(r.cantidad) || 0),
      0
    );
  }

  /** Total estimado del gasto de la partida en que se está filtrando. */
  get totalPartidaFiltrada(): number {
    if (!this.partidaFiltro) {
      return 0;
    }
    return this.requisicionesMes.reduce(
      (s, r) => s + (Number(r.precioEstimado) || 0) * (Number(r.cantidad) || 0),
      0
    );
  }

  get totalesPorPartida(): TotalPartida[] {
    const mapa = new Map<string, TotalPartida>();
    for (const r of this.requisicionesMes) {
      const clave = this.clavePartida(r);
      const e = mapa.get(clave) ?? {
        codigo: r.partidaCodigo || '',
        nombre: r.partidaNombre || 'Sin partida',
        total: 0,
        cantidad: 0
      };
      e.total += (Number(r.precioEstimado) || 0) * (Number(r.cantidad) || 0);
      e.cantidad += Number(r.cantidad) || 0;
      mapa.set(clave, e);
    }
    return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
  }

  partidaActual(r: Requisicion): Partida | undefined {
    return this.partidas.find((p) => p.codigo === r.partidaCodigo && p.nombre === r.partidaNombre);
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.mensaje = '';
    this.requisicionService.listarMateriales().subscribe({
      next: (data) => {
        this.requisiciones = [];
        for (const r of data) {
          this.requisiciones.push(r);
          if (this.mesEdit[r.id] === undefined) {
            this.mesEdit[r.id] = r.mesCompra;
          }
        }
        const meses = this.meses;
        if (!meses.includes(this.mesSeleccionado)) {
          this.mesSeleccionado = meses[0] ?? '';
        }
        if (this.partidaFiltro && !this.partidasDisponibles.includes(this.partidaFiltro)) {
          this.partidaFiltro = '';
        }
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.cargando = false;
        this.error = typeof err.error === 'string'
          ? err.error
          : 'No se pudieron cargar los materiales. Verifica que el backend esté disponible.';
        this.cdr.markForCheck();
      }
    });
  }

  // ===== Partida: botón Modificar =====

  abrirModificarPartida(r: Requisicion): void {
    this.modificarPartidaTarget = r;
    this.partidaNueva = this.partidaActual(r);
    this.error = '';
    this.mostrarModificarPartida = true;
    this.cdr.markForCheck();
  }

  cancelarModificarPartida(): void {
    this.mostrarModificarPartida = false;
    this.modificarPartidaTarget = null;
    this.partidaNueva = undefined;
  }

  confirmarModificarPartida(): void {
    const r = this.modificarPartidaTarget;
    const p = this.partidaNueva;
    if (!r) {
      return;
    }
    if (!p) {
      this.error = 'Selecciona una partida para clasificar el gasto.';
      this.cdr.markForCheck();
      return;
    }
    if (p.codigo === r.partidaCodigo && p.nombre === r.partidaNombre) {
      this.error = 'La partida seleccionada es la misma; elige una diferente.';
      this.cdr.markForCheck();
      return;
    }
    this.guardando = true;
    this.cdr.markForCheck();
    this.requisicionService.reasignarPartida(r.id, p.codigo, p.nombre).subscribe({
      next: (actualizada) => {
        this.guardando = false;
        this.mostrarModificarPartida = false;
        this.modificarPartidaTarget = null;
        this.mensaje = `Req ${actualizada.folio}: gasto clasificado en la partida ${p.codigo}.`;
        this.cargar();
      },
      error: (err) => {
        this.guardando = false;
        this.error = typeof err.error === 'string' ? err.error : 'No se pudo modificar la partida.';
        this.cdr.markForCheck();
      }
    });
  }

  // ===== Avance de compra =====

  registrarCompra(r: Requisicion): void {
    this.requisicionService.marcarComprado(r.id).subscribe({
      next: (actualizada) => {
        this.mensaje = `Req ${actualizada.folio}: compra registrada.`;
        this.cargar();
      },
      error: (err) => {
        this.error = typeof err.error === 'string' ? err.error : 'No se pudo registrar la compra.';
        this.cdr.markForCheck();
      }
    });
  }

  entregarMaterial(r: Requisicion): void {
    this.requisicionService.marcarEntregado(r.id).subscribe({
      next: (actualizada) => {
        this.mensaje = `Req ${actualizada.folio}: material entregado.`;
        this.cargar();
      },
      error: (err) => {
        this.error = typeof err.error === 'string' ? err.error : 'No se pudo marcar el material como entregado.';
        this.cdr.markForCheck();
      }
    });
  }

  solicitarCambioMes(r: Requisicion, valor: string): void {
    if (!valor || valor === r.mesCompra) {
      this.mesEdit[r.id] = r.mesCompra;
      return;
    }
    if (this.mesBloqueado(valor)) {
      this.mesEdit[r.id] = r.mesCompra;
      this.error = `No se pueden programar compras en ${this.nombreMesBloqueado(valor)}; elige otro mes.`;
      this.cdr.markForCheck();
      return;
    }
    this.cambioMesTarget = r;
    this.mesNuevo = valor;
    this.justificacionCambioMes = '';
    this.error = '';
    this.mostrarCambioMes = true;
    this.cdr.markForCheck();
  }

  cancelarCambioMes(): void {
    if (this.cambioMesTarget) {
      this.mesEdit[this.cambioMesTarget.id] = this.cambioMesTarget.mesCompra;
    }
    this.mostrarCambioMes = false;
    this.cambioMesTarget = null;
  }

  confirmarCambioMes(): void {
    const r = this.cambioMesTarget;
    if (!r) {
      return;
    }
    if (!this.justificacionCambioMes.trim()) {
      this.error = 'Debes indicar el motivo del cambio de mes de compra.';
      this.cdr.markForCheck();
      return;
    }
    this.guardando = true;
    this.cdr.markForCheck();
    this.requisicionService.reasignarMes(r.id, this.mesNuevo, this.justificacionCambioMes.trim()).subscribe({
      next: (actualizada) => {
        this.guardando = false;
        this.mostrarCambioMes = false;
        this.cambioMesTarget = null;
        this.mesEdit[actualizada.id] = actualizada.mesCompra;
        this.mensaje = `Req ${actualizada.folio}: mes de compra asignado a ${this.mesLabel(actualizada.mesCompra)}. Se notificó al solicitante y a la Dirección General.`;
        this.cargar();
      },
      error: (err) => {
        this.guardando = false;
        this.mesEdit[r.id] = r.mesCompra;
        this.error = typeof err.error === 'string' ? err.error : 'No se pudo reasignar el mes de compra.';
        this.cdr.markForCheck();
      }
    });
  }

  // ===== Autorización de compra (pestaña de revisión) =====

  abrirAutorizar(r: Requisicion): void {
    if (this.mesBloqueado(r.mesCompra)) {
      this.error = `La Req ${r.folio} está programada para ${this.mesLabel(r.mesCompra)}, mes bloqueado para compras. Mueve el mes de compra antes de autorizar.`;
      this.cdr.markForCheck();
      return;
    }
    this.autorizarTarget = r;
    this.proveedor = r.proveedor ?? '';
    this.error = '';
    this.mensaje = '';
    if (r.sugerencias.length > 0) {
      this.costoTipo = 'SUGERENCIA';
      this.sugerenciaElegida = r.sugerencias[0].id ?? null;
    } else {
      this.costoTipo = 'PROPIO';
      this.sugerenciaElegida = null;
    }
    this.costoPropio = null;
    this.vista = 'autorizar';
    this.cdr.markForCheck();
  }

  volverAprobadas(): void {
    this.vista = 'aprobadas';
    this.autorizarTarget = null;
  }

  confirmarAutorizar(): void {
    const r = this.autorizarTarget;
    if (!r) {
      return;
    }
    let sugerenciaId: number | null = null;
    let costoPropio: number | null = null;
    if (this.costoTipo === 'SUGERENCIA') {
      if (this.sugerenciaElegida == null) {
        this.error = 'Selecciona una de las sugerencias del solicitante.';
        this.cdr.markForCheck();
        return;
      }
      sugerenciaId = this.sugerenciaElegida;
    } else {
      if (!this.costoPropio || this.costoPropio <= 0) {
        this.error = 'Indica el costo propio para la compra.';
        this.cdr.markForCheck();
        return;
      }
      costoPropio = this.costoPropio;
    }
    this.guardando = true;
    this.error = '';
    this.cdr.markForCheck();
    this.requisicionService.autorizarCompra(r.id, this.proveedor.trim(), sugerenciaId, costoPropio).subscribe({
      next: (actualizada) => {
        this.guardando = false;
        this.autorizarTarget = null;
        this.mensaje = `Req ${actualizada.folio}: compra autorizada. Pasó a En Proceso de Compra.`;
        this.vista = 'proceso';
        this.cargar();
      },
      error: (err) => {
        this.guardando = false;
        this.error = typeof err.error === 'string' ? err.error : 'No se pudo autorizar la compra.';
        this.cdr.markForCheck();
      }
    });
  }

  // ===== Exportación a Excel (sin sugerencias) =====

  exportarExcel(): void {
    const filas = this.requisicionesMes;
    if (filas.length === 0) {
      this.error = 'No hay registros que exportar para esta vista.';
      this.cdr.markForCheck();
      return;
    }
    const cab = this.vista === 'proceso'
      ? ['No. Requisición', 'Solicitante', 'Departamento', 'Material', 'Cantidad', 'Unidad',
         'Partida', 'Mes de compra', 'Precio est. unit.', 'Total', 'Justificación', 'Proveedor', 'Avance']
      : ['No. Requisición', 'Solicitante', 'Departamento', 'Material', 'Cantidad', 'Unidad',
         'Partida', 'Mes de compra', 'Precio est. unit.', 'Total', 'Justificación', 'Estado'];
    const filasTexto = filas.map((r) => {
      const total = (Number(r.precioEstimado) || 0) * (Number(r.cantidad) || 0);
      const avance = this.vista === 'proceso'
        ? this.compraLabel(r.estadoCompra)
        : this.estadoMaterialesLabel(r.estadoMateriales);
      return [
        r.folio,
        r.nombreSolicitante,
        r.area,
        r.material,
        Number(r.cantidad) || 0,
        r.unidad ?? '',
        this.clavePartida(r),
        this.mesLabel(r.mesCompra),
        Number(r.precioEstimado) || 0,
        total,
        r.justificacion ?? '',
        ...(this.vista === 'proceso' ? [r.proveedor || '', avance] : [avance])
      ];
    });
    filasTexto.push([
      '', '', '', 'TOTAL', '',
      '', '', '', '',
      filas.reduce((s, r) => s + (Number(r.precioEstimado) || 0) * (Number(r.cantidad) || 0), 0),
      '',
      ...(this.vista === 'proceso' ? ['', ''] : [''])
    ]);
    const escapar = (v: string | number) => {
      const t = String(v).replace(/"/g, '""');
      return `"${t}"`;
    };
    const csv = [cab, ...filasTexto].map((f) => f.map(escapar).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `materiales_${this.vista}_${this.mesSeleccionado || 'todos'}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    this.mensaje = `Exportado ${filas.length} registro(s) a Excel (sin incluir sugerencias).`;
    this.cdr.markForCheck();
  }

  estadoClaseMateriales(estado: string): string {
    switch (estado) {
      case 'APROBADO': return 'process';
      case 'RECHAZADO': return 'rejected';
      case 'PENDIENTE': return 'pending';
      default: return 'na';
    }
  }

  estadoMaterialesLabel(estado: string): string {
    switch (estado) {
      case 'APROBADO': return 'En compra';
      case 'RECHAZADO': return 'No comprar';
      case 'PENDIENTE': return 'Por adjudicar';
      default: return estado.replaceAll('_', ' ');
    }
  }

  compraClase(estado: string | undefined): string {
    switch (estado) {
      case 'EN_COMPRA': return 'process';
      case 'COMPRADO': return 'pending';
      case 'ENTREGADO': return 'completed';
      default: return 'na';
    }
  }

  compraLabel(estado: string | undefined): string {
    switch (estado) {
      case 'EN_COMPRA': return 'En compra';
      case 'COMPRADO': return 'Comprado';
      case 'ENTREGADO': return 'Entregado';
      default: return '—';
    }
  }

  /** Diciembre y enero están bloqueados para compras. */
  mesBloqueado(mes: string): boolean {
    if (!mes || mes.length < 7) {
      return false;
    }
    const mesNum = mes.substring(5, 7);
    return mesNum === '12' || mesNum === '01';
  }

  nombreMesBloqueado(mes: string): string {
    if (mes && mes.length >= 7) {
      return mes.substring(5, 7) === '12' ? 'diciembre' : 'enero';
    }
    return 'ese mes';
  }

  mesLabel(mes: string): string {
    if (!mes || mes.length < 7) {
      return 'Sin mes';
    }
    const [anio, mesNum] = mes.split('-');
    const idx = Number(mesNum) - 1;
    return `${MESES[idx] ?? mesNum} ${anio}`;
  }

  formatMoney(v: number | undefined): string {
    return (Number(v) ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }
}