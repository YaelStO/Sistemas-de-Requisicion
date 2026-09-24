package com.sisrequisiciones.requisiciones_backend.modules.auth.entity;

import com.sisrequisiciones.requisiciones_backend.modules.area.entity.Area;
import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "usuarios")
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String nombreCompleto;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private Rol rol;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "area_id")
    private Area area;

    @Column(name = "password_expirada", nullable = false)
    private boolean passwordExpirada = false;

    @Column(name = "fecha_expiracion_password")
    private LocalDateTime fechaExpiracionPassword;

    @Column(nullable = false)
    private boolean activo = true;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getNombreCompleto() { return nombreCompleto; }
    public void setNombreCompleto(String nombreCompleto) { this.nombreCompleto = nombreCompleto; }

    public Rol getRol() { return rol; }
    public void setRol(Rol rol) { this.rol = rol; }

    public Area getArea() { return area; }
    public void setArea(Area area) { this.area = area; }

    public boolean isPasswordExpirada() { return passwordExpirada; }
    public void setPasswordExpirada(boolean passwordExpirada) { this.passwordExpirada = passwordExpirada; }

    public LocalDateTime getFechaExpiracionPassword() { return fechaExpiracionPassword; }
    public void setFechaExpiracionPassword(LocalDateTime fechaExpiracionPassword) { this.fechaExpiracionPassword = fechaExpiracionPassword; }

    public boolean isActivo() { return activo; }
    public void setActivo(boolean activo) { this.activo = activo; }
}