package com.sisrequisiciones.requisiciones_backend.modules.requisicion.repository;

import com.sisrequisiciones.requisiciones_backend.modules.requisicion.entity.Sugerencia;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SugerenciaRepository extends JpaRepository<Sugerencia, Long> {
    List<Sugerencia> findByRequisicionId(Long requisicionId);
    void deleteByRequisicionId(Long requisicionId);
}