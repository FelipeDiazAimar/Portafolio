# Portfolio Monorepo Scaffold — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the full portfolio monorepo (apps/web, apps/playground, apps/api, packages/ui, packages/config) with real, runnable code per `docs/superpowers/specs/2026-07-18-portfolio-monorepo-design.md`, and wire it so the whole thing deploys as a single Vercel project.

**Architecture:** npm workspaces monorepo. `apps/web` (Next.js, App Router) is the only Vercel-facing app. `apps/api` (Express) is a standalone, independently-runnable backend whose exported Express app is embedded into `apps/web` via a Next.js Pages Router catch-all route. `apps/playground` (Vite + React) builds to static assets that get copied into `apps/web/public/playground` before `next build`. `packages/ui` and `packages/config` are shared workspace packages consumed via `transpilePackages` (Next) and native ESM resolution (Vite).

**Tech Stack:** Next.js 15 (App Router, JSX), React 19, Vite 6, Express 4, Supabase JS client, CSS Modules, npm workspaces, Node 24.

## Deviations from the approved spec (found while planning — read before implementing)

1. **API embedding mechanism:** the spec said `apps/web/src/app/api/[...path]/route.js` (App Router) would "delegate" to the Express app. App Router Route Handlers only expose Web-standard `Request`/`Response`, not Node's raw `(req, res)`, so an Express app (which is literally a `(req, res) => void` function) can't be invoked there without a fragile custom adapter. Instead, this plan uses **`apps/web/pages/api/[...path].js`** (Next.js Pages Router). Pages Router API routes hand you Node-compatible `(req, res)` objects directly — `export default app` is the standard, documented way to run an Express app on Vercel/Next.js. Pages Router and App Router coexist fine in the same Next.js project. This also means a separate dedicated `/api/contacto` App Router route is unnecessary — Express's own `/api/contacto` route (mounted inside `app.js`) handles it once the catch-all forwards everything under `/api/*`.
2. **`vercel.ts` → `vercel.json`:** the spec mentioned a single `vercel.ts` per the current Vercel config docs. That format depends on an `@vercel/config` package whose availability I could not verify. Since our Vercel config here is trivial (just `framework: "nextjs"` — Root Directory and the monorepo "include files outside root" toggle are dashboard settings, not file-based), this plan uses the long-established `vercel.json` instead. Practically identical result, zero dependency risk.

Everything else (folder layout, layered Express, CSS Modules, shared packages, single-Vercel-project deploy) matches the spec exactly.

## Global Constraints

- Application code is JSX (`.jsx`) — no TypeScript, except trivial tooling config where noted.
- Styling is CSS Modules (`*.module.css`) plus a shared `tokens.css` from `packages/config`.
- Node version: 24 (`.nvmrc` at repo root).
- Package manager: npm workspaces (`apps/*`, `packages/*`) — no pnpm/yarn.
- Single Vercel project, Root Directory = `apps/web`. No separate deploys for `apps/playground` or `apps/api`.
- No automated test framework in this round (explicitly out of scope per spec) — verification steps use `curl` and build/dev commands instead of unit tests.
- `apps/api`'s Express `app.js` must stay runnable standalone (`node src/index.js`) as well as embedded in `apps/web`.

---

### Task 1: Root Workspace Tooling

**Files:**
- Modify: `package.json` (root)
- Create: `.nvmrc`

**Interfaces:**
- Produces: root `workspaces` config (`apps/*`, `packages/*`) that every later task's `npm install` relies on.

- [ ] **Step 1: Pin the Node version**

Create `.nvmrc`:

```
24
```

- [ ] **Step 2: Add engines and a root build script**

Edit `package.json` (root) — add `"engines"` and a `build` script that targets the only deployable app:

```json
{
  "name": "portafolio",
  "private": true,
  "engines": {
    "node": ">=24"
  },
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev:web": "npm run dev -w apps/web",
    "dev:playground": "npm run dev -w apps/playground",
    "dev:api": "npm run dev -w apps/api",
    "build": "npm run build -w apps/web"
  }
}
```

- [ ] **Step 3: Verify the JSON is valid**

Run: `node -e "console.log(require('./package.json').workspaces)"`
Expected: `[ 'apps/*', 'packages/*' ]`

- [ ] **Step 4: Commit**

```bash
git add package.json .nvmrc
git commit -m "chore: pin Node version and add root build script"
```

---

### Task 2: `packages/config` — Shared Design Tokens & Lint Config

**Files:**
- Create: `packages/config/package.json`
- Create: `packages/config/tokens/tokens.css`
- Create: `packages/config/eslint/index.js`

**Interfaces:**
- Produces: CSS custom properties (`--color-bg`, `--color-fg`, `--color-muted`, `--color-accent`, `--font-sans`, `--space-1..4`, `--radius`) importable as `@portafolio/config/tokens/tokens.css`. Shared ESLint flat-config array importable as `require('@portafolio/config/eslint')`.

- [ ] **Step 1: Create the package manifest**

`packages/config/package.json`:

```json
{
  "name": "@portafolio/config",
  "version": "0.0.0",
  "private": true,
  "main": "eslint/index.js",
  "dependencies": {
    "@eslint/js": "^9.15.0"
  }
}
```

- [ ] **Step 2: Create the shared design tokens**

`packages/config/tokens/tokens.css`:

```css
:root {
  --color-bg: #0b0d12;
  --color-fg: #f4f5f7;
  --color-muted: #9aa1ac;
  --color-accent: #5b8cff;
  --font-sans: system-ui, -apple-system, "Segoe UI", sans-serif;
  --space-1: 0.5rem;
  --space-2: 1rem;
  --space-3: 1.5rem;
  --space-4: 2.5rem;
  --radius: 8px;
}
```

- [ ] **Step 3: Create the shared ESLint config**

`packages/config/eslint/index.js`:

```js
const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];
```

- [ ] **Step 4: Install and verify it resolves**

Run: `npm install`
Run: `node -e "console.log(require('./packages/config/eslint/index.js').length)"`
Expected: `2`

- [ ] **Step 5: Commit**

```bash
git add packages/config package-lock.json
git commit -m "feat(config): add shared design tokens and eslint config"
```

---

### Task 3: `packages/ui` — Shared Button and Card Components

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/src/Button/Button.jsx`
- Create: `packages/ui/src/Button/Button.module.css`
- Create: `packages/ui/src/Card/Card.jsx`
- Create: `packages/ui/src/Card/Card.module.css`
- Create: `packages/ui/src/index.js`

**Interfaces:**
- Produces: `Button({ children, onClick, variant = 'primary', type = 'button' })` and `Card({ title, children })`, both exported from `@portafolio/ui`.
- Consumes: CSS custom properties from `packages/config/tokens/tokens.css` (with hardcoded fallbacks so the components render even if tokens aren't loaded).

- [ ] **Step 1: Create the package manifest**

`packages/ui/package.json`:

```json
{
  "name": "@portafolio/ui",
  "version": "0.0.0",
  "private": true,
  "main": "src/index.js",
  "peerDependencies": {
    "react": "^19.0.0"
  }
}
```

- [ ] **Step 2: Create Button**

`packages/ui/src/Button/Button.jsx`:

```jsx
import styles from './Button.module.css';

export default function Button({ children, onClick, variant = 'primary', type = 'button' }) {
  const className = variant === 'secondary' ? styles.secondary : styles.primary;

  return (
    <button type={type} className={className} onClick={onClick}>
      {children}
    </button>
  );
}
```

`packages/ui/src/Button/Button.module.css`:

```css
.primary {
  background: var(--color-accent, #5b8cff);
  color: #fff;
  border: none;
  border-radius: var(--radius, 8px);
  padding: 0.5rem 1rem;
  font-size: 1rem;
  cursor: pointer;
}

.secondary {
  background: transparent;
  color: var(--color-accent, #5b8cff);
  border: 1px solid var(--color-accent, #5b8cff);
  border-radius: var(--radius, 8px);
  padding: 0.5rem 1rem;
  font-size: 1rem;
  cursor: pointer;
}
```

- [ ] **Step 3: Create Card**

`packages/ui/src/Card/Card.jsx`:

```jsx
import styles from './Card.module.css';

export default function Card({ title, children }) {
  return (
    <div className={styles.card}>
      {title ? <h3 className={styles.title}>{title}</h3> : null}
      <div className={styles.body}>{children}</div>
    </div>
  );
}
```

`packages/ui/src/Card/Card.module.css`:

```css
.card {
  background: var(--color-bg, #0b0d12);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius, 8px);
  padding: var(--space-3, 1.5rem);
}

.title {
  margin: 0 0 var(--space-1, 0.5rem);
  color: var(--color-fg, #f4f5f7);
}

.body {
  color: var(--color-muted, #9aa1ac);
}
```

- [ ] **Step 4: Barrel export**

`packages/ui/src/index.js`:

```js
export { default as Button } from './Button/Button.jsx';
export { default as Card } from './Card/Card.jsx';
```

- [ ] **Step 5: Install**

Run: `npm install`
Expected: exits 0, `node_modules/@portafolio/ui` symlinked to `packages/ui`.

Note: `Button`/`Card` don't have a standalone runtime here (no React app in this task) — they're exercised end-to-end in Task 5 and Task 6 when `apps/playground` and `apps/web` actually render them. Full verification happens there.

- [ ] **Step 6: Commit**

```bash
git add packages/ui package-lock.json
git commit -m "feat(ui): add shared Button and Card components"
```

---

### Task 4: `apps/api` — Express Backend Scaffold

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/.env.example`
- Create: `apps/api/src/config/env.js`
- Create: `apps/api/src/lib/supabaseClient.js`
- Create: `apps/api/src/middlewares/cors.js`
- Create: `apps/api/src/middlewares/errorHandler.js`
- Create: `apps/api/src/services/proyectos.service.js`
- Create: `apps/api/src/services/contacto.service.js`
- Create: `apps/api/src/controllers/proyectos.controller.js`
- Create: `apps/api/src/controllers/contacto.controller.js`
- Create: `apps/api/src/routes/proyectos.routes.js`
- Create: `apps/api/src/routes/contacto.routes.js`
- Create: `apps/api/src/app.js`
- Create: `apps/api/src/index.js`

**Interfaces:**
- Produces: `module.exports = app` from `apps/api/src/app.js` — an Express app with routes mounted at `/api/health` (GET), `/api/proyectos` (GET), `/api/contacto` (POST). No `listen()` call in `app.js` (Task 7's Next.js adapter needs the bare app).
- Consumes: env vars `PORT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CONTACT_EMAIL_TO`, `ALLOWED_ORIGINS`.

- [ ] **Step 1: Create the package manifest**

`apps/api/package.json`:

```json
{
  "name": "@portafolio/api",
  "version": "0.0.0",
  "private": true,
  "main": "src/app.js",
  "scripts": {
    "dev": "node src/index.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "@supabase/supabase-js": "^2.45.0"
  }
}
```

- [ ] **Step 2: Env example and loader**

`apps/api/.env.example`:

```
PORT=4000
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CONTACT_EMAIL_TO=tu-correo@ejemplo.com
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

`apps/api/src/config/env.js`:

```js
require('dotenv').config();

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

module.exports = {
  PORT: process.env.PORT || 4000,
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  CONTACT_EMAIL_TO: process.env.CONTACT_EMAIL_TO || '',
  ALLOWED_ORIGINS,
};
```

- [ ] **Step 3: Supabase client**

`apps/api/src/lib/supabaseClient.js`:

```js
const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = require('../config/env');

let client = null;

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const err = new Error('Supabase no está configurado: faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    err.status = 500;
    throw err;
  }

  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }

  return client;
}

module.exports = { getSupabaseClient };
```

- [ ] **Step 4: Middlewares**

`apps/api/src/middlewares/cors.js`:

```js
const cors = require('cors');
const { ALLOWED_ORIGINS } = require('../config/env');

module.exports = cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
});
```

`apps/api/src/middlewares/errorHandler.js`:

```js
module.exports = function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Error interno' });
};
```

- [ ] **Step 5: Proyectos route (service → controller → route)**

`apps/api/src/services/proyectos.service.js`:

```js
const { getSupabaseClient } = require('../lib/supabaseClient');

async function listProyectos() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('proyectos').select('*');

  if (error) {
    const err = new Error(error.message);
    err.status = 502;
    throw err;
  }

  return data;
}

module.exports = { listProyectos };
```

`apps/api/src/controllers/proyectos.controller.js`:

```js
const { listProyectos } = require('../services/proyectos.service');

async function getProyectos(req, res, next) {
  try {
    const proyectos = await listProyectos();
    res.json({ proyectos });
  } catch (err) {
    next(err);
  }
}

module.exports = { getProyectos };
```

`apps/api/src/routes/proyectos.routes.js`:

```js
const { Router } = require('express');
const { getProyectos } = require('../controllers/proyectos.controller');

const router = Router();
router.get('/', getProyectos);

module.exports = router;
```

- [ ] **Step 6: Contacto route (service → controller → route)**

`apps/api/src/services/contacto.service.js`:

```js
const { CONTACT_EMAIL_TO } = require('../config/env');

async function submitContacto({ nombre, email, mensaje } = {}) {
  if (!nombre || !email || !mensaje) {
    const err = new Error('Faltan campos requeridos: nombre, email, mensaje');
    err.status = 400;
    throw err;
  }

  console.log(`[contacto] Nuevo mensaje para ${CONTACT_EMAIL_TO || '(sin destino configurado)'}:`, {
    nombre,
    email,
    mensaje,
  });

  return { recibido: true };
}

module.exports = { submitContacto };
```

`apps/api/src/controllers/contacto.controller.js`:

```js
const { submitContacto } = require('../services/contacto.service');

async function postContacto(req, res, next) {
  try {
    const resultado = await submitContacto(req.body);
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = { postContacto };
```

`apps/api/src/routes/contacto.routes.js`:

```js
const { Router } = require('express');
const { postContacto } = require('../controllers/contacto.controller');

const router = Router();
router.post('/', postContacto);

module.exports = router;
```

- [ ] **Step 7: Assemble the app and the standalone entrypoint**

`apps/api/src/app.js`:

```js
const express = require('express');
const corsMiddleware = require('./middlewares/cors');
const errorHandler = require('./middlewares/errorHandler');
const proyectosRoutes = require('./routes/proyectos.routes');
const contactoRoutes = require('./routes/contacto.routes');

const app = express();

app.use(corsMiddleware);
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/proyectos', proyectosRoutes);
app.use('/api/contacto', contactoRoutes);

app.use(errorHandler);

module.exports = app;
```

`apps/api/src/index.js`:

```js
const app = require('./app');
const { PORT } = require('./config/env');

app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});
```

- [ ] **Step 8: Install and run it standalone**

Run: `npm install`

Run (starts the server in the background, hits it, then stops it):

```bash
PORT=4001 node apps/api/src/index.js &
API_PID=$!
sleep 1
curl -s http://localhost:4001/api/health
curl -s -X POST http://localhost:4001/api/contacto -H "Content-Type: application/json" -d '{}'
curl -s -X POST http://localhost:4001/api/contacto -H "Content-Type: application/json" -d '{"nombre":"Ana","email":"ana@test.com","mensaje":"Hola"}'
curl -s http://localhost:4001/api/proyectos
kill $API_PID
```

Expected output (in order):
- `{"status":"ok"}`
- `{"error":"Faltan campos requeridos: nombre, email, mensaje"}`
- `{"recibido":true}`
- `{"error":"Supabase no está configurado: faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"}` (expected until real Supabase credentials are added to `apps/api/.env` — proves the error handler catches it cleanly instead of crashing the process)

- [ ] **Step 9: Commit**

```bash
git add apps/api package-lock.json
git commit -m "feat(api): scaffold Express backend with proyectos and contacto endpoints"
```

---

### Task 5: `apps/playground` — Vite Demos Scaffold

**Files:**
- Create: `apps/playground/package.json`
- Create: `apps/playground/index.html`
- Create: `apps/playground/vite.config.js`
- Create: `apps/playground/src/main.jsx`
- Create: `apps/playground/src/App.jsx`
- Create: `apps/playground/src/App.module.css`
- Create: `apps/playground/src/demos/demo-uno/DemoUno.jsx`
- Create: `apps/playground/src/demos/demo-uno/DemoUno.module.css`
- Create: `apps/playground/src/demos/demo-dos/DemoDos.jsx`
- Create: `apps/playground/src/demos/demo-dos/DemoDos.module.css`
- Create: `apps/playground/src/styles/globals.css`

**Interfaces:**
- Consumes: `Button`, `Card` from `@portafolio/ui` (Task 3); `tokens.css` from `@portafolio/config` (Task 2).
- Produces: static build at `apps/playground/dist/` (base path `/playground/`) — consumed by Task 7's copy step.

- [ ] **Step 1: Package manifest**

`apps/playground/package.json`:

```json
{
  "name": "@portafolio/playground",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@portafolio/ui": "*",
    "@portafolio/config": "*"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.3.0"
  }
}
```

- [ ] **Step 2: Vite config with `/playground/` base path**

`apps/playground/vite.config.js`:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  base: '/playground/',
  plugins: [react()],
  server: {
    fs: {
      allow: [path.resolve(__dirname, '../..')],
    },
  },
  build: {
    outDir: 'dist',
  },
});
```

`apps/playground/index.html`:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Playground</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Entry point and shared styles**

`apps/playground/src/styles/globals.css`:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: var(--font-sans, system-ui, sans-serif);
  background: var(--color-bg, #0b0d12);
  color: var(--color-fg, #f4f5f7);
}
```

`apps/playground/src/main.jsx`:

```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import '@portafolio/config/tokens/tokens.css';
import './styles/globals.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 4: App shell with demo navigation**

`apps/playground/src/App.module.css`:

```css
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 1.5rem);
  padding: var(--space-3, 1.5rem);
}

.nav {
  display: flex;
  gap: var(--space-2, 1rem);
}

.content {
  flex: 1;
}
```

`apps/playground/src/App.jsx`:

```jsx
import { useState } from 'react';
import { Button } from '@portafolio/ui';
import DemoUno from './demos/demo-uno/DemoUno.jsx';
import DemoDos from './demos/demo-dos/DemoDos.jsx';
import styles from './App.module.css';

const DEMOS = {
  'demo-uno': { label: 'Demo Uno', Component: DemoUno },
  'demo-dos': { label: 'Demo Dos', Component: DemoDos },
};

export default function App() {
  const [activeDemo, setActiveDemo] = useState('demo-uno');
  const { Component } = DEMOS[activeDemo];

  return (
    <div className={styles.layout}>
      <nav className={styles.nav}>
        {Object.entries(DEMOS).map(([key, demo]) => (
          <Button
            key={key}
            variant={activeDemo === key ? 'primary' : 'secondary'}
            onClick={() => setActiveDemo(key)}
          >
            {demo.label}
          </Button>
        ))}
      </nav>
      <main className={styles.content}>
        <Component />
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Demo Uno (counter)**

`apps/playground/src/demos/demo-uno/DemoUno.module.css`:

```css
.value {
  font-size: 2rem;
  font-weight: 700;
}
```

`apps/playground/src/demos/demo-uno/DemoUno.jsx`:

```jsx
import { useState } from 'react';
import { Card, Button } from '@portafolio/ui';
import styles from './DemoUno.module.css';

export default function DemoUno() {
  const [count, setCount] = useState(0);

  return (
    <Card title="Demo Uno: contador">
      <p className={styles.value}>{count}</p>
      <Button onClick={() => setCount((c) => c + 1)}>Sumar</Button>
    </Card>
  );
}
```

- [ ] **Step 6: Demo Dos (reversed text)**

`apps/playground/src/demos/demo-dos/DemoDos.module.css`:

```css
.input {
  width: 100%;
  padding: var(--space-1, 0.5rem);
  border-radius: var(--radius, 8px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: transparent;
  color: inherit;
}
```

`apps/playground/src/demos/demo-dos/DemoDos.jsx`:

```jsx
import { useState } from 'react';
import { Card } from '@portafolio/ui';
import styles from './DemoDos.module.css';

export default function DemoDos() {
  const [texto, setTexto] = useState('');

  return (
    <Card title="Demo Dos: texto invertido">
      <input
        className={styles.input}
        value={texto}
        onChange={(event) => setTexto(event.target.value)}
        placeholder="Escribí algo..."
      />
      <p>{texto.split('').reverse().join('')}</p>
    </Card>
  );
}
```

- [ ] **Step 7: Install, run dev, and build**

Run: `npm install`

```bash
npm run dev -w apps/playground &
DEV_PID=$!
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/playground/
kill $DEV_PID
```

Expected: `200`

```bash
npm run build -w apps/playground
```

Expected: exits 0, creates `apps/playground/dist/index.html` with asset URLs prefixed `/playground/assets/...`.

- [ ] **Step 8: Commit**

```bash
git add apps/playground package-lock.json
git commit -m "feat(playground): scaffold Vite demos app with shared UI components"
```

---

### Task 6: `apps/web` — Next.js Portfolio Scaffold

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.js`
- Create: `apps/web/jsconfig.json`
- Create: `apps/web/src/styles/globals.css`
- Create: `apps/web/src/app/layout.jsx`
- Create: `apps/web/src/app/page.jsx`
- Create: `apps/web/src/app/sobre-mi/page.jsx`
- Create: `apps/web/src/app/contacto/page.jsx`
- Create: `apps/web/src/app/proyectos/page.jsx`
- Create: `apps/web/src/app/proyectos/[slug]/page.jsx`
- Create: `apps/web/src/components/Header/Header.jsx`
- Create: `apps/web/src/components/Header/Header.module.css`
- Create: `apps/web/src/components/ProjectCard/ProjectCard.jsx`
- Create: `apps/web/src/components/ProjectCard/ProjectCard.module.css`
- Create: `apps/web/src/data/proyectos.json`
- Create: `apps/web/src/lib/proyectos.js`

**Interfaces:**
- Consumes: `Button`, `Card` from `@portafolio/ui`; `tokens.css` from `@portafolio/config`.
- Produces: `listarProyectos()` and `obtenerProyecto(slug)` from `src/lib/proyectos.js`, used by the `proyectos` pages and reusable by Task 7 if needed.

- [ ] **Step 1: Package manifest and Next config**

`apps/web/package.json`:

```json
{
  "name": "@portafolio/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@portafolio/ui": "*",
    "@portafolio/config": "*"
  }
}
```

`apps/web/next.config.js`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@portafolio/ui', '@portafolio/config'],
};

module.exports = nextConfig;
```

`apps/web/jsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

- [ ] **Step 2: Global styles and layout**

`apps/web/src/styles/globals.css`:

```css
@import '@portafolio/config/tokens/tokens.css';

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: var(--font-sans);
  background: var(--color-bg);
  color: var(--color-fg);
}

main {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--space-3);
}
```

`apps/web/src/components/Header/Header.module.css`:

```css
.header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: var(--space-2) var(--space-3);
}

.nav {
  display: flex;
  gap: var(--space-2);
  max-width: 960px;
  margin: 0 auto;
}

.link {
  color: var(--color-fg);
  text-decoration: none;
  font-weight: 500;
}

.link:hover {
  color: var(--color-accent);
}
```

`apps/web/src/components/Header/Header.jsx`:

```jsx
import Link from 'next/link';
import styles from './Header.module.css';

const LINKS = [
  { href: '/', label: 'Inicio' },
  { href: '/proyectos', label: 'Proyectos' },
  { href: '/sobre-mi', label: 'Sobre mí' },
  { href: '/contacto', label: 'Contacto' },
];

export default function Header() {
  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className={styles.link}>
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
```

`apps/web/src/app/layout.jsx`:

```jsx
import Header from '@/components/Header/Header.jsx';
import '../styles/globals.css';

export const metadata = {
  title: 'Felipe Diaz Aimar — Portfolio',
  description: 'Portfolio profesional de desarrollo fullstack.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Proyectos data + lib**

`apps/web/src/data/proyectos.json`:

```json
[
  {
    "slug": "portfolio-monorepo",
    "titulo": "Portfolio Fullstack (este proyecto)",
    "resumen": "Monorepo con Next.js, Vite y Express desplegado como un único proyecto en Vercel.",
    "stack": ["Next.js", "React", "Vite", "Express", "Supabase"]
  },
  {
    "slug": "proyecto-demo",
    "titulo": "Proyecto de ejemplo",
    "resumen": "Reemplazá esta entrada con uno de tus proyectos reales.",
    "stack": ["React"]
  }
]
```

`apps/web/src/lib/proyectos.js`:

```js
import proyectos from '../data/proyectos.json';

export function listarProyectos() {
  return proyectos;
}

export function obtenerProyecto(slug) {
  return proyectos.find((proyecto) => proyecto.slug === slug) ?? null;
}
```

- [ ] **Step 4: ProjectCard component**

`apps/web/src/components/ProjectCard/ProjectCard.module.css`:

```css
.resumen {
  color: var(--color-muted);
}

.stack {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  list-style: none;
  padding: 0;
}

.stack li {
  background: rgba(255, 255, 255, 0.08);
  border-radius: var(--radius);
  padding: 0.15rem 0.6rem;
  font-size: 0.85rem;
}
```

`apps/web/src/components/ProjectCard/ProjectCard.jsx`:

```jsx
import Link from 'next/link';
import { Card } from '@portafolio/ui';
import styles from './ProjectCard.module.css';

export default function ProjectCard({ proyecto }) {
  return (
    <Card title={proyecto.titulo}>
      <p className={styles.resumen}>{proyecto.resumen}</p>
      <ul className={styles.stack}>
        {proyecto.stack.map((tech) => (
          <li key={tech}>{tech}</li>
        ))}
      </ul>
      <Link href={`/proyectos/${proyecto.slug}`}>Ver detalle</Link>
    </Card>
  );
}
```

- [ ] **Step 5: Pages — home, proyectos (list + detail), sobre-mí**

`apps/web/src/app/page.jsx`:

```jsx
import Link from 'next/link';
import { Button } from '@portafolio/ui';

export default function HomePage() {
  return (
    <section>
      <h1>Felipe Diaz Aimar</h1>
      <p>Desarrollador fullstack — React, Next.js, Node/Express.</p>
      <Link href="/proyectos">
        <Button>Ver proyectos</Button>
      </Link>
    </section>
  );
}
```

`apps/web/src/app/proyectos/page.jsx`:

```jsx
import ProjectCard from '@/components/ProjectCard/ProjectCard.jsx';
import { listarProyectos } from '@/lib/proyectos.js';

export default function ProyectosPage() {
  const proyectos = listarProyectos();

  return (
    <section>
      <h1>Proyectos</h1>
      {proyectos.map((proyecto) => (
        <ProjectCard key={proyecto.slug} proyecto={proyecto} />
      ))}
    </section>
  );
}
```

`apps/web/src/app/proyectos/[slug]/page.jsx`:

```jsx
import { notFound } from 'next/navigation';
import { obtenerProyecto } from '@/lib/proyectos.js';

export default function ProyectoDetallePage({ params }) {
  const proyecto = obtenerProyecto(params.slug);

  if (!proyecto) {
    notFound();
  }

  return (
    <section>
      <h1>{proyecto.titulo}</h1>
      <p>{proyecto.resumen}</p>
      <ul>
        {proyecto.stack.map((tech) => (
          <li key={tech}>{tech}</li>
        ))}
      </ul>
    </section>
  );
}
```

`apps/web/src/app/sobre-mi/page.jsx`:

```jsx
export default function SobreMiPage() {
  return (
    <section>
      <h1>Sobre mí</h1>
      <p>Contá acá tu experiencia, stack y trayectoria.</p>
    </section>
  );
}
```

- [ ] **Step 6: Contacto page (posts to the embedded API from Task 7)**

`apps/web/src/app/contacto/page.jsx`:

```jsx
'use client';

import { useState } from 'react';
import { Button } from '@portafolio/ui';

export default function ContactoPage() {
  const [estado, setEstado] = useState('idle');

  async function handleSubmit(event) {
    event.preventDefault();
    setEstado('enviando');

    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());

    const response = await fetch('/api/contacto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setEstado(response.ok ? 'enviado' : 'error');
  }

  return (
    <section>
      <h1>Contacto</h1>
      <form onSubmit={handleSubmit}>
        <input name="nombre" placeholder="Nombre" required />
        <input name="email" type="email" placeholder="Email" required />
        <textarea name="mensaje" placeholder="Mensaje" required />
        <Button type="submit">Enviar</Button>
      </form>
      {estado === 'enviado' && <p>¡Mensaje enviado!</p>}
      {estado === 'error' && <p>Hubo un error, intentá de nuevo.</p>}
    </section>
  );
}
```

Note: this form calls `/api/contacto`, which doesn't exist yet — Task 7 adds it. `next build` doesn't execute this `fetch` (it only runs in the browser at runtime), so the build in this task succeeds without it.

- [ ] **Step 7: Install, build, and smoke-test the pages**

Run: `npm install`
Run: `npm run build -w apps/web`
Expected: exits 0.

```bash
npm run dev -w apps/web &
WEB_PID=$!
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
curl -s http://localhost:3000/proyectos | grep -o "Proyecto de ejemplo"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/proyectos/proyecto-demo
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/proyectos/no-existe
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/sobre-mi
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/contacto
kill $WEB_PID
```

Expected: `200`, `Proyecto de ejemplo`, `200`, `404`, `200`, `200`.

- [ ] **Step 8: Commit**

```bash
git add apps/web package-lock.json
git commit -m "feat(web): scaffold Next.js portfolio pages"
```

---

### Task 7: Deploy Wiring — Embed `apps/api` and `apps/playground` into `apps/web`

**Files:**
- Create: `apps/web/pages/api/[...path].js`
- Create: `apps/web/scripts/copy-playground.mjs`
- Modify: `apps/web/package.json` (build script)
- Create: `apps/web/vercel.json`

**Interfaces:**
- Consumes: `module.exports = app` from `apps/api/src/app.js` (Task 4); `apps/playground/dist` output (Task 5).
- Produces: `apps/web/public/playground/` (static demo assets) and a working `/api/*` surface backed by the real Express app, both present after `npm run build -w apps/web`.

- [ ] **Step 1: Catch-all Pages Router route that mounts the Express app**

`apps/web/pages/api/[...path].js`:

```js
import app from '../../../api/src/app.js';

export default app;

export const config = {
  api: {
    bodyParser: false,
  },
};
```

`bodyParser: false` is required so Next.js doesn't consume the request stream before Express's own `express.json()` middleware gets to it.

- [ ] **Step 2: Script that copies the playground build into `public/`**

`apps/web/scripts/copy-playground.mjs`:

```js
import { existsSync, rmSync, cpSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const playgroundDist = path.resolve(webRoot, '../playground/dist');
const target = path.resolve(webRoot, 'public/playground');

if (!existsSync(playgroundDist)) {
  throw new Error(`No se encontró ${playgroundDist}. Corré "npm run build -w apps/playground" primero.`);
}

rmSync(target, { recursive: true, force: true });
cpSync(playgroundDist, target, { recursive: true });

console.log(`Copiado ${playgroundDist} -> ${target}`);
```

- [ ] **Step 3: Wire the composite build script**

Edit `apps/web/package.json` — replace the `build` script:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "npm run build -w apps/playground && node scripts/copy-playground.mjs && next build",
    "start": "next start"
  }
}
```

- [ ] **Step 4: Vercel config**

`apps/web/vercel.json`:

```json
{
  "framework": "nextjs"
}
```

- [ ] **Step 5: Run the full composite build**

Run: `npm run build -w apps/web`
Expected: exits 0. Confirm the copy happened:

Run: `ls apps/web/public/playground/index.html`
Expected: file exists (no "No such file" error).

- [ ] **Step 6: Production smoke test — playground assets + embedded API**

```bash
npm run start -w apps/web &
WEB_PID=$!
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/playground/
curl -s http://localhost:3000/api/health
curl -s -X POST http://localhost:3000/api/contacto -H "Content-Type: application/json" -d '{}'
curl -s -X POST http://localhost:3000/api/contacto -H "Content-Type: application/json" -d '{"nombre":"Ana","email":"ana@test.com","mensaje":"Hola"}'
kill $WEB_PID
```

Expected (in order):
- `200`
- `{"status":"ok"}`
- `{"error":"Faltan campos requeridos: nombre, email, mensaje"}`
- `{"recibido":true}`

This is the key proof that the single-Vercel-project design works: the Express app answers real requests through Next.js's own production server, and the Vite-built demos are served as static files from the same origin.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): embed Express API and playground build into the single Vercel deployment"
```

---

### Task 8: Full Install Smoke Test and Push

**Files:** none created — this task only verifies and pushes.

- [ ] **Step 1: Clean install from the lockfile**

Run: `npm ci`
Expected: exits 0 (proves the committed `package-lock.json` is self-consistent and nothing depended on stray local state).

- [ ] **Step 2: Rebuild everything from scratch**

Run: `npm run build -w apps/web`
Expected: exits 0 (same checks as Task 7 Step 5 — confirms the clean-installed tree still builds).

- [ ] **Step 3: Manual Vercel dashboard step (not scriptable)**

When creating the Vercel project for this repo:
1. Set **Root Directory** to `apps/web`.
2. Enable **"Include files outside the Root Directory in the Build Step"** (needed because `apps/web`'s build imports `apps/api/src/app.js` and depends on `apps/playground`'s build output).
3. Framework preset: Next.js (auto-detected via `apps/web/vercel.json`).

- [ ] **Step 4: Push everything**

```bash
git push
```

Expected: all commits from Tasks 1-7 land on `origin/main`.
