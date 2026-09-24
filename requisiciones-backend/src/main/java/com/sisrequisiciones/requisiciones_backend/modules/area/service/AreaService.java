package com.sisrequisiciones.requisiciones_backend.modules.area.service;

import com.sisrequisiciones.requisiciones_backend.modules.area.dto.AreaRequest;
import com.sisrequisiciones.requisiciones_backend.modules.area.entity.Area;
import com.sisrequisiciones.requisiciones_backend.modules.area.entity.AreaNivel;
import com.sisrequisiciones.requisiciones_backend.modules.area.repository.AreaRepository;
import com.sisrequisiciones.requisiciones_backend.modules.auth.entity.Usuario;
import com.sisrequisiciones.requisiciones_backend.modules.auth.repository.UsuarioRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AreaService {

    private final AreaRepository areaRepository;
    private final UsuarioRepository usuarioRepository;

    public AreaService(AreaRepository areaRepository, UsuarioRepository usuarioRepository) {
        this.areaRepository = areaRepository;
        this.usuarioRepository = usuarioRepository;
    }

    @Transactional(readOnly = true)
    public List<AreaRequest.AreaResponse> listar() {
        return areaRepository.findAllByOrderByNivelAscNombreAsc().stream()
                .map(a -> AreaRequest.AreaResponse.from(a, nombrePadre(a)))
                .toList();
    }

    @Transactional
    public AreaRequest.AreaResponse crear(AreaRequest request) {
        validar(request.nombre(), request.nivel(), request.parentId(), null);
        Area area = new Area();
        area.setNombre(request.nombre().trim());
        area.setNivel(request.nivel());
        area.setParentId(request.parentId());
        area.setActivo(true);
        Area guardada = areaRepository.save(area);
        return AreaRequest.AreaResponse.from(guardada, nombrePadre(guardada));
    }

    @Transactional
    public AreaRequest.AreaResponse actualizar(Long id, AreaRequest request) {
        Area area = areaRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("El área no existe"));
        validar(request.nombre(), request.nivel(), request.parentId(), id);
        area.setNombre(request.nombre().trim());
        area.setNivel(request.nivel());
        area.setParentId(request.parentId());
        Area guardada = areaRepository.save(area);
        return AreaRequest.AreaResponse.from(guardada, nombrePadre(guardada));
    }

    @Transactional
    public AreaRequest.AreaResponse cambiarEstado(Long id, boolean activo) {
        Area area = areaRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("El área no existe"));
        area.setActivo(activo);
        return AreaRequest.AreaResponse.from(areaRepository.save(area), nombrePadre(area));
    }

    @Transactional
    public void eliminar(Long id) {
        Area area = areaRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("El área no existe"));

        if (!areaRepository.findAllByParentId(id).isEmpty()) {
            throw new IllegalArgumentException("No se puede eliminar: el área tiene áreas hijas asignadas. Elimina o reasigna primero.");
        }

        List<Usuario> usuarios = usuarioRepository.findByAreaId(id);
        if (!usuarios.isEmpty()) {
            usuarioRepository.deleteAll(usuarios);
        }

        areaRepository.delete(area);
    }

    private void validar(String nombre, AreaNivel nivel, Long parentId, Long id) {
        if (parentId != null && parentId.equals(id)) {
            throw new IllegalArgumentException("Un área no puede ser superior de sí misma");
        }
        if (parentId != null) {
            Area padre = areaRepository.findById(parentId)
                    .orElseThrow(() -> new IllegalArgumentException("El área superior no existe"));
            if (esDescendiente(padre, id)) {
                throw new IllegalArgumentException("El área superior crearía un ciclo en el organigrama");
            }
        }
    }

    private boolean esDescendiente(Area actual, Long buscado) {
        if (buscado == null || actual.getParentId() == null) {
            return false;
        }
        Area padre = areaRepository.findById(actual.getParentId()).orElse(null);
        if (padre == null) {
            return false;
        }
        if (padre.getId().equals(buscado)) {
            return true;
        }
        return esDescendiente(padre, buscado);
    }

    private String nombrePadre(Area area) {
        if (area.getParentId() == null) {
            return null;
        }
        return areaRepository.findById(area.getParentId()).map(Area::getNombre).orElse(null);
    }
}