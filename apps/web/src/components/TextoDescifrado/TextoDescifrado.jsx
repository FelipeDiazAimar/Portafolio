'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import styles from './TextoDescifrado.module.css';

export default function TextoDescifrado({
  texto,
  velocidad = 50,
  iteracionesMaximas = 10,
  secuencial = false,
  direccionRevelado = 'start',
  usarSoloCaracteresOriginales = false,
  caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+',
  className = '',
  parentClassName = '',
  encryptedClassName = '',
  activarCon = 'hover',
  modoClic = 'once',
  ...resto
}) {
  const [textoMostrado, setTextoMostrado] = useState(texto);
  const [estaAnimando, setEstaAnimando] = useState(false);
  const [indicesRevelados, setIndicesRevelados] = useState(new Set());
  const [yaAnimo, setYaAnimo] = useState(false);
  const [estaDescifrado, setEstaDescifrado] = useState(activarCon !== 'click');
  const [direccion, setDireccion] = useState('forward');

  const refContenedor = useRef(null);
  const refOrden = useRef([]);
  const refPuntero = useRef(0);
  const refIntervalo = useRef(null);

  const caracteresDisponibles = useMemo(() => {
    return usarSoloCaracteresOriginales
      ? Array.from(new Set(texto.split(''))).filter((caracter) => caracter !== ' ')
      : caracteres.split('');
  }, [usarSoloCaracteresOriginales, texto, caracteres]);

  const mezclarTexto = useCallback(
    (textoOriginal, revelacionActual) => {
      return textoOriginal
        .split('')
        .map((caracter, i) => {
          if (caracter === ' ') return ' ';
          if (revelacionActual.has(i)) return textoOriginal[i];
          return caracteresDisponibles[Math.floor(Math.random() * caracteresDisponibles.length)];
        })
        .join('');
    },
    [caracteresDisponibles]
  );

  const calcularOrden = useCallback(
    (largo) => {
      const orden = [];
      if (largo <= 0) return orden;
      if (direccionRevelado === 'start') {
        for (let i = 0; i < largo; i++) orden.push(i);
        return orden;
      }
      if (direccionRevelado === 'end') {
        for (let i = largo - 1; i >= 0; i--) orden.push(i);
        return orden;
      }
      // center
      const medio = Math.floor(largo / 2);
      let offset = 0;
      while (orden.length < largo) {
        if (offset % 2 === 0) {
          const idx = medio + offset / 2;
          if (idx >= 0 && idx < largo) orden.push(idx);
        } else {
          const idx = medio - Math.ceil(offset / 2);
          if (idx >= 0 && idx < largo) orden.push(idx);
        }
        offset++;
      }
      return orden.slice(0, largo);
    },
    [direccionRevelado]
  );

  const llenarTodosIndices = useCallback(() => {
    const s = new Set();
    for (let i = 0; i < texto.length; i++) s.add(i);
    return s;
  }, [texto]);

  const quitarIndicesAleatorios = useCallback((set, cantidad) => {
    const arr = Array.from(set);
    for (let i = 0; i < cantidad && arr.length > 0; i++) {
      const idx = Math.floor(Math.random() * arr.length);
      arr.splice(idx, 1);
    }
    return new Set(arr);
  }, []);

  const encriptarInstantaneo = useCallback(() => {
    const setVacio = new Set();
    setIndicesRevelados(setVacio);
    setTextoMostrado(mezclarTexto(texto, setVacio));
    setEstaDescifrado(false);
  }, [texto, mezclarTexto]);

  const dispararDescifrado = useCallback(() => {
    if (secuencial) {
      refOrden.current = calcularOrden(texto.length);
      refPuntero.current = 0;
      setIndicesRevelados(new Set());
    } else {
      setIndicesRevelados(new Set());
    }
    setDireccion('forward');
    setEstaAnimando(true);
  }, [secuencial, calcularOrden, texto.length]);

  const dispararReversa = useCallback(() => {
    if (secuencial) {
      refOrden.current = calcularOrden(texto.length).slice().reverse();
      refPuntero.current = 0;
      setIndicesRevelados(llenarTodosIndices());
      setTextoMostrado(mezclarTexto(texto, llenarTodosIndices()));
    } else {
      setIndicesRevelados(llenarTodosIndices());
      setTextoMostrado(mezclarTexto(texto, llenarTodosIndices()));
    }
    setDireccion('reverse');
    setEstaAnimando(true);
  }, [secuencial, calcularOrden, llenarTodosIndices, mezclarTexto, texto]);

  useEffect(() => {
    if (!estaAnimando) return;

    let iteracionActual = 0;

    const obtenerSiguienteIndice = (revelacionSet) => {
      const largoTexto = texto.length;
      switch (direccionRevelado) {
        case 'start':
          return revelacionSet.size;
        case 'end':
          return largoTexto - 1 - revelacionSet.size;
        case 'center': {
          const medio = Math.floor(largoTexto / 2);
          const offset = Math.floor(revelacionSet.size / 2);
          const siguienteIndice = revelacionSet.size % 2 === 0 ? medio + offset : medio - offset - 1;

          if (siguienteIndice >= 0 && siguienteIndice < largoTexto && !revelacionSet.has(siguienteIndice)) {
            return siguienteIndice;
          }

          for (let i = 0; i < largoTexto; i++) {
            if (!revelacionSet.has(i)) return i;
          }
          return 0;
        }
        default:
          return revelacionSet.size;
      }
    };

    refIntervalo.current = setInterval(() => {
      setIndicesRevelados((prevRevelados) => {
        if (secuencial) {
          // Forward
          if (direccion === 'forward') {
            if (prevRevelados.size < texto.length) {
              const siguienteIndice = obtenerSiguienteIndice(prevRevelados);
              const nuevosRevelados = new Set(prevRevelados);
              nuevosRevelados.add(siguienteIndice);
              setTextoMostrado(mezclarTexto(texto, nuevosRevelados));
              return nuevosRevelados;
            } else {
              clearInterval(refIntervalo.current);
              setEstaAnimando(false);
              setEstaDescifrado(true);
              return prevRevelados;
            }
          }
          // Reverse
          if (direccion === 'reverse') {
            if (refPuntero.current < refOrden.current.length) {
              const idxAQuitar = refOrden.current[refPuntero.current++];
              const nuevosRevelados = new Set(prevRevelados);
              nuevosRevelados.delete(idxAQuitar);
              setTextoMostrado(mezclarTexto(texto, nuevosRevelados));
              if (nuevosRevelados.size === 0) {
                clearInterval(refIntervalo.current);
                setEstaAnimando(false);
                setEstaDescifrado(false);
              }
              return nuevosRevelados;
            } else {
              clearInterval(refIntervalo.current);
              setEstaAnimando(false);
              setEstaDescifrado(false);
              return prevRevelados;
            }
          }
        } else {
          // Non-Sequential
          if (direccion === 'forward') {
            setTextoMostrado(mezclarTexto(texto, prevRevelados));
            iteracionActual++;
            if (iteracionActual >= iteracionesMaximas) {
              clearInterval(refIntervalo.current);
              setEstaAnimando(false);
              setTextoMostrado(texto);
              setEstaDescifrado(true);
            }
            return prevRevelados;
          }

          // Non-Sequential Reverse
          if (direccion === 'reverse') {
            let setActual = prevRevelados;
            if (setActual.size === 0) {
              setActual = llenarTodosIndices();
            }
            const cantidadAQuitar = Math.max(1, Math.ceil(texto.length / Math.max(1, iteracionesMaximas)));
            const siguienteSet = quitarIndicesAleatorios(setActual, cantidadAQuitar);
            setTextoMostrado(mezclarTexto(texto, siguienteSet));
            iteracionActual++;
            if (siguienteSet.size === 0 || iteracionActual >= iteracionesMaximas) {
              clearInterval(refIntervalo.current);
              setEstaAnimando(false);
              setEstaDescifrado(false);
              setTextoMostrado(mezclarTexto(texto, new Set()));
              return new Set();
            }
            return siguienteSet;
          }
        }
        return prevRevelados;
      });
    }, velocidad);

    return () => clearInterval(refIntervalo.current);
  }, [
    estaAnimando,
    texto,
    velocidad,
    iteracionesMaximas,
    secuencial,
    direccionRevelado,
    mezclarTexto,
    direccion,
    llenarTodosIndices,
    quitarIndicesAleatorios,
    caracteres,
    usarSoloCaracteresOriginales
  ]);

  /* Comportamiento al clic */
  const manejarClic = () => {
    if (activarCon !== 'click') return;

    if (modoClic === 'once') {
      if (estaDescifrado) return;
      setDireccion('forward');
      dispararDescifrado();
    }

    if (modoClic === 'toggle') {
      if (estaDescifrado) {
        dispararReversa();
      } else {
        setDireccion('forward');
        dispararDescifrado();
      }
    }
  };

  /* Comportamiento al hover */
  const dispararDescifradoHover = useCallback(() => {
    if (estaAnimando) return;

    setIndicesRevelados(new Set());
    setEstaDescifrado(false);
    setTextoMostrado(texto);
    setDireccion('forward');
    setEstaAnimando(true);
  }, [estaAnimando, texto]);

  const restablecerTextoPlano = useCallback(() => {
    clearInterval(refIntervalo.current);
    setEstaAnimando(false);
    setIndicesRevelados(new Set());
    setTextoMostrado(texto);
    setEstaDescifrado(true);
    setDireccion('forward');
  }, [texto]);

  /* Observador de vista */
  useEffect(() => {
    if (activarCon !== 'view' && activarCon !== 'inViewHover') return;

    const callbackObservador = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !yaAnimo) {
          dispararDescifrado();
          setYaAnimo(true);
        }
      });
    };

    const opcionesObservador = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
    };

    const observador = new IntersectionObserver(callbackObservador, opcionesObservador);
    const refActual = refContenedor.current;
    if (refActual) {
      observador.observe(refActual);
    }

    return () => {
      if (refActual) {
        observador.unobserve(refActual);
      }
    };
  }, [activarCon, yaAnimo, dispararDescifrado]);

  useEffect(() => {
    if (activarCon === 'click') {
      encriptarInstantaneo();
    } else {
      setTextoMostrado(texto);
      setEstaDescifrado(true);
    }
    setIndicesRevelados(new Set());
    setDireccion('forward');
  }, [activarCon, texto, encriptarInstantaneo]);

  const propsAnimacion =
    activarCon === 'hover' || activarCon === 'inViewHover'
      ? {
          onMouseEnter: dispararDescifradoHover,
          onMouseLeave: restablecerTextoPlano
        }
      : activarCon === 'click'
        ? {
            onClick: manejarClic
          }
        : {};

  return (
    <motion.span className={`${styles.contenedor} ${parentClassName}`} ref={refContenedor} {...propsAnimacion} {...resto}>
      <span className={styles.soloLectura}>{textoMostrado}</span>

      <span aria-hidden="true">
        {textoMostrado.split('').map((caracter, indice) => {
          const estaRevelado = indicesRevelados.has(indice) || (!estaAnimando && estaDescifrado);

          return (
            <span key={indice} className={estaRevelado ? className : encryptedClassName}>
              {caracter}
            </span>
          );
        })}
      </span>
    </motion.span>
  );
}
