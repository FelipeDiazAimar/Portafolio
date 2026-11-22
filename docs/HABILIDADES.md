# Habilidades: catálogo y marca de uso

## Catálogo de tecnologías
- `apps/web/src/data/tecnologias.js` es el catálogo único (61 tecnologías); `categoriasTecnologias.js` pone cada una en
  exactamente una categoría.
- Regla: toda tecnología debe figurar en el `stack` de algún proyecto de `data/proyectos.json`. El test
  `catálogo: toda tecnología se usó en algún proyecto` (`src/lib/proyectos.test.js`) lo verifica. Excepciones declaradas
  a propósito en `SIN_PROYECTO`: Claude, MCP, Kubernetes y Godot.
- Las dependencias de cada proyecto se verificaron contra el `package.json` de sus repos públicos (Radix, React Hook Form,
  Zod, Recharts, Genkit, S3, Axios, JWT, React Router, ESLint, Vitest, Testing Library, Prettier, Lenis). Los repos
  privados de MBRF y Movii no se pudieron revisar.
- «WhatsApp» se llama ahora «WhatsApp API» (la tecnología es la API, no la app).
- El xilófono toma su cantidad de barras de `TECNOLOGIAS.length` (el atlas admite hasta 64).
- Proyecto 14: «Este portafolio» (`slug: portafolio`), con portada y logo sintéticos en `public/proyectos/portafolio/`.

## Marca de uso sobre la hélice (`MarcaUso.jsx` / `MarcaUso.module.css`)
Sobre la barra resaltada (foco, mouse o buscador) se dibuja una diagonal translúcida con cruces en las puntas y, al final,
los proyectos donde se usó esa tecnología, en una sola línea (hasta 4 títulos completos separados por « · » y «+N más»).
No aparece en el modo árbol.

- `Xilofono.js › senalarResaltada` calcula los dos extremos **físicos** de la barra (`a`, `b`) proyectados a píxeles y llama a
  `opciones.alSenalar`. `Habilidades.jsx` mueve la marca directo en el DOM (sin pasar por React).
- Dirección: preferencia arriba-derecha desde el extremo que está a la derecha, o abajo-izquierda desde el otro (el modelo se
  inclina hacia arriba a la izquierda, así no lo cruza); si no entran, las otras dos. Se mide el ancho real del texto y se
  reserva el dock de abajo.
- Estabilidad: la salida se elige al cambiar de tecnología y se conserva mientras entre en pantalla (holgura de 90 px), así
  al rotar el ADN la línea acompaña a su extremo y no salta de lado.
- Con `prefers-reduced-motion` la marca queda estática.
