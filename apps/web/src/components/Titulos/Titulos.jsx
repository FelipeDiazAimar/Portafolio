"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { hayWebGL } from "@/lib/soporteWebGL.js";
import useTema from "@/hooks/useTema.js";
import { TITULOS } from "@/data/titulos.js";
import TitulosPlanos from "./TitulosPlanos.jsx";
import VistaTitulo from "./VistaTitulo.jsx";
import styles from "./Titulos.module.css";
import TextoPartido from "@/components/Revelar/TextoPartido.jsx";
import LineaTitulos from "./LineaTitulos.jsx";

// título escrito y foto (si tiene), intercalados. Los datos están en src/data/titulos.js.
const TARJETAS = TITULOS.flatMap((t, i) => {
  const comun = { ...t, indiceTitulo: i };
  const texto = {
    ...comun,
    tipo: "texto",
    aspecto: 0.75,
    numero: String(i + 1).padStart(2, "0"),
  };
  return t.imagen ? [texto, { ...comun, tipo: "foto" }] : [texto];
});

// scroll (en svh) para pasar de una tarjeta a la siguiente
const SVH_POR_TARJETA = 55;

// PC: cinta horizontal ondulada; celulares (o pantallas angostas / verticales): columna con vidrio
const CONSULTA_PC = "(min-width: 900px) and (min-aspect-ratio: 1/1)";

