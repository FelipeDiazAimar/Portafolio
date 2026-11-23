'use client';

import proyectos from '@/data/proyectos.json';
import { tecnologiaPorId } from '@/data/tecnologias.js';
import { IconoTecnologia } from '@/components/Proyectos/iconosTecnologias.jsx';
import styles from './Experiencia.module.css';

import { ImagenCarga } from '@/components/Esqueleto/Esqueleto.jsx';
const proyectoPorSlug = (slug) => (slug ? (proyectos.find((p) => p.slug === slug) ?? null) : null);

const ESTADOS = { produccion: 'En producción', demo: 'Demo', desarrollo: 'En desarrollo' };
const TIPOS = { laboral: 'Laboral', cliente: 'Cliente', personal: 'Propio', academico: 'Académico' };

// "539 medias pesadas en un día" → { cifra: '539', resto: 'medias pesadas en un día' }
function partirMetrica(texto) {
  const m = texto.match(/^([\d.,]+\+?\s?%?)\s+(.*)$/) ?? texto.match(/^(.*?)\s+([\d.,]+\+?.*)$/);
  if (m && /\d/.test(m[1])) return { cifra: m[1].trim(), resto: m[2] };
  return { cifra: null, resto: texto };
}

const Flecha = ({ d }) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

// Detalle de un objeto del pasillo. Arriba, en qué etapa estás y la navegación entre los objetos del
// pasillo; después lo que hice ahí y, si hay un proyecto detrás, el caso en chico (problema,
// solución, contexto, métricas, funcionalidades, stack y enlaces). Abajo, los otros proyectos de esa
// etapa y los demás objetos del pasillo para saltar directo. La altura sigue al contenido.
export default function DetalleObjeto({ objeto, trabajo, etapa, etapas, hermanos, alIr, alAnterior, alSiguiente, alCerrar }) {
  const proyecto = proyectoPorSlug(objeto.proyecto);
  const stack = (proyecto?.stack ?? objeto.stack ?? []).filter((id) => tecnologiaPorId(id));
  const metricas = (proyecto?.metricas ?? []).map(partirMetrica);
  const features = proyecto?.features ?? [];
  const otrosProyectos = (trabajo.proyectos ?? []).filter((slug) => slug !== proyecto?.slug).map(proyectoPorSlug).filter(Boolean);
  const indice = hermanos.findIndex((h) => h.actual);
  const sitio = proyecto && !proyecto.privado ? proyecto.enlaces?.sitio : null;
  const datos = proyecto
    ? [proyecto.periodo, TIPOS[proyecto.tipo], ESTADOS[proyecto.estado] ?? proyecto.estado, proyecto.privado ? 'Sistema interno' : null].filter(Boolean)
    : [];

  return (
    <aside key={objeto.clave} className={styles.detalle} style={{ '--acento': objeto.acento }} data-panel aria-live="polite" aria-label={objeto.titulo}>
      <header className={styles.detalleCabecera}>
        <p className={styles.detalleTrabajo}>
          <span className={styles.detallePunto} aria-hidden="true" />
          <span>
            Etapa {etapa + 1}/{etapas} · {trabajo.periodo}
            <b>{trabajo.puesto}</b>
          </span>
        </p>
        <div className={styles.detalleNav}>
          <span className={styles.detalleIndice}>
            {String(indice + 1).padStart(2, '0')}/{String(hermanos.length).padStart(2, '0')}
          </span>
          <button type="button" onClick={alAnterior} aria-label="Objeto anterior" disabled={hermanos.length < 2}>
            <Flecha d="M15 18l-6-6 6-6" />
          </button>
          <button type="button" onClick={alSiguiente} aria-label="Objeto siguiente" disabled={hermanos.length < 2}>
            <Flecha d="M9 18l6-6-6-6" />
          </button>
          <button type="button" onClick={alCerrar} aria-label="Volver al pasillo">
            <Flecha d="M18 6L6 18M6 6l12 12" />
          </button>
        </div>
      </header>

      <div className={styles.detalleCuerpo}>
        <div className={styles.detalleIntro}>
          {proyecto?.imagenes?.portada ? (
            // eslint-disable-next-line @next/next/no-img-element
            <ImagenCarga className={styles.detalleMiniatura} src={proyecto.imagenes.portada} alt="" loading="lazy" decoding="async" />
          ) : null}
          <div>
            {proyecto ? (
              <p className={styles.detalleCliente}>
                {proyecto.imagenes?.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <ImagenCarga src={proyecto.imagenes.logo} alt="" className={styles.detalleLogo} />
                ) : null}
                {proyecto.cliente}
              </p>
            ) : (
              <p className={styles.detalleCliente}>{trabajo.lugar}</p>
            )}
            <h3 className={styles.detalleTitulo}>{objeto.titulo}</h3>
            {datos.length ? (
              <ul className={styles.detalleDatos}>
                {datos.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <p className={styles.detalleTexto}>{objeto.texto}</p>

        {objeto.puntos?.length ? (
          <ul className={styles.detallePuntos}>
            {objeto.puntos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : null}

        {proyecto ? (
          <div className={styles.detalleCaso}>
            <section>
              <h4>El problema</h4>
              <p>{proyecto.problema}</p>
            </section>
            <section>
              <h4>La solución</h4>
              <p>{proyecto.resumen}</p>
            </section>
          </div>
        ) : null}

        {proyecto?.contexto ? <p className={styles.detalleContexto}>{proyecto.contexto}</p> : null}

        {metricas.length ? (
          <div className={styles.detalleMetricas}>
            {metricas.map(({ cifra, resto }) => (
              <div key={resto}>
                {cifra ? <strong>{cifra}</strong> : null}
                <span>{resto}</span>
              </div>
            ))}
          </div>
        ) : null}

        {features.length ? (
          <section className={styles.detalleBloque}>
            <h4>Qué hace</h4>
            <ul className={styles.detalleFeatures}>
              {features.map((f) => (
                <li key={f}>
                  <Flecha d="M5 12.5l4.5 4.5L19 7.5" />
                  {f}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {stack.length ? (
          <section className={styles.detalleBloque}>
            <h4>Stack</h4>
            <ul className={styles.detalleStack}>
              {stack.map((id) => (
                <li key={id}>
                  <IconoTecnologia id={id} className={styles.detalleIcono} />
                  {tecnologiaPorId(id).nombre}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!proyecto ? (
          <section className={styles.detalleBloque}>
            <h4>La etapa</h4>
            <p className={styles.detalleEtapa}>
              <b>{trabajo.puesto}</b> en {trabajo.lugar}, {trabajo.periodo}. {trabajo.resumen}
            </p>
          </section>
        ) : null}

        {otrosProyectos.length ? (
          <section className={styles.detalleBloque}>
            <h4>{proyecto ? 'Más proyectos de esta etapa' : 'Proyectos de esta etapa'}</h4>
            <ul className={styles.detalleOtros}>
              {otrosProyectos.map((p) => (
                <li key={p.slug}>
                  <a href={`/proyectos/${p.slug}`}>
                    {p.imagenes?.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <ImagenCarga src={p.imagenes.logo} alt="" />
                    ) : null}
                    <span>
                      <b>{p.titulo}</b>
                      <small>{p.cliente}</small>
                    </span>
                    <Flecha d="M9 18l6-6-6-6" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {hermanos.length > 1 ? (
          <section className={styles.detalleBloque}>
            <h4>En este pasillo</h4>
            <ul className={styles.detalleHermanos}>
              {hermanos.map((h) => (
                <li key={h.i}>
                  <button type="button" data-actual={h.actual ? 'true' : 'false'} onClick={() => alIr(h.i)} aria-current={h.actual ? 'true' : undefined}>
                    {h.titulo}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <footer className={styles.detallePie}>
        <div className={styles.detalleAcciones}>
          {proyecto ? (
            <a className={styles.detalleCta} href={`/proyectos/${proyecto.slug}`}>
              Ver el caso completo
              <Flecha d="M5 12h14M13 6l6 6-6 6" />
            </a>
          ) : (
            <button type="button" className={styles.detalleCta} onClick={alSiguiente}>
              Siguiente objeto
              <Flecha d="M5 12h14M13 6l6 6-6 6" />
            </button>
          )}
          {sitio ? (
            <a className={styles.detalleSecundario} href={sitio} target="_blank" rel="noreferrer">
              Sitio en vivo ↗
            </a>
          ) : null}
        </div>
        <span className={styles.detalleTeclas} aria-hidden="true">
          <kbd>←</kbd>
          <kbd>→</kbd> · <kbd>Esc</kbd>
        </span>
      </footer>
    </aside>
  );
}
