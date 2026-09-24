package com.sisrequisiciones.requisiciones_backend.modules.archivo.service;

import com.sisrequisiciones.requisiciones_backend.modules.archivo.dto.ArchivoResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class ArchivoService {

    private final Path uploadDir;
    private final String baseUrl;

    public ArchivoService(
            @Value("${app.upload.dir}") String uploadDirPath,
            @Value("${app.base-url}") String baseUrl) {
        this.uploadDir = Path.of(uploadDirPath).toAbsolutePath().normalize();
        this.baseUrl = baseUrl;
    }

    public ArchivoResponse guardar(MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) {
            throw new IllegalArgumentException("Debes seleccionar un archivo.");
        }
        if (!"application/pdf".equalsIgnoreCase(archivo.getContentType())) {
            throw new IllegalArgumentException("Solo se aceptan archivos PDF.");
        }
        try {
            Files.createDirectories(uploadDir);
            String extension = extension(archivo.getOriginalFilename());
            String nombreInterno = UUID.randomUUID() + extension;
            Path destino = uploadDir.resolve(nombreInterno).normalize();
            if (!destino.startsWith(uploadDir)) {
                throw new IllegalArgumentException("Nombre de archivo invalido.");
            }
            Files.copy(archivo.getInputStream(), destino, StandardCopyOption.REPLACE_EXISTING);
            return new ArchivoResponse(archivo.getOriginalFilename(), nombreInterno, baseUrl + "/api/v1/archivos/" + nombreInterno, archivo.getSize());
        } catch (IOException e) {
            throw new RuntimeException("No se pudo guardar el archivo.", e);
        }
    }

    public Resource cargar(String nombreInterno) {
        String limpiado = Path.of(nombreInterno).getFileName().toString();
        Path archivo = uploadDir.resolve(limpiado).normalize();
        if (!archivo.startsWith(uploadDir) || !Files.exists(archivo) || !Files.isRegularFile(archivo)) {
            throw new IllegalArgumentException("Archivo no encontrado");
        }
        return new FileSystemResource(archivo);
    }

    private String extension(String nombreOriginal) {
        if (nombreOriginal == null) {
            return ".pdf";
        }
        int i = nombreOriginal.lastIndexOf('.');
        return i >= 0 ? nombreOriginal.substring(i) : ".pdf";
    }
}