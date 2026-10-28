package com.sisrequisiciones.requisiciones_backend.modules.requisicion.dto;

public record SugerenciaPreviewResponse(
        String marca,
        String modelo,
        Double precioEstimado,
        String titulo,
        String moneda
) {
}
