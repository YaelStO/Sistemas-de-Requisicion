package com.sisrequisiciones.requisiciones_backend.modules.requisicion.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record RequisicionRequest(
        @NotBlank String nombreSolicitante,
        String area,
        @NotBlank String fechaRequerida,
        @NotBlank String partidaCodigo,
        @NotBlank String partidaNombre,
        @NotBlank String material,
        @NotNull Double cantidad,
        @NotBlank String unidad,
        @NotNull Double precioEstimado,
        String descripcion,
        @NotBlank String justificacion,
        List<SugerenciaRequest> sugerencias
) {
    public record SugerenciaRequest(
            String marca,
            String modelo,
            Double precioEstimado,
            String enlaceUrl,
            String archivoPdfNombre,
            String archivoPdfUrl
    ) {}
}