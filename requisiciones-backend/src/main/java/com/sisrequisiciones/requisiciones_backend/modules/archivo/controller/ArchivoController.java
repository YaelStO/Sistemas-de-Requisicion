package com.sisrequisiciones.requisiciones_backend.modules.archivo.controller;

import com.sisrequisiciones.requisiciones_backend.modules.archivo.dto.ArchivoResponse;
import com.sisrequisiciones.requisiciones_backend.modules.archivo.service.ArchivoService;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1/archivos")
public class ArchivoController {

    private final ArchivoService archivoService;

    public ArchivoController(ArchivoService archivoService) {
        this.archivoService = archivoService;
    }

    @PostMapping
    public ResponseEntity<?> subir(@RequestParam("archivos") List<MultipartFile> archivos) {
        try {
            List<ArchivoResponse> resultado = archivos.stream()
                    .map(archivoService::guardar)
                    .toList();
            return ResponseEntity.ok(resultado);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/{nombre}")
    public ResponseEntity<Resource> ver(@PathVariable String nombre) {
        Resource archivo = archivoService.cargar(nombre);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + nombre + "\"")
                .body(archivo);
    }
}