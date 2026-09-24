package com.sisrequisiciones.requisiciones_backend.modules.requisicion.service;

import com.sisrequisiciones.requisiciones_backend.modules.area.entity.Area;
import com.sisrequisiciones.requisiciones_backend.modules.area.repository.AreaRepository;
import com.sisrequisiciones.requisiciones_backend.modules.auth.entity.Rol;
import com.sisrequisiciones.requisiciones_backend.modules.auth.entity.Usuario;
import com.sisrequisiciones.requisiciones_backend.modules.requisicion.dto.*;
import com.sisrequisiciones.requisiciones_backend.modules.requisicion.entity.*;
import com.sisrequisiciones.requisiciones_backend.modules.requisicion.repository.HistoricoEventoRepository;
import com.sisrequisiciones.requisiciones_backend.modules.requisicion.repository.RequisicionRepository;
import com.sisrequisiciones.requisiciones_backend.modules.requisicion.repository.SugerenciaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class RequisicionService {

    private final RequisicionRepository requisicionRepository;
    private final SugerenciaRepository sugerenciaRepository;
    private final HistoricoEventoRepository historicoRepository;
    private final AreaRepository areaRepository;

    public RequisicionService(
            RequisicionRepository requisicionRepository,
            SugerenciaRepository sugerenciaRepository,
            HistoricoEventoRepository historicoRepository,
            AreaRepository areaRepository) {
        this.requisicionRepository = requisicionRepository;
        this.sugerenciaRepository = sugerenciaRepository;
        this.historicoRepository = historicoRepository;
        this.areaRepository = areaRepository;
    }

    @Transactional(readOnly = true)
    public List<RequisicionResponse> listarPorRol(Usuario usuario) {
        // Un usuario solo ve sus propias requisiciones y las que dependen de su
        // área (sus "hijos" en la cadena de autorización), nunca las de terceros.
        Map<Long, Requisicion> unidas = new LinkedHashMap<>();
        for (Requisicion r : requisicionRepository.findByCreadoPorId(usuario.getId())) {
            unidas.put(r.getId(), r);
        }
        for (Requisicion r : listaAccesible(usuario)) {
            unidas.put(r.getId(), r);
        }

        return unidas.values().stream()
                .map(this::toResponse)
                .sorted((a, b) -> Long.compare(b.id(), a.id()))
                .toList();
    }

    @Transactional(readOnly = true)
    public RequisicionResponse obtener(Long id, Usuario usuario) {
        Requisicion r = requisicionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Requisición no encontrada"));
        verificarAcceso(r, usuario);
        return toResponse(r);
    }

    @Transactional
    public RequisicionResponse crear(RequisicionRequest req, Usuario autor) {
        if (autor.getRol() == Rol.ROLE_MATERIALES) {
            throw new IllegalArgumentException("El área de Materiales no puede generar requisiciones");
        }
        Requisicion r = new Requisicion();
        r.setFolio(generarFolio());
        r.setNombreSolicitante(req.nombreSolicitante());
        if (autor.getArea() == null) {
            throw new IllegalArgumentException("Tu cuenta no tiene un área asignada en el organigrama");
        }
        r.setArea(autor.getArea().getNombre());
        r.setAreaId(autor.getArea().getId());
        r.setFechaRequerida(req.fechaRequerida());
        r.setFechaSolicitud(LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")));
        r.setPartidaCodigo(req.partidaCodigo());
        r.setPartidaNombre(req.partidaNombre());
        r.setMaterial(req.material());
        r.setCantidad(req.cantidad());
        r.setUnidad(req.unidad());
        r.setPrecioEstimado(req.precioEstimado());
        r.setDescripcion(req.descripcion());
        r.setJustificacion(req.justificacion());
        r.setCreadoPorId(autor.getId());

        // Asignar la cadena jerárquica según el área del autor, subiendo por parentId
        Long[] cadena = resolverCadena(autor.getArea());
        r.setCoordAreaId(cadena[0]);
        r.setDirAreaId(cadena[1]);
        r.setDirGralAreaId(cadena[2]);
        r.setEstadoCoord(cadena[0] != null ? EstadoNivel.PENDIENTE : EstadoNivel.NO_APLICA);
        r.setEstadoDir(cadena[1] != null ? EstadoNivel.PENDIENTE : EstadoNivel.NO_APLICA);
        r.setEstadoDirGral(cadena[2] != null ? EstadoNivel.PENDIENTE : EstadoNivel.NO_APLICA);
        r.setEstadoMateriales(EstadoNivel.NO_APLICA);
        r.setMesCompra(RequisicionResponse.mesDesdeFecha(req.fechaRequerida()));

        Requisicion guardada = requisicionRepository.save(r);

        guardarSugerencias(guardada, req.sugerencias());

        if (autor.getRol() == Rol.ROLE_DEPARTAMENTO) {
            registrarEvento(guardada, autor, "Creó requerimiento", "Estado", "BORRADOR", "EN_REVISION_COORD");
        } else {
            registrarEvento(guardada, autor, "Creó requerimiento", "Material", "—", guardada.getMaterial());
        }

        return toResponse(guardada);
    }

    @Transactional
    public RequisicionResponse aprobar(Long id, Usuario usuario) {
        Requisicion r = requisicionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Requisición no encontrada"));

        String nivel = nivelActual(r);
        if (nivel == null) {
            throw new IllegalArgumentException("La requisición ya está aprobada o rechazada");
        }
        verificarAutorizador(r, usuario, nivel);

        switch (nivel) {
            case "COORD" -> {
                r.setEstadoCoord(EstadoNivel.APROBADO);
                registrarEvento(r, usuario, "Aprobó requerimiento", "Estado Coord.", "Pendiente", "Aprobado");
            }
            case "DIR" -> {
                r.setEstadoDir(EstadoNivel.APROBADO);
                registrarEvento(r, usuario, "Aprobó requerimiento", "Estado Dir.", "Pendiente", "Aprobado");
            }
            case "DIRGRAL" -> {
                r.setEstadoDirGral(EstadoNivel.APROBADO);
                r.setEstadoMateriales(EstadoNivel.PENDIENTE);
                registrarEvento(r, usuario, "Aprobó requerimiento", "Estado Dir. Gral.", "Pendiente", "Aprobado");
            }
        }
        r.setModificadoPor(usuario.getNombreCompleto());
        return toResponse(requisicionRepository.save(r));
    }

    @Transactional
    public RequisicionResponse rechazar(Long id, String justificacion, Usuario usuario) {
        Requisicion r = requisicionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Requisición no encontrada"));

        String nivel = nivelActual(r);
        if (nivel == null) {
            throw new IllegalArgumentException("La requisición ya está aprobada o rechazada");
        }
        verificarAutorizador(r, usuario, nivel);

        switch (nivel) {
            case "COORD" -> {
                r.setEstadoCoord(EstadoNivel.RECHAZADO);
                registrarEvento(r, usuario, "Rechazó requerimiento", "Estado Coord.", "Pendiente", "Rechazado");
            }
            case "DIR" -> {
                r.setEstadoDir(EstadoNivel.RECHAZADO);
                registrarEvento(r, usuario, "Rechazó requerimiento", "Estado Dir.", "Pendiente", "Rechazado");
            }
            case "DIRGRAL" -> {
                r.setEstadoDirGral(EstadoNivel.RECHAZADO);
                registrarEvento(r, usuario, "Rechazó requerimiento", "Estado Dir. Gral.", "Pendiente", "Rechazado");
            }
        }
        r.setJustificacionRechazo(justificacion);
        r.setModificadoPor(usuario.getNombreCompleto());
        return toResponse(requisicionRepository.save(r));
    }

    @Transactional
    public RequisicionResponse modificar(Long id, ModificacionRequest req, Usuario usuario) {
        Requisicion r = requisicionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Requisición no encontrada"));

        // Solo niveles superiores (no el departamento creador) pueden modificar
        if (usuario.getRol() == Rol.ROLE_DEPARTAMENTO) {
            throw new IllegalArgumentException("El departamento no puede modificar después de enviar");
        }
        verificarAutorizador(r, usuario, "CUALQUIERA");

        registrarCambio(r, usuario, "Material", r.getMaterial(), req.material());
        registrarCambio(r, usuario, "Cantidad", valor(r.getCantidad()), valor(req.cantidad()));
        registrarCambio(r, usuario, "Unidad", r.getUnidad(), req.unidad());
        registrarCambio(r, usuario, "Precio Estimado", valor(r.getPrecioEstimado()), valor(req.precioEstimado()));
        registrarCambio(r, usuario, "Descripción", r.getDescripcion(), req.descripcion());
        registrarCambio(r, usuario, "Justificación", r.getJustificacion(), req.justificacion());

        r.setMaterial(req.material());
        r.setCantidad(req.cantidad());
        r.setUnidad(req.unidad());
        r.setPrecioEstimado(req.precioEstimado());
        r.setDescripcion(req.descripcion());
        r.setJustificacion(req.justificacion());
        r.setModificadoPor(usuario.getNombreCompleto());
        requisicionRepository.save(r);

        // Reemplazar sugerencias
        sugerenciaRepository.deleteByRequisicionId(r.getId());
        guardarSugerencias(r, req.sugerencias());

        return toResponse(r);
    }

    @Transactional(readOnly = true)
    public List<HistoricoEventoResponse> historial(Long id, Usuario usuario) {
        Requisicion r = requisicionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Requisición no encontrada"));
        verificarAcceso(r, usuario);

        return historicoRepository.findByRequisicionIdOrderByFechaHoraDesc(id).stream()
                .map(e -> new HistoricoEventoResponse(
                        e.getId(), e.getFechaHora(), e.getUsuario(), e.getRol(),
                        e.getAccion(), e.getCampo(), e.getValorAnterior(), e.getValorNuevo()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RequisicionResponse> enProceso(Usuario usuario) {
        List<RequisicionResponse> mías = requisicionRepository.findByCreadoPorId(usuario.getId()).stream()
                .map(this::toResponse)
                .toList();

        return mías.stream()
                .filter(r -> r.estadoGlobal().contains("EN_REVISION"))
                .sorted((a, b) -> Long.compare(b.id(), a.id()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<NotificacionResponse> notificaciones(Usuario usuario) {
        // El solicitante ve lo que ocurrió con sus requisiciones; los receptores
        // (Coord, Dir, DG) además reciben los eventos de las solicitudes de su
        // área en la cadena de autorización (p. ej. movimiento de mes de compra).
        Map<Long, Requisicion> relevantes = new LinkedHashMap<>();
        for (Requisicion r : requisicionRepository.findByCreadoPorId(usuario.getId())) {
            relevantes.put(r.getId(), r);
        }
        Area area = usuario.getArea();
        if (area != null) {
            switch (usuario.getRol()) {
                case ROLE_COORDINACION ->
                        requisicionRepository.findByCoordAreaId(area.getId())
                                .forEach(r -> relevantes.putIfAbsent(r.getId(), r));
                case ROLE_DIRECCION ->
                        requisicionRepository.findByDirAreaId(area.getId())
                                .forEach(r -> relevantes.putIfAbsent(r.getId(), r));
                case ROLE_DIRECCION_GENERAL ->
                        requisicionRepository.findByDirGralAreaId(area.getId())
                                .forEach(r -> relevantes.putIfAbsent(r.getId(), r));
                default -> { /* SIN_NOTIFICACIONES_ADICIONALES */ }
            }
        }
        if (relevantes.isEmpty()) {
            return List.of();
        }

        Map<Long, String> folioPorId = relevantes.values().stream()
                .collect(Collectors.toMap(Requisicion::getId, Requisicion::getFolio));

        List<String> acciones = List.of("Aprobó requerimiento", "Rechazó requerimiento", "Modificó registro",
                "Autorizó la compra", "Reasignó partida", "Reasignó mes de compra",
                "Registró la compra", "Entregó el material");

        return historicoRepository.findByRequisicionIdInAndAccionInOrderByFechaHoraDesc(
                        new ArrayList<>(relevantes.keySet()), acciones)
                .stream()
                .map(e -> new NotificacionResponse(
                        folioPorId.get(e.getRequisicionId()),
                        e.getRequisicionId(),
                        e.getFechaHora(),
                        e.getUsuario(),
                        e.getRol(),
                        e.getAccion(),
                        e.getCampo(),
                        e.getValorAnterior(),
                        e.getValorNuevo()))
                .toList();
    }

    @Transactional(readOnly = true)
    public DashboardResponse dashboard(Usuario usuario) {
        List<Requisicion> todas = listaAccesible(usuario);
        List<RequisicionResponse> items = todas.stream().map(this::toResponse).toList();

        long pendientes = items.stream().filter(r -> r.estadoGlobal().contains("EN_REVISION")).count();
        long aprobadas = items.stream().filter(r -> "APROBADA".equals(r.estadoGlobal())).count();
        long rechazadas = items.stream().filter(r -> "RECHAZADA".equals(r.estadoGlobal())).count();
        long enRevision = pendientes;

        List<DashboardResponse.PorArea> porArea = items.stream()
                .collect(java.util.stream.Collectors.groupingBy(RequisicionResponse::area))
                .entrySet().stream()
                .map(e -> {
                    List<RequisicionResponse> q = e.getValue();
                    long p = q.stream().filter(r -> r.estadoGlobal().contains("EN_REVISION")).count();
                    long a = q.stream().filter(r -> "APROBADA".equals(r.estadoGlobal())).count();
                    long rj = q.stream().filter(r -> "RECHAZADA".equals(r.estadoGlobal())).count();
                    return new DashboardResponse.PorArea(e.getKey(), q.size(), p, a, rj);
                })
                .toList();

        return new DashboardResponse(todas.size(), pendientes, aprobadas, rechazadas, enRevision, porArea);
    }

    // ===================== FLUJO DE MATERIALES =====================

    @Transactional(readOnly = true)
    public List<RequisicionResponse> listarMateriales(Usuario usuario) {
        verificarMateriales(usuario);
        // Solo llegan a Materiales las requisiciones aprobadas por Dirección General.
        return requisicionRepository.findAll().stream()
                .filter(r -> r.getEstadoDirGral() == EstadoNivel.APROBADO)
                .map(this::toResponse)
                .sorted((a, b) -> Long.compare(b.id(), a.id()))
                .toList();
    }

    @Transactional
    public RequisicionResponse autorizarCompra(Long id, String proveedor, Long sugerenciaId, Double costoPropio, Usuario usuario) {
        verificarMateriales(usuario);
        Requisicion r = obtenerAprobada(id);
        if (estadoMateriales(r) != EstadoNivel.PENDIENTE) {
            throw new IllegalArgumentException("La requisición no está pendiente de adjudicar la compra");
        }
        String mesActual = RequisicionResponse.mesCompraDe(r);
        if (esMesBloqueado(mesActual)) {
            throw new IllegalArgumentException("No se pueden autorizar compras en " + nombreMesBloqueado(mesActual)
                    + ". Mueve primero el mes de compra a otro mes");
        }
        if (proveedor != null && proveedor.length() > 200) {
            throw new IllegalArgumentException("El proveedor no puede exceder 200 caracteres");
        }

        String decision = resolverCosto(r, sugerenciaId, costoPropio);
        String prov = proveedor != null && proveedor.isBlank() ? null : proveedor;
        r.setEstadoMateriales(EstadoNivel.APROBADO);
        r.setEstadoCompra(EstadoCompra.EN_COMPRA);
        r.setProveedor(prov);
        r.setModificadoPor(usuario.getNombreCompleto());
        registrarEvento(r, usuario, "Autorizó la compra", "Estado Materiales", "Pendiente", "En compra");
        registrarEvento(r, usuario, "Autorizó la compra", "Decisión de costo", "—", decision);
        if (prov != null) {
            registrarEvento(r, usuario, "Autorizó la compra", "Proveedor", "—", prov);
        }
        return toResponse(requisicionRepository.save(r));
    }

    /**
     * Resuelve la decisión de costo al autorizar: usa una sugerencia del
     * solicitante o un costo propio de Materiales. Devuelve la descripción
     * de la decisión y deja el costo/marca guardados en la requisición.
     */
    private String resolverCosto(Requisicion r, Long sugerenciaId, Double costoPropio) {
        if (sugerenciaId != null) {
            Sugerencia s = sugerenciaRepository.findById(sugerenciaId)
                    .orElseThrow(() -> new IllegalArgumentException("La sugerencia seleccionada no existe"));
            if (s.getRequisicion() == null || !s.getRequisicion().getId().equals(r.getId())) {
                throw new IllegalArgumentException("La sugerencia no pertenece a esta requisición");
            }
            String marca = (s.getMarca() + (s.getModelo() != null && !s.getModelo().isBlank() ? " " + s.getModelo() : "")).trim();
            r.setTipoCosto("SUGERENCIA");
            r.setMarcaSeleccionada(marca);
            r.setPrecioCompra(s.getPrecioEstimado());
            return "Sugerencia: " + marca + (s.getPrecioEstimado() != null
                    ? " (" + String.format("%.2f", s.getPrecioEstimado()) + ")" : "");
        }
        if (costoPropio != null && costoPropio > 0) {
            r.setTipoCosto("PROPIO");
            r.setMarcaSeleccionada(null);
            r.setPrecioCompra(costoPropio);
            return "Costo propio de Materiales: " + String.format("%.2f", costoPropio);
        }
        throw new IllegalArgumentException("Indica si usarás una sugerencia del solicitante o un costo propio para la compra");
    }

    @Transactional
    public RequisicionResponse marcarComprado(Long id, Usuario usuario) {
        verificarMateriales(usuario);
        Requisicion r = obtenerAprobada(id);
        if (r.getEstadoCompra() != EstadoCompra.EN_COMPRA) {
            throw new IllegalArgumentException("La compra no está 'En compra'; no se puede registrar como realizada");
        }
        if (estadoMateriales(r) != EstadoNivel.APROBADO) {
            throw new IllegalArgumentException("La requisición no está en proceso de compra");
        }
        r.setEstadoCompra(EstadoCompra.COMPRADO);
        r.setModificadoPor(usuario.getNombreCompleto());
        registrarEvento(r, usuario, "Registró la compra", "Estado compra", "En compra", "Comprado");
        return toResponse(requisicionRepository.save(r));
    }

    @Transactional
    public RequisicionResponse marcarEntregado(Long id, Usuario usuario) {
        verificarMateriales(usuario);
        Requisicion r = obtenerAprobada(id);
        if (r.getEstadoCompra() != EstadoCompra.COMPRADO) {
            throw new IllegalArgumentException("Debes registrar primero la compra realizada antes de marcarla como entregada");
        }
        if (estadoMateriales(r) != EstadoNivel.APROBADO) {
            throw new IllegalArgumentException("La requisición no está en proceso de compra");
        }
        r.setEstadoCompra(EstadoCompra.ENTREGADO);
        r.setModificadoPor(usuario.getNombreCompleto());
        registrarEvento(r, usuario, "Entregó el material", "Estado compra", "Comprado", "Entregado");
        return toResponse(requisicionRepository.save(r));
    }

    @Transactional
    public RequisicionResponse reasignarPartida(Long id, String codigo, String nombre, Usuario usuario) {
        verificarMateriales(usuario);
        Requisicion r = obtenerAprobada(id);
        if (codigo == null || codigo.isBlank() || nombre == null || nombre.isBlank()) {
            throw new IllegalArgumentException("Selecciona una partida válida para clasificar el gasto");
        }
        registrarEvento(r, usuario, "Reasignó partida", "Partida",
                clavePartida(r.getPartidaCodigo(), r.getPartidaNombre()), clavePartida(codigo, nombre));
        r.setPartidaCodigo(codigo);
        r.setPartidaNombre(nombre);
        r.setModificadoPor(usuario.getNombreCompleto());
        return toResponse(requisicionRepository.save(r));
    }

    @Transactional
    public RequisicionResponse reasignarMes(Long id, String mes, String justificacion, Usuario usuario) {
        verificarMateriales(usuario);
        Requisicion r = obtenerAprobada(id);
        if (mes == null || !mes.matches("\\d{4}-(0[1-9]|1[0-2])")) {
            throw new IllegalArgumentException("Mes de compra inválido (usa formato yyyy-MM)");
        }
        if (esMesBloqueado(mes)) {
            throw new IllegalArgumentException("No se pueden programar compras en " + nombreMesBloqueado(mes)
                    + "; elige otro mes");
        }
        if (justificacion == null || justificacion.isBlank()) {
            throw new IllegalArgumentException("Debes indicar el motivo del cambio de mes de compra");
        }
        if (justificacion.length() > 500) {
            throw new IllegalArgumentException("La justificación no puede exceder 500 caracteres");
        }
        String actual = RequisicionResponse.mesCompraDe(r);
        if (!actual.equals(mes)) {
            registrarEvento(r, usuario, "Reasignó mes de compra", "Mes de compra", actual, mes);
        }
        // La justificación queda registrada para que el solicitante y la
        // Dirección General vean el motivo en sus notificaciones.
        registrarEvento(r, usuario, "Reasignó mes de compra", "Justificación", "—", justificacion.trim());
        r.setMesCompra(mes);
        r.setModificadoPor(usuario.getNombreCompleto());
        return toResponse(requisicionRepository.save(r));
    }

    private void verificarMateriales(Usuario usuario) {
        if (usuario.getRol() != Rol.ROLE_MATERIALES) {
            throw new IllegalArgumentException("Solo el área de Materiales puede administrar la compra");
        }
    }

    private Requisicion obtenerAprobada(Long id) {
        Requisicion r = requisicionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Requisición no encontrada"));
        if (EstadoUtil.calcularEstadoGlobal(r) != EstadoRequisicion.APROBADA) {
            throw new IllegalArgumentException("La requisición aún no está aprobada en todos los niveles");
        }
        return r;
    }

    private EstadoNivel estadoMateriales(Requisicion r) {
        if (r.getEstadoMateriales() != null) {
            return r.getEstadoMateriales();
        }
        return EstadoUtil.calcularEstadoGlobal(r) == EstadoRequisicion.APROBADA
                ? EstadoNivel.PENDIENTE : EstadoNivel.NO_APLICA;
    }

    private String clavePartida(String codigo, String nombre) {
        return (codigo != null ? codigo : "—") + " · " + (nombre != null ? nombre : "—");
    }

    /** Diciembre y enero están bloqueados para compras. */
    private boolean esMesBloqueado(String mes) {
        if (mes == null || mes.length() < 7) {
            return false;
        }
        String mesNum = mes.substring(5, 7);
        return "12".equals(mesNum) || "01".equals(mesNum);
    }

    private String nombreMesBloqueado(String mes) {
        if (mes != null && mes.length() >= 7) {
            return "12".equals(mes.substring(5, 7)) ? "diciembre" : "enero";
        }
        return "ese mes";
    }

    // ===================== HELPERS =====================

    private RequisicionResponse toResponse(Requisicion r) {
        List<SugerenciaResponse> sugs = sugerenciaRepository.findByRequisicionId(r.getId())
                .stream().map(SugerenciaResponse::from).toList();
        return RequisicionResponse.from(r, sugs);
    }

    private void guardarSugerencias(Requisicion r, List<RequisicionRequest.SugerenciaRequest> reqs) {
        if (reqs == null) {
            return;
        }
        for (RequisicionRequest.SugerenciaRequest s : reqs) {
            Sugerencia su = new Sugerencia();
            su.setMarca(s.marca());
            su.setModelo(s.modelo());
            su.setPrecioEstimado(s.precioEstimado());
            su.setEnlaceUrl(s.enlaceUrl());
            su.setArchivoPdfNombre(s.archivoPdfNombre());
            su.setArchivoPdfUrl(s.archivoPdfUrl());
            su.setRequisicion(r);
            sugerenciaRepository.save(su);
        }
    }

    private String nivelActual(Requisicion r) {
        if (r.getEstadoCoord() == EstadoNivel.PENDIENTE) return "COORD";
        if (r.getEstadoDir() == EstadoNivel.PENDIENTE) return "DIR";
        if (r.getEstadoDirGral() == EstadoNivel.PENDIENTE) return "DIRGRAL";
        return null;
    }

    /**
     * Devuelve el id del área del usuario, o null si no tiene una asignada.
     */
    private Long areaIdDe(Usuario usuario) {
        return usuario.getArea() != null ? usuario.getArea().getId() : null;
    }

    /**
     * Requisiciones que el usuario puede ver según su rol: las originadas en su
     * propia área ("sus hijos" en la cadena de autorización) y las propias.
     * Materiales solo ve lo aprobado por Dirección General; el resto de roles
     * jamás ve trámites ajenos a su cadena.
     */
    private List<Requisicion> listaAccesible(Usuario usuario) {
        return switch (usuario.getRol()) {
            case ROLE_DEPARTAMENTO -> requisicionRepository.findByCreadoPorId(usuario.getId());
            case ROLE_COORDINACION ->
                    usuario.getArea() != null
                            ? requisicionRepository.findByCoordAreaId(usuario.getArea().getId())
                            : List.of();
            case ROLE_DIRECCION ->
                    usuario.getArea() != null
                            ? requisicionRepository.findByDirAreaId(usuario.getArea().getId())
                            : List.of();
            case ROLE_DIRECCION_GENERAL ->
                    usuario.getArea() != null
                            ? requisicionRepository.findByDirGralAreaId(usuario.getArea().getId())
                            : List.of();
            case ROLE_MATERIALES -> requisicionRepository.findAll().stream()
                    .filter(r -> r.getEstadoDirGral() == EstadoNivel.APROBADO)
                    .toList();
        };
    }

    private void verificarAutorizador(Requisicion r, Usuario usuario, String nivel) {
        Long areaId = areaIdDe(usuario);
        boolean puede;
        switch (usuario.getRol()) {
            case ROLE_COORDINACION -> puede = r.getCoordAreaId() != null && r.getCoordAreaId().equals(areaId);
            case ROLE_DIRECCION -> puede = r.getDirAreaId() != null && r.getDirAreaId().equals(areaId);
            case ROLE_DIRECCION_GENERAL -> puede = r.getDirGralAreaId() != null && r.getDirGralAreaId().equals(areaId);
            case ROLE_MATERIALES -> puede = true; // Materiales ve todo pero normalmente solo libera
            default -> puede = false;
        }
        if (!puede) {
            throw new IllegalArgumentException("No tienes autorización sobre esta requisición");
        }

        if ("CUALQUIERA".equals(nivel)) {
            return; // Modificación permitida para cualquier nivel superior de la cadena
        }
        String nivelActual = nivelActual(r);
        if (!nivel.equals(nivelActual) || !nivelActual.equals(rolToNivel(usuario.getRol()))) {
            throw new IllegalArgumentException("No es tu turno de aprobar esta requisición");
        }
    }

    private String rolToNivel(Rol rol) {
        return switch (rol) {
            case ROLE_COORDINACION -> "COORD";
            case ROLE_DIRECCION -> "DIR";
            case ROLE_DIRECCION_GENERAL -> "DIRGRAL";
            default -> "NA";
        };
    }

    private void verificarAcceso(Requisicion r, Usuario usuario) {
        // El creador de la requisición siempre puede consultar su propio proceso,
        // aunque su área no sea destino de autorización en la cadena.
        if (r.getCreadoPorId() != null && r.getCreadoPorId().equals(usuario.getId())) {
            return;
        }
        boolean ok = switch (usuario.getRol()) {
            case ROLE_DEPARTAMENTO -> r.getCreadoPorId() != null && r.getCreadoPorId().equals(usuario.getId());
            case ROLE_COORDINACION -> r.getCoordAreaId() != null && r.getCoordAreaId().equals(areaIdDe(usuario));
            case ROLE_DIRECCION -> r.getDirAreaId() != null && r.getDirAreaId().equals(areaIdDe(usuario));
            case ROLE_DIRECCION_GENERAL -> r.getDirGralAreaId() != null && r.getDirGralAreaId().equals(areaIdDe(usuario));
            case ROLE_MATERIALES -> r.getEstadoDirGral() == EstadoNivel.APROBADO;
            default -> false;
        };
        if (!ok) {
            throw new IllegalArgumentException("No tienes acceso a esta requisición");
        }
    }

    private void registrarCambio(Requisicion r, Usuario u, String campo, String anterior, String nuevo) {
        String a = anterior == null ? "—" : anterior;
        String n = nuevo == null ? "—" : nuevo;
        if (!a.equals(n)) {
            registrarEvento(r, u, "Modificó registro", campo, a, n);
        }
    }

    private String valor(Object o) {
        return o == null ? "" : String.valueOf(o);
    }

    private void registrarEvento(Requisicion r, Usuario u, String accion, String campo, String anterior, String nuevo) {
        HistoricoEvento e = new HistoricoEvento();
        e.setRequisicionId(r.getId());
        e.setUsuario(u.getNombreCompleto());
        e.setRol(rolEtiqueta(u.getRol()));
        e.setAccion(accion);
        e.setCampo(campo);
        e.setValorAnterior(anterior);
        e.setValorNuevo(nuevo);
        e.setFechaHora(LocalDateTime.now());
        historicoRepository.save(e);
    }

    public static String rolEtiqueta(Rol rol) {
        return switch (rol) {
            case ROLE_DEPARTAMENTO -> "Departamento";
            case ROLE_COORDINACION -> "Coordinación";
            case ROLE_DIRECCION -> "Dirección";
            case ROLE_DIRECCION_GENERAL -> "Dir. General";
            case ROLE_MATERIALES -> "Materiales";
        };
    }

    private String generarFolio() {
        String anio = String.valueOf(LocalDateTime.now().getYear());
        long total = requisicionRepository.count();
        String folio;
        do {
            total++;
            folio = "REQ-" + anio + "-" + String.format("%03d", total);
        } while (requisicionRepository.existsByFolio(folio));
        return folio;
    }

    /**
     * Recorre la jerarquía del área del autor por parentId y devuelve
     * [coordAreaId, dirAreaId, dirGralAreaId] correspondientes a los niveles
     * superiores que deben autorizar. El organigrama vive en las áreas, no en los usuarios.
     */
    private Long[] resolverCadena(Area area) {
        if (area == null) {
            return new Long[]{null, null, null};
        }
        Long coordAreaId = null;
        Long dirAreaId = null;
        Long dirGralAreaId = null;

        Area actual = area;
        for (int i = 0; i < 10; i++) {
            if (actual.getParentId() == null) {
                break;
            }
            Area padre = areaRepository.findById(actual.getParentId()).orElse(null);
            if (padre == null) {
                break;
            }
            switch (padre.getNivel()) {
                case COORDINACION -> {
                    if (coordAreaId == null) coordAreaId = padre.getId();
                }
                case DIRECCION -> {
                    if (dirAreaId == null) dirAreaId = padre.getId();
                }
                case DIRECCION_GENERAL -> {
                    if (dirGralAreaId == null) dirGralAreaId = padre.getId();
                }
                default -> { }
            }
            actual = padre;
        }
        return new Long[]{coordAreaId, dirAreaId, dirGralAreaId};
    }
}