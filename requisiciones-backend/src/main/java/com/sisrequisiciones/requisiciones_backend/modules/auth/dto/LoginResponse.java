package com.sisrequisiciones.requisiciones_backend.modules.auth.dto;

import com.sisrequisiciones.requisiciones_backend.modules.auth.entity.Usuario;
import com.sisrequisiciones.requisiciones_backend.modules.auth.entity.Rol;

public record LoginResponse(
        String token,
        Long id,
        String username,
        String nombreCompleto,
        Rol rol,
        Long areaId,
        String area,
        boolean passwordExpirada
) {
    public static LoginResponse from(Usuario usuario, String token) {
        return new LoginResponse(
                token,
                usuario.getId(),
                usuario.getUsername(),
                usuario.getNombreCompleto(),
                usuario.getRol(),
                usuario.getArea() != null ? usuario.getArea().getId() : null,
                usuario.getArea() != null ? usuario.getArea().getNombre() : null,
                usuario.isPasswordExpirada()
        );
    }
}