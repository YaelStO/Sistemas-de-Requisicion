package com.sisrequisiciones.requisiciones_backend.modules.auth.service;

import com.sisrequisiciones.requisiciones_backend.modules.area.entity.Area;
import com.sisrequisiciones.requisiciones_backend.modules.area.repository.AreaRepository;
import com.sisrequisiciones.requisiciones_backend.modules.auth.dto.LoginRequest;
import com.sisrequisiciones.requisiciones_backend.modules.auth.dto.LoginResponse;
import com.sisrequisiciones.requisiciones_backend.modules.auth.dto.UsuarioRegistroResponse;
import com.sisrequisiciones.requisiciones_backend.modules.auth.dto.UsuarioRequest;
import com.sisrequisiciones.requisiciones_backend.modules.auth.dto.UsuarioResponse;
import com.sisrequisiciones.requisiciones_backend.modules.auth.entity.Usuario;
import com.sisrequisiciones.requisiciones_backend.modules.auth.repository.UsuarioRepository;
import com.sisrequisiciones.requisiciones_backend.modules.auth.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class AuthService {

    private static final long EXPIRACION_HORAS = 48;

    private final UsuarioRepository usuarioRepository;
    private final AreaRepository areaRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UsuarioRepository usuarioRepository, AreaRepository areaRepository,
                       PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.usuarioRepository = usuarioRepository;
        this.areaRepository = areaRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        Usuario usuario = usuarioRepository.findByUsername(request.username())
                .orElseThrow(() -> new IllegalArgumentException("Usuario o contraseña incorrectos"));
        if (!passwordEncoder.matches(request.password(), usuario.getPassword())) {
            throw new IllegalArgumentException("Usuario o contraseña incorrectos");
        }
        if (!usuario.isActivo()) {
            throw new IllegalArgumentException("El usuario está desactivado");
        }
        if (usuario.isPasswordExpirada()
                && usuario.getFechaExpiracionPassword() != null
                && LocalDateTime.now().isAfter(usuario.getFechaExpiracionPassword())) {
            throw new IllegalArgumentException("Tu contraseña temporal venció. Solicita al administrador que la restablezca.");
        }
        String token = jwtService.generateToken(usuario);
        return LoginResponse.from(usuario, token);
    }

    @Transactional
    public UsuarioRegistroResponse registrarUsuario(UsuarioRequest request) {
        String username = (request.username() == null || request.username().isBlank())
                ? generarUsername(request.nombreCompleto())
                : request.username().trim();
        if (usuarioRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("El username ya existe");
        }

        Area area = null;
        if (request.areaId() != null) {
            area = areaRepository.findById(request.areaId())
                    .orElseThrow(() -> new IllegalArgumentException("El área seleccionada no existe"));
        }

        boolean passwordGenerada = request.password() == null || request.password().isBlank();
        String password = passwordGenerada ? generarPasswordTemporal() : request.password();

        Usuario usuario = new Usuario();
        usuario.setUsername(username);
        usuario.setPassword(passwordEncoder.encode(password));
        usuario.setNombreCompleto(request.nombreCompleto().trim());
        usuario.setRol(request.rol());
        usuario.setArea(area);
        if (passwordGenerada) {
            usuario.setPasswordExpirada(true);
            usuario.setFechaExpiracionPassword(LocalDateTime.now().plusHours(EXPIRACION_HORAS));
        }

        Usuario guardado = usuarioRepository.save(usuario);
        return UsuarioRegistroResponse.of(guardado, passwordGenerada ? password : null);
    }

    @Transactional(readOnly = true)
    public List<UsuarioResponse> listarUsuarios() {
        return usuarioRepository.findAll().stream().map(UsuarioResponse::from).toList();
    }

    @Transactional
    public UsuarioResponse cambiarEstadoUsuario(Long id, boolean activo) {
        Usuario usuario = usuarioRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
        usuario.setActivo(activo);
        return UsuarioResponse.from(usuarioRepository.save(usuario));
    }

    @Transactional
    public void cambiarPassword(Long usuarioId, String usernameNuevo, String passwordActual, String passwordNueva) {
        Usuario usuario = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
        if (!passwordEncoder.matches(passwordActual, usuario.getPassword())) {
            throw new IllegalArgumentException("La contraseña actual es incorrecta");
        }

        if (usernameNuevo != null && !usernameNuevo.isBlank()) {
            String nuevo = usernameNuevo.trim();
            if (nuevo.length() > 50) {
                throw new IllegalArgumentException("El usuario no puede exceder 50 caracteres");
            }
            if (usuarioRepository.existsByUsername(nuevo) && !nuevo.equals(usuario.getUsername())) {
                throw new IllegalArgumentException("El nombre de usuario ya está en uso");
            }
            usuario.setUsername(nuevo);
        }

        if (passwordNueva != null && !passwordNueva.isBlank()) {
            if (passwordNueva.length() < 6) {
                throw new IllegalArgumentException("La nueva contraseña debe tener al menos 6 caracteres");
            }
            usuario.setPassword(passwordEncoder.encode(passwordNueva));
            usuario.setPasswordExpirada(false);
            usuario.setFechaExpiracionPassword(null);
        }

        usuarioRepository.save(usuario);
    }

    private String generarUsername(String nombreCompleto) {
        String base = normalizar(nombreCompleto);
        String candidato = base;
        int i = 1;
        while (usuarioRepository.existsByUsername(candidato)) {
            candidato = base + i;
            i++;
        }
        return candidato;
    }

    private String normalizar(String nombre) {
        String limpio = Normalizer.normalize(nombre, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replaceAll("[^a-zA-Z0-9 ]", " ")
                .replaceAll("\\s+", " ")
                .trim()
                .toLowerCase();
        String[] partes = limpio.split(" ");
        if (partes.length <= 1) {
            return limpio.isEmpty() ? "usuario" : limpio;
        }
        return partes[0] + "." + partes[partes.length - 1];
    }

    private String generarPasswordTemporal() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder(10);
        for (int i = 0; i < 10; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }
}