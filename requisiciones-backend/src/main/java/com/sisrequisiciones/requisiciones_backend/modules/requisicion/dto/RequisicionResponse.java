package com.sisrequisiciones.requisiciones_backend.modules.requisicion.dto;

import com.sisrequisiciones.requisiciones_backend.modules.requisicion.entity.EstadoRequisicion;
import com.sisrequisiciones.requisiciones_backend.modules.requisicion.entity.Requisicion;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

public record RequisicionResponse(
        Long id,
        String folio,
        String nombreSolicitante,
        String area,
        String fechaRequerida,
        String fechaSolicitud,
        String partidaCodigo,
        String partidaNombre,
        String material,
        Double cantidad,
        String unidad,
        Double precioEstimado,
        String descripcion,
        String justificacion,
        String estadoCoord,
        String estadoDir,
        String estadoDirGral,
        String estadoGlobal,
        String justificacionRechazo,
        Long creadoPorId,
        String modificadoPor,
        List<SugerenciaResponse> sugerencias,
        String estadoMateriales,
        String mesCompra,
        String proveedor,
        String estadoCompra,
        String tipoCosto,
        Double precioCompra,
        String marcaSeleccionada
) {
    public static RequisicionResponse from(Requisicion r, List<SugerenciaResponse> sugerencias) {
        return new RequisicionResponse(
                r.getId(),
                r.getFolio(),
                r.getNombreSolicitante(),
                r.getArea(),
                r.getFechaRequerida(),
                r.getFechaSolicitud(),
                r.getPartidaCodigo(),
                r.getPartidaNombre(),
                r.getMaterial(),
                r.getCantidad(),
                r.getUnidad(),
                r.getPrecioEstimado(),
                r.getDescripcion(),
                r.getJustificacion(),
                r.getEstadoCoord() != null ? r.getEstadoCoord().name() : "NO_APLICA",
                r.getEstadoDir() != null ? r.getEstadoDir().name() : "NO_APLICA",
                r.getEstadoDirGral() != null ? r.getEstadoDirGral().name() : "NO_APLICA",
                EstadoUtil.calcularEstadoGlobal(r).name(),
                r.getJustificacionRechazo(),
                r.getCreadoPorId(),
                r.getModificadoPor(),
                sugerencias,
                estadoMaterialesDe(r),
                mesCompraDe(r),
                r.getProveedor(),
                r.getEstadoCompra() != null ? r.getEstadoCompra().name() : null,
                r.getTipoCosto(),
                r.getPrecioCompra(),
                r.getMarcaSeleccionada()
        );
    }

    /** Estado del área de Materiales (PENDIENTE = aprobada y por adjudicar compra). */
    public static String estadoMaterialesDe(Requisicion r) {
        if (r.getEstadoMateriales() != null) {
            return r.getEstadoMateriales().name();
        }
        return EstadoUtil.calcularEstadoGlobal(r) == EstadoRequisicion.APROBADA ? "PENDIENTE" : "NO_APLICA";
    }

    /** Mes de compra ("yyyy-MM"); por defecto el mes de la fecha requerida. */
    public static String mesCompraDe(Requisicion r) {
        if (r.getMesCompra() != null && !r.getMesCompra().isBlank()) {
            return r.getMesCompra();
        }
        return mesDesdeFecha(r.getFechaRequerida());
    }

    public static String mesDesdeFecha(String fecha) {
        if (fecha != null && fecha.matches("\\d{2}/\\d{2}/\\d{4}")) {
            try {
                LocalDate d = LocalDate.parse(fecha, DateTimeFormatter.ofPattern("dd/MM/yyyy"));
                return d.format(DateTimeFormatter.ofPattern("yyyy-MM"));
            } catch (Exception ignored) {
                // fallback al mes actual
            }
        }
        return LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM"));
    }
}