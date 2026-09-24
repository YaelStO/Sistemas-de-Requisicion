package com.sisrequisiciones.requisiciones_backend.modules.requisicion.dto;

import com.sisrequisiciones.requisiciones_backend.modules.requisicion.entity.EstadoNivel;
import com.sisrequisiciones.requisiciones_backend.modules.requisicion.entity.EstadoRequisicion;
import com.sisrequisiciones.requisiciones_backend.modules.requisicion.entity.Requisicion;

public final class EstadoUtil {

    private EstadoUtil() {}

    public static EstadoRequisicion calcularEstadoGlobal(Requisicion r) {
        EstadoNivel coord = r.getEstadoCoord();
        EstadoNivel dir = r.getEstadoDir();
        EstadoNivel dirGral = r.getEstadoDirGral();

        if (esRechazo(coord) || esRechazo(dir) || esRechazo(dirGral)) {
            return EstadoRequisicion.RECHAZADA;
        }
        if (esAprobado(coord) && esAprobado(dir) && esAprobado(dirGral)) {
            return EstadoRequisicion.APROBADA;
        }
        if (!esAprobado(coord)) {
            return EstadoRequisicion.EN_REVISION_COORD;
        }
        if (!esAprobado(dir)) {
            return EstadoRequisicion.EN_REVISION_DIRECCION;
        }
        return EstadoRequisicion.EN_REVISION_DIRECCION_GENERAL;
    }

    private static boolean esRechazo(EstadoNivel e) {
        return e == EstadoNivel.RECHAZADO;
    }

    private static boolean esAprobado(EstadoNivel e) {
        return e == EstadoNivel.APROBADO || e == EstadoNivel.NO_APLICA;
    }
}