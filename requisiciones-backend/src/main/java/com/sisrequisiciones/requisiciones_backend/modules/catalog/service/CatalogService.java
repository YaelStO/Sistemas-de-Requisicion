package com.sisrequisiciones.requisiciones_backend.modules.catalog.service;

import com.sisrequisiciones.requisiciones_backend.modules.catalog.entity.Partida;
import com.sisrequisiciones.requisiciones_backend.modules.catalog.entity.UnidadMedida;
import com.sisrequisiciones.requisiciones_backend.modules.catalog.repository.PartidaRepository;
import com.sisrequisiciones.requisiciones_backend.modules.catalog.repository.UnidadMedidaRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CatalogService {
    private final PartidaRepository partidaRepository;
    private final UnidadMedidaRepository unidadMedidaRepository;

    public CatalogService(PartidaRepository partidaRepository, UnidadMedidaRepository unidadMedidaRepository) {
        this.partidaRepository = partidaRepository;
        this.unidadMedidaRepository = unidadMedidaRepository;
    }

    public List<Partida> findAllPartidas() {
        return partidaRepository.findAll();
    }

    public List<UnidadMedida> findAllUnidades() {
        return unidadMedidaRepository.findAll();
    }
}