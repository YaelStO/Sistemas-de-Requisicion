package com.sisrequisiciones.requisiciones_backend.modules.auth.controller;

import com.sisrequisiciones.requisiciones_backend.modules.auth.dto.LoginRequest;
import com.sisrequisiciones.requisiciones_backend.modules.auth.dto.LoginResponse;
import com.sisrequisiciones.requisiciones_backend.modules.auth.dto.UsuarioRegistroResponse;
import com.sisrequisiciones.requisiciones_backend.modules.auth.dto.UsuarioRequest;
import com.sisrequisiciones.requisiciones_backend.modules.auth.dto.UsuarioResponse;
import com.sisrequisiciones.requisiciones_backend.modules.auth.entity.Usuario;
import com.sisrequisiciones.requisiciones_backend.modules.auth.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        try {
            return ResponseEntity.ok(authService.login(request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(e.getMessage());
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(Authentication authentication) {
        if (authentication == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
        }
        if (authentication.getPrincipal() instanceof Usuario usuario) {
            return ResponseEntity.ok(UsuarioResponse.from(usuario));
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
    }

    @GetMapping("/usuarios")
    public List<UsuarioResponse> listarUsuarios() {
        return authService.listarUsuarios();
    }

    @PostMapping("/usuarios")
    public ResponseEntity<?> crearUsuario(@Valid @RequestBody UsuarioRequest request) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(authService.registrarUsuario(request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/cambiar-password")
    public ResponseEntity<?> cambiarPassword(Authentication authentication, @RequestBody CambioCredencialesRequest request) {
        if (!(authentication.getPrincipal() instanceof Usuario usuario)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No autenticado");
        }
        try {
            authService.cambiarPassword(usuario.getId(), request.usernameNuevo(), request.passwordActual(), request.passwordNueva());
            return ResponseEntity.ok(Map.of("mensaje", "Credenciales actualizadas correctamente"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PatchMapping("/usuarios/{id}/estado")
    public ResponseEntity<?> cambiarEstado(@PathVariable Long id, @RequestBody CambioEstadoRequest request) {
        try {
            return ResponseEntity.ok(authService.cambiarEstadoUsuario(id, request.activo()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    public record CambioEstadoRequest(boolean activo) {}
    public record CambioCredencialesRequest(String usernameNuevo, String passwordActual, String passwordNueva) {}
}