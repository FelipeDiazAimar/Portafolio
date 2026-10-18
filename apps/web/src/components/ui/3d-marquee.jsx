"use client";

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
  // Celular: grilla plana y liviana (ver más abajo)
  plano = false,
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
  // Modo plano (celular): sin 3D, sin inclinación y sin animación por JS. Dos columnas de tarjetas
  // derechas que suben y bajan lento con una animación CSS (la hace el compositor, sin saltos). El 3D
  // queda para el viaje de la tarjeta elegida (VistaProyecto).
  if (plano) {
    return (
      <div className={cn("relative mx-auto block overflow-hidden", className)}>
        <style>{`@keyframes mqPlanoA{from{transform:translate3d(0,0,0)}to{transform:translate3d(0,-34%,0)}}@keyframes mqPlanoB{from{transform:translate3d(0,-34%,0)}to{transform:translate3d(0,0,0)}}@media (prefers-reduced-motion: reduce){[data-mq-plano]{animation:none!important}}`}</style>
        <div data-escala-marquee className="flex size-full items-start justify-center gap-3 px-3">
          {chunks.map((subarray, colIndex) => (
            <div
              key={colIndex + "plano"}
              data-mq-plano
              className="flex min-w-0 flex-1 flex-col gap-3"
              style={{ animation: `${colIndex % 2 === 0 ? "mqPlanoA" : "mqPlanoB"} ${colIndex % 2 === 0 ? 34 : 42}s ease-in-out infinite alternate`, willChange: "transform" }}
            >
              {subarray.map(renderItem)}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "mx-auto block h-[600px] overflow-hidden rounded-2xl max-sm:h-100",
        className,
      )}
    >
      <div className="flex size-full items-center justify-center">
        {/* data-escala-marquee: para medir la escala real de las tarjetas (ver Proyectos). */}
        <div data-escala-marquee style={{ width: anchoCaja, height: 1720 }} className="shrink-0 scale-50 sm:scale-75 lg:scale-100">
          <div
            style={{
              transform: "rotateX(55deg) rotateY(0deg) rotateZ(-45deg)",
              gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))`,
              ...posicionGrilla,
            }}
            className="relative top-96 right-[50%] grid size-full origin-top-left gap-8 transform-3d"
          >
            {chunks.map((subarray, colIndex) => (
              <motion.div
                animate={{ y: colIndex % 2 === 0 ? 100 : -100 }}
                transition={{
                  duration: colIndex % 2 === 0 ? 10 : 15,
                  repeat: Infinity,
                  repeatType: "reverse",
                }}
                key={colIndex + "marquee"}
                className="flex flex-col items-start gap-8"
              >
                <GridLineVertical className="-left-4" offset="80px" />
                {subarray.map(renderItem)}
              </motion.div>
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
