"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Mrs_Saint_Delafield } from "next/font/google";
import { PERSONA } from "@/data/titulos.js";
import styles from "./VistaTitulo.module.css";

import { ImagenCarga } from '@/components/Esqueleto/Esqueleto.jsx';
// letra manuscrita para la firma propia
const manuscrita = Mrs_Saint_Delafield({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

// Firma ilegible (de la persona responsable): bucles y una rúbrica, siempre iguales para el
// mismo texto. En un viewBox de 200 × 60.
function trazoFirma(texto) {
  let s = [...texto].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  let x = 14 + r() * 10;
  const base = 38;
  let d = `M${x.toFixed(1)} ${(base - 4).toFixed(1)}`;
  const bucles = 6 + Math.floor(r() * 3);
  for (let k = 0; k < bucles; k++) {
    const ancho = 16 + r() * 10;
    const alto = 20 + r() * (k === 0 ? 22 : 16);
    const atras = 8 + r() * 10;
    const nx = x + ancho;
    const ny = base + (r() - 0.5) * 8;
    d += ` C${(x + ancho * 0.9).toFixed(1)} ${(ny - alto).toFixed(1)} ${(x - atras).toFixed(1)} ${(ny - alto * 0.8).toFixed(1)} ${nx.toFixed(1)} ${ny.toFixed(1)}`;
    x = nx;
  }
  // rúbrica: vuelve por debajo y cruza
  d += ` C${(x + 18).toFixed(1)} ${base + 8} ${(x - 30).toFixed(1)} ${base + 18} 18 ${base + 12}`;
  d += ` S${(x + 6).toFixed(1)} ${base + 2} ${(x + 14).toFixed(1)} ${base - 6}`;
  return d;
}

function Firma({ f }) {
  return (
    <div className={styles.firma}>
      {f.propia ? (
        <span
          className={`${styles.manuscrita} ${manuscrita.className}`}
          aria-hidden="true"
        >
          {f.nombre}
        </span>
      ) : (
        <svg className={styles.trazo} viewBox="0 0 200 60" aria-hidden="true">
          <path d={trazoFirma(f.cargo)} pathLength="1" />
        </svg>
      )}
      <span className={styles.linea} />
      {f.nombre ? <span className={styles.firmaNombre}>{f.nombre}</span> : null}
      <span className={styles.firmaCargo}>{f.cargo}</span>
    </div>
  );
}

const DURACION = 900;
const CURVA = "cubic-bezier(0.22, 1, 0.36, 1)";
const GROSOR = 12; // canto de la lámina, en px
const RAIZ2 = Math.SQRT2;

// tamaño final: la lámina (o la foto) lo más grande que entre, dejando aire para el botón y el pie
function medidaFinal(aspecto) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const maxAncho = Math.min(W * (W < 700 ? 0.92 : 0.82), 1180);
  const maxAlto = H * (W < 700 ? 0.72 : 0.78);
  let ancho = maxAncho;
  let alto = ancho / aspecto;
  if (alto > maxAlto) {
    alto = maxAlto;
    ancho = alto * aspecto;
  }
  return { ancho: Math.round(ancho), alto: Math.round(alto) };
}

const reducido = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * La tarjeta tocada, abierta encima de todo.
 * - Foto: crece desde donde estaba la tarjeta hasta verse entera.
 * - Título: la tarjeta gira 90° y crece hasta ser la hoja del título, recreada como una lámina de
 *   vidrio esmerilado con canto, que se inclina siguiendo el puntero.
 *
 * @param {object} o
 * @param {object} o.tarjeta  la tarjeta del carrusel (con los datos de su título)
 * @param {{x:number,y:number,ancho:number,alto:number}} o.origen  centro y tamaño de la tarjeta en
 *   la pantalla
 * @param {() => void} o.alMostrar  la lámina ya tapa la tarjeta: el carrusel puede esconderla
 * @param {() => void} o.alCerrar  terminó de volver a su lugar
 */
export default function VistaTitulo({ tarjeta, origen, alMostrar, alCerrar }) {
  const esDiploma = tarjeta.tipo === "texto";
  const d = tarjeta.diploma ?? {};
  const vertical = d.orientacion === "vertical";
  const [aspectoFoto, setAspectoFoto] = useState(null);
  const aspecto = esDiploma
    ? vertical
      ? 1 / RAIZ2
      : RAIZ2
    : (aspectoFoto ?? tarjeta.aspecto);
  const [medida, setMedida] = useState(() => medidaFinal(aspecto));
  const [cerrando, setCerrando] = useState(false);
  // lupa: al tocar la hoja (o la foto) se acerca en ese punto, sin marco; el punto sigue al
  // puntero y otro toque la aleja
  const [lupa, setLupa] = useState(false);
  const refLupa = useRef(false);
  const refVelo = useRef(null);
  const refVuelo = useRef(null);
  const refInclina = useRef(null);
  const refContenido = useRef(null);
  const refCaraTarjeta = useRef(null);
  const refPie = useRef(null);
  const refCerrar = useRef(null);
  const animaciones = useRef([]);
  const listo = useRef(false);

  // la foto se muestra entera: hace falta su proporción antes de animar
  useEffect(() => {
    if (esDiploma) return undefined;
    let vivo = true;
    const img = new Image();
    img.src = tarjeta.imagen;
    const usar = () =>
      vivo &&
      setAspectoFoto(
        img.naturalWidth
          ? img.naturalWidth / img.naturalHeight
          : tarjeta.aspecto,
      );
    img.decode().then(usar, usar);
    return () => {
      vivo = false;
    };
  }, [esDiploma, tarjeta.imagen, tarjeta.aspecto]);

  useEffect(() => {
    setMedida(medidaFinal(aspecto));
    const alCambiarTam = () => setMedida(medidaFinal(aspecto));
    window.addEventListener("resize", alCambiarTam);
    return () => window.removeEventListener("resize", alCambiarTam);
  }, [aspecto]);

  // la entrada: de la tarjeta a la lámina (o a la foto entera)
  const preparado = esDiploma || aspectoFoto !== null;
  useLayoutEffect(() => {
    if (!preparado || listo.current) return;
    listo.current = true;
    const { ancho, alto } = medidaFinal(aspecto);
    const dx = origen.x - window.innerWidth / 2;
    const dy = origen.y - window.innerHeight / 2;
    const dur = reducido() ? 1 : DURACION;
    const anims = [];
    if (esDiploma) {
      // girada 90°, la lámina ocupa exactamente la tarjeta: su alto queda a lo ancho
      const sx = origen.alto / ancho;
      const sy = origen.ancho / alto;
      const pose = (x, y, rx, ry, rz, ex, ey) =>
        `translate(${x}px, ${y}px) rotateX(${rx}deg) rotateY(${ry}deg) rotate(${rz}deg) scale(${ex}, ${ey})`;
      anims.push(
        refVuelo.current.animate(
          [
            { transform: pose(dx, dy, 0, 0, -90, sx, sy) },
            {
              transform: pose(
                dx * 0.25,
                dy * 0.25 - 18,
                14,
                -22,
                -30,
                0.9,
                0.9,
              ),
              offset: 0.45,
            },
            { transform: pose(0, 0, 0, 0, 0, 1, 1) },
          ],
          { duration: dur, easing: CURVA, fill: "both" },
        ),
        refCaraTarjeta.current.animate(
          [{ opacity: 1 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }],
          { duration: dur * 0.6, easing: "ease-out", fill: "both" },
        ),
        refContenido.current.animate(
          [
            { opacity: 0, filter: "blur(6px)" },
            { opacity: 0, filter: "blur(6px)", offset: 0.35 },
            { opacity: 1, filter: "blur(0px)" },
          ],
          { duration: dur, easing: "ease-out", fill: "both" },
        ),
      );
    } else {
      anims.push(
        refVuelo.current.animate(
          [
            {
              transform: `translate(${dx}px, ${dy}px)`,
              width: `${origen.ancho}px`,
              height: `${origen.alto}px`,
            },
            {
              transform: "translate(0px, 0px)",
              width: `${ancho}px`,
              height: `${alto}px`,
            },
          ],
          { duration: dur * 0.8, easing: CURVA, fill: "both" },
        ),
      );
    }
    anims.push(
      refVelo.current.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: dur * 0.6,
        easing: "ease-out",
        fill: "both",
      }),
      refPie.current.animate(
        [
          { opacity: 0, transform: "translateY(10px)" },
          { opacity: 0, transform: "translateY(10px)", offset: 0.5 },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: dur, easing: "ease-out", fill: "both" },
      ),
    );
    animaciones.current = anims;
    alMostrar();
    refCerrar.current?.focus({ preventScroll: true });
  }, [preparado, aspecto, esDiploma, origen, alMostrar]);

  // inclinación con el puntero (y un vaivén suave mientras nadie la mueve)
  useEffect(() => {
    if (!esDiploma || cerrando || reducido()) return undefined;
    const objetivo = { x: 0, y: 0 };
    const actual = { x: 0, y: 0 };
    let ultimoMovimiento = 0;
    let cuadro = 0;
    const inicio = performance.now();
    const mover = (e) => {
      objetivo.x = (e.clientX / window.innerWidth - 0.5) * 2;
      objetivo.y = (e.clientY / window.innerHeight - 0.5) * 2;
      ultimoMovimiento = performance.now();
    };
    const soltar = (e) => {
      if (e.pointerType !== "mouse") {
        objetivo.x = 0;
        objetivo.y = 0;
      }
    };
    const paso = (ahora) => {
      const quieto = ahora - ultimoMovimiento > 2500;
      const t = (ahora - inicio) / 1000;
      // con la lupa puesta la lámina queda derecha, para leer tranquilo
      const tx = refLupa.current
        ? 0
        : quieto
          ? Math.sin(t * 0.7) * 0.35
          : objetivo.x;
      const ty = refLupa.current
        ? 0
        : quieto
          ? Math.sin(t * 0.9 + 1) * 0.2
          : objetivo.y;
      // con la lupa la lámina se endereza de una, así la burbuja apunta justo
      const k = refLupa.current ? 1 : 0.08;
      actual.x += (tx - actual.x) * k;
      actual.y += (ty - actual.y) * k;
      const el = refInclina.current;
      if (el) {
        el.style.transform = `rotateX(${-actual.y * 9}deg) rotateY(${actual.x * 14}deg)`;
        el.style.setProperty("--gx", `${50 + actual.x * 45}%`);
        el.style.setProperty("--gy", `${50 + actual.y * 45}%`);
      }
      cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    window.addEventListener("pointermove", mover, { passive: true });
    window.addEventListener("pointerup", soltar, { passive: true });
    return () => {
      cancelAnimationFrame(cuadro);
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      // al cerrar, la lámina se endereza mientras vuelve
      const el = refInclina.current;
      if (el) {
        el.style.transition = "transform 300ms ease-out";
        el.style.transform = "none";
      }
    };
  }, [esDiploma, cerrando]);

  // la salida: el mismo camino al revés
  const cerrar = () => {
    if (cerrando) return;
    if (refLupa.current) soltarLupa();
    setCerrando(true);
    const anims = animaciones.current;
    if (!anims.length || reducido()) {
      alCerrar();
      return;
    }
    anims.forEach((a) => {
      a.playbackRate = 1.35;
      a.reverse();
    });
    Promise.all(anims.map((a) => a.finished.catch(() => {}))).then(alCerrar);
  };

  // Lupa: una burbuja de vidrio sobre el puntero con una copia agrandada de la hoja (o la foto).
  // La copia se arma una sola vez al tocar; después sólo se mueven dos transform por cuadro, así
  // que no hay que volver a pintar la hoja.
  const ZOOM = 2.4;
  const refLente = useRef(null);
  const refLenteCopia = useRef(null);
  const refContenedor = useRef(null);
  const refPunto = useRef({ x: 0, y: 0, cuadro: 0 });
  const radioLente = () => (window.innerWidth < 700 ? 78 : 115);

  const ubicarLente = () => {
    const p = refPunto.current;
    p.cuadro = 0;
    const lente = refLente.current;
    const copia = refLenteCopia.current;
    const cont = refContenedor.current;
    if (!lente || !copia || !cont) return;
    const r = cont.getBoundingClientRect();
    const R = radioLente();
    // punto bajo el puntero, en px sin transformar de la hoja
    const px = ((p.x - r.left) / r.width) * cont.offsetWidth;
    const py = ((p.y - r.top) / r.height) * cont.offsetHeight;
    lente.style.transform = `translate3d(${p.x - R}px, ${p.y - R}px, 0)`;
    copia.style.transform = `translate3d(${R - px * ZOOM}px, ${R - py * ZOOM}px, 0) scale(${ZOOM})`;
  };
  const pedirLente = (x, y) => {
    const p = refPunto.current;
    p.x = x;
    p.y = y;
    if (!p.cuadro) p.cuadro = requestAnimationFrame(ubicarLente);
  };

  function soltarLupa() {
    cancelAnimationFrame(refPunto.current.cuadro);
    refPunto.current.cuadro = 0;
    refLupa.current = false;
    setLupa(false);
  }
  const alTocarLupa = (e) => {
    e.stopPropagation();
    if (cerrando) return;
    if (refLupa.current) {
      soltarLupa();
      return;
    }
    const cont = e.currentTarget;
    const copia = refLenteCopia.current;
    if (!copia) return;
    // la copia: la hoja tal como se ve, sin la cara de la tarjeta ni el reflejo
    const clon = cont.cloneNode(true);
    clon.querySelectorAll("[data-sin-lupa]").forEach((n) => n.remove());
    clon.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    clon.removeAttribute("id");
    clon.style.transform = "none";
    copia.replaceChildren(clon);
    copia.style.width = `${cont.offsetWidth}px`;
    copia.style.height = `${cont.offsetHeight}px`;
    refContenedor.current = cont;
    refLupa.current = true;
    setLupa(true);
    pedirLente(e.clientX, e.clientY);
  };
  const alMoverLupa = (e) => {
    if (refLupa.current) pedirLente(e.clientX, e.clientY);
  };
  const propsLupa = {
    onClick: alTocarLupa,
    onPointerMove: alMoverLupa,
    onPointerLeave: (e) => {
      if (refLupa.current && e.pointerType === "mouse") soltarLupa();
    },
    "data-lupa": lupa ? "true" : "false",
  };

  useEffect(() => {
    const alTecla = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (refLupa.current) soltarLupa();
        else cerrar();
      } else if (e.key === "Tab") {
        // el foco no sale de la capa
        const capa = refCerrar.current?.closest("[role=dialog]");
        const controles = capa
          ? [...capa.querySelectorAll("button, a[href]")]
          : [];
        if (!controles.length) return;
        e.preventDefault();
        const i = controles.indexOf(document.activeElement);
        const siguiente =
          (i + (e.shiftKey ? -1 : 1) + controles.length) % controles.length;
        controles[siguiente].focus();
      }
    };
    window.addEventListener("keydown", alTecla);
    return () => window.removeEventListener("keydown", alTecla);
  });

  const idTitulo = `vista-${tarjeta.clave}`;
  const estiloAcento = {
    "--acento": tarjeta.color,
    "--acento-fin": tarjeta.colorFin ?? tarjeta.color,
    "--grosor": `${GROSOR}px`,
  };

  return createPortal(
    <div
      className={styles.capa}
      role="dialog"
      aria-modal="true"
      aria-labelledby={idTitulo}
      style={{ ...estiloAcento, visibility: preparado ? "visible" : "hidden" }}
      data-cerrando={cerrando ? "true" : "false"}
    >
      <div ref={refVelo} className={styles.velo} onClick={cerrar} />

      <div className={styles.escena}>
        {esDiploma ? (
          <div
            ref={refVuelo}
            className={styles.vuelo}
            style={{ width: medida.ancho, height: medida.alto }}
          >
            <div ref={refInclina} className={styles.inclina}>
              <span className={`${styles.canto} ${styles.cantoArriba}`} />
              <span className={`${styles.canto} ${styles.cantoAbajo}`} />
              <span className={`${styles.canto} ${styles.cantoIzq}`} />
              <span className={`${styles.canto} ${styles.cantoDer}`} />
              <span className={styles.dorso} />
              <article
                className={styles.frente}
                data-orientacion={vertical ? "vertical" : "horizontal"}
                {...propsLupa}
              >
                <span
                  ref={refCaraTarjeta}
                  className={styles.caraTarjeta}
                  data-sin-lupa=""
                />
                <div ref={refContenido} className={styles.hoja}>
                  <span className={styles.marco} aria-hidden="true" />
                  {["ai", "ad", "bi", "bd"].map((p) => (
                    <span
                      key={p}
                      className={styles.esquina}
                      data-pos={p}
                      aria-hidden="true"
                    />
                  ))}
                  {d.marcaAgua ? (
                    <svg
                      className={styles.marcaAgua}
                      viewBox="0 0 1000 700"
                      aria-hidden="true"
                    >
                      <path
                        id={`arco-${tarjeta.clave}`}
                        d="M120 620 A380 380 0 0 1 880 620"
                        fill="none"
                      />
                      <text>
                        <textPath
                          href={`#arco-${tarjeta.clave}`}
                          startOffset="50%"
                          textAnchor="middle"
                        >
                          {d.marcaAgua}
                        </textPath>
                      </text>
                    </svg>
                  ) : null}
                  <header className={styles.encabezado}>
                    {d.logo ? (
                      <ImagenCarga
                        className={styles.logo}
                        src={d.logo}
                        alt={`Logo de ${d.institucion}`}
                      />
                    ) : (
                      <span className={styles.sello} aria-hidden="true">
                        {d.sigla}
                      </span>
                    )}
                    <div className={styles.membrete}>
                      <p className={styles.institucion}>{d.institucion}</p>
                      {d.dependencia ? (
                        <p className={styles.dependencia}>{d.dependencia}</p>
                      ) : null}
                    </div>
                  </header>
                  <h3
                    id={idTitulo}
                    className={styles.documento}
                    data-largo={
                      (d.documento ?? "").length > 14 ? "true" : "false"
                    }
                  >
                    {d.documento}
                  </h3>
                  {d.otorga ? (
                    <p className={styles.otorga}>{d.otorga}</p>
                  ) : null}
                  <p className={styles.persona}>{PERSONA}</p>
                  {d.conector ? (
                    <p className={styles.otorga}>{d.conector}</p>
                  ) : null}
                  <p className={styles.destacado}>
                    {d.destacado ?? tarjeta.nombre}
                  </p>
                  {d.motivo ? (
                    <p className={styles.motivo}>{d.motivo}</p>
                  ) : null}
                  {d.datos?.length ? (
                    <dl
                      className={styles.datos}
                      style={{ "--columnas": Math.min(4, d.datos.length) }}
                    >
                      {d.datos.map((x) => (
                        <div key={x.etiqueta} className={styles.dato}>
                          <dt>{x.etiqueta}</dt>
                          <dd>
                            {x.valor ?? (
                              <span className={styles.vacio}>
                                <span className={styles.sr}>sin dato</span>
                              </span>
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {d.nota ? <p className={styles.nota}>{d.nota}</p> : null}
                  <footer className={styles.pie}>
                    <div className={styles.emision}>
                      {d.emisor ? <p>{d.emisor}</p> : null}
                      {d.lugarFecha ? <p>{d.lugarFecha}</p> : null}
                      {d.registro ? (
                        <p>
                          <strong>
                            {d.etiquetaRegistro ?? "Registro N.º"}
                          </strong>
                          {d.registro}
                        </p>
                      ) : null}
                    </div>
                    <div
                      className={styles.firmas}
                      data-cantidad={(d.firmas ?? []).length}
                    >
                      {(d.firmas ?? []).map((f) => (
                        <Firma key={f.cargo} f={f} />
                      ))}
                    </div>
                    {d.logoPie ? (
                      <ImagenCarga className={styles.logoPie} src={d.logoPie} alt="" />
                    ) : (
                      <span className={styles.selloRelieve} aria-hidden="true">
                        {d.sigla ?? ""}
                      </span>
                    )}
                  </footer>
                </div>
                <span
                  className={styles.brillo}
                  aria-hidden="true"
                  data-sin-lupa=""
                />
              </article>
            </div>
          </div>
        ) : (
          <div
            ref={refVuelo}
            className={styles.foto}
            style={{
              width: medida.ancho,
              height: medida.alto,
              background: tarjeta.fondo ?? "transparent",
            }}
            {...propsLupa}
          >
            <ImagenCarga
              id={idTitulo}
              src={tarjeta.imagen}
              alt={`${tarjeta.nombre}, ${tarjeta.lugar}`}
              style={{
                objectFit: tarjeta.ajuste === "contain" ? "contain" : "cover",
                objectPosition: `${(tarjeta.foco?.[0] ?? 0.5) * 100}% ${(tarjeta.foco?.[1] ?? 0.5) * 100}%`,
                padding: tarjeta.ajuste === "contain" ? "6%" : 0,
              }}
            />
          </div>
        )}
      </div>

      <div
        ref={refLente}
        className={styles.lente}
        data-activa={lupa ? "true" : "false"}
        aria-hidden="true"
      >
        <div ref={refLenteCopia} className={styles.lenteCopia} />
        <span className={styles.lenteBrillo} />
      </div>

      <div ref={refPie} className={styles.leyenda}>
        <p className={styles.leyendaNombre}>{tarjeta.nombre}</p>
        <p className={styles.pistaLupa}>
          {lupa
            ? "Mové para recorrer · tocá de nuevo para alejar"
            : "Tocá para acercar"}
        </p>
        <p className={styles.leyendaLugar}>
          {[tarjeta.lugar, tarjeta.anio].filter(Boolean).join(" · ")}
        </p>
        {!esDiploma && tarjeta.credito ? (
          <a
            className={styles.credito}
            href={tarjeta.credito.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {tarjeta.credito.texto}
          </a>
        ) : null}
      </div>

      <button
        ref={refCerrar}
        type="button"
        className={styles.cerrar}
        onClick={cerrar}
        aria-label="Cerrar"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>,
    document.body,
  );
}
