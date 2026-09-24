package com.sisrequisiciones.requisiciones_backend.modules.requisicion.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "sugerencias")
public class Sugerencia {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String marca;

    private String modelo;

    @Column(name = "precio_estimado")
    private Double precioEstimado;

    @Column(name = "enlace_url", length = 1000)
    private String enlaceUrl;

    @Column(name = "archivo_pdf_nombre")
    private String archivoPdfNombre;

    @Column(name = "archivo_pdf_url", length = 1000)
    private String archivoPdfUrl;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requisicion_id")
    private Requisicion requisicion;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getMarca() { return marca; }
    public void setMarca(String marca) { this.marca = marca; }

    public String getModelo() { return modelo; }
    public void setModelo(String modelo) { this.modelo = modelo; }

    public Double getPrecioEstimado() { return precioEstimado; }
    public void setPrecioEstimado(Double precioEstimado) { this.precioEstimado = precioEstimado; }

    public String getEnlaceUrl() { return enlaceUrl; }
    public void setEnlaceUrl(String enlaceUrl) { this.enlaceUrl = enlaceUrl; }

    public String getArchivoPdfNombre() { return archivoPdfNombre; }
    public void setArchivoPdfNombre(String archivoPdfNombre) { this.archivoPdfNombre = archivoPdfNombre; }

    public String getArchivoPdfUrl() { return archivoPdfUrl; }
    public void setArchivoPdfUrl(String archivoPdfUrl) { this.archivoPdfUrl = archivoPdfUrl; }

    public Requisicion getRequisicion() { return requisicion; }
    public void setRequisicion(Requisicion requisicion) { this.requisicion = requisicion; }
}