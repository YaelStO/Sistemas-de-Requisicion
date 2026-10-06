import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { RequisicionService, Requisicion } from '../../services/requisicion.service';
import { AreaService, Area } from '../../services/area.service';
import { AuthService } from '../../services/auth.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import type * as Docx from 'docx';


const TASA_IVA = 0.16;

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
    const gris: [number, number, number] = [90, 90, 90];

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

    // Encabezado: título, periodo/fecha y el área a la derecha.
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('DOCUMENTO DE DOCUMENTACIÓN DE MATERIALES', m.left, y);
    y += 20;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...gris);
    pdf.text(`Periodo: ${this.periodo}   ·   Fecha de emisión: ${this.fechaEmision}`, m.left, y);
    y += 16;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`ÁREA: ${doc.direccion}`, ancho - m.right, y, { align: 'right' });
    y += 8;
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(1);
    pdf.line(m.left, y, ancho - m.right, y);
    y += 22;

    // Columnas: # | DESCRIPCIÓN | UNIDAD DE MEDIDA | CANTIDAD | P.U. | SUBTOTAL
    const colNum = 24;
    const colDesc = 205;
    const colUnidad = 80;
    const colCant = 60;
    const colPrecio = 66;
    const colSub = util - colNum - colDesc - colUnidad - colCant - colPrecio;
    const xNum = m.left;
    const xDesc = xNum + colNum;
    const xUnidad = xDesc + colDesc;
    const xCant = xUnidad + colUnidad;
    const xPrecio = xCant + colCant;
    const xSub = xPrecio + colPrecio;

    const encabezado = ['#', 'DESCRIPCIÓN', 'UNIDAD DE MEDIDA', 'CANTIDAD', 'P.U.', 'SUBTOTAL'];
    const alineaciones: ('left' | 'right' | 'center')[] = ['center', 'left', 'center', 'right', 'right', 'right'];
    const columnas = [xNum, xDesc, xUnidad, xCant, xPrecio, xSub];
    const anchos = [colNum, colDesc, colUnidad, colCant, colPrecio, colSub];

    const pintarEncabezado = (yy: number): number => {
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.6);
      pdf.rect(m.left, yy, util, 20);
      for (let i = 1; i < columnas.length; i++) {
        pdf.line(columnas[i], yy, columnas[i], yy + 20);
      }
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(0, 0, 0);
      encabezado.forEach((t, i) => {
        const alineacion = alineaciones[i];
        const x = alineacion === 'left' ? columnas[i] + 4
          : alineacion === 'center' ? columnas[i] + anchos[i] / 2
            : columnas[i] + anchos[i] - 4;
        pdf.text(t, x, yy + 13.5, { align: alineacion });
      });
      return yy + 20;
    };

    y = pintarEncabezado(y);

    pdf.setFontSize(9);
    doc.lineas.forEach((linea, idx) => {
      const celdas: [string, ('left' | 'right' | 'center')][] = [
        [`${idx + 1}`, 'center'],
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
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(40, 40, 40);
        const anchoUtil = anchos[i] - 8;
        const lineas = pdf.splitTextToSize(texto, anchoUtil);
        const x = alineacion === 'left' ? columnas[i] + 4
          : alineacion === 'center' ? columnas[i] + anchos[i] / 2
            : columnas[i] + anchos[i] - 4;
        pdf.text(lineas, x, yTexto, { align: alineacion });
      });
      // Referencia de la requisición.
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...gris);
      const ref = `Requisición ${linea.requisicion.folio} · ${this.clavePartida(linea.requisicion)}`
        + (linea.precioAdjudicado ? ' · costo adjudicado' : ' · precio estimado');
      pdf.text(pdf.splitTextToSize(ref, colDesc - 8), xDesc + 4, y + altoFila - 5);

      pdf.setDrawColor(160, 160, 160);
      pdf.setLineWidth(0.4);
      pdf.line(m.left, y + altoFila, ancho - m.right, y + altoFila);
      y += altoFila;
    });

    // Totales
    if (y + 90 > alto - m.bottom) {
      pdf.addPage();
      y = m.top;
    }
    y += 14;
    const anchoTotales = 230;
    const xTotales = ancho - m.right - anchoTotales;
    const filas: [string, string, boolean][] = [
      ['Subtotal:', this.money(doc.subtotal), false],
      [`I.V.A. (${(TASA_IVA * 100).toFixed(0)}%):`, this.money(doc.iva), false],
      ['Total:', this.money(doc.total), true]
    ];
    for (const [etiqueta, valor, fuerte] of filas) {
      pdf.setFont('helvetica', fuerte ? 'bold' : 'normal');
      pdf.setFontSize(fuerte ? 11 : 10);
      if (fuerte) {
        pdf.setTextColor(0, 0, 0);
      } else {
        pdf.setTextColor(60, 60, 60);
      }
      pdf.text(etiqueta, xTotales, y, { align: 'left' });
      pdf.text(valor, xTotales + anchoTotales, y, { align: 'right' });
      y += fuerte ? 20 : 16;
      if (!fuerte) {
        pdf.setDrawColor(235, 235, 235);
        pdf.setLineWidth(0.4);
        pdf.line(xTotales, y - 5, xTotales + anchoTotales, y - 5);
      }
    }

    // Justificaciones en texto: MATERIAL (negrita): justificación.
    y += 12;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    pdf.text('DESCRIPCIÓN Y JUSTIFICACIÓN DE LA ADQUISICIÓN', m.left, y);
    y += 6;
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.6);
    pdf.line(m.left, y, ancho - m.right, y);
    y += 18;

    for (const linea of doc.lineas) {
      const r = linea.requisicion;
      const material = (r.material || linea.descripcion || '').trim() || '—';
      const justificacion = (r.justificacion || '').trim() || '—';

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      const prefijo = `${material}: `;
      const anchoPrefijo = pdf.getTextWidth(prefijo);
      const segmentos: string[] = pdf.splitTextToSize(
        justificacion,
        Math.max(util - anchoPrefijo, 60)
      );
      const primeraLinea = segmentos[0] ?? '';
      const resto = segmentos.slice(1).join(' ');
      const restoLineas: string[] = resto ? pdf.splitTextToSize(resto, util) : [];

      const aviso = r.correccionPendiente
        ? `Corrección de justificación pendiente: ${r.correccionComentario ?? ''}`
        : '';
      const lineasAviso: string[] = aviso ? pdf.splitTextToSize(aviso, util) : [];

      const totalLineas = 1 + restoLineas.length;
      const altoBloque = totalLineas * 11
        + (lineasAviso.length ? lineasAviso.length * 10 + 6 : 0)
        + 6;

      if (y + altoBloque > alto - m.bottom - 30) {
        pdf.addPage();
        y = m.top;
      }

      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.text(prefijo, m.left, y);
      pdf.setFont('helvetica', 'normal');
      if (primeraLinea) {
        pdf.text(primeraLinea, m.left + anchoPrefijo, y);
      }
      let yy = y + 11;
      for (const l2 of restoLineas) {
        pdf.text(l2, m.left, yy);
        yy += 11;
      }
      if (lineasAviso.length) {
        yy += 4;
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(8);
        pdf.setTextColor(110, 110, 110);
        for (const l2 of lineasAviso) {
          pdf.text(l2, m.left, yy);
          yy += 10;
        }
      }
      y = yy + 6;
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

  // ---------- DOCX (Word, tamaño carta) ----------

  private construirDocx(d: typeof import('docx')): Docx.File {
    const doc = this.documentoActivo!;
    const contenido: Docx.FileChild[] = [];

    type OpcionesTexto = { bold?: boolean; size?: number; color?: string; italics?: boolean };
    type Alineacion = Docx.IParagraphOptions['alignment'];

    /** Párrafo con opciones de texto y de bloque. */
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
    contenido.push(p(`Periodo: ${this.periodo}   ·   Fecha de emisión: ${this.fechaEmision}`, { size: 18, color: '666666' }));
    contenido.push(p(`ÁREA: ${doc.direccion}`, { bold: true, size: 24 }, { alignment: d.AlignmentType.RIGHT }));
    contenido.push(enNegrita('', 10));

    const bordeFino = { style: d.BorderStyle.SINGLE, size: 4, color: 'CCCCCC' };
    const borders = { top: bordeFino, bottom: bordeFino, left: bordeFino, right: bordeFino };
    const encabezado = (texto: string, alineacion: Alineacion): Docx.TableCell =>
      new d.TableCell({
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
      columnWidths: [400, 3400, 1400, 1000, 1800, 1972],
      borders,
      rows: [
        new d.TableRow({
          tableHeader: true,
          children: [
            encabezado('#', d.AlignmentType.CENTER),
            encabezado('DESCRIPCIÓN', d.AlignmentType.LEFT),
            encabezado('UNIDAD DE MEDIDA', d.AlignmentType.CENTER),
            encabezado('CANTIDAD', d.AlignmentType.RIGHT),
            encabezado('P.U.', d.AlignmentType.RIGHT),
            encabezado('SUBTOTAL', d.AlignmentType.RIGHT)
          ]
        }),
        ...doc.lineas.map((l, i) => new d.TableRow({
          children: [
            celda([textoCelda(`${i + 1}`, d.AlignmentType.CENTER)]),
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
          text: `${etiqueta} ${valor}`,
          bold: fuerte,
          size: fuerte ? 24 : 20,
          color: fuerte ? '000000' : '333333'
        })]
      });
    contenido.push(totalTexto('Subtotal:', this.money(doc.subtotal), false));
    contenido.push(totalTexto(`I.V.A. (${(TASA_IVA * 100).toFixed(0)}%):`, this.money(doc.iva), false));
    contenido.push(totalTexto('Total:', this.money(doc.total), true));
    contenido.push(enNegrita('', 10));

    contenido.push(p('DESCRIPCIÓN Y JUSTIFICACIÓN DE LA ADQUISICIÓN', { bold: true, size: 22 }));
    for (const linea of doc.lineas) {
      const r = linea.requisicion;
      const material = (r.material || linea.descripcion || '').trim() || '—';
      const justificacion = (r.justificacion || '').trim() || '—';
      contenido.push(new d.Paragraph({
        spacing: { after: 120 },
        children: [
          new d.TextRun({ text: `${material}: `, bold: true, size: 18 }),
          new d.TextRun({ text: justificacion, size: 18 })
        ]
      }));
      if (r.correccionPendiente) {
        contenido.push(p(`Corrección de justificación pendiente: ${r.correccionComentario ?? ''}`, {
          size: 16, italics: true, color: '666666'
        }));
      }
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
