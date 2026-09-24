package com.sisrequisiciones.requisiciones_backend.modules.requisicion.dto;

public record SugerenciaResponse(
        Long id,
        String marca,
        String modelo,
        Double precioEstimado,
        String enlaceUrl,
        String archivoPdfNombre,
        String archivoPdfUrl
) {
    public static SugerenciaResponse from(com.sisrequisiciones.requisiciones_backend.modules.requisicion.entity.Sugerencia s) {
        return new SugerenciaResponse(
                s.getId(),
                s.getMarca(),
                s.getModelo(),
                s.getPrecioEstimado(),
                s.getEnlaceUrl(),
                s.getArchivoPdfNombre(),
                s.getArchivoPdfUrl()
        );
    }
}