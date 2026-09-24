package com.sisrequisiciones.requisiciones_backend.modules.catalog.repository;

import com.sisrequisiciones.requisiciones_backend.modules.catalog.entity.Partida;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PartidaRepository extends JpaRepository<Partida, Long> {
}