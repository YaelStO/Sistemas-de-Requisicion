-- Catálogo de Unidades de Medida
CREATE TABLE IF NOT EXISTS unidades_medida (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    codigo VARCHAR(10) NOT NULL UNIQUE
);

INSERT INTO unidades_medida (nombre, codigo) VALUES
('Pieza', 'PZA'),
('Metro', 'MTR'),
('Litro', 'LTR'),
('Kilo', 'KGO'),
('Licencia', 'LIC'),
('Caja', 'CJA'),
('Paquete', 'PQT'),
('Juego / Kit', 'JGO'),
('Rollo', 'RLL'),
('Servicio', 'SRV')
ON CONFLICT (nombre) DO NOTHING;

-- Tabla de Partidas (con Descripción Detallada)
CREATE TABLE IF NOT EXISTS partidas (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(10) NOT NULL UNIQUE,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT NOT NULL
);

INSERT INTO partidas (codigo, nombre, descripcion) VALUES
('2100', 'MATERIALES DE ADMINISTRACIÓN, EMISIÓN DE DOCUMENTOS Y ARTÍCULOS OFICIALES',
 'Abarca papelería, consumibles de impresión, papelería de oficina, artículos de escritorio y material impreso oficial.'),
('2110', 'MATERIALES, ÚTILES Y EQUIPOS MENORES DE OFICINA',
 'Incluye plumas, lápices, gomas, carpetas, clips, calculadoras de escritorio, perforadoras y engrapadoras de uso general.'),
('2140', 'MATERIALES, ÚTILES Y EQUIPOS MENORES DE TECNOLOGÍAS DE LA INFORMACIÓN',
 'Comprende consumibles de cómputo: tóner, tintas, memorias USB, cables, bocinas, teclados, mouse y accesorios menores de TI.'),
('2400', 'MATERIALES Y ARTÍCULOS DE CONSTRUCCIÓN Y DE REPARACIÓN',
 'Materiales para mantenimiento menor de instalaciones: pintura, impermeabilizante, cemento, varilla, herrajes y artículos de plomería.'),
('2500', 'PRODUCTOS QUÍMICOS, FARMACÉUTICOS Y DE LABORATORIO',
 'Artículos de limpieza institucional, desinfectantes, jabones, papel sanitario y productos de higiene de uso común.'),
('2600', 'COMBUSTIBLES, LUBRICANTES Y ADITIVOS',
 'Gasolina, diésel, lubricantes para vehículos oficiales y aditivos para maquinaria institucional.'),
('2700', 'VESTUARIO, BLANCOS, PRENDAS DE PROTECCIÓN Y ARTÍCULOS DEPORTIVOS',
 'Uniforme oficinal, cobertores, cortinas, ropa de trabajo y equipamiento de protección personal (guantes, cascos, botas).'),
('2900', 'HERRAMIENTAS, REFACCIONES Y ACCESORIOS MENORES',
 'Herramientas manuales, cables de red, componentes eléctricos menores, refacciones de equipo de cómputo y mantenimiento.'),
('5100', 'MOBILIARIO Y EQUIPO DE ADMINISTRACIÓN',
 'Escritorios, sillas ejecutivas, computadoras portátiles, de escritorio, servidores y licencias de software institucional.'),
('5150', 'EQUIPO DE CÓMPUTO Y DE TECNOLOGÍAS DE LA INFORMACIÓN',
 'Servidores, equipos de cómputo de escritorio y portátiles, monitores, impresoras y licenciamiento de software especializado.'),
('5200', 'VEHÍCULOS Y EQUIPO TERRESTRE',
 'Adquisición de vehículos terrestres de pasajeros y de carga, así como equipo de transporte institucional.'),
('5300', 'INSTRUMENTAL MÉDICO Y DE LABORATORIO',
 'Instrumental especializado para laboratorios de análisis clínicos y equipo médico menor de uso institucional.')
ON CONFLICT (codigo) DO UPDATE
SET descripcion = EXCLUDED.descripcion;