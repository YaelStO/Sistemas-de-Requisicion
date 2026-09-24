package com.sisrequisiciones.requisiciones_backend.modules.requisicion.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "requisiciones")
public class Requisicion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 20)
    private String folio;

    @Column(name = "nombre_solicitante", nullable = false)
    private String nombreSolicitante;

    @Column(nullable = false)
    private String area;

    @Column(name = "fecha_requerida")
    private String fechaRequerida;

    @Column(name = "fecha_solicitud")
    private String fechaSolicitud;

    @Column(name = "partida_codigo")
    private String partidaCodigo;

    @Column(name = "partida_nombre")
    private String partidaNombre;

    @Column(nullable = false)
    private String material;

    private Double cantidad;

    private String unidad;

    @Column(name = "precio_estimado")
    private Double precioEstimado;

    private String descripcion;

    private String justificacion;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private EstadoNivel estadoCoord;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private EstadoNivel estadoDir;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private EstadoNivel estadoDirGral;

    @Column(length = 1000)
    private String justificacionRechazo;

    @Column(name = "creado_por_id", nullable = false)
    private Long creadoPorId;

    @Column(name = "area_id")
    private Long areaId;

    @Column(name = "coord_area_id")
    private Long coordAreaId;

    @Column(name = "dir_area_id")
    private Long dirAreaId;

    @Column(name = "dir_gral_area_id")
    private Long dirGralAreaId;

    @Column(name = "modificado_por")
    private String modificadoPor;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private EstadoNivel estadoMateriales;

    @Column(name = "mes_compra", length = 7)
    private String mesCompra;

    @Column(length = 200)
    private String proveedor;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_compra", length = 20)
    private EstadoCompra estadoCompra;

    @Column(name = "tipo_costo", length = 20)
    private String tipoCosto;

    @Column(name = "precio_compra")
    private Double precioCompra;

    @Column(name = "marca_seleccionada", length = 200)
    private String marcaSeleccionada;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getFolio() { return folio; }
    public void setFolio(String folio) { this.folio = folio; }

    public String getNombreSolicitante() { return nombreSolicitante; }
    public void setNombreSolicitante(String nombreSolicitante) { this.nombreSolicitante = nombreSolicitante; }

    public String getArea() { return area; }
    public void setArea(String area) { this.area = area; }

    public String getFechaRequerida() { return fechaRequerida; }
    public void setFechaRequerida(String fechaRequerida) { this.fechaRequerida = fechaRequerida; }

    public String getFechaSolicitud() { return fechaSolicitud; }
    public void setFechaSolicitud(String fechaSolicitud) { this.fechaSolicitud = fechaSolicitud; }

    public String getPartidaCodigo() { return partidaCodigo; }
    public void setPartidaCodigo(String partidaCodigo) { this.partidaCodigo = partidaCodigo; }

    public String getPartidaNombre() { return partidaNombre; }
    public void setPartidaNombre(String partidaNombre) { this.partidaNombre = partidaNombre; }

    public String getMaterial() { return material; }
    public void setMaterial(String material) { this.material = material; }

    public Double getCantidad() { return cantidad; }
    public void setCantidad(Double cantidad) { this.cantidad = cantidad; }

    public String getUnidad() { return unidad; }
    public void setUnidad(String unidad) { this.unidad = unidad; }

    public Double getPrecioEstimado() { return precioEstimado; }
    public void setPrecioEstimado(Double precioEstimado) { this.precioEstimado = precioEstimado; }

    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }

    public String getJustificacion() { return justificacion; }
    public void setJustificacion(String justificacion) { this.justificacion = justificacion; }

    public EstadoNivel getEstadoCoord() { return estadoCoord; }
    public void setEstadoCoord(EstadoNivel estadoCoord) { this.estadoCoord = estadoCoord; }

    public EstadoNivel getEstadoDir() { return estadoDir; }
    public void setEstadoDir(EstadoNivel estadoDir) { this.estadoDir = estadoDir; }

    public EstadoNivel getEstadoDirGral() { return estadoDirGral; }
    public void setEstadoDirGral(EstadoNivel estadoDirGral) { this.estadoDirGral = estadoDirGral; }

    public String getJustificacionRechazo() { return justificacionRechazo; }
    public void setJustificacionRechazo(String justificacionRechazo) { this.justificacionRechazo = justificacionRechazo; }

    public Long getCreadoPorId() { return creadoPorId; }
    public void setCreadoPorId(Long creadoPorId) { this.creadoPorId = creadoPorId; }

    public Long getAreaId() { return areaId; }
    public void setAreaId(Long areaId) { this.areaId = areaId; }

    public Long getCoordAreaId() { return coordAreaId; }
    public void setCoordAreaId(Long coordAreaId) { this.coordAreaId = coordAreaId; }

    public Long getDirAreaId() { return dirAreaId; }
    public void setDirAreaId(Long dirAreaId) { this.dirAreaId = dirAreaId; }

    public Long getDirGralAreaId() { return dirGralAreaId; }
    public void setDirGralAreaId(Long dirGralAreaId) { this.dirGralAreaId = dirGralAreaId; }

    public String getModificadoPor() { return modificadoPor; }
    public void setModificadoPor(String modificadoPor) { this.modificadoPor = modificadoPor; }

    public EstadoNivel getEstadoMateriales() { return estadoMateriales; }
    public void setEstadoMateriales(EstadoNivel estadoMateriales) { this.estadoMateriales = estadoMateriales; }

    public String getMesCompra() { return mesCompra; }
    public void setMesCompra(String mesCompra) { this.mesCompra = mesCompra; }

    public String getProveedor() { return proveedor; }
    public void setProveedor(String proveedor) { this.proveedor = proveedor; }

    public EstadoCompra getEstadoCompra() { return estadoCompra; }
    public void setEstadoCompra(EstadoCompra estadoCompra) { this.estadoCompra = estadoCompra; }

    public String getTipoCosto() { return tipoCosto; }
    public void setTipoCosto(String tipoCosto) { this.tipoCosto = tipoCosto; }

    public Double getPrecioCompra() { return precioCompra; }
    public void setPrecioCompra(Double precioCompra) { this.precioCompra = precioCompra; }

    public String getMarcaSeleccionada() { return marcaSeleccionada; }
    public void setMarcaSeleccionada(String marcaSeleccionada) { this.marcaSeleccionada = marcaSeleccionada; }
}