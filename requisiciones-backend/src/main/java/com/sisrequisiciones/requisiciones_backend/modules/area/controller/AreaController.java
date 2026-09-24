package com.sisrequisiciones.requisiciones_backend.modules.area.controller;

import com.sisrequisiciones.requisiciones_backend.modules.area.dto.AreaRequest;
import com.sisrequisiciones.requisiciones_backend.modules.area.service.AreaService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/areas")
public class AreaController {

    private final AreaService areaService;

    public AreaController(AreaService areaService) {
        this.areaService = areaService;
    }

    @GetMapping
    public List<AreaRequest.AreaResponse> listar() {
        return areaService.listar();
    }

    @PostMapping
    public ResponseEntity<?> crear(@Valid @RequestBody AreaRequest request) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(areaService.crear(request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> actualizar(@PathVariable Long id, @Valid @RequestBody AreaRequest request) {
        try {
            return ResponseEntity.ok(areaService.actualizar(id, request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PatchMapping("/{id}/estado")
    public ResponseEntity<?> cambiarEstado(@PathVariable Long id, @RequestBody AreaRequest.CambioEstadoRequest request) {
        try {
            return ResponseEntity.ok(areaService.cambiarEstado(id, request.activo()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> eliminar(@PathVariable Long id) {
        try {
            areaService.eliminar(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}