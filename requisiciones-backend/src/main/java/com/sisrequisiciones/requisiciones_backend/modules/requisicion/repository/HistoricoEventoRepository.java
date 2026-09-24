package com.sisrequisiciones.requisiciones_backend.modules.requisicion.repository;

import com.sisrequisiciones.requisiciones_backend.modules.requisicion.entity.HistoricoEvento;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface HistoricoEventoRepository extends JpaRepository<HistoricoEvento, Long> {
    List<HistoricoEvento> findByRequisicionIdOrderByFechaHoraDesc(Long requisicionId);

    List<HistoricoEvento> findByRequisicionIdInAndAccionInOrderByFechaHoraDesc(List<Long> requisicionIds, List<String> acciones);
}