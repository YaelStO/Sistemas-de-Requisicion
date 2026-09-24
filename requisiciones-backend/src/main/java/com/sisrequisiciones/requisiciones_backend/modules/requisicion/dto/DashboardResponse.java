package com.sisrequisiciones.requisiciones_backend.modules.requisicion.dto;

import java.util.List;

public record DashboardResponse(
        long total,
        long pendientes,
        long aprobadas,
        long rechazadas,
        long enRevision,
        List<PorArea> porArea
) {
    public record PorArea(
            String area,
            long total,
            long pendientes,
            long aprobadas,
            long rechazadas
    ) {}
}