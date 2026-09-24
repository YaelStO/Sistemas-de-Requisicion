package com.sisrequisiciones.requisiciones_backend;

import com.sisrequisiciones.requisiciones_backend.modules.area.entity.Area;
import com.sisrequisiciones.requisiciones_backend.modules.area.entity.AreaNivel;
import com.sisrequisiciones.requisiciones_backend.modules.area.repository.AreaRepository;
import com.sisrequisiciones.requisiciones_backend.modules.auth.entity.Rol;
import com.sisrequisiciones.requisiciones_backend.modules.auth.entity.Usuario;
import com.sisrequisiciones.requisiciones_backend.modules.auth.repository.UsuarioRepository;
import com.sisrequisiciones.requisiciones_backend.modules.requisicion.entity.EstadoNivel;
import com.sisrequisiciones.requisiciones_backend.modules.requisicion.entity.HistoricoEvento;
import com.sisrequisiciones.requisiciones_backend.modules.requisicion.entity.Requisicion;
import com.sisrequisiciones.requisiciones_backend.modules.requisicion.entity.Sugerencia;
import com.sisrequisiciones.requisiciones_backend.modules.requisicion.repository.HistoricoEventoRepository;
import com.sisrequisiciones.requisiciones_backend.modules.requisicion.repository.RequisicionRepository;
import com.sisrequisiciones.requisiciones_backend.modules.requisicion.repository.SugerenciaRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Component
public class DataInitializer implements CommandLineRunner {

    private final AreaRepository areaRepository;
    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final RequisicionRepository requisicionRepository;
    private final SugerenciaRepository sugerenciaRepository;
    private final HistoricoEventoRepository historicoRepository;

    public DataInitializer(
            AreaRepository areaRepository,
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            RequisicionRepository requisicionRepository,
            SugerenciaRepository sugerenciaRepository,
            HistoricoEventoRepository historicoRepository) {
        this.areaRepository = areaRepository;
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.requisicionRepository = requisicionRepository;
        this.sugerenciaRepository = sugerenciaRepository;
        this.historicoRepository = historicoRepository;
    }

    @Override
    public void run(String... args) {
        Map<String, Long> areas = sembrarAreas();
        sembrarUsuarios(areas);
        sembrarRequisiciones(areas);
    }

    // ===================== ÁREAS (organigrama) =====================

    private Map<String, Long> sembrarAreas() {
        Map<String, Long> areas = new HashMap<>();
        if (areaRepository.count() > 0) {
            return areas;
        }
        areas.put("dirGral", crearArea("Dirección General", AreaNivel.DIRECCION_GENERAL, null));
        areas.put("dirInformatica", crearArea("Dirección de Informática", AreaNivel.DIRECCION, areas.get("dirGral")));
        areas.put("dirAdmin", crearArea("Dirección Administrativa", AreaNivel.DIRECCION, areas.get("dirGral")));
        areas.put("coordTI", crearArea("Coordinación de TI", AreaNivel.COORDINACION, areas.get("dirInformatica")));
        areas.put("coordRedes", crearArea("Coordinación de Redes", AreaNivel.COORDINACION, areas.get("dirInformatica")));
        areas.put("coordRecursos", crearArea("Coordinación de Recursos Materiales", AreaNivel.COORDINACION, areas.get("dirAdmin")));
        areas.put("desarrollo", crearArea("Desarrollo de Software", AreaNivel.DEPARTAMENTO, areas.get("coordTI")));
        areas.put("soporte", crearArea("Soporte Técnico", AreaNivel.DEPARTAMENTO, areas.get("coordTI")));
        areas.put("redes", crearArea("Redes y Comunicaciones", AreaNivel.DEPARTAMENTO, areas.get("coordRedes")));
        areas.put("infra", crearArea("Infraestructura", AreaNivel.DEPARTAMENTO, areas.get("coordRedes")));
        areas.put("almacen", crearArea("Almacén General", AreaNivel.DEPARTAMENTO, areas.get("coordRecursos")));
        areas.put("compras", crearArea("Compras y Suministros", AreaNivel.DEPARTAMENTO, areas.get("coordRecursos")));
        return areas;
    }

    private Long crearArea(String nombre, AreaNivel nivel, Long parentId) {
        Area a = new Area();
        a.setNombre(nombre);
        a.setNivel(nivel);
        a.setParentId(parentId);
        a.setActivo(true);
        return areaRepository.save(a).getId();
    }

    // ===================== USUARIOS (asignados a áreas) =====================

    private void sembrarUsuarios(Map<String, Long> areas) {
        if (usuarioRepository.count() > 0) {
            return;
        }
        crear("dirgeneral", "Dirección General", Rol.ROLE_DIRECCION_GENERAL, areas.get("dirGral"));
        crear("dirinformatica", "Director de Informática", Rol.ROLE_DIRECCION, areas.get("dirInformatica"));
        crear("diradmin", "Director Administrativo", Rol.ROLE_DIRECCION, areas.get("dirAdmin"));
        crear("coordti", "Coordinador de TI", Rol.ROLE_COORDINACION, areas.get("coordTI"));
        crear("coordredes", "Coordinador de Redes", Rol.ROLE_COORDINACION, areas.get("coordRedes"));
        crear("coordrecursos", "Coordinador de Recursos Materiales", Rol.ROLE_COORDINACION, areas.get("coordRecursos"));
        crear("desarrollo", "Departamento de Desarrollo", Rol.ROLE_DEPARTAMENTO, areas.get("desarrollo"));
        crear("soporte", "Departamento de Soporte", Rol.ROLE_DEPARTAMENTO, areas.get("soporte"));
        crear("redes", "Departamento de Redes", Rol.ROLE_DEPARTAMENTO, areas.get("redes"));
        crear("infra", "Departamento de Infraestructura", Rol.ROLE_DEPARTAMENTO, areas.get("infra"));
        crear("almacen", "Departamento de Almacén", Rol.ROLE_DEPARTAMENTO, areas.get("almacen"));
        crear("compras", "Departamento de Compras", Rol.ROLE_DEPARTAMENTO, areas.get("compras"));
    }

    private void crear(String username, String nombre, Rol rol, Long areaId) {
        if (areaId == null) {
            return;
        }
        Usuario u = new Usuario();
        u.setUsername(username);
        u.setPassword(passwordEncoder.encode("123456"));
        u.setNombreCompleto(nombre);
        u.setRol(rol);
        u.setArea(areaRepository.findById(areaId).orElse(null));
        u.setPasswordExpirada(false);
        u.setActivo(true);
        usuarioRepository.save(u);
    }

    // ===================== REQUISICIONES =====================

    private void sembrarRequisiciones(Map<String, Long> areas) {
        if (requisicionRepository.count() > 0) {
            return;
        }
        usuarioRepository.findByUsername("desarrollo").ifPresent(u -> {
            Requisicion r1 = baseRequisicion("REQ-2026-001", u, areas,
                    EstadoNivel.PENDIENTE, EstadoNivel.PENDIENTE, EstadoNivel.PENDIENTE,
                    "Laptop Dell Latitude 5440", 10.0, "Pieza", 18500.0,
                    "Laptop con procesador Intel Core i5, 16GB RAM, SSD 512GB",
                    "Renovación de equipos del equipo de desarrollo de software institucional.");
            addSugerencia(r1, "DELL", "Latitude 5440", 18500.0, "https://walmart.com.mx/dell-latitude-5440");
            addEvento(r1, u, "Creó requerimiento", "Estado", "BORRADOR", "EN_REVISION_COORD");
        });

        usuarioRepository.findByUsername("infra").ifPresent(u -> {
            Requisicion r2 = baseRequisicion("REQ-2026-002", u, areas,
                    EstadoNivel.APROBADO, EstadoNivel.PENDIENTE, EstadoNivel.PENDIENTE,
                    "Cable de Red UTP Categoría 6", 500.0, "Metro", 18.0,
                    "Cable estructurado categoría 6 para ampliación de red de datos.",
                    "Ampliación de la red de datos del edificio principal.");
            addSugerencia(r2, "PANDUIT", "C6-UTP-500", 18.0, "https://example.com/cable-cat6");
            addEvento(r2, u, "Creó requerimiento", "Estado", "BORRADOR", "EN_REVISION_COORD");
            addEvento(r2, usuarioRepository.findByUsername("coordredes").orElse(u), "Aprobó requerimiento", "Estado Coord.", "Pendiente", "Aprobado");
        });

        usuarioRepository.findByUsername("almacen").ifPresent(u -> {
            Requisicion r3 = baseRequisicion("REQ-2026-003", u, areas,
                    EstadoNivel.APROBADO, EstadoNivel.APROBADO, EstadoNivel.PENDIENTE,
                    "Paquete de Hojas Tamaño Carta", 100.0, "Caja", 120.0,
                    "Papelería para operación diaria de oficinas administrativas.",
                    "Reabastecimiento de papelería para el periodo trimestral.");
            addSugerencia(r3, "OFFICE DEPOT", "Carbón Carta P80", 120.0, "https://example.com/hojas-carta");
            addEvento(r3, u, "Creó requerimiento", "Estado", "BORRADOR", "EN_REVISION_COORD");
            addEvento(r3, usuarioRepository.findByUsername("coordrecursos").orElse(u), "Aprobó requerimiento", "Estado Coord.", "Pendiente", "Aprobado");
            addEvento(r3, usuarioRepository.findByUsername("diradmin").orElse(u), "Aprobó requerimiento", "Estado Dir.", "Pendiente", "Aprobado");
        });

        usuarioRepository.findByUsername("soporte").ifPresent(u -> {
            Requisicion r4 = baseRequisicion("REQ-2026-004", u, areas,
                    EstadoNivel.RECHAZADO, EstadoNivel.NO_APLICA, EstadoNivel.NO_APLICA,
                    "Tóner HP 85A", 20.0, "Pieza", 950.0,
                    "Tóner para impresoras de la mesa de ayuda.",
                    "Abastecimiento de consumibles de impresión.");
            addSugerencia(r4, "HP", "CF285A", 950.0, null);
            addEvento(r4, u, "Creó requerimiento", "Estado", "BORRADOR", "EN_REVISION_COORD");
            addEvento(r4, usuarioRepository.findByUsername("coordti").orElse(u), "Rechazó requerimiento", "Estado Coord.", "Pendiente", "Rechazado",
                    "Duplicidad de insumos con inventario en almacén general.");
        });
    }

