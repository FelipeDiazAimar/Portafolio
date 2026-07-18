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
