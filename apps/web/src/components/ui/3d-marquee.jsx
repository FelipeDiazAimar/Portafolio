"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
// Adaptado: cada imagen puede ser un string o { src, clave, titulo }. Con
// `alApuntar` las imágenes se vuelven interactivas (hover con mouse, foco o click
// eligen su clave) y `claveActiva` apaga la que ya está en primer plano.
export const ThreeDMarquee = ({
  images,
  className,
  alApuntar,
  alSalir,
  claveActiva = null,
}) => {
  const interactiva = typeof alApuntar === "function";
  // Split the images array into 4 equal parts
  const chunkSize = Math.ceil(images.length / 4);
  const chunks = Array.from({ length: 4 }, (_, colIndex) => {
    const start = colIndex * chunkSize;
    return images.slice(start, start + chunkSize);
  });
  return (
    <div
      className={cn(
        "mx-auto block h-[600px] overflow-hidden rounded-2xl max-sm:h-100",
        className,
      )}
    >
      <div className="flex size-full items-center justify-center">
        <div className="size-[1720px] shrink-0 scale-50 sm:scale-75 lg:scale-100">
          <div
            style={{
              transform: "rotateX(55deg) rotateY(0deg) rotateZ(-45deg)",
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
                  const image = typeof item === "string" ? item : item.src;
                  const clave = typeof item === "string" ? item : item.clave ?? item.src;
                  const titulo = typeof item === "string" ? `Image ${imageIndex + 1}` : item.titulo ?? "";
                  const activa = claveActiva !== null && clave === claveActiva;
                  return (
                    <div
                      className="relative"
                      key={imageIndex + image}
                      data-clave={interactiva ? clave : undefined}
                      data-zona-mixto={interactiva ? "marquesina" : undefined}
                      role={interactiva ? "button" : undefined}
                      tabIndex={interactiva ? 0 : undefined}
                      aria-label={interactiva ? titulo : undefined}
                      style={
                        interactiva
                          ? { cursor: "pointer", opacity: activa ? 0.12 : 1, transition: "opacity 0.35s ease" }
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
                        className="aspect-[970/700] rounded-lg object-cover ring ring-gray-950/5 hover:shadow-2xl"
                        width={970}
                        height={700}
                      />
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