    private Requisicion baseRequisicion(String folio, Usuario creador, Map<String, Long> areas,
                                        EstadoNivel ec, EstadoNivel ed, EstadoNivel eg,
                                        String material, Double cantidad, String unidad,
                                        Double precio, String descripcion, String justificacion) {
        Requisicion r = new Requisicion();
        r.setFolio(folio);
        r.setNombreSolicitante(creador.getNombreCompleto());
        Long[] cadena = resolverCadena(creador.getArea(), areas);
        r.setArea(creador.getArea().getNombre());
        r.setAreaId(creador.getArea().getId());
        r.setCoordAreaId(cadena[0]);
        r.setDirAreaId(cadena[1]);
        r.setDirGralAreaId(cadena[2]);
        r.setFechaRequerida("15/12/2026");
        r.setFechaSolicitud("01/09/2026");
        r.setPartidaCodigo("5150");
        r.setPartidaNombre("EQUIPO DE CÓMPUTO Y DE TECNOLOGÍAS DE LA INFORMACIÓN");
        r.setMaterial(material);
        r.setCantidad(cantidad);
        r.setUnidad(unidad);
        r.setPrecioEstimado(precio);
        r.setDescripcion(descripcion);
        r.setJustificacion(justificacion);
        r.setEstadoCoord(ec);
        r.setEstadoDir(ed);
        r.setEstadoDirGral(eg);
        r.setCreadoPorId(creador.getId());
        return requisicionRepository.save(r);
    }

    private Long[] resolverCadena(Area area, Map<String, Long> areas) {
        Long coordAreaId = null;
        Long dirAreaId = null;
        Long dirGralAreaId = null;
        Area actual = area;
        for (int i = 0; i < 10 && actual != null && actual.getParentId() != null; i++) {
            Area padre = areaRepository.findById(actual.getParentId()).orElse(null);
            if (padre == null) {
                break;
            }
            switch (padre.getNivel()) {
                case COORDINACION -> { if (coordAreaId == null) coordAreaId = padre.getId(); }
                case DIRECCION -> { if (dirAreaId == null) dirAreaId = padre.getId(); }
                case DIRECCION_GENERAL -> { if (dirGralAreaId == null) dirGralAreaId = padre.getId(); }
                default -> { }
            }
            actual = padre;
        }
        return new Long[]{coordAreaId, dirAreaId, dirGralAreaId};
    }

    private void addSugerencia(Requisicion r, String marca, String modelo, Double precio, String enlace) {
        Sugerencia s = new Sugerencia();
        s.setMarca(marca);
        s.setModelo(modelo);
        s.setPrecioEstimado(precio);
        s.setEnlaceUrl(enlace);
        s.setRequisicion(r);
        sugerenciaRepository.save(s);
    }

    private void addEvento(Requisicion r, Usuario usuario, String accion, String campo, String anterior, String nuevo) {
        addEvento(r, usuario, accion, campo, anterior, nuevo, null);
    }

    private void addEvento(Requisicion r, Usuario usuario, String accion, String campo, String anterior, String nuevo, String justificacion) {
        HistoricoEvento e = new HistoricoEvento();
        e.setRequisicionId(r.getId());
        e.setUsuario(usuario.getNombreCompleto());
        e.setRol(etiqueta(usuario.getRol()));
        e.setAccion(accion);
        e.setCampo(campo);
        e.setValorAnterior(anterior);
        e.setValorNuevo(nuevo);
        e.setFechaHora(LocalDateTime.now().minusMinutes(30));
        historicoRepository.save(e);
        if (justificacion != null) {
            r.setJustificacionRechazo(justificacion);
            requisicionRepository.save(r);
        }
    }

    private String etiqueta(Rol rol) {
        return switch (rol) {
            case ROLE_DEPARTAMENTO -> "Departamento";
            case ROLE_COORDINACION -> "Coordinación";
            case ROLE_DIRECCION -> "Dirección";
            case ROLE_DIRECCION_GENERAL -> "Dir. General";
            case ROLE_MATERIALES -> "Materiales";
        };
    }
}