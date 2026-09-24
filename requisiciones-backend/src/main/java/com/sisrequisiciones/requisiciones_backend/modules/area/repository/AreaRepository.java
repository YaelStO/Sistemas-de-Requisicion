package com.sisrequisiciones.requisiciones_backend.modules.area.repository;

import com.sisrequisiciones.requisiciones_backend.modules.area.entity.Area;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AreaRepository extends JpaRepository<Area, Long> {
    List<Area> findAllByOrderByNivelAscNombreAsc();
    List<Area> findAllByParentId(Long parentId);
    Optional<Area> findByNombre(String nombre);
    boolean existsByNombreIgnoreCase(String nombre);
}