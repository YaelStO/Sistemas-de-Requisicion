package com.sisrequisiciones.requisiciones_backend.modules.auth.dto;

import com.sisrequisiciones.requisiciones_backend.modules.auth.entity.Rol;
import com.sisrequisiciones.requisiciones_backend.modules.auth.entity.Usuario;

public record UsuarioRegistroResponse(
        Long id,
        String username,
        String passwordTemporal,
        String nombreCompleto,
        Rol rol,
        Long areaId,
        String area,
        boolean passwordExpirada,
        boolean activo
) {
    public static UsuarioRegistroResponse of(Usuario u, String passwordTemporal) {
        return new UsuarioRegistroResponse(
                u.getId(),
                u.getUsername(),
                passwordTemporal,
                u.getNombreCompleto(),
                u.getRol(),
                u.getArea() != null ? u.getArea().getId() : null,
                u.getArea() != null ? u.getArea().getNombre() : null,
                u.isPasswordExpirada(),
                u.isActivo()
        );
    }
}