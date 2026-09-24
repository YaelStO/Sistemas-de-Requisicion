package com.sisrequisiciones.requisiciones_backend.modules.area.dto;

import com.sisrequisiciones.requisiciones_backend.modules.area.entity.Area;
import com.sisrequisiciones.requisiciones_backend.modules.area.entity.AreaNivel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record AreaRequest(
        @NotBlank String nombre,
        @NotNull AreaNivel nivel,
        Long parentId
) {
    public record AreaResponse(
            Long id,
            String nombre,
            AreaNivel nivel,
            Long parentId,
            String padreNombre,
            boolean activo
    ) {
        public static AreaResponse from(Area a, String padreNombre) {
            return new AreaResponse(a.getId(), a.getNombre(), a.getNivel(), a.getParentId(), padreNombre, a.isActivo());
        }
    }

    public record CambioEstadoRequest(boolean activo) {}
}