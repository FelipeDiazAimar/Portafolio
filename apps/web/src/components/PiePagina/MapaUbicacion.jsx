'use client';

// Mapa abstracto de Argentina hecho de puntos, con un pin que late sobre San Francisco, Córdoba y una
// banda de luz que lo recorre de sur a norte. Es un contorno simplificado (a mano), no un mapa
// exacto: alcanza para que se lea el país. Sigue el tema por las variables --contacto-*.
import { useEffect, useRef, useState } from 'react';
import styles from './MapaUbicacion.module.css';

// [longitud, latitud], en sentido horario desde el noroeste.
const ARGENTINA = [
  [-66.5, -22.1], [-65.0, -22.1], [-64.3, -22.8], [-63.8, -22.0], [-62.5, -22.3], [-61.0, -23.6], [-60.0, -24.0],
  [-58.7, -24.9], [-57.6, -25.3], [-58.1, -26.2], [-58.6, -27.3], [-56.9, -27.4], [-55.8, -27.3], [-54.6, -25.6],
  [-53.7, -25.8], [-53.8, -27.1], [-55.0, -27.9], [-56.5, -29.1], [-57.6, -30.2], [-58.2, -31.2], [-58.1, -32.3],
  [-58.4, -33.4], [-58.4, -34.4], [-57.8, -34.9], [-57.4, -35.8], [-56.7, -36.8], [-57.3, -37.7], [-58.7, -38.5],
  [-60.5, -38.8], [-62.2, -38.8], [-62.3, -40.4], [-64.9, -40.8], [-64.2, -41.4], [-63.6, -42.2], [-64.8, -42.7],
  [-65.2, -44.2], [-66.5, -45.2], [-67.6, -46.1], [-66.0, -47.8], [-67.4, -49.0], [-68.4, -50.3], [-69.2, -51.6],
  [-68.4, -52.4], [-67.0, -54.0], [-65.2, -54.8], [-68.6, -54.9], [-68.8, -53.2], [-71.5, -52.2], [-72.4, -50.8],
  [-73.4, -49.3], [-72.6, -48.0], [-72.3, -46.6], [-71.5, -45.4], [-71.7, -43.5], [-71.9, -41.8], [-71.4, -40.2],
  [-70.7, -38.2], [-70.4, -36.4], [-70.0, -34.8], [-70.1, -33.2], [-69.9, -31.5], [-69.8, -29.6], [-68.6, -28.0],
  [-68.4, -26.4], [-67.6, -24.6], [-67.0, -23.0],
];
const SAN_FRANCISCO = [-62.09, -31.43];

const LON0 = -73.8;
const LON1 = -53.4;
const LAT0 = -21.6; // arriba
const LAT1 = -55.2; // abajo
const COS = Math.cos((38 * Math.PI) / 180); // los grados de longitud miden menos hacia el sur
const ANCHO_MAPA = (LON1 - LON0) * COS;
const ALTO_MAPA = LAT0 - LAT1;
const PASO = 6.5; // separación entre puntos, en px

const proyectar = ([lon, lat]) => [((lon - LON0) * COS) / ANCHO_MAPA, (LAT0 - lat) / ALTO_MAPA];

function dentro(punto, poligono) {
  let adentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [xi, yi] = poligono[i];
    const [xj, yj] = poligono[j];
    if (yi > punto[1] !== yj > punto[1] && punto[0] < ((xj - xi) * (punto[1] - yi)) / (yj - yi) + xi) adentro = !adentro;
  }
  return adentro;
}

function horaCordoba() {
  return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Cordoba' }).format(new Date());
}

export default function MapaUbicacion() {
  const refLienzo = useRef(null);
  const [hora, setHora] = useState('');

  useEffect(() => {
    setHora(horaCordoba());
    const intervalo = setInterval(() => setHora(horaCordoba()), 20000);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    const lienzo = refLienzo.current;
    const ctx = lienzo.getContext('2d');
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const poligono = ARGENTINA.map(proyectar);
    const pin = proyectar(SAN_FRANCISCO);
    let ancho = 0;
    let alto = 0;
    let puntos = [];
    let visible = true;
    let cuadro = 0;
    const colores = { punto: '#7b8aa3', acento: '#1f6bff', celeste: '#38c6ff' };

    function leerColores() {
      const css = getComputedStyle(lienzo);
      colores.punto = css.getPropertyValue('--contacto-tenue').trim() || colores.punto;
      colores.acento = css.getPropertyValue('--contacto-acento').trim() || colores.acento;
      colores.celeste = css.getPropertyValue('--contacto-celeste').trim() || colores.celeste;
    }

    function armar() {
      const rect = lienzo.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      ancho = rect.width;
      alto = rect.height;
      lienzo.width = Math.round(ancho * dpr);
      lienzo.height = Math.round(alto * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // el mapa mantiene su proporción: ocupa todo el alto si el ancho alcanza, y si no, todo el ancho
      const razon = ANCHO_MAPA / ALTO_MAPA;
      const w = Math.min(ancho, alto * razon);
      const h = w / razon;
      const x0 = (ancho - w) / 2;
      puntos = [];
      for (let py = PASO / 2; py < h; py += PASO) {
        for (let px = x0 + PASO / 2; px < x0 + w; px += PASO) {
          if (dentro([(px - x0) / w, py / h], poligono)) puntos.push({ x: px, y: py, fila: py / h });
        }
      }
      puntos.pin = { x: x0 + pin[0] * w, y: pin[1] * h };
    }

    function pintar(t) {
      ctx.clearRect(0, 0, ancho, alto);
      const p = puntos.pin;
      // banda de luz: sube de sur a norte y vuelve a empezar
      const banda = reducido ? -1 : 1.25 - ((t / 6500) % 1.5);
      for (const q of puntos) {
        const cerca = Math.hypot(q.x - p.x, q.y - p.y);
        const luz = Math.max(0, 1 - Math.abs(q.fila - banda) / 0.07);
        const brillo = Math.max(luz, Math.max(0, 1 - cerca / 34) * 0.9);
        ctx.globalAlpha = 0.3 + brillo * 0.7;
        ctx.fillStyle = brillo > 0.05 ? colores.celeste : colores.punto;
        ctx.beginPath();
        ctx.arc(q.x, q.y, 1.25 + brillo * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // pin: dos ondas que se abren y un centro fijo con resplandor
      const fase = reducido ? 0.4 : (t / 2200) % 1;
      for (let k = 0; k < 2; k++) {
        const f = (fase + k * 0.5) % 1;
        ctx.globalAlpha = (1 - f) * 0.75;
        ctx.strokeStyle = colores.acento;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 + f * 22, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const brillo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 16);
      brillo.addColorStop(0, colores.celeste);
      brillo.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = brillo;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = colores.acento;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }

    function bucle(t) {
      if (visible) pintar(t);
      cuadro = requestAnimationFrame(bucle);
    }

    leerColores();
    armar();
    const observador = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    observador.observe(lienzo);
    window.addEventListener('resize', armar);
    const dejarDeObservar = new MutationObserver(leerColores);
    dejarDeObservar.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    const consulta = window.matchMedia('(prefers-color-scheme: dark)');
    consulta.addEventListener('change', leerColores);
    if (reducido) pintar(0);
    else cuadro = requestAnimationFrame(bucle);
    return () => {
      cancelAnimationFrame(cuadro);
      observador.disconnect();
      dejarDeObservar.disconnect();
      consulta.removeEventListener('change', leerColores);
      window.removeEventListener('resize', armar);
    };
  }, []);

  return (
    <figure className={styles.mapa}>
      <canvas ref={refLienzo} className={styles.lienzo} role="img" aria-label="Mapa de Argentina con un pin en San Francisco, Córdoba" />
      <figcaption className={styles.leyenda}>
        <span className={styles.titulo}>San Francisco, Córdoba</span>
        <span>31°26′ S · 62°05′ O</span>
        <span className={styles.hora}>
          <i aria-hidden="true" />
          {hora ? `${hora} h · UTC−3` : 'UTC−3'}
        </span>
      </figcaption>
    </figure>
  );
}
