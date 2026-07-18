# Portafolio

Monorepo del portfolio profesional (fullstack).

## Estructura

- `apps/web` — Portfolio público (Next.js).
- `apps/playground` — Demos/mini-proyectos embebidos (React + Vite).
- `apps/api` — Backend propio (Express + Supabase).
- `packages/ui` — Componentes React compartidos entre `web` y `playground`.
- `packages/config` — Configuración compartida (ESLint, TypeScript, design tokens).

> Estructura en construcción — ver `docs/superpowers/specs/` para el diseño detallado a medida que se define cada app.

## Desarrollo

Este repo usa [npm workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces).

```bash
npm install
npm run dev:web
npm run dev:playground
npm run dev:api
```

## Despliegue en Vercel

El proyecto se despliega en Vercel a partir de `apps/web`. Al crear el proyecto en el dashboard de Vercel, configurar:

1. **Root Directory**: `apps/web`.
2. **Include files outside the Root Directory in the Build Step**: habilitar esta opción (en *Settings → General*). Es necesaria porque el build de `apps/web` accede a archivos fuera de su directorio raíz (`../playground` y `../../api/src/app.js`).
3. **Framework Preset**: Next.js.
4. **Variables de entorno** (*Settings → Environment Variables*):
   - `ALLOWED_ORIGINS`: lista de orígenes permitidos separados por coma (requerido — el middleware de CORS de `apps/api` rechaza por defecto cualquier origen que no esté en esta lista).
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CONTACT_EMAIL_TO`: ver `apps/api/.env.example` para el detalle de cada variable.
