package com.sisrequisiciones.requisiciones_backend.modules.requisicion.service;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.sisrequisiciones.requisiciones_backend.modules.requisicion.dto.SugerenciaPreviewResponse;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class EnlacePreviewService {

    private static final int MAX_BYTES = 768 * 1024;
    private static final int MAX_REDIRECTS = 3;
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(8);
    private static final Set<Integer> PUERTOS_PERMITIDOS = Set.of(80, 443);
    private static final Pattern SCRIPT_LD_JSON = Pattern.compile(
            "<script[^>]+type=[\"']application/ld\\+json[\"'][^>]*>(.*?)</script>",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern META_TAG = Pattern.compile("<meta\\b[^>]*>", Pattern.CASE_INSENSITIVE);
    private static final Pattern META_ATTR = Pattern.compile(
            "([a-zA-Z_:][-a-zA-Z0-9_:.]*)\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\"'=<>`]+))");
    private static final Pattern TITLE = Pattern.compile("<title[^>]*>(.*?)</title>",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern H1 = Pattern.compile("<h1[^>]*>(.*?)</h1>",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern TAG = Pattern.compile("<[^>]+>");
    private static final Pattern ENTIDAD_NUMERICA = Pattern.compile("&#(x?)([0-9a-fA-F]+);",
            Pattern.CASE_INSENSITIVE);

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public EnlacePreviewService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(CONNECT_TIMEOUT)
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    public SugerenciaPreviewResponse obtener(String enlace) {
        if (enlace == null || enlace.isBlank()) {
            throw new IllegalArgumentException("Ingresa un enlace válido.");
        }
        URI uri = parsearEnlace(enlace);
        String html = descargar(uri);
        DatosProducto datos = extraerDatos(html);
        String modelo = !vacio(datos.modelo) ? datos.modelo : datos.titulo;
        if (vacio(datos.marca) && vacio(modelo) && datos.precio == null) {
            throw new IllegalArgumentException(
                    "No se pudo extraer información del enlace. Captura los datos manualmente.");
        }
        return new SugerenciaPreviewResponse(
                recortar(datos.marca, 300),
                recortar(modelo, 200),
                datos.precio,
                recortar(datos.titulo, 500),
                recortar(datos.moneda, 10));
    }

    private URI parsearEnlace(String enlace) {
        try {
            URI uri = new URI(enlace.trim());
            String esquema = uri.getScheme();
            if (esquema == null
                    || !(esquema.equalsIgnoreCase("http") || esquema.equalsIgnoreCase("https"))) {
                throw new IllegalArgumentException("Solo se permiten enlaces HTTP o HTTPS.");
            }
            return uri;
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException("El enlace no tiene un formato válido.");
        }
    }

    private String descargar(URI enlace) {
        URI actual = enlace;
        for (int intento = 0; intento <= MAX_REDIRECTS; intento++) {
            validarDestino(actual);
            HttpRequest request = HttpRequest.newBuilder(actual)
                    .timeout(REQUEST_TIMEOUT)
                    .header("User-Agent",
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                                    + "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
                    .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                    .header("Accept-Language", "es-MX,es;q=0.9,en;q=0.8")
                    .GET()
                    .build();

            HttpResponse<InputStream> response;
            try {
                response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalArgumentException("La consulta del enlace fue interrumpida.");
            } catch (IOException e) {
                throw new IllegalArgumentException(
                        "No se pudo consultar el enlace. Verifica que sea accesible.");
            }

            try (InputStream cuerpo = response.body()) {
                int estado = response.statusCode();
                if (estado >= 300 && estado < 400) {
                    String ubicacion = response.headers().firstValue("Location").orElse(null);
                    if (vacio(ubicacion) || intento == MAX_REDIRECTS) {
                        throw new IllegalArgumentException("El enlace tiene demasiadas redirecciones.");
                    }
                    try {
                        actual = actual.resolve(ubicacion.trim());
                    } catch (IllegalArgumentException e) {
                        throw new IllegalArgumentException(
                                "El enlace redirige a una dirección no válida.");
                    }
                    continue;
                }
                if (estado < 200 || estado >= 300) {
                    throw new IllegalArgumentException(
                            "El enlace respondió con el estado HTTP " + estado + ".");
                }
                return leerLimitado(cuerpo);
            } catch (IOException e) {
                throw new IllegalArgumentException("No se pudo leer el contenido del enlace.");
            }
        }
        throw new IllegalArgumentException("El enlace tiene demasiadas redirecciones.");
    }

    private void validarDestino(URI uri) {
        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            throw new IllegalArgumentException("El enlace no contiene un dominio válido.");
        }
        if (uri.getUserInfo() != null) {
            throw new IllegalArgumentException("El enlace no puede incluir credenciales.");
        }
        int puerto = uri.getPort();
        if (puerto != -1 && !PUERTOS_PERMITIDOS.contains(puerto)) {
            throw new IllegalArgumentException("Solo se permiten enlaces en los puertos 80 y 443.");
        }

        String hostSinCorchetes = host.startsWith("[") && host.endsWith("]")
                ? host.substring(1, host.length() - 1)
                : host;
        InetAddress[] direcciones;
        try {
            direcciones = InetAddress.getAllByName(hostSinCorchetes);
        } catch (UnknownHostException e) {
            throw new IllegalArgumentException("No se pudo resolver el dominio del enlace.");
        }
        for (InetAddress direccion : direcciones) {
            if (esDireccionLocal(direccion)) {
                throw new IllegalArgumentException("El enlace apunta a una dirección no permitida.");
            }
        }
    }

    private boolean esDireccionLocal(InetAddress direccion) {
        if (direccion.isAnyLocalAddress()
                || direccion.isLoopbackAddress()
                || direccion.isLinkLocalAddress()
                || direccion.isSiteLocalAddress()
                || direccion.isMulticastAddress()) {
            return true;
        }
        byte[] bytes = direccion.getAddress();
        return bytes.length == 16 && (bytes[0] & 0xfe) == 0xfc;
    }

    private String leerLimitado(InputStream entrada) throws IOException {
        ByteArrayOutputStream salida = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int total = 0;
        while (total < MAX_BYTES) {
            int leidos = entrada.read(buffer, 0, Math.min(buffer.length, MAX_BYTES - total));
            if (leidos < 0) {
                break;
            }
            salida.write(buffer, 0, leidos);
            total += leidos;
        }
        return salida.toString(StandardCharsets.UTF_8);
    }

    private DatosProducto extraerDatos(String html) {
        DatosProducto datos = new DatosProducto();
        extraerJsonLd(html, datos);
        extraerMetadatos(html, datos);

        if (vacio(datos.titulo)) {
            Matcher titulo = TITLE.matcher(html);
            if (titulo.find()) {
                datos.titulo = recortar(limpiar(titulo.group(1)), 500);
            }
        }
        if (vacio(datos.titulo)) {
            Matcher encabezado = H1.matcher(html);
            if (encabezado.find()) {
                datos.titulo = recortar(limpiar(encabezado.group(1)), 500);
            }
        }
        return datos;
    }

    private void extraerJsonLd(String html, DatosProducto datos) {
        Matcher matcher = SCRIPT_LD_JSON.matcher(html);
        while (matcher.find()) {
            String json = matcher.group(1).trim();
            if (json.isEmpty()) {
                continue;
            }
            try {
                JsonNode raiz = objectMapper.readTree(json);
                buscarProducto(raiz, datos);
            } catch (JacksonException ignored) {
            }
        }
    }

    private void buscarProducto(JsonNode nodo, DatosProducto datos) {
        if (nodo == null || nodo.isNull()) {
            return;
        }
        if (nodo.isArray()) {
            for (JsonNode hijo : nodo) {
                buscarProducto(hijo, datos);
            }
            return;
        }
        if (!nodo.isObject()) {
            return;
        }
        String tipo = texto(nodo.get("@type"));
        if (tipo != null && tipo.equalsIgnoreCase("Product")) {
            llenarProducto(nodo, datos);
        }
        for (JsonNode hijo : nodo) {
            buscarProducto(hijo, datos);
        }
    }

    private void llenarProducto(JsonNode nodo, DatosProducto datos) {
        if (vacio(datos.titulo)) {
            datos.titulo = recortar(limpiar(texto(nodo.get("name"))), 500);
        }
        if (vacio(datos.marca)) {
            datos.marca = recortar(limpiar(marcaDesde(nodo.get("brand"))), 300);
        }
        if (vacio(datos.modelo)) {
            String modelo = texto(nodo.get("mpn"));
            if (vacio(modelo)) {
                modelo = texto(nodo.get("model"));
            }
            datos.modelo = recortar(limpiar(modelo), 200);
        }
        if (datos.precio == null) {
            extraerOfertas(nodo.get("offers"), datos);
        }
    }

    private String marcaDesde(JsonNode nodo) {
        if (nodo == null || nodo.isNull()) {
            return null;
        }
        if (nodo.isArray()) {
            for (JsonNode hijo : nodo) {
                String marca = marcaDesde(hijo);
                if (!vacio(marca)) {
                    return marca;
                }
            }
            return null;
        }
        if (nodo.isObject()) {
            return texto(nodo.get("name"));
        }
        return texto(nodo);
    }

    private void extraerOfertas(JsonNode ofertas, DatosProducto datos) {
        if (ofertas == null || ofertas.isNull()) {
            return;
        }
        if (ofertas.isArray()) {
            for (JsonNode oferta : ofertas) {
                extraerOfertas(oferta, datos);
            }
            return;
        }
        if (!ofertas.isObject()) {
            return;
        }
        if (datos.precio == null) {
            Double precio = parsearPrecio(texto(ofertas.get("price")));
            if (precio == null) {
                precio = parsearPrecio(texto(ofertas.get("lowPrice")));
            }
            if (precio != null) {
                datos.precio = precio;
            }
        }
        if (vacio(datos.moneda)) {
            datos.moneda = recortar(texto(ofertas.get("priceCurrency")), 10);
        }
        if (datos.precio == null) {
            extraerOfertas(ofertas.get("priceSpecification"), datos);
        }
    }

    private void extraerMetadatos(String html, DatosProducto datos) {
        Matcher matcher = META_TAG.matcher(html);
        while (matcher.find()) {
            Map<String, String> atributos = atributos(matcher.group());
            String clave = primerNoVacio(
                    atributos.get("property"),
                    atributos.get("name"),
                    atributos.get("itemprop"));
            String contenido = atributos.get("content");
            if (vacio(clave) || contenido == null) {
                continue;
            }
            String claveNormalizada = clave.toLowerCase(Locale.ROOT);
            switch (claveNormalizada) {
                case "og:title", "twitter:title" -> {
                    if (vacio(datos.titulo)) {
                        datos.titulo = recortar(limpiar(contenido), 500);
                    }
                }
                case "product:brand", "og:brand", "brand" -> {
                    if (vacio(datos.marca)) {
                        datos.marca = recortar(limpiar(contenido), 300);
                    }
                }
                case "product:model", "og:model", "model", "product:mpn", "mpn" -> {
                    if (vacio(datos.modelo)) {
                        datos.modelo = recortar(limpiar(contenido), 200);
                    }
                }
                case "product:price:amount", "og:price:amount", "price", "product:lowprice" -> {
                    if (datos.precio == null) {
                        datos.precio = parsearPrecio(contenido);
                    }
                }
                case "product:price:currency", "og:price:currency", "pricecurrency" -> {
                    if (vacio(datos.moneda)) {
                        datos.moneda = recortar(limpiar(contenido), 10);
                    }
                }
                default -> {
                }
            }
        }
    }

    private Map<String, String> atributos(String etiqueta) {
        Map<String, String> atributos = new HashMap<>();
        Matcher matcher = META_ATTR.matcher(etiqueta);
        while (matcher.find()) {
            String nombre = matcher.group(1).toLowerCase(Locale.ROOT);
            String valor = matcher.group(2) != null
                    ? matcher.group(2)
                    : matcher.group(3) != null ? matcher.group(3) : matcher.group(4);
            atributos.put(nombre, valor);
        }
        return atributos;
    }

    private Double parsearPrecio(String valor) {
        if (vacio(valor)) {
            return null;
        }
        String limpio = valor.replaceAll("[^0-9,.]", "");
        if (limpio.isBlank()) {
            return null;
        }

        int ultimaComa = limpio.lastIndexOf(',');
        int ultimoPunto = limpio.lastIndexOf('.');
        String normalizado;
        if (ultimaComa >= 0 && ultimoPunto >= 0) {
            char separadorDecimal = ultimaComa > ultimoPunto ? ',' : '.';
            char separadorMiles = separadorDecimal == ',' ? '.' : ',';
            normalizado = limpio
                    .replace(String.valueOf(separadorMiles), "")
                    .replace(separadorDecimal, '.');
        } else {
            char separador = ultimaComa >= 0 ? ',' : '.';
            int ultimaPosicion = Math.max(ultimaComa, ultimoPunto);
            int decimales = limpio.length() - ultimaPosicion - 1;
            if (decimales >= 1 && decimales <= 2) {
                normalizado = limpio.replace(separador, '.');
            } else {
                normalizado = limpio.replace(String.valueOf(separador), "");
            }
        }

        try {
            double numero = Double.parseDouble(normalizado);
            if (numero <= 0) {
                return null;
            }
            return Math.round(numero * 100.0) / 100.0;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String texto(JsonNode nodo) {
        if (nodo == null || nodo.isNull()) {
            return null;
        }
        if (nodo.isValueNode()) {
            return nodo.asText();
        }
        return null;
    }

    private String primerNoVacio(String... valores) {
        for (String valor : valores) {
            if (!vacio(valor)) {
                return valor;
            }
        }
        return null;
    }

    private String limpiar(String texto) {
        if (texto == null) {
            return null;
        }
        String sinEtiquetas = TAG.matcher(texto).replaceAll(" ");
        String decodificado = decodificarEntidades(sinEtiquetas);
        return decodificado.replaceAll("\\s+", " ").trim();
    }

    private String decodificarEntidades(String texto) {
        String resultado = texto
                .replace("&nbsp;", " ")
                .replace("&amp;", "&")
                .replace("&quot;", "\"")
                .replace("&apos;", "'")
                .replace("&#39;", "'")
                .replace("&lt;", "<")
                .replace("&gt;", ">");
        Matcher matcher = ENTIDAD_NUMERICA.matcher(resultado);
        StringBuilder salida = new StringBuilder();
        while (matcher.find()) {
            try {
                String valor = matcher.group(2);
                int codigo = matcher.group(1).isEmpty()
                        ? Integer.parseInt(valor)
                        : Integer.parseInt(valor, 16);
                matcher.appendReplacement(salida,
                        Matcher.quoteReplacement(new String(Character.toChars(codigo))));
            } catch (IllegalArgumentException e) {
                matcher.appendReplacement(salida, Matcher.quoteReplacement(matcher.group()));
            }
        }
        matcher.appendTail(salida);
        return salida.toString();
    }

    private String recortar(String texto, int maximo) {
        if (texto == null) {
            return null;
        }
        String limpio = texto.trim();
        if (limpio.isEmpty()) {
            return null;
        }
        return limpio.length() > maximo ? limpio.substring(0, maximo).trim() : limpio;
    }

    private boolean vacio(String valor) {
        return valor == null || valor.isBlank();
    }

    private static final class DatosProducto {
        private String titulo;
        private String marca;
        private String modelo;
        private Double precio;
        private String moneda;
    }
}