// "Títulos": un carrusel de tarjetas (ver EscenaCarrusel.js) que avanza con el scroll de la página.
// Sin WebGL o con movimiento reducido, las tarjetas planas.
export default function Titulos() {
  const [plano, setPlano] = useState(false);
  useEffect(() => {
    if (
      !hayWebGL() ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      setPlano(true);
  }, []);
  const alFallar = useCallback(() => setPlano(true), []);
  return plano ? (
    <TitulosPlanos titulos={TITULOS} />
  ) : (
    <Carrusel titulos={TITULOS} tarjetas={TARJETAS} alFallar={alFallar} />
  );
}

// color de fondo de la sección, en 0..1, para que el vidrio lo use donde no hay tarjeta
function leerFondo(el) {
  const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
  if (!m) return [0, 0, 0];
  return m.slice(0, 3).map((v) => Number(v) / 255);
}

// lleva la página a `top` (con el scroll suave del sitio si está)
function irAlScroll(top, inmediato = false) {
  const lenis = window.__lenis;
  if (lenis?.scrollTo)
    lenis.scrollTo(top, inmediato ? { immediate: true } : { duration: 0.9 });
  else window.scrollTo({ top, behavior: inmediato ? "auto" : "smooth" });
}

function Carrusel({ titulos, tarjetas, alFallar }) {
  const { tema } = useTema();
  const [modo, setModo] = useState(null);
  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_PC);
    const leer = () => setModo(consulta.matches ? "horizontal" : "vertical");
    leer();
    consulta.addEventListener("change", leer);
    return () => consulta.removeEventListener("change", leer);
  }, []);
  const horizontal = modo === "horizontal";
  const refSeccion = useRef(null);
  const refEscenario = useRef(null);
  const refLienzo = useRef(null);
  const refEscena = useRef(null);
  const [actual, setActual] = useState(0);
  const refActual = useRef(0);
  refActual.current = actual;
  // tarjeta abierta: { indice, origen } (origen: centro y tamaño en la pantalla)
  const [abierta, setAbierta] = useState(null);
  const total = tarjetas.length;

  // scroll de la página donde la tarjeta i queda en el centro
  const scrollDeTarjeta = useCallback(
    (i) => {
      const seccion = refSeccion.current;
      if (!seccion) return 0;
      const r = seccion.getBoundingClientRect();
      const recorrible = r.height - window.innerHeight;
      return (
        window.scrollY +
        r.top +
        (Math.max(0, Math.min(total - 1, i)) / (total - 1)) * recorrible
      );
    },
    [total],
  );

  useEffect(() => {
    if (!modo) return undefined;
    let cancelado = false;
    let limpiar = () => {};
    // PC: la cinta (EscenaCinta.js); celulares: la columna con vidrio (EscenaCarrusel.js)
    const cargar =
      modo === "horizontal"
        ? import("./EscenaCinta.js").then((m) => m.crearEscenaCinta)
        : import("./EscenaCarrusel.js").then((m) => m.crearEscenaCarrusel);
    cargar.then((crearEscena) => {
      if (cancelado) return;
      const seccion = refSeccion.current;
      const escenario = refEscenario.current;
      const lienzo = refLienzo.current;
      let escena;
      try {
        escena = crearEscena({
          lienzo,
          tarjetas,
          modo,
          fuente: getComputedStyle(seccion).fontFamily || "sans-serif",
          alCambiar: setActual,
          alPerder: alFallar,
        });
      } catch {
        alFallar();
        return;
      }
      refEscena.current = escena;

      const avance = () => {
        const r = seccion.getBoundingClientRect();
        const recorrible = r.height - window.innerHeight;
        const u =
          recorrible > 0 ? Math.min(1, Math.max(0, -r.top / recorrible)) : 0;
        return u * (total - 1);
      };
      const medir = () =>
        escena.tamano(escenario.clientWidth, escenario.clientHeight);
      medir();
      escena.fijarFondo(...leerFondo(seccion));
      escena.fijar(avance());

      // el scroll lleva el carrusel; al quedarse quieto, se acomoda en la tarjeta más cercana
      let arrastre = null;
      let espera = 0;
      // la intro 'rise' de la cinta (PC) sigue al scroll: sube mientras la sección entra
      const introPorScroll = () => {
        if (!escena.ponerIntro) return;
        const r = seccion.getBoundingClientRect();
        const vh = window.innerHeight;
        escena.ponerIntro((vh * 0.95 - r.top) / (vh * 0.85));
      };
      introPorScroll();
      const alScroll = () => {
        const p = avance();
        escena.seguir(p);
        introPorScroll();
        clearTimeout(espera);
        espera = setTimeout(() => {
          const r = seccion.getBoundingClientRect();
          const adentro = r.top < 0 && r.bottom > window.innerHeight;
          const cerca = Math.round(p);
          if (adentro && !arrastre && Math.abs(p - cerca) > 0.02)
            irAlScroll(scrollDeTarjeta(cerca));
        }, 160);
      };
      window.addEventListener("scroll", alScroll, { passive: true });
      const observadorTam = new ResizeObserver(() => {
        medir();
        alScroll();
      });
      observadorTam.observe(escenario);

      // sólo dibuja mientras la sección está a la vista
      const observadorVista = new IntersectionObserver(
        ([entrada]) => {
          if (entrada.isIntersecting) escena.arrancar();
          else escena.frenar();
        },
        { rootMargin: "100px 0px" },
      );
      observadorVista.observe(seccion);

      // arrastre con mouse o lápiz: mueve el scroll de la página (con el dedo ya scrollea solo)
      const pxPorTarjeta = () =>
        (seccion.offsetHeight - window.innerHeight) / (total - 1);
      const alBajar = (e) => {
        if (e.button !== 0 || e.pointerType === "touch") return;
        arrastre = {
          x: e.clientX,
          y: e.clientY,
          scroll: window.scrollY,
          movido: false,
        };
        lienzo.setPointerCapture(e.pointerId);
      };
      const alMover = (e) => {
        if (!arrastre) {
          // sobre una tarjeta, la mano de "tocar"
          if (e.pointerType === "mouse") {
            const r = lienzo.getBoundingClientRect();
            const toca = escena.tarjetaEn(
              e.clientX - r.left,
              e.clientY - r.top,
            );
            lienzo.style.cursor = toca ? "pointer" : "";
          }
          return;
        }
        if (Math.hypot(e.clientX - arrastre.x, e.clientY - arrastre.y) > 6)
          arrastre.movido = true;
        // vertical: bajar el mouse trae la siguiente (que viene de arriba), igual que la rueda;
        // horizontal: llevarlo a la izquierda trae la de la derecha
        const tarjetasMovidas =
          modo === "horizontal"
            ? (arrastre.x - e.clientX) /
              (escenario.clientHeight * 0.36 * (4 / 3) + 12) // un paso de la cinta
            : (e.clientY - arrastre.y) / (escenario.clientHeight * 0.5);
        irAlScroll(arrastre.scroll + tarjetasMovidas * pxPorTarjeta(), true);
      };
      let recienArrastrado = false;
      const alSoltar = () => {
        if (!arrastre) return;
        recienArrastrado = arrastre.movido;
        arrastre = null;
        alScroll();
      };
      // tocar una tarjeta: si es la del centro se abre; si no, se trae al centro
      const alTocar = (e) => {
        if (recienArrastrado) {
          recienArrastrado = false;
          return;
        }
        const r = lienzo.getBoundingClientRect();
        const toca = escena.tarjetaEn(e.clientX - r.left, e.clientY - r.top);
        if (!toca) return;
        if (toca.indice !== refActual.current) {
          irAlScroll(scrollDeTarjeta(toca.indice));
          return;
        }
        setAbierta({
          indice: toca.indice,
          origen: {
            x: r.left + toca.x,
            y: r.top + toca.y,
            ancho: toca.ancho,
            alto: toca.alto,
          },
        });
      };
      lienzo.addEventListener("click", alTocar);
      lienzo.addEventListener("pointerdown", alBajar);
      lienzo.addEventListener("pointermove", alMover);
      lienzo.addEventListener("pointerup", alSoltar);
      lienzo.addEventListener("pointercancel", alSoltar);

      limpiar = () => {
        clearTimeout(espera);
        window.removeEventListener("scroll", alScroll);
        observadorTam.disconnect();
        observadorVista.disconnect();
        lienzo.removeEventListener("pointerdown", alBajar);
        lienzo.removeEventListener("pointermove", alMover);
        lienzo.removeEventListener("pointerup", alSoltar);
        lienzo.removeEventListener("pointercancel", alSoltar);
        lienzo.removeEventListener("click", alTocar);
        escena.destruir();
        refEscena.current = null;
      };
    });
    return () => {
      cancelado = true;
      limpiar();
    };
  }, [tarjetas, total, alFallar, scrollDeTarjeta, modo]);

  // el cambio de tema anima el fondo: se relee al toque y al terminar
  useEffect(() => {
    const seccion = refSeccion.current;
    if (!seccion) return undefined;
    const releer = () => refEscena.current?.fijarFondo(...leerFondo(seccion));
    const t1 = setTimeout(releer, 30);
    const t2 = setTimeout(releer, 700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [tema]);

  const ir = (pasos) => irAlScroll(scrollDeTarjeta(actual + pasos));

  // mientras está abierta, la página no scrollea
  useEffect(() => {
    if (!abierta) return undefined;
    const lenis = window.__lenis;
    lenis?.stop?.();
    const html = document.documentElement;
    const antes = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = antes;
      lenis?.start?.();
    };
  }, [abierta]);

  const abrirCentral = () => {
    const escena = refEscena.current;
    const lienzo = refLienzo.current;
    if (!escena || !lienzo) return;
    const r = lienzo.getBoundingClientRect();
    const toca = escena.tarjetaEn(r.width / 2, r.height / 2);
    if (!toca) return;
    setAbierta({
      indice: toca.indice,
      origen: {
        x: r.left + toca.x,
        y: r.top + toca.y,
        ancho: toca.ancho,
        alto: toca.alto,
      },
    });
  };
  const alMostrarAbierta = useCallback(() => {
    if (abierta) refEscena.current?.ocultar(abierta.indice);
  }, [abierta]);
  const alCerrarAbierta = useCallback(() => {
    refEscena.current?.ocultar(null);
    setAbierta(null);
    refSeccion.current?.focus({ preventScroll: true });
  }, []);

  const alTecla = (e) => {
    if (abierta) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      abrirCentral();
      return;
    }
    // abajo (o derecha) trae la siguiente; arriba (o izquierda), la anterior
    if (
      (e.key === "ArrowDown" || e.key === "ArrowRight") &&
      actual < total - 1
    ) {
      e.preventDefault();
      ir(1);
    } else if ((e.key === "ArrowUp" || e.key === "ArrowLeft") && actual > 0) {
      e.preventDefault();
      ir(-1);
    }
  };

  const indiceTitulo = tarjetas[actual]?.indiceTitulo ?? 0;
  const t = titulos[indiceTitulo];
  const numero = (n) => String(n).padStart(2, "0");

  return (
    <section
      ref={refSeccion}
      id="titulos"
      className={styles.seccion}
      style={{ height: `calc(100svh + ${(total - 1) * SVH_POR_TARJETA}svh)` }}
      aria-labelledby="titulo-titulos"
      aria-roledescription="carrusel"
      tabIndex={-1}
      onKeyDown={alTecla}
    >
      <div
        ref={refEscenario}
        className={styles.escenario}
        data-modo={modo ?? "vertical"}
      >
        <canvas ref={refLienzo} className={styles.lienzo} aria-hidden="true" />
        {/* la línea del sitio, como una hélice alrededor de la cinta (sólo en PC) */}
        {modo === "horizontal" ? <LineaTitulos refEscena={refEscena} total={total} /> : null}

        <div className={styles.izquierda}>
          <h2 id="titulo-titulos" className={styles.rotulo}>
            <TextoPartido texto="Títulos" data-revelar="letras" data-revelar-en="seccion" data-revelar-desde="top 70%" data-revelar-hasta="top 20%" />
          </h2>
          <p className={styles.contador} aria-hidden="true" data-revelar="subir" data-revelar-en="seccion" data-revelar-desde="top 62%" data-revelar-hasta="top 12%">
            <span key={indiceTitulo} className={styles.cambia}>
              {numero(indiceTitulo + 1)}
            </span>
            <span className={styles.barra}>/</span>
            {numero(titulos.length)}
          </p>
        </div>

        <div className={styles.derecha} aria-live="polite" aria-atomic="true" data-revelar="subir" data-revelar-en="seccion" data-revelar-desde="top 55%" data-revelar-hasta="top 5%">
          <div key={t.clave} className={styles.cambia}>
            <p className={styles.sr}>
              Título {indiceTitulo + 1} de {titulos.length}:
            </p>
            <h3 className={styles.nombre}>{t.nombre}</h3>
            <p className={styles.lugar}>{t.lugar}</p>
            <p className={styles.estado}>
              {[t.estado, t.anio].filter(Boolean).join(" · ")}
            </p>
            {tarjetas[actual]?.tipo === "foto" && t.credito ? (
              <a
                className={styles.credito}
                href={t.credito.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.credito.texto}
              </a>
            ) : null}
            <p className={styles.pista}>
              {tarjetas[actual]?.tipo === "foto"
                ? "Tocá la foto para verla entera"
                : "Tocá la tarjeta para ver el título"}
            </p>
          </div>
        </div>

        <button
          type="button"
          className={`${styles.boton} ${styles.arriba}`}
          onClick={() => ir(-1)}
          disabled={actual === 0}
          aria-label="Tarjeta anterior"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 15l6-6 6 6" />
          </svg>
        </button>
        <button
          type="button"
          className={`${styles.boton} ${styles.abajo}`}
          onClick={() => ir(1)}
          disabled={actual === total - 1}
          aria-label="Tarjeta siguiente"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        <ul className={styles.sr}>
          {titulos.map((x) => (
            <li key={x.clave}>
              {x.nombre}, {x.lugar}.{" "}
              {[x.estado, x.anio].filter(Boolean).join(", ")}.
            </li>
          ))}
        </ul>
        <button type="button" className={styles.sr} onClick={abrirCentral}>
          Ver el título del centro
        </button>
      </div>
      {abierta ? (
        <VistaTitulo
          key={abierta.indice}
          tarjeta={tarjetas[abierta.indice]}
          origen={abierta.origen}
          alMostrar={alMostrarAbierta}
          alCerrar={alCerrarAbierta}
        />
      ) : null}
    </section>
  );
}
