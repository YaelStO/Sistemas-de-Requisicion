package com.sisrequisiciones.requisiciones_backend.modules.auth.dto;

import com.sisrequisiciones.requisiciones_backend.modules.auth.entity.Rol;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UsuarioRequest(
        String username,
        String password,
        @NotBlank String nombreCompleto,
        @NotNull Rol rol,
        Long areaId
) {}