package com.sisrequisiciones.requisiciones_backend.modules.auth.dto;

import com.sisrequisiciones.requisiciones_backend.modules.auth.entity.Usuario;
import com.sisrequisiciones.requisiciones_backend.modules.auth.entity.Rol;

public record UsuarioResponse(
        Long id,
        String username,
        String nombreCompleto,
        Rol rol,
        Long areaId,
        String area,
        boolean passwordExpirada,
        boolean activo
) {
    public static UsuarioResponse from(Usuario u) {
        return new UsuarioResponse(
                u.getId(),
                u.getUsername(),
                u.getNombreCompleto(),
                u.getRol(),
                u.getArea() != null ? u.getArea().getId() : null,
                u.getArea() != null ? u.getArea().getNombre() : null,
                u.isPasswordExpirada(),
                u.isActivo()
        );
    }
}