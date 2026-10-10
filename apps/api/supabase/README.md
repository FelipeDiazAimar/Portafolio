# Supabase reutilizado (portfolio viejo)

La API nueva no crea una BD nueva: reutiliza la del repo `Portfolio`.

- Tabla origen (vieja, no tocar): `public.projects`
  columnas: `id, title, slug, description, longdescription, imageurl,
  technologies, livelink, repolink, frontendrepolink, backendrepolink,
  imagehint, isinproduction`
- Vista nueva (este repo): `public.proyectos`
  ver `001_vista_proyectos.sql`. Expone alias en español
  (`titulo, resumen, stack`) manteniendo los nombres originales.

## Orden de lectura del servicio (`src/services/proyectos.service.js`)

1. Intenta `from('proyectos').select('*')`.
2. Si la tabla/vista no existe (`PGRST205`), hace fallback a
   `from('projects').select('*')` y normaliza a
   `{ slug, titulo, resumen, stack, ... }`.
3. Si Supabase no responde, lanza error 502 (ver `GET /api/proyectos`).

## Variables locales (no commiteadas)

`apps/api/.env` (gitignored) ya quedó creado en local con:

```ini
PORT=4000
SUPABASE_URL=<tu URL de Supabase>
SUPABASE_SERVICE_ROLE_KEY=<service_role, solo backend>
CONTACT_EMAIL_TO=felipediazaimar@gmail.com
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:9002
```

Para Vercel/producción, cargar las mismas keys en el dashboard
(Root Directory `apps/web`, más variables de la API si se despliega aparte).
Nunca exponer `SERVICE_ROLE` en el frontend.

## Estado actual de la URL vieja

Al 2026-10-09, `uxeamrctpwwyinrgnalz.supabase.co` no resuelve por DNS
(`NXDOMAIN` incluso contra 8.8.8.8). El código quedó listo, pero si esa URL
sigue sin resolver hay que:

1. Revisar en Supabase Dashboard si el proyecto está pausado/eliminado,
2. o crear un proyecto nuevo y aplicar
   `Portfolio/supabase/migrations/full_setup_and_seed.sql`,
3. y actualizar `SUPABASE_URL` + keys en `apps/api/.env` y en Vercel.
