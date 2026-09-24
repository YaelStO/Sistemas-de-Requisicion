package com.sisrequisiciones.requisiciones_backend.modules.requisicion.dto;

import java.time.LocalDateTime;

public record HistoricoEventoResponse(
        Long id,
        LocalDateTime fechaHora,
        String usuario,
        String rol,
        String accion,
        String campo,
        String valorAnterior,
        String valorNuevo
) {}