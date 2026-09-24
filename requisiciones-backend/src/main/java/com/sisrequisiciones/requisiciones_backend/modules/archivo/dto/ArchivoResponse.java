package com.sisrequisiciones.requisiciones_backend.modules.archivo.dto;

public record ArchivoResponse(
        String nombre,
        String nombreInterno,
        String url,
        long tamano
) {}