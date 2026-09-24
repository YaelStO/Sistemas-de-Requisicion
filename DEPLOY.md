# Despliegue: Backend (Render) + Base de datos (Supabase) + Frontend (Vercel)

Este proyecto ya está preparado. Solo sigue los pasos en orden: **1) GitHub → 2) Supabase → 3) Render → 4) Vercel**.

---

## 1. Subir el proyecto a GitHub

El código está en `requisiciones-backend` y `requisiciones-frontend`. Súbelo a un repo nuevo:

```bash
cd "Sistema de Requerimientos"
git init
git add .
git commit -m "Deploy: backend env-driven, Docker, vercel.json"
# crea un repo vacío en https://github.com/new y luego:
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

---

## 2. Supabase (la base de datos PostgreSQL en la nube)

1. Crea una cuenta y un proyecto en https://supabase.com (elige región cercana, p. ej. `us-east-1`).
2. Espera a que termine la provisión y copia estos datos de **Project Settings → Database → Connection string**:
   - **Host directo:** `db.<PROJECT-REF>.supabase.co`  (puerto `5432`)
   - **Transaction Pooler (PgBouncer):** `aws-0-<region>.pooler.supabase.com` (puerto `6543`) — recomendado para Render.
   - **Usuario:** `postgres.<PROJECT-REF>` (cuando uses el pooler) o `postgres` (conexión directa).
   - **Contraseña:** la Password de la base que definiste al crear el proyecto.
3. Convierte la cadena del pooler a una URL JDBC (la que entiende Spring):

   ```
   jdbc:postgresql://aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
   ```

   - En Render define `DB_USERNAME=postgres.<PROJECT-REF>` y `DB_PASSWORD=<tu password>`.
   - No hay que crear tablas: Hibernate las crea solo (`ddl-auto: update`) y los catálogos se siembran con `data.sql`. El primer arranque también crea las áreas y usuarios demo (`DataInitializer`).
4. Si algún día quieres persistir los PDFs, Supabase **Storage** es la opción (ver al final).

---

## 3. Render (el backend Spring Boot)

**Opcion A — Blueprint (recomendado):** Dashboard de Render → **New → Blueprint** → conecta el repo → Render leerá `requisiciones-backend/render.yaml` y te pedirá llenar estas variables:

| Variable | Ejemplo |
|---|---|
| `DB_URL` | `jdbc:postgresql://aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require` |
| `DB_USERNAME` | `postgres.<PROJECT-REF>` |
| `DB_PASSWORD` | la password de tu Supabase |
| `JWT_SECRET` | una cadena larga que inventes (mínimo 32 caracteres) |
| `APP_BASE_URL` | `https://REEMPLAZA-CON-TU-BACKEND.onrender.com` (lo llenas después de crear el servicio) |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:4200,https://TU-APP.vercel.app` (la URL final de Vercel) |

**Opcion B — Manual:** New → **Web Service** → conecta el repo → **Root directory:** `requisiciones-backend` → **Runtime:** Docker (usa el `Dockerfile`) → define las mismas variables → **Health Check Path:** `/api/v1/catalogo/partidas`.

Luego:
1. Copia la URL final (`https://xxxxxxxx.onrender.com`).
2. Actualiza `APP_BASE_URL` con esa URL (los enlaces de PDF que guarda el backend las usan).
3. Añade la URL de Vercel a `CORS_ALLOWED_ORIGINS`.
4. Redespliega para aplicar los cambios.

> **Nota importante:** el plan gratuito de Render tiene disco efímero. Los PDFs que se suben se pierden al redesplegar. Si te importan, contrata un **Persisted Disk** de Render (ajusta `UPLOAD_DIR` a la ruta del disco) o usa **Supabase Storage**.

---

## 4. Vercel (el frontend Angular)

1. Edita `requisiciones-frontend/src/environments/environment.prod.ts` y pon tu backend real:

   ```ts
   export const environment = {
     production: true,
     apiUrl: 'https://xxxxxxxx.onrender.com/api/v1'
   };
   ```

2. Sube ese cambio a GitHub (`git commit` + `git push`).
3. En Vercel: **Add New → Project** → importa el repo → **Root Directory:** `requisiciones-frontend`. Vercel detectará el `vercel.json` y correrá `ng build`.
4. Pulso **Deploy**. Obtendrás una URL `https://tu-app.vercel.app`.
5. Agrega esa URL al CORS del backend (paso 3) y redespliega el backend.

### Primer acceso

Usuarios iniciales (`DataInitializer`, contraseña `123456`; se generan solo con una base vacía):

```
usuario: dirgeneral    rol: Dirección General
usuario: coordrecursos rol: Coordinación de Recursos Materiales
usuario: desarrollo    rol: Departamento de Desarrollo
...
```

(Al primer login el sistema puede pedir cambiar la contraseña si aplica.)

---

## Post-despliegue (opcional): PDFs persistentes con Supabase Storage

Hoy el backend guarda los PDFs en disco (`UPLOAD_DIR`). Para persistirlos en Supabase Storage:

1. Crea un **bucket** `cotizaciones` (público o privado) en Supabase.
2. Al backend le faltaría un cliente de Storage (subir con los `supabase` keys: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) y ajustar `ArchivoService` para que cuide los archivos ahí.
3. Si lo necesitas, puedo implementarlo: solo avísame.