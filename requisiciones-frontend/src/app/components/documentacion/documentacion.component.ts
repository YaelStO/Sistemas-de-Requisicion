import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { RequisicionService, Requisicion } from '../../services/requisicion.service';
import { AreaService, Area } from '../../services/area.service';
import { AuthService } from '../../services/auth.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import type * as Docx from 'docx';

/** Tasa de IVA aplicada al documento de documentación. */
const TASA_IVA = 0.16;

/** Tamaño carta en pulgadas: 8.5 x 11. */
const CARTA_ANCHO_IN = 8.5;
const CARTA_ALTO_IN = 11;

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/** Una fila de la tabla del documento. */
export interface LineaDocumento {
  requisicion: Requisicion;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  /** El precio unitario proviene del costo adjudicado, no del estimado. */
  precioAdjudicado: boolean;
}

/** Documento de documentación de una sola Dirección. */
export interface DocumentoDireccion {
  clave: string;
  direccion: string;
  lineas: LineaDocumento[];
  subtotal: number;
  iva: number;
  total: number;
}

@Component({
  selector: 'app-documentacion',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './documentacion.component.html',
  styleUrl: './documentacion.component.scss'
})
export class DocumentacionComponent implements OnInit {
  readonly tasaIva = TASA_IVA;

  cargando = true;
  error = '';
  mensaje = '';

  requisiciones: Requisicion[] = [];
  areas: Area[] = [];

  documentos: DocumentoDireccion[] = [];
  documentoActivo: DocumentoDireccion | null = null;

  mesSeleccionado = '';
  partidaFiltro = '';

  /** Pedido de corrección de la justificación, abierto sobre una requisición. */
  correccionTarget: Requisicion | null = null;
  correccionComentario = '';
  guardando = false;
  exporting = false;

  private requisicionService = inject(RequisicionService);
  private areaService = inject(AreaService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.cargar();
  }

  // ===== CARGA Y AGRUPACIÓN =====

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.mensaje = '';
    forkJoin({
      requisiciones: this.requisicionService.listarMateriales(),
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
          if (!this.meses.includes(this.mesSeleccionado)) {
            this.mesSeleccionado = '';
          }
          this.agrupar();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = typeof err.error === 'string'
            ? err.error
            : 'No se pudieron cargar las requisiciones autorizadas. Verifica que el backend esté disponible.';
          this.cdr.markForCheck();
        }
      });
  }

  /** Sólo las compras ya autorizadas por Materiales entran a la documentación. */
  get autorizadas(): Requisicion[] {
    return this.requisiciones.filter((r) => r.estadoMateriales === 'APROBADO');
  }

  get meses(): string[] {
    const set = new Set(this.autorizadas.map((r) => r.mesCompra).filter((m) => !!m));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }

  private get baseMes(): Requisicion[] {
    if (!this.mesSeleccionado) {
      return this.autorizadas;
    }
    return this.autorizadas.filter((r) => r.mesCompra === this.mesSeleccionado);
  }

  get partidasDisponibles(): string[] {
    const set = new Set(this.baseMes.map((r) => this.clavePartida(r)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }

  clavePartida(r: Requisicion): string {
    return r.partidaCodigo ? `${r.partidaCodigo} · ${r.partidaNombre}` : (r.partidaNombre || 'Sin partida');
  }

  cambiarMes(mes: string): void {
    this.mesSeleccionado = mes;
    if (this.partidaFiltro && !this.partidasDisponibles.includes(this.partidaFiltro)) {
      this.partidaFiltro = '';
    }
    this.agrupar();
    this.cdr.markForCheck();
  }

  cambiarPartida(clave: string): void {
    this.partidaFiltro = clave;
    this.agrupar();
    this.cdr.markForCheck();
  }

  /**
   * Un documento por Dirección. Cada requisición pertenece a la Dirección que
   * aparece en su cadena de autorización, sin importar si la pidió la Dirección
   * misma o alguno de sus Departamentos.
   */
  private agrupar(): void {
    const base = this.partidaFiltro
      ? this.baseMes.filter((r) => this.clavePartida(r) === this.partidaFiltro)
      : this.baseMes;

    const porClave = new Map<string, DocumentoDireccion>();
    for (const r of base) {
      const clave = this.claveDireccion(r);
      const nombre = this.nombreDireccion(r);
      let doc = porClave.get(clave);
      if (!doc) {
        doc = { clave, direccion: nombre, lineas: [], subtotal: 0, iva: 0, total: 0 };
        porClave.set(clave, doc);
      }
      const precioUnitario = Number(r.precioCompra ?? r.precioEstimado) || 0;
      const cantidad = Number(r.cantidad) || 0;
      const linea: LineaDocumento = {
        requisicion: r,
        descripcion: (r.descripcion || r.material || '').trim(),
        unidad: r.unidad || '',
        cantidad,
        precioUnitario,
        subtotal: precioUnitario * cantidad,
        precioAdjudicado: r.precioCompra != null
      };
      doc.lineas.push(linea);
    }

    const lista = Array.from(porClave.values());
    for (const d of lista) {
      d.lineas.sort((a, b) => a.requisicion.folio.localeCompare(b.requisicion.folio, 'es'));
      d.subtotal = d.lineas.reduce((s, l) => s + l.subtotal, 0);
      d.iva = d.subtotal * TASA_IVA;
      d.total = d.subtotal + d.iva;
    }
    lista.sort((a, b) => a.direccion.localeCompare(b.direccion, 'es'));
    this.documentos = lista;

    const actual = this.documentoActivo;
    this.documentoActivo = (actual && lista.find((d) => d.clave === actual.clave)) ?? lista[0] ?? null;
  }

  /** Identidad estable de la Dirección, por id cuando la requisición lo trae. */
  private claveDireccion(r: Requisicion): string {
    if (r.dirAreaId != null) {
      return `dir-${r.dirAreaId}`;
    }
    if (r.dirArea) {
      return `dir-nombre-${r.dirArea}`;
    }
    if (this.areas.some((a) => a.nombre === r.area && a.nivel === 'DIRECCION')) {
      return `dir-nombre-${r.area}`;
    }
    return 'dir-sin-asignar';
  }

  private nombreDireccion(r: Requisicion): string {
    if (r.dirArea) {
      return r.dirArea;
    }
    if (r.dirAreaId != null) {
      const porId = this.areas.find((a) => a.id === r.dirAreaId);
      if (porId) {
        return porId.nombre;
      }
    }
    if (this.areas.some((a) => a.nombre === r.area && a.nivel === 'DIRECCION')) {
      return r.area;
    }
    return 'Sin Dirección asignada';
  }

  seleccionar(doc: DocumentoDireccion): void {
    this.documentoActivo = doc;
    this.cdr.markForCheck();
  }

  get correccionesPendientes(): number {
    return this.autorizadas.filter((r) => r.correccionPendiente).length;
  }

  // ===== PEDIDO DE CORRECCIÓN =====

  abrirCorreccion(r: Requisicion): void {
    this.correccionTarget = r;
    this.correccionComentario = '';
    this.error = '';
    this.cdr.markForCheck();
  }

  cerrarCorreccion(): void {
    this.correccionTarget = null;
    this.correccionComentario = '';
  }

  confirmarCorreccion(): void {
    const r = this.correccionTarget;
    if (!r) {
      return;
    }
    if (!this.correccionComentario.trim()) {
      this.error = 'Describe qué corrección necesitas en la justificación.';
      this.cdr.markForCheck();
      return;
    }
    this.guardando = true;
    this.error = '';
    this.cdr.markForCheck();
    this.requisicionService.pedirCorreccion(r.id, this.correccionComentario.trim()).subscribe({
      next: (actualizada) => {
        this.guardando = false;
        this.correccionTarget = null;
        this.requisiciones = this.requisiciones.map((x) => (x.id === actualizada.id ? actualizada : x));
        this.mensaje = `Req ${actualizada.folio}: se solicitó corregir la justificación al área solicitante.`;
        this.agrupar();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.guardando = false;
        this.error = typeof err.error === 'string' ? err.error : 'No se pudo solicitar la corrección.';
        this.cdr.markForCheck();
      }
    });
  }

  // ===== DOCUMENTO: IMPRESIÓN, PDF Y DOCX =====

  get nombreArchivo(): string {
    const d = this.documentoActivo;
    if (!d) {
      return 'documentacion';
    }
    const base = d.direccion.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_');
    const mes = this.mesSeleccionado || 'todos';
    return `documentacion_${base}_${mes}`;
  }

  get tituloDocumento(): string {
    return this.documentoActivo?.direccion ?? '';
  }

  get periodo(): string {
    return this.mesSeleccionado ? this.mesLabel(this.mesSeleccionado) : 'Acumulado';
  }

  get puedeExportar(): boolean {
    return !!this.documentoActivo && this.documentoActivo.lineas.length > 0;
  }

  get authNombreSolicitante(): string {
    return this.authService.usuario?.nombreCompleto ?? '';
  }

  /** La hoja impresa es tamaño carta con márgenes de 2 cm. */
  private readonly margenes = { top: 56, right: 56, bottom: 56, left: 56 };

  imprimir(): void {
    if (!this.puedeExportar) {
      return;
    }
    window.print();
  }

  async exportarPdf(): Promise<void> {
    const doc = this.documentoActivo;
    if (!doc || this.exporting) {
      return;
    }
    this.exporting = true;
    this.error = '';
    this.cdr.markForCheck();
    try {
      // Importación diferida: mantiene jspdf fuera del bundle inicial.
      const { jsPDF } = await import('jspdf');
      const pdf = this.construirPdf(new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' }));
      pdf.save(`${this.nombreArchivo}.pdf`);
      this.mensaje = 'Documento exportado a PDF (tamaño carta).';
    } catch {
      this.error = 'No se pudo generar el PDF. Intenta de nuevo.';
    } finally {
      this.exporting = false;
      this.cdr.markForCheck();
    }
  }

  async exportarDocx(): Promise<void> {
    const doc = this.documentoActivo;
    if (!doc || this.exporting) {
      return;
    }
    this.exporting = true;
    this.error = '';
    this.cdr.markForCheck();
    try {
      // Importación diferida: mantiene docx fuera del bundle inicial.
      const d = await import('docx');
      const documento = this.construirDocx(d);
      const blob = await d.Packer.toBlob(documento);
      this.descargar(blob, `${this.nombreArchivo}.docx`);
      this.mensaje = 'Documento exportado a DOCX (tamaño carta).';
    } catch {
      this.error = 'No se pudo generar el DOCX. Intenta de nuevo.';
    } finally {
      this.exporting = false;
      this.cdr.markForCheck();
    }
  }

  private descargar(blob: Blob, nombre: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  // ---------- PDF (dibujo vectorial, tamaño carta) ----------

  private construirPdf(pdf: any): any {
    const doc = this.documentoActivo!;
    const ancho = CARTA_ANCHO_IN * 72;
    const alto = CARTA_ALTO_IN * 72;
    const m = this.margenes;
    const util = ancho - m.left - m.right;

    let y = m.top;
    const guinda: [number, number, number] = [91, 18, 37];
    const gris: [number, number, number] = [90, 90, 90];
    const crema: [number, number, number] = [251, 243, 213];

    const pie = () => {
      const total = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        pdf.setPage(i);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(...gris);
        pdf.text(
          `${this.tituloDocumento} · ${this.periodo} · Página ${i} de ${total}`,
          ancho / 2,
          alto - 28,
          { align: 'center' }
        );
      }
    };

    // Encabezado
    pdf.setTextColor(...guinda);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('DOCUMENTO DE DOCUMENTACIÓN DE MATERIALES', m.left, y);
    y += 20;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.text(`Dirección: ${doc.direccion}`, m.left, y);
    y += 15;
    pdf.setFontSize(9);
    pdf.setTextColor(...gris);
    pdf.text(`Periodo: ${this.periodo}`, m.left, y);
    pdf.text(`Fecha de emisión: ${this.fechaEmision}`, ancho - m.right, y, { align: 'right' });
    y += 8;
    pdf.setDrawColor(...guinda);
    pdf.setLineWidth(1.2);
    pdf.line(m.left, y, ancho - m.right, y);
    y += 22;

    // Columnas: DESCRIPCIÓN | UNIDAD | CANTIDAD | P. UNITARIO | SUBTOTAL
    const colDesc = 250;
    const colUnidad = 80;
    const colCant = 70;
    const colPrecio = 95;
    const colSub = util - colDesc - colUnidad - colCant - colPrecio;
    const xDesc = m.left;
    const xUnidad = xDesc + colDesc;
    const xCant = xUnidad + colUnidad;
    const xPrecio = xCant + colCant;
    const xSub = xPrecio + colPrecio;

    const encabezado = ['DESCRIPCIÓN', 'UNIDAD DE MEDIDA', 'CANTIDAD', 'PRECIO UNITARIO', 'SUBTOTAL'];
    const alineaciones: ('left' | 'right' | 'center')[] = ['left', 'center', 'right', 'right', 'right'];
    const columnas = [xDesc, xUnidad, xCant, xPrecio, xSub];
    const anchos = [colDesc, colUnidad, colCant, colPrecio, colSub];

    const pintarEncabezado = (yy: number): number => {
      pdf.setFillColor(...crema);
      pdf.rect(m.left, yy, util, 20, 'F');
      pdf.setDrawColor(...guinda);
      pdf.setLineWidth(0.6);
      pdf.rect(m.left, yy, util, 20);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(...guinda);
      encabezado.forEach((t, i) => {
        const anchoUtil = anchos[i] - 8;
        const alineacion = alineaciones[i];
        const x = alineacion === 'left' ? columnas[i] + 4
          : alineacion === 'center' ? columnas[i] + anchos[i] / 2
            : columnas[i] + anchos[i] - 4;
        pdf.text(pdf.splitTextToSize(t, anchoUtil), x, yy + 13.5, { align: alineacion });
      });
      return yy + 20;
    };

    y = pintarEncabezado(y);

    pdf.setFontSize(9);
    for (const linea of doc.lineas) {
      const celdas: [string, ('left' | 'right' | 'center')][] = [
        [`${linea.descripcion}`, 'left'],
        [`${linea.unidad}`, 'center'],
        [`${this.numero(linea.cantidad)}`, 'right'],
        [`${this.money(linea.precioUnitario)}`, 'right'],
        [`${this.money(linea.subtotal)}`, 'right']
      ];
      const altoFila = this.altoFilaPdf(pdf, celdas, anchos);
      if (y + altoFila > alto - m.bottom - 60) {
        pdf.addPage();
        y = m.top;
        y = pintarEncabezado(y);
        pdf.setFontSize(9);
      }
      const yTexto = y + 12;
      celdas.forEach(([texto, alineacion], i) => {
        pdf.setFont('helvetica', i === 0 ? 'normal' : 'normal');
        pdf.setTextColor(40, 40, 40);
        const anchoUtil = anchos[i] - 8;
        const lineas = pdf.splitTextToSize(texto, anchoUtil);
        const x = alineacion === 'left' ? columnas[i] + 4
          : alineacion === 'center' ? columnas[i] + anchos[i] / 2
            : columnas[i] + anchos[i] - 4;
        pdf.text(lineas, x, yTexto, { align: alineacion });
      });
      // Referencia de la requisición y marca de costo adjudicado.
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...gris);
      const ref = `Requisición ${linea.requisicion.folio} · ${this.clavePartida(linea.requisicion)}`
        + (linea.precioAdjudicado ? ' · costo adjudicado' : ' · precio estimado');
      pdf.text(pdf.splitTextToSize(ref, colDesc - 8), xDesc + 4, y + altoFila - 5);

      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(0.4);
      pdf.line(m.left, y + altoFila, ancho - m.right, y + altoFila);
      y += altoFila;
    }

    // Totales
    if (y + 90 > alto - m.bottom) {
      pdf.addPage();
      y = m.top;
    }
    y += 14;
    const anchoTotales = 230;
    const xTotales = ancho - m.right - anchoTotales;
    const filas: [string, string, boolean][] = [
      ['SUBTOTAL ADQUIRIDO', this.money(doc.subtotal), false],
      [`IVA (${(TASA_IVA * 100).toFixed(0)}%)`, this.money(doc.iva), false],
      ['TOTAL', this.money(doc.total), true]
    ];
    for (const [etiqueta, valor, fuerte] of filas) {
      pdf.setFont('helvetica', fuerte ? 'bold' : 'normal');
      pdf.setFontSize(fuerte ? 11 : 10);
      pdf.setTextColor(...(fuerte ? guinda : gris));
      pdf.text(etiqueta, xTotales, y, { align: 'left' });
      pdf.text(valor, xTotales + anchoTotales, y, { align: 'right' });
      y += fuerte ? 20 : 16;
      if (!fuerte) {
        pdf.setDrawColor(235, 235, 235);
        pdf.setLineWidth(0.4);
        pdf.line(xTotales, y - 5, xTotales + anchoTotales, y - 5);
      }
    }

    // Justificaciones
    y += 12;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(...guinda);
    pdf.text('DESCRIPCIÓN Y JUSTIFICACIÓN DE LA ADQUISICIÓN', m.left, y);
    y += 6;
    pdf.setDrawColor(...guinda);
    pdf.setLineWidth(0.8);
    pdf.line(m.left, y, ancho - m.right, y);
    y += 18;

    for (const linea of doc.lineas) {
      const r = linea.requisicion;
      const bloque = this.bloqueJustificacion(r);
      const lineasDesc = pdf.splitTextToSize(bloque.descripcion, util);
      const lineasJust = pdf.splitTextToSize(bloque.justificacion, util);
      const altoBloque = 14 + lineasDesc.length * 10 + 14 + lineasJust.length * 10 + 12;

      if (y + altoBloque > alto - m.bottom - 30) {
        pdf.addPage();
        y = m.top;
      }

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(...guinda);
      pdf.text(bloque.titulo, m.left, y);
      y += 12;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(...gris);
      pdf.text('Descripción', m.left, y);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(40, 40, 40);
      pdf.text(lineasDesc, m.left, y + 10);
      y += 10 + lineasDesc.length * 10 + 4;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(...gris);
      pdf.text('Justificación', m.left, y);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(40, 40, 40);
      pdf.text(lineasJust, m.left, y + 10);
      y += 10 + lineasJust.length * 10 + 14;

      if (r.correccionPendiente) {
        pdf.setFillColor(255, 246, 219);
        const aviso = `Corrección de justificación pendiente: ${r.correccionComentario ?? ''}`;
        const lineasAviso = pdf.splitTextToSize(aviso, util - 16);
        const altoAviso = lineasAviso.length * 10 + 12;
        pdf.rect(m.left, y - 10, util, altoAviso, 'F');
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(8);
        pdf.setTextColor(122, 74, 0);
        pdf.text(lineasAviso, m.left + 8, y + 2);
        y += altoAviso + 8;
      }
    }

    pie();
    return pdf;
  }

  private altoFilaPdf(
    pdf: any,
    celdas: [string, ('left' | 'right' | 'center')][],
    anchos: number[]
  ): number {
    let lineas = 1;
    celdas.forEach(([texto], i) => {
      lineas = Math.max(lineas, pdf.splitTextToSize(texto, anchos[i] - 8).length);
    });
    // Se reserva una línea extra para la referencia de la requisición.
    return Math.max(26, lineas * 10 + 16);
  }

  private bloqueJustificacion(r: Requisicion): { titulo: string; descripcion: string; justificacion: string } {
    return {
      titulo: `Requisición ${r.folio} · ${r.area} · ${r.nombreSolicitante}`,
      descripcion: (r.descripcion || r.material || '').trim() || '—',
      justificacion: (r.justificacion || '').trim() || '—'
    };
  }

  // ---------- DOCX (Word, tamaño carta) ----------

  private construirDocx(d: typeof import('docx')): Docx.File {
    const doc = this.documentoActivo!;
    const contenido: Docx.FileChild[] = [];

    type OpcionesTexto = { bold?: boolean; size?: number; color?: string; italics?: boolean };
    type Alineacion = Docx.IParagraphOptions['alignment'];

    /** Párrafo con opciones de texto (negrita, tamaño, color) y de bloque. */
    const p = (
      text: string,
      run: OpcionesTexto = {},
      parrafo: { alignment?: Alineacion } = {}
    ): Docx.Paragraph => new d.Paragraph({
      ...parrafo,
      children: [new d.TextRun({ text, ...run })]
    });

    const enNegrita = (text: string, size = 18): Docx.Paragraph =>
      new d.Paragraph({ children: [new d.TextRun({ text, bold: true, size })] });

    contenido.push(p('DOCUMENTO DE DOCUMENTACIÓN DE MATERIALES', { bold: true, size: 30 }, { alignment: d.AlignmentType.CENTER }));
    contenido.push(enNegrita(`Dirección: ${doc.direccion}`, 22));
    contenido.push(p(`Periodo: ${this.periodo}   ·   Fecha de emisión: ${this.fechaEmision}`, { size: 18, color: '666666' }));
    contenido.push(enNegrita('', 10));

    const bordeFino = { style: d.BorderStyle.SINGLE, size: 4, color: 'CCCCCC' };
    const borders = { top: bordeFino, bottom: bordeFino, left: bordeFino, right: bordeFino };
    const encabezado = (texto: string, alineacion: Alineacion): Docx.TableCell =>
      new d.TableCell({
        shading: { fill: 'FBF3D5' },
        borders,
        children: [new d.Paragraph({ alignment: alineacion, children: [new d.TextRun({ text: texto, bold: true, size: 18 })] })]
      });
    const celda = (parrafos: Docx.Paragraph[]): Docx.TableCell => new d.TableCell({
      borders,
      children: parrafos.length > 0 ? parrafos : [new d.Paragraph({ children: [new d.TextRun({ text: '—', size: 18 })] })]
    });
    const textoCelda = (valor: string, alineacion: Alineacion): Docx.Paragraph =>
      new d.Paragraph({ alignment: alineacion, children: [new d.TextRun({ text: valor, size: 18 })] });

    const tabla = new d.Table({
      width: { size: 100, type: d.WidthType.PERCENTAGE },
      borders,
      rows: [
        new d.TableRow({
          tableHeader: true,
          children: [
            encabezado('DESCRIPCIÓN', d.AlignmentType.LEFT),
            encabezado('UNIDAD DE MEDIDA', d.AlignmentType.CENTER),
            encabezado('CANTIDAD', d.AlignmentType.RIGHT),
            encabezado('PRECIO UNITARIO', d.AlignmentType.RIGHT),
            encabezado('SUBTOTAL', d.AlignmentType.RIGHT)
          ]
        }),
        ...doc.lineas.map((l) => new d.TableRow({
          children: [
            celda([
              textoCelda(l.descripcion || '—', d.AlignmentType.LEFT),
              new d.Paragraph({
                children: [new d.TextRun({
                  text: `Requisición ${l.requisicion.folio} · ${this.clavePartida(l.requisicion)}`
                    + (l.precioAdjudicado ? ' · costo adjudicado' : ' · precio estimado'),
                  size: 15,
                  color: '777777',
                  italics: true
                })]
              })
            ]),
            celda([textoCelda(l.unidad, d.AlignmentType.CENTER)]),
            celda([textoCelda(this.numero(l.cantidad), d.AlignmentType.RIGHT)]),
            celda([textoCelda(this.money(l.precioUnitario), d.AlignmentType.RIGHT)]),
            celda([textoCelda(this.money(l.subtotal), d.AlignmentType.RIGHT)])
          ]
        }))
      ]
    });
    contenido.push(tabla);
    contenido.push(enNegrita('', 10));

    const totalTexto = (etiqueta: string, valor: string, fuerte: boolean): Docx.Paragraph =>
      new d.Paragraph({
        alignment: d.AlignmentType.RIGHT,
        children: [new d.TextRun({
          text: `${etiqueta}: ${valor}`,
          bold: fuerte,
          size: fuerte ? 24 : 20,
          color: fuerte ? '5B1225' : '333333'
        })]
      });
    contenido.push(totalTexto('SUBTOTAL ADQUIRIDO', this.money(doc.subtotal), false));
    contenido.push(totalTexto(`IVA (${(TASA_IVA * 100).toFixed(0)}%)`, this.money(doc.iva), false));
    contenido.push(totalTexto('TOTAL', this.money(doc.total), true));
    contenido.push(enNegrita('', 10));

    contenido.push(p('DESCRIPCIÓN Y JUSTIFICACIÓN DE LA ADQUISICIÓN', { bold: true, size: 22, color: '5B1225' }));
    for (const linea of doc.lineas) {
      const r = linea.requisicion;
      const b = this.bloqueJustificacion(r);
      contenido.push(p(`Requisición ${r.folio} · ${r.area} · ${r.nombreSolicitante}`, { bold: true, size: 18, color: '5B1225' }));
      contenido.push(p(`Descripción: ${b.descripcion}`, { size: 18 }));
      contenido.push(p(`Justificación: ${b.justificacion}`, { size: 18 }));
      if (r.correccionPendiente) {
        contenido.push(p(`Corrección de justificación pendiente: ${r.correccionComentario ?? ''}`, {
          size: 16, italics: true, color: '7A4A00'
        }));
      }
      contenido.push(enNegrita('', 12));
    }

    return new d.Document({
      creator: 'Portal de Adquisiciones',
      title: `Documentación ${doc.direccion}`,
      description: `Documento de documentación de materiales · ${this.periodo}`,
      sections: [{
        properties: {
          page: {
            // Tamaño carta en twips (8.5in x 11in).
            size: { width: 12240, height: 15840 },
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }
          }
        },
        children: contenido
      }]
    });
  }

  // ===== FORMATO =====

  get fechaEmision(): string {
    return new Date().toLocaleDateString('es-MX', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  }

  mesLabel(mes: string): string {
    if (!mes || mes.length < 7) {
      return 'Sin mes';
    }
    const [anio, mesNum] = mes.split('-');
    return `${MESES[Number(mesNum) - 1] ?? mesNum} ${anio}`;
  }

  numero(v: number): string {
    return (Number(v) || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 });
  }

  money(v: number | undefined): string {
    return (Number(v) ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }
}
