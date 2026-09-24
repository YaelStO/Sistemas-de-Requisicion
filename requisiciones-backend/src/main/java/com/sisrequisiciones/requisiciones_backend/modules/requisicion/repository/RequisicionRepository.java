package com.sisrequisiciones.requisiciones_backend.modules.requisicion.repository;

import com.sisrequisiciones.requisiciones_backend.modules.requisicion.entity.Requisicion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RequisicionRepository extends JpaRepository<Requisicion, Long> {
    List<Requisicion> findByCreadoPorId(Long creadoPorId);
    List<Requisicion> findByCoordAreaId(Long coordAreaId);
    List<Requisicion> findByDirAreaId(Long dirAreaId);
    List<Requisicion> findByDirGralAreaId(Long dirGralAreaId);
    boolean existsByFolio(String folio);
}