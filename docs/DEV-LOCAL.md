# Cómo correr el proyecto en local (Windows)

Lecciones aprendidas del 10/10/2026: dos intentos fallidos + 11 minutos
por no verificar procesos y por esperas a ciegas. Seguir este orden.

## 1. Pre-requisitos

- `npm install` en la raíz (workspaces: `apps/*`, `packages/*`).
- `apps/api/.env` existente (gitignored). Ver `apps/api/.env.example`.
  Sin `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` la API arranca igual
  pero `/api/proyectos` devuelve 502.
- Ojo: `apps/playground` **no existe** todavía. `npm run dev:playground`
  falla. No usarlo hasta crear la app.

## 2. Puertos

| App  | Puerto | Health check              |
| ---- | ------ | ------------------------- |
| web  | 3000   | http://localhost:3000/    |
| api  | 4000   | http://localhost:4000/api/health |

Si un puerto está ocupado, NO asumir de quién es. Verificar dueño:

```powershell
Get-NetTCPConnection -LocalPort 4000 -State Listen | Select-Object OwningProcess
```

## 3. Arranque (en este orden)

**Primero en primer plano** para ver errores (los detached ocultan el log):

```powershell
npm run dev:api   # debe decir "API escuchando en http://localhost:4000"
```

Luego el web en otra terminal. Para dejarlos corriendo en segundo plano
en Windows, `npm` NO va directo en `Start-Process` (muere en silencio).
Usar `cmd /c`:

```powershell
Start-Process -FilePath "cmd" -ArgumentList "/c npm run dev:api" -WorkingDirectory "C:\ruta\PORTAFOLIO" -WindowStyle Hidden
Start-Process -FilePath "cmd" -ArgumentList "/c npm run dev:web" -WorkingDirectory "C:\ruta\PORTAFOLIO" -WindowStyle Hidden
```

## 4. Verificación (nunca esperas a ciegas)

1. Confirmar que el proceso **sigue vivo** antes de esperar nada.
2. `curl http://localhost:4000/api/health` → `{"status":"ok"}`.
3. `curl http://localhost:3000/` → 200.
4. La home tiene **animación de intro (~9s)**: una captura inmediata sale
   en blanco y NO es un bug. Esperar 9s+ o revisar el DOM/consola.
5. La primera compilación de Next es lenta: esperar hasta 60s el primer 200.

## 5. Apagado

```powershell
# Buscar PIDs con el comando del punto 2 y:
taskkill /PID <PID> /F
```

## 6. Troubleshooting conocido

- **Todo 500 en dev tras correr `next build`**: el build pisa `.next` y rompe
  el dev server. Borrar `.next` y reiniciar el dev.
- **`/api/proyectos` 502 `fetch failed`**: Supabase no resuelve
  (proyecto pausado/eliminado) o `.env` incompleto. Revisar DNS y keys.
- **Puerto ocupado por proceso desconocido**: ver punto 2, no matar a ciegas
  (puede ser otro proyecto del usuario).
