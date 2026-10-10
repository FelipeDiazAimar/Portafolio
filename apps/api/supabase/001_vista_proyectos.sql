-- Reutiliza la BD del portfolio viejo (tabla public.projects)
-- sin duplicar datos ni romper el frontend viejo.
--
-- Cómo aplicarlo:
-- 1. Abrí el proyecto Supabase en SQL Editor.
-- 2. Pegá este archivo y ejecutalo.
-- 3. La API nueva (apps/api) lee de public.proyectos;
--    si la vista no existe, el servicio hace fallback a public.projects.
--
-- Nota: Postgres pliega identificadores no entrecomillados a minúsculas,
-- por eso se usan nombres en minúsculas (longdescription, imageurl, etc.).

DROP VIEW IF EXISTS public.proyectos;

CREATE OR REPLACE VIEW public.proyectos AS
SELECT
  p.id                  AS id,
  p.slug                AS slug,
  p.title               AS titulo,
  p.description         AS resumen,
  p.technologies        AS stack,
  -- Columnas originales (compatibilidad con el portfolio viejo)
  p.title               AS title,
  p.description         AS description,
  p.longdescription     AS descripcion_larga,
  p.longdescription     AS "longDescription",
  p.imageurl            AS imagen,
  p.imageurl            AS "imageUrl",
  p.technologies        AS tecnologias,
  p.technologies        AS "technologies",
  p.livelink            AS demo,
  p.livelink            AS "liveLink",
  p.repolink            AS repo,
  p.repolink            AS "repoLink",
  p.frontendrepolink    AS "frontendRepoLink",
  p.backendrepolink     AS "backendRepoLink",
  p.imagehint           AS "imageHint",
  p.isinproduction      AS destacado,
  p.isinproduction      AS "isInProduction"
FROM public.projects p;

-- La vista hereda los datos de projects; solo falta permiso de lectura.
GRANT SELECT ON public.proyectos TO anon, authenticated;
