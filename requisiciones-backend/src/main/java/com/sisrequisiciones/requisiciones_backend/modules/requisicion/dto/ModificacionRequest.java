package com.sisrequisiciones.requisiciones_backend.modules.requisicion.dto;

import java.util.List;

public record ModificacionRequest(
        String material,
        Double cantidad,
        String unidad,
        Double precioEstimado,
        String descripcion,
        String justificacion,
        List<RequisicionRequest.SugerenciaRequest> sugerencias
) {}