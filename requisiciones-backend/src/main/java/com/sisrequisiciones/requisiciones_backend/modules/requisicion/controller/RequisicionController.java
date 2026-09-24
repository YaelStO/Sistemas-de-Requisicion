package com.sisrequisiciones.requisiciones_backend.modules.requisicion.controller;

import com.sisrequisiciones.requisiciones_backend.modules.auth.entity.Usuario;
import com.sisrequisiciones.requisiciones_backend.modules.requisicion.dto.*;
import com.sisrequisiciones.requisiciones_backend.modules.requisicion.service.RequisicionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/requisiciones")
public class RequisicionController {

    private final RequisicionService requisicionService;

    public RequisicionController(RequisicionService requisicionService) {
        this.requisicionService = requisicionService;
    }

    private Usuario usuario(Authentication auth) {
        return (Usuario) auth.getPrincipal();
    }

    @GetMapping
    public ResponseEntity<?> listar(Authentication auth) {
        try {
            return ResponseEntity.ok(requisicionService.listarPorRol(usuario(auth)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> obtener(@PathVariable Long id, Authentication auth) {
        try {
            return ResponseEntity.ok(requisicionService.obtener(id, usuario(auth)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        }
    }

    @PostMapping
    public ResponseEntity<?> crear(@Valid @RequestBody RequisicionRequest request, Authentication auth) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(requisicionService.crear(request, usuario(auth)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/{id}/aprobar")
    public ResponseEntity<?> aprobar(@PathVariable Long id, Authentication auth) {
        try {
            return ResponseEntity.ok(requisicionService.aprobar(id, usuario(auth)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/{id}/rechazar")
    public ResponseEntity<?> rechazar(@PathVariable Long id, @RequestBody(required = false) AccionRequest request, Authentication auth) {
        try {
            String justificacion = request != null && request.justificacion() != null ? request.justificacion() : "";
            return ResponseEntity.ok(requisicionService.rechazar(id, justificacion, usuario(auth)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PatchMapping("/{id}/modificar")
    public ResponseEntity<?> modificar(@PathVariable Long id, @Valid @RequestBody ModificacionRequest request, Authentication auth) {
        try {
            return ResponseEntity.ok(requisicionService.modificar(id, request, usuario(auth)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/dashboard")
    public ResponseEntity<?> dashboard(Authentication auth) {
        try {
            return ResponseEntity.ok(requisicionService.dashboard(usuario(auth)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/en-proceso")
    public ResponseEntity<?> enProceso(Authentication auth) {
        try {
            return ResponseEntity.ok(requisicionService.enProceso(usuario(auth)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/materiales")
    public ResponseEntity<?> materiales(Authentication auth) {
        try {
            return ResponseEntity.ok(requisicionService.listarMateriales(usuario(auth)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/{id}/autorizar-compra")
    public ResponseEntity<?> autorizarCompra(@PathVariable Long id, @RequestBody CompraRequest request, Authentication auth) {
        try {
            return ResponseEntity.ok(requisicionService.autorizarCompra(
                    id, request.proveedor(), request.sugerenciaId(), request.costoPropio(), usuario(auth)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/{id}/comprado")
    public ResponseEntity<?> comprado(@PathVariable Long id, Authentication auth) {
        try {
            return ResponseEntity.ok(requisicionService.marcarComprado(id, usuario(auth)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/{id}/entregado")
    public ResponseEntity<?> entregado(@PathVariable Long id, Authentication auth) {
        try {
            return ResponseEntity.ok(requisicionService.marcarEntregado(id, usuario(auth)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PatchMapping("/{id}/partida")
    public ResponseEntity<?> reasignarPartida(@PathVariable Long id, @RequestBody PartidaRequest request, Authentication auth) {
        try {
            return ResponseEntity.ok(requisicionService.reasignarPartida(id, request.partidaCodigo(), request.partidaNombre(), usuario(auth)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PatchMapping("/{id}/mes-compra")
    public ResponseEntity<?> reasignarMes(@PathVariable Long id, @RequestBody MesCompraRequest request, Authentication auth) {
        try {
            return ResponseEntity.ok(requisicionService.reasignarMes(id, request.mesCompra(), request.justificacion(), usuario(auth)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/notificaciones")
    public ResponseEntity<?> notificaciones(Authentication auth) {
        try {
            return ResponseEntity.ok(requisicionService.notificaciones(usuario(auth)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/{id}/historial")
    public ResponseEntity<?> historial(@PathVariable Long id, Authentication auth) {
        try {
            return ResponseEntity.ok(requisicionService.historial(id, usuario(auth)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        }
    }

    public record CompraRequest(String proveedor, Long sugerenciaId, Double costoPropio) {}
    public record PartidaRequest(String partidaCodigo, String partidaNombre) {}
    public record MesCompraRequest(String mesCompra, String justificacion) {}
}