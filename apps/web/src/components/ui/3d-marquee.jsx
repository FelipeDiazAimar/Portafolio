"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
// Adaptado: cada imagen puede ser un string, { src, clave, titulo } o { contenido,
// clave, titulo } (una tarjeta HTML en vez de imagen). Con
// `alApuntar` las imágenes se vuelven interactivas (hover con mouse, foco o click
// eligen su clave) y `claveActiva` (una clave o una lista) oculta las que están en
// primer plano: en su lugar viaja una copia, así que desaparecen sin transición.
export const ThreeDMarquee = ({
  images,
  className,
  alApuntar,
  alSalir,
  claveActiva = null,
  // Posición de la grilla dentro de su caja (top/right): la original está pensada para
  // ~30 imágenes; con menos hay que correrla para que caigan en la zona visible.
  posicionGrilla = null,
}) => {
  const interactiva = typeof alApuntar === "function";
  // Reparto alternado en 4 columnas: con pocas imágenes quedan parejas (13 → 4, 3, 3, 3)
  // en vez de dejar una columna casi vacía.
  const chunks = Array.from({ length: 4 }, (_, colIndex) => images.filter((_, i) => i % 4 === colIndex));
  return (
    <div
      className={cn(
        "mx-auto block h-[600px] overflow-hidden rounded-2xl max-sm:h-100",
        className,
      )}
    >
      <div className="flex size-full items-center justify-center">
        {/* data-escala-marquee: para medir la escala real de las tarjetas (ver Proyectos). */}
        <div data-escala-marquee className="size-[1720px] shrink-0 scale-50 sm:scale-75 lg:scale-100">
          <div
            style={{
              transform: "rotateX(55deg) rotateY(0deg) rotateZ(-45deg)",
              ...posicionGrilla,
            }}
            className="relative top-96 right-[50%] grid size-full origin-top-left grid-cols-4 gap-8 transform-3d"
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
                {subarray.map((item, imageIndex) => {
                  const image = typeof item === "string" ? item : item.src ?? item.clave;
                  const clave = typeof item === "string" ? item : item.clave ?? item.src;
                  const titulo = typeof item === "string" ? `Image ${imageIndex + 1}` : item.titulo ?? "";
                  const activa = Array.isArray(claveActiva)
                    ? claveActiva.includes(clave)
                    : claveActiva !== null && clave === claveActiva;
                  return (
                    <div
                      className="relative w-full"
                      key={imageIndex + image}
                      data-clave={interactiva ? clave : undefined}
                      data-zona-mixto={interactiva ? "marquesina" : undefined}
                      role={interactiva ? "button" : undefined}
                      tabIndex={interactiva ? 0 : undefined}
                      aria-label={interactiva ? titulo : undefined}
                      style={
                        interactiva
                          ? { cursor: "pointer", opacity: activa ? 0 : 1 }
                          : undefined
                      }
                      onPointerEnter={
                        interactiva
                          ? (e) => {
                              if (e.pointerType === "mouse") alApuntar(clave);
                            }
                          : undefined
                      }
                      onPointerLeave={interactiva ? (e) => alSalir?.(e) : undefined}
                      onFocus={interactiva ? () => alApuntar(clave) : undefined}
                      onClick={interactiva ? () => alApuntar(clave) : undefined}
                    >
                      <GridLineHorizontal className="-top-4" offset="20px" />
                      {item && typeof item === "object" && item.contenido ? (
                        <motion.div
                          whileHover={{ y: -10 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                          className="aspect-[970/700] w-full overflow-hidden rounded-lg ring ring-gray-950/5 hover:shadow-2xl"
                        >
                          {item.contenido}
                        </motion.div>
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
                })}
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
