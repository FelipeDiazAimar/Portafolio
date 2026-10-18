"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
// Adaptado: cada imagen puede ser un string, { src, clave, titulo } o { contenido,
// clave, titulo } (una tarjeta HTML en vez de imagen). Con
// `alApuntar` las imágenes se vuelven interactivas (click, Enter o Espacio eligen su
// clave; el hover solo las levanta) y `claveActiva` (una clave o una lista) oculta las que están en
// primer plano: en su lugar viaja una copia, así que desaparecen sin transición.
export const ThreeDMarquee = ({
  images,
  className,
  alApuntar,
  claveActiva = null,
  // Posición de la grilla dentro de su caja (top/right): la original está pensada para
  // ~30 imágenes; con menos hay que correrla para que caigan en la zona visible.
  posicionGrilla = null,
  // Con pocas imágenes quedan huecos en los bordes de la grilla inclinada: con `filas` > 0
  // se arma una grilla de `columnas` × `filas` repitiendo las imágenes lo justo. Ninguna se
  // repite en la misma fila ni en las filas vecinas (ni en diagonal), así nunca quedan dos
  // iguales juntas. Las copias se ven y se pueden tocar, pero la caja que se mide es
  // siempre la del original (data-clave), el más cercano al centro.
  filas = 0,
  // Columnas de la grilla y ancho de su caja (px): más columnas cubren más a lo ancho.
  columnas = 4,
  anchoCaja = 1720,
}) => {
  const interactiva = typeof alApuntar === "function";
  const copia = (item) => (item && typeof item === "object" ? { ...item, esCopia: true } : item);
  const total = images.length;
  let chunks;
  if (filas > 0 && total > 0) {
    // Paso entre filas: coprimo con la cantidad (recorre todas) y lejos de ±1 (así los
    // vecinos en diagonal tampoco coinciden). En la misma fila no hay repetidos mientras
    // las columnas no superen la cantidad de imágenes.
    const mcd = (a, b) => (b === 0 ? a : mcd(b, a % b));
    const paso = [5, 3, 4, 2, 6, 7].find((p) => p % total > 1 && p % total < total - 1 && mcd(p, total) === 1) ?? 1;
    const indiceEn = (c, r) => (((c + r * paso) % total) + total) % total;
    // El original de cada proyecto es su aparición más cercana al centro de la grilla.
    const centroC = (columnas - 1) / 2;
    const centroR = (filas - 1) / 2;
    const original = new Map();
    for (let c = 0; c < columnas; c += 1) {
      for (let r = 0; r < filas; r += 1) {
        const i = indiceEn(c, r);
        const d = Math.abs(c - centroC) + Math.abs(r - centroR);
        if (!original.has(i) || d < original.get(i).d) original.set(i, { c, r, d });
      }
    }
    chunks = Array.from({ length: columnas }, (_, c) =>
      Array.from({ length: filas }, (_, r) => {
        const i = indiceEn(c, r);
        const esOriginal = original.get(i).c === c && original.get(i).r === r;
        return esOriginal ? images[i] : copia(images[i]);
      })
    );
  } else {
    // Reparto alternado en `columnas` columnas: con pocas imágenes quedan parejas.
    chunks = Array.from({ length: columnas }, (_, colIndex) => images.filter((_, i) => i % columnas === colIndex));
  }
  // Una tarjeta (la usan la grilla 3D y la plana)
  const renderItem = (item, imageIndex) => {
        const image = typeof item === "string" ? item : item.src ?? item.clave;
        const clave = typeof item === "string" ? item : item.clave ?? item.src;
        const titulo = typeof item === "string" ? `Image ${imageIndex + 1}` : item.titulo ?? "";
        const esCopia = typeof item === "object" && item?.esCopia === true;
        const activa = Array.isArray(claveActiva)
          ? claveActiva.includes(clave)
          : claveActiva !== null && clave === claveActiva;
        return (
          <div
            className="group relative w-full"
            data-mq-item
            key={imageIndex + image + (esCopia ? "copia" : "")}
            data-clave={interactiva && !esCopia ? clave : undefined}
            data-copia={interactiva && esCopia ? clave : undefined}
            data-zona-mixto={interactiva ? "marquesina" : undefined}
            role={interactiva ? "button" : undefined}
            aria-label={interactiva ? titulo : undefined}
            aria-hidden={esCopia ? true : undefined}
            tabIndex={interactiva && !esCopia ? 0 : undefined}
            style={
              interactiva
                ? { cursor: "pointer", opacity: activa ? 0 : 1 }
                : undefined
            }
            onKeyDown={
              interactiva
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      alApuntar(clave);
                    }
                  }
                : undefined
            }
            onClick={interactiva ? () => alApuntar(clave) : undefined}
          >
            <GridLineHorizontal className="-top-4" offset="20px" />
            {item && typeof item === "object" && item.contenido ? (
              // El realce lo gobierna el contenedor (group-hover), que no se mueve, y el
              // elemento realzado no recibe el mouse (pointer-events-none): si crecía o
              // se desplazaba, pisaba a la vecina y el cursor alternaba entre las dos
              // (la tarjeta "rebotaba"). Ahora sólo crece el contenido, por dentro del
              // recorte, y se enciende la sombra.
              <div className="pointer-events-none aspect-[970/700] w-full overflow-hidden rounded-lg ring ring-gray-950/5 transition-shadow duration-300 ease-out group-hover:shadow-2xl [&>*]:transition-transform [&>*]:duration-500 [&>*]:ease-out group-hover:[&>*]:scale-[1.06]">
                {item.contenido}
              </div>
            ) : (
              // w-full: el original se apoya en el reset de Tailwind (img con
              // max-width 100%); sin él la imagen salía a 970 px de ancho.
              <motion.img
                whileHover={{
                  y: -10,
                }}
                transition={{
                  duration: 0.3,
                  ease: "easeInOut",
                }}
                key={imageIndex + image}
                src={image}
                alt={titulo}
                className="aspect-[970/700] w-full h-auto rounded-lg object-cover ring ring-gray-950/5 hover:shadow-2xl"
                width={970}
                height={700}
              />
            )}
          </div>
        );
  };
  // ---- Recorrido infinito -------------------------------------------------------------------
  // Cada columna se puede agarrar y arrastrar sin fin (con el mouse o el dedo), con inercia, y por sí
  // sola deriva despacio. Es infinito porque cada columna lleva su contenido dos veces seguidas: la
  // posición se reduce al largo de UNA tanda, y al llegar al final es idéntica. La posición se escribe
  // directo en el transform (sin estado de React: cambia en cada cuadro).
  const refRaiz = useRef(null);
  const refEscala = useRef(null);
  const refLineas = useRef([]);
  const lineas = useRef([]);
  useEffect(() => {
    const els = refLineas.current.filter(Boolean);
    if (!els.length) return undefined;
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const info = els.map((el, i) => ({
      el,
      pos: 0,
      vel: 0,
      periodo: 0,
      // deriva lenta (px/s locales), en sentidos alternados
      deriva: reducido ? 0 : (i % 2 === 0 ? 1 : -1) * 16,
      pres: null,
      sinClic: false,
    }));
    lineas.current = info;
    const medirPeriodos = () => {
      info.forEach((l, i) => {
        const items = l.el.querySelectorAll(":scope > [data-mq-item]");
        const n = chunks[i]?.length ?? 0;
        if (items.length > n && n > 0) {
          const p = items[n].offsetTop - items[0].offsetTop;
          if (p > 0) l.periodo = p;
        }
      });
    };
    medirPeriodos();
    const observador = new ResizeObserver(medirPeriodos);
    observador.observe(refRaiz.current);
    let activo = true;
    const vigia = new IntersectionObserver(([e]) => {
      activo = e.isIntersecting;
    });
    vigia.observe(refRaiz.current);
    let raf = 0;
    let ultimo = performance.now();
    const cuadro = (t) => {
      raf = requestAnimationFrame(cuadro);
      const dt = Math.min(0.05, (t - ultimo) / 1000);
      ultimo = t;
      if (!activo) return;
      info.forEach((l) => {
        if (!l.periodo) return;
        if (!l.pres?.mov) {
          // la inercia de un tirón se apaga hasta quedar en la deriva
          l.vel += (l.deriva - l.vel) * (1 - Math.exp(-dt * 2.2));
          l.pos += l.vel * dt;
        }
        l.pos = ((l.pos % l.periodo) + l.periodo) % l.periodo;
        l.el.style.transform = `translate3d(0,${-l.pos}px,0)`;
      });
    };
    raf = requestAnimationFrame(cuadro);
    return () => {
      cancelAnimationFrame(raf);
      observador.disconnect();
      vigia.disconnect();
    };
    // las tandas dependen de la cantidad de columnas y de filas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnas, filas, images.length]);

  // Cuánto de la columna (px locales) equivale a un desplazamiento del dedo o del mouse en pantalla:
  // el eje local de la columna se ve inclinado (0,707 · 0,406 por la rotación), escalado por la caja.
  const aLocal = (dx, dy) => {
    const caja = refEscala.current;
    const k = caja && caja.offsetWidth ? caja.getBoundingClientRect().width / caja.offsetWidth : 1;
    const ax = 0.7071 * k;
    const ay = 0.4056 * k;
    return (dx * ax + dy * ay) / (ax * ax + ay * ay);
  };
  const alBajar = (i, e) => {
    const l = lineas.current[i];
    if (!l || (e.pointerType === "mouse" && e.button !== 0)) return;
    l.pres = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, lt: e.timeStamp, mov: false };
  };
  const alMover = (i, e) => {
    const l = lineas.current[i];
    const pr = l?.pres;
    if (!pr || pr.id !== e.pointerId) return;
    if (!pr.mov) {
      // hasta pasar unos píxeles es un toque (abre el proyecto), no un arrastre
      if (Math.hypot(e.clientX - pr.x0, e.clientY - pr.y0) < 6) return;
      pr.mov = true;
      pr.lx = e.clientX;
      pr.ly = e.clientY;
      pr.lt = e.timeStamp;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      e.currentTarget.dataset.arrastrando = "1";
    }
    const dLocal = aLocal(e.clientX - pr.lx, e.clientY - pr.ly);
    l.pos -= dLocal;
    const dtm = Math.max(1, e.timeStamp - pr.lt) / 1000;
    l.vel = Math.max(-2600, Math.min(2600, 0.5 * l.vel + 0.5 * (-dLocal / dtm)));
    pr.lx = e.clientX;
    pr.ly = e.clientY;
    pr.lt = e.timeStamp;
  };
  const alSoltar = (i, e) => {
    const l = lineas.current[i];
    if (!l?.pres || l.pres.id !== e.pointerId) return;
    const movio = l.pres.mov;
    l.pres = null;
    delete e.currentTarget.dataset.arrastrando;
    if (movio) {
      // el clic que sigue a un arrastre no tiene que abrir el proyecto
      l.sinClic = true;
      setTimeout(() => {
        l.sinClic = false;
      }, 60);
    }
  };
  const alClicCapturado = (i, e) => {
    const l = lineas.current[i];
    if (l?.sinClic) {
      e.stopPropagation();
      e.preventDefault();
      l.sinClic = false;
    }
  };
  const propsLinea = (i) => ({
    ref: (el) => {
      refLineas.current[i] = el;
    },
    "data-mq-linea": true,
    onPointerDown: (e) => alBajar(i, e),
    onPointerMove: (e) => alMover(i, e),
    onPointerUp: (e) => alSoltar(i, e),
    onPointerCancel: (e) => alSoltar(i, e),
    onClickCapture: (e) => alClicCapturado(i, e),
    onDragStart: (e) => e.preventDefault(),
  });
  // touch-action: pan-y deja que un gesto vertical siga siendo scroll de la página; uno más diagonal
  // u horizontal es del arrastre
  const estiloBase = "[data-mq-linea]{cursor:grab;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:pan-y;will-change:transform}@media (max-width:768px){[data-mq-linea]{will-change:auto}[data-mq-grid]{display:none}}[data-mq-linea][data-arrastrando],[data-mq-linea][data-arrastrando] *{cursor:grabbing!important}";
  const tanda = (sub) => (
    <>
      {sub.map(renderItem)}
      {sub.map((item, k) => renderItem(copia(item), k + sub.length))}
    </>
  );

  return (
    <div
      ref={refRaiz}
      className={cn(
        "mx-auto block h-[600px] overflow-hidden rounded-2xl max-sm:h-100",
        className,
      )}
    >
      <style>{estiloBase}</style>
      <div className="flex size-full items-center justify-center">
        {/* data-escala-marquee: para medir la escala real de las tarjetas (ver Proyectos). */}
        <div ref={refEscala} data-escala-marquee style={{ width: anchoCaja, height: 1720 }} className="shrink-0 scale-50 sm:scale-75 lg:scale-100">
          <div
            style={{
              transform: "rotateX(55deg) rotateY(0deg) rotateZ(-45deg)",
              gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))`,
              ...posicionGrilla,
            }}
            className="relative top-96 right-[50%] grid size-full origin-top-left gap-8 transform-3d"
          >
            {chunks.map((subarray, colIndex) => (
              <div key={colIndex + "marquee"} className="relative flex flex-col items-start gap-8" {...propsLinea(colIndex)}>
                <GridLineVertical className="-left-4" offset="80px" />
                {tanda(subarray)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const GridLineHorizontal = ({
  className,
  offset
}) => {
  return (
    <div
      data-mq-grid
      style={
        {
          "--background": "#ffffff",
          "--color": "rgba(0, 0, 0, 0.2)",
          "--height": "1px",
          "--width": "5px",
          "--fade-stop": "90%",

          //-100px if you want to keep the line inside
          "--offset": offset || "200px",

          "--color-dark": "rgba(255, 255, 255, 0.2)",
          maskComposite: "exclude"
        }
      }
      className={cn(
        "absolute left-[calc(var(--offset)/2*-1)] h-[var(--height)] w-[calc(100%+var(--offset))]",
        "bg-[linear-gradient(to_right,var(--color),var(--color)_50%,transparent_0,transparent)]",
        "[background-size:var(--width)_var(--height)]",
        "[mask:linear-gradient(to_left,var(--background)_var(--fade-stop),transparent),_linear-gradient(to_right,var(--background)_var(--fade-stop),transparent),_linear-gradient(black,black)]",
        "[mask-composite:exclude]",
        "z-30",
        "dark:bg-[linear-gradient(to_right,var(--color-dark),var(--color-dark)_50%,transparent_0,transparent)]",
        className,
      )}
    ></div>
  );
};

const GridLineVertical = ({
  className,
  offset
}) => {
  return (
    <div
      data-mq-grid
      style={
        {
          "--background": "#ffffff",
          "--color": "rgba(0, 0, 0, 0.2)",
          "--height": "5px",
          "--width": "1px",
          "--fade-stop": "90%",

          //-100px if you want to keep the line inside
          "--offset": offset || "150px",

          "--color-dark": "rgba(255, 255, 255, 0.2)",
          maskComposite: "exclude"
        }
      }
      className={cn(
        "absolute top-[calc(var(--offset)/2*-1)] h-[calc(100%+var(--offset))] w-[var(--width)]",
        "bg-[linear-gradient(to_bottom,var(--color),var(--color)_50%,transparent_0,transparent)]",
        "[background-size:var(--width)_var(--height)]",
        "[mask:linear-gradient(to_top,var(--background)_var(--fade-stop),transparent),_linear-gradient(to_bottom,var(--background)_var(--fade-stop),transparent),_linear-gradient(black,black)]",
        "[mask-composite:exclude]",
        "z-30",
        "dark:bg-[linear-gradient(to_bottom,var(--color-dark),var(--color-dark)_50%,transparent_0,transparent)]",
        className,
      )}
    ></div>
  );
};
