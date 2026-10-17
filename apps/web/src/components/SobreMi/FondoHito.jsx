'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useReducedMotion } from 'framer-motion';
import { mostrarVideo } from '@/lib/fondoHito.js';
import styles from './FondoHito.module.css';

// Segundos que se ve la foto antes de pasar al video (si el hito tiene los dos).
const ESPERA_VIDEO_S = 1.5;

// Todas las fotos quedan montadas y sólo cambia la opacidad: así el cambio de
// hito es un crossfade y no una carga. Una foto que no existe se omite en vez de
// dejar el ícono de imagen rota. El video, en cambio, sólo se monta para el hito
// activo (pesan megas) y se pide recién cuando se llega a él.
export default function FondoHito({ hitos, activo, presente = true }) {
  const [fallidas, setFallidas] = useState({});
  const [videoFallido, setVideoFallido] = useState({});
  const [verVideo, setVerVideo] = useState(false);
  const [videoListo, setVideoListo] = useState(false);
  const refVideo = useRef(null);
  const reducido = useReducedMotion();
  const hitoActivo = hitos[activo];

  // Cada vez que cambia el hito activo se vuelve a empezar: foto primero y, si
  // corresponde, video después.
  useEffect(() => {
    setVideoListo(false);
    if (!presente || reducido || !hitoActivo.video) {
      setVerVideo(false);
      return undefined;
    }
    if (mostrarVideo(hitoActivo, 0, ESPERA_VIDEO_S)) {
      setVerVideo(true);
      return undefined;
    }
    setVerVideo(false);
    const espera = setTimeout(() => setVerVideo(true), ESPERA_VIDEO_S * 1000);
    return () => clearTimeout(espera);
  }, [activo, hitoActivo, reducido, presente]);

  // El video arranca (desde el principio) cuando toca verlo.
  useEffect(() => {
    const video = refVideo.current;
    if (!video) return;
    if (verVideo) {
      video.currentTime = 0;
      video.play().catch(() => setVideoFallido((previos) => ({ ...previos, [hitoActivo.id]: true })));
    } else {
      video.pause();
    }
  }, [verVideo, hitoActivo]);

  const videoActivo = hitoActivo.video && !videoFallido[hitoActivo.id];
  const videoSeVe = Boolean(videoActivo && verVideo && videoListo);

  return (
    <div className={styles.fondo} aria-hidden="true">
      {hitos.map((hito, i) => {
        if (!hito.imagen || fallidas[hito.id]) return null;
        const esActivo = i === activo;
        return (
          <div
            key={hito.id}
            className={`${styles.capa} ${esActivo && !videoSeVe ? styles.activa : ''}`}
          >
            <Image
              src={hito.imagen}
              alt=""
              fill
              sizes="100vw"
              loading="eager"
              className={styles.imagen}
              style={{ objectPosition: hito.foco ?? 'center' }}
              onError={() => setFallidas((previas) => ({ ...previas, [hito.id]: true }))}
            />
          </div>
        );
      })}

      {videoActivo ? (
        <div key={`video-${hitoActivo.id}`} className={`${styles.capa} ${videoSeVe ? styles.activa : ''}`}>
          <video
            ref={refVideo}
            src={hitoActivo.video}
            className={styles.video}
            muted
            loop
            playsInline
            preload="auto"
            onCanPlay={() => setVideoListo(true)}
            onError={() => setVideoFallido((previos) => ({ ...previos, [hitoActivo.id]: true }))}
          />
        </div>
      ) : null}
      <div className={styles.velo} />
    </div>
  );
}
