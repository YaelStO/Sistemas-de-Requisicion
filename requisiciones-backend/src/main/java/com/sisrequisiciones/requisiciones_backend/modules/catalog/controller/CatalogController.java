package com.sisrequisiciones.requisiciones_backend.modules.catalog.controller;

import com.sisrequisiciones.requisiciones_backend.modules.catalog.entity.Partida;
import com.sisrequisiciones.requisiciones_backend.modules.catalog.entity.UnidadMedida;
import com.sisrequisiciones.requisiciones_backend.modules.catalog.service.CatalogService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/catalogo")
public class CatalogController {

    private final CatalogService catalogService;

    public CatalogController(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @GetMapping("/partidas")
    public List<Partida> getPartidas() {
        return catalogService.findAllPartidas();
    }

    @GetMapping("/unidades-medida")
    public List<UnidadMedida> getUnidadesMedida() {
        return catalogService.findAllUnidades();
    }
}
