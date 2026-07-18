# Diseño: Monorepo del Portfolio Fullstack

Fecha: 2026-07-18

## Contexto y objetivo

Repo nuevo (`github.com/FelipeDiazAimar/Portafolio`) para el portfolio profesional de un desarrollador fullstack. Debe alojar:
- El sitio del portfolio en sí (público).
- Un espacio de demos/mini-proyectos embebidos.
- Un backend propio que demuestre habilidades backend reales.

Stack acordado: React (JSX, sin TypeScript), Next.js, Vite, CSS Modules, Express, Supabase. Todo se despliega en Vercel, en **un solo proyecto Vercel**.

## Arquitectura general

Monorepo con `apps/` (proyectos deployables/ejecutables de forma independiente en local) y `packages/` (código compartido vía npm workspaces).

```
portafolio/
├── apps/
│   ├── web/            # Next.js — portfolio público (único proyecto Vercel)
│   ├── playground/      # Vite + React — demos embebidas
│   └── api/             # Express + Supabase — backend propio
├── packages/
│   ├── ui/               # Componentes React compartidos (web + playground)
│   └── config/           # ESLint, design tokens compartidos
├── docs/
│   └── superpowers/specs/   # Specs de diseño (este archivo)
├── package.json            # workspaces: apps/*, packages/*
├── .nvmrc                   # Node 24
└── .gitignore
```

**Por qué monorepo con `packages/` compartidos:** cada `apps/*` puede desarrollarse y correr en forma aislada (`npm run dev` propio), pero `packages/ui` y `packages/config` evitan duplicar componentes y variables de diseño entre `web` y `playground`. No obliga a compartir nada desde el día uno, pero deja el lugar armado para cuando haga falta.

## `apps/web` — Next.js (portfolio público)

```
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.jsx
│   │   ├── page.jsx                    # Home
│   │   ├── proyectos/
│   │   │   ├── page.jsx                # Listado
│   │   │   └── [slug]/page.jsx         # Detalle
│   │   ├── sobre-mi/page.jsx
│   │   ├── contacto/page.jsx
│   │   └── api/
│   │       ├── contacto/route.js       # Endpoint del form de contacto
│   │       └── [...path]/route.js      # Adapter: delega a apps/api (Express)
│   ├── components/                     # Componentes propios de web
│   │   ├── Header/{Header.jsx,Header.module.css}
│   │   └── ProjectCard/{ProjectCard.jsx,ProjectCard.module.css}
│   ├── data/                           # Contenido de proyectos (JSON) hasta tener CMS
│   ├── lib/                            # Helpers (fetch, formateo)
│   └── styles/{globals.css,tokens.css}
├── public/
│   └── playground/                     # Build estático de apps/playground (copiado en build)
├── next.config.js
├── package.json                        # script build: build playground → copiar → next build
├── jsconfig.json                       # alias @/components, etc. (JSX, sin TS)
└── vercel.ts                            # único vercel.ts del monorepo (framework: "nextjs")
```

- JSX puro, App Router, una carpeta por sección.
- `data/` sirve de fuente de proyectos hasta sumar CMS/Supabase; solo cambia `lib/`, no los componentes.
- `app/api/[...path]/route.js` es el puente hacia `apps/api` (ver sección de despliegue unificado).

## `apps/api` — Express + Supabase (backend propio)

```
apps/api/
├── src/
│   ├── index.js                # Entry point local (`npm run dev` standalone)
│   ├── app.js                  # Express app: middlewares + rutas (exportado, sin listen())
│   ├── routes/{contacto.routes.js,proyectos.routes.js}
│   ├── controllers/{contacto.controller.js,proyectos.controller.js}
│   ├── services/{contacto.service.js,proyectos.service.js}
│   ├── lib/supabaseClient.js   # Cliente Supabase centralizado
│   ├── middlewares/{errorHandler.js,cors.js}
│   └── config/env.js           # Carga y valida env vars
├── .env.example                # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CONTACT_EMAIL_TO, ALLOWED_ORIGINS
└── package.json
```

- Arquitectura por capas: `routes → controllers → services → supabaseClient`, testeable por capa.
- `app.js` exporta la app Express sin llamar `listen()` — así `src/index.js` (local) y el adapter de `apps/web` (`app/api/[...path]/route.js`) pueden reusar exactamente el mismo código.
- `middlewares/cors.js` permite explícitamente los orígenes de `web`/`playground` en dev y prod.

## `apps/playground` — Vite + React (demos embebidas)

```
apps/playground/
├── src/
│   ├── main.jsx
│   ├── App.jsx                 # Router simple entre demos
│   ├── demos/
│   │   ├── demo-uno/{DemoUno.jsx,DemoUno.module.css}
│   │   └── demo-dos/{DemoDos.jsx,DemoDos.module.css}
│   ├── components/              # Nav/layout propio del playground
│   └── styles/globals.css
├── public/
├── index.html
├── vite.config.js               # base: '/playground/' para servir embebido en web
└── package.json
```

- Cada demo es una carpeta autocontenida en `demos/`; sumar un mini-proyecto = sumar una carpeta.
- No tiene variables de entorno propias (demos estáticas). No se despliega como proyecto Vercel independiente: su `dist/` se copia a `apps/web/public/playground/` durante el build de `web`.

## `packages/ui` y `packages/config`

```
packages/ui/                     # "@portafolio/ui"
├── src/
│   ├── Button/{Button.jsx,Button.module.css}
│   ├── Card/{Card.jsx,Card.module.css}
│   └── index.js                 # Barrel export
└── package.json

packages/config/                 # "@portafolio/config"
├── eslint/index.js               # Config ESLint base para los 3 apps/*
├── tokens/tokens.css              # Variables de diseño: colores, spacing, tipografía
└── package.json
```

- `web` y `playground` importan `@portafolio/ui` para componentes compartidos y `@portafolio/config/tokens/tokens.css` para consistencia visual.

## Despliegue: un solo proyecto Vercel

Decisión explícita: **no se despliegan 3 proyectos Vercel separados**. Un único proyecto con *Root Directory* = `apps/web`.

1. `apps/api` sigue siendo un Express real y standalone (mismo código de la sección anterior), pero se monta embebido: `apps/web/src/app/api/[...path]/route.js` importa el `app.js` de Express y lo invoca dentro de la misma Vercel Function de Next.js. Si en el futuro se necesita separarlo, se puede desplegar aparte sin reescribir `apps/api`.
2. `apps/playground` se buildea con `vite build` y su salida se copia a `apps/web/public/playground/` como parte del script `build` de `apps/web`, antes de `next build`. Next.js sirve ese contenido como estático bajo `/playground`.
3. En desarrollo local no cambia nada: cada `apps/*` corre con su propio `npm run dev` (Next, Vite, Express) de forma independiente.
4. Único `vercel.ts` del monorepo, en `apps/web`, con `framework: "nextjs"`.

## Variables de entorno

- `apps/api/.env.example`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CONTACT_EMAIL_TO`, `ALLOWED_ORIGINS`.
- `apps/web/.env.example`: ninguna variable pública a un backend externo (el backend va embebido); variables propias de Next si surgen más adelante.
- `apps/playground`: sin `.env` (demos estáticas).
- `.nvmrc` en la raíz fija Node 24 para todo el monorepo.

## Fuera de alcance (por ahora)

- CMS externo para el contenido de proyectos (se usa `data/` local hasta que haga falta).
- Tests automatizados (no se definieron requerimientos de testing en esta ronda de diseño).
- CI/CD más allá del deploy automático de Vercel.
