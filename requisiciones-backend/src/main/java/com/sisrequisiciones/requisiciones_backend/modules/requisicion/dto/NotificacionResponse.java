package com.sisrequisiciones.requisiciones_backend.modules.requisicion.dto;

import java.time.LocalDateTime;

public record NotificacionResponse(
        String folio,
        Long requisicionId,
        LocalDateTime fechaHora,
        String usuario,
        String rol,
        String accion,
        String campo,
        String valorAnterior,
        String valorNuevo
) {}