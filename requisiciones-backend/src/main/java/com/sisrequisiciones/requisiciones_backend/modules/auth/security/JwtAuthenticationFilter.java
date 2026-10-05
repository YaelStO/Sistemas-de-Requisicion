package com.sisrequisiciones.requisiciones_backend.modules.auth.security;

import com.sisrequisiciones.requisiciones_backend.modules.auth.entity.Usuario;
import com.sisrequisiciones.requisiciones_backend.modules.auth.repository.UsuarioRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    private final JwtService jwtService;
    private final UsuarioRepository usuarioRepository;

    public JwtAuthenticationFilter(JwtService jwtService, UsuarioRepository usuarioRepository) {
        this.jwtService = jwtService;
        this.usuarioRepository = usuarioRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        final String token = authHeader.substring(7);
        final String uri = request.getRequestURI();

        try {
            final String username = jwtService.extractUsername(token);

            if (username == null) {
                log.debug("JWT sin subject en {}", uri);
            } else if (SecurityContextHolder.getContext().getAuthentication() != null) {
                log.debug("SecurityContext ya poblado, se omite JWT en {}", uri);
            } else {
                final Optional<Usuario> encontrado = usuarioRepository.findByUsername(username);
                if (encontrado.isEmpty()) {
                    log.warn("JWT de '{}' no corresponde a ningún usuario en {}", username, uri);
                } else if (!encontrado.get().isActivo()) {
                    log.warn("Usuario '{}' está desactivado, acceso denegado en {}", username, uri);
                } else if (!jwtService.isValidToken(token, username)) {
                    log.warn("JWT de '{}' expirado o con firma inválida en {}", username, uri);
                } else {
                    Usuario usuario = encontrado.get();
                    var authToken = new UsernamePasswordAuthenticationToken(
                            usuario, null, List.of(new SimpleGrantedAuthority(usuario.getRol().name())));
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }
        } catch (Exception e) {
            log.warn("No se pudo validar el JWT en {}: {}", uri, e.getMessage());
        }

        filterChain.doFilter(request, response);
    }
}