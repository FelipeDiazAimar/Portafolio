'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import PiezaDesarmable from '../PiezaDesarmable.jsx';
import { crearPantalla } from '../pantallaCanvas.js';
import { dibujarBandera } from '../dibujarBandera.js';
import { PARTES } from '../simboloUtn.js';
import { progresoEntrada } from '../entrada.js';
import { vistaParaAltura } from '../vista.js';
import {
  PASO,
  crearTela,
  empujar,
  estiramientoDesenrollado,
  particulaMasCercana,
  pasoTela,
} from '../tela.js';

// Bandera colgada a lo largo (franjas de costado): cuelga desde arriba del borde
// de la pantalla y baja. Más filas que columnas porque es larga.
const COLUMNAS = 22;
const FILAS = 38;
const ANCHO_TELA = 2.2;
const LARGO_TELA = 4.4;
// Cuánto por encima del borde de arriba del canvas queda sujeta la tela: así el
// borde que la sostiene nunca se ve.
const MARGEN_ARRIBA = 0.25;
// La tela empieza recogida arriba y se desenrolla hacia abajo.
const RETRASO_DESENROLLE = 0.35;
const DURACION_DESENROLLE = 2.6;
const VIENTO = 1.4;
// Qué tan lejos de la tela debe estar el puntero para que no la toque.
const RADIO_EMPUJE = 0.4;
const FUERZA_EMPUJE = 1.1;
// El símbolo aparece un rato después de la bandera.
const ALTO_SIMBOLO = 1.2;
const PROFUNDIDAD_BARRAS = 0.085;
const PROFUNDIDAD_ARCOS = 0.08;
const RETRASO_SIMBOLO = 3.6;
const DURACION_SIMBOLO = 1.1;

// Una parte del símbolo (barra o medio anillo) como forma 2D de three.
function formaDeParte(parte) {
  const forma = new THREE.Shape();
  if (parte.tipo === 'rect') {
    forma.moveTo(parte.x0, parte.y0);
    forma.lineTo(parte.x1, parte.y0);
    forma.lineTo(parte.x1, parte.y1);
    forma.lineTo(parte.x0, parte.y1);
    forma.closePath();
  } else {
    const [desde, hasta] = parte.mitad === 'inferior' ? [Math.PI, Math.PI * 2] : [0, Math.PI];
    forma.absarc(parte.cx, parte.cy, parte.r1, desde, hasta, false);
    forma.absarc(parte.cx, parte.cy, parte.r0, hasta, desde, true);
  }
  return forma;
}

// Las barras son un poco más gruesas que los arcos: así las caras de los arcos
// quedan dentro del volumen de las barras donde se solapan y no hay parpadeo
// (z-fighting) entre caras coplanares.
function crearGeometriasSimbolo() {
  return PARTES.map((parte) => {
    const profundidad = parte.tipo === 'rect' ? PROFUNDIDAD_BARRAS : PROFUNDIDAD_ARCOS;
    const geometria = new THREE.ExtrudeGeometry(formaDeParte(parte), {
      depth: profundidad,
      curveSegments: 48,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelSegments: 2,
    });
    geometria.translate(0, 0, -profundidad / 2);
    return geometria;
  });
}

// Geometría de la tela: comparte con la simulación el mismo arreglo de
// posiciones (`tela.p`), así que alcanza con marcarlo como actualizado.
function crearGeometriaTela(tela) {
  const geometria = new THREE.BufferGeometry();
  const posicion = new THREE.BufferAttribute(tela.p, 3);
  posicion.setUsage(THREE.DynamicDrawUsage);
  geometria.setAttribute('position', posicion);

  const uv = new Float32Array(tela.n * 2);
  for (let f = 0; f < FILAS; f += 1) {
    for (let c = 0; c < COLUMNAS; c += 1) {
      const i = f * COLUMNAS + c;
      uv[i * 2] = c / (COLUMNAS - 1);
      uv[i * 2 + 1] = 1 - f / (FILAS - 1);
    }
  }
  geometria.setAttribute('uv', new THREE.BufferAttribute(uv, 2));

  const indices = [];
  for (let f = 0; f < FILAS - 1; f += 1) {
    for (let c = 0; c < COLUMNAS - 1; c += 1) {
      const a = f * COLUMNAS + c;
      const b = a + 1;
      const d = a + COLUMNAS;
      const e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }
  geometria.setIndex(indices);
  geometria.computeVertexNormals();
  // La tela se mueve: el cálculo automático de la esfera envolvente quedaría
  // viejo y recortaría el dibujo o el rayo. Se fija una grande.
  geometria.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 8);
  return { geometria, posicion };
}

export default function Escena1Bandera({ activa, reducido }) {
  // Borde de arriba del canvas, en unidades de escena (la cámara se acomoda con
  // la misma función, ver DistanciaCamara).
  const alturaCanvas = useThree((estado) => estado.size.height);
  const yTope = vistaParaAltura(alturaCanvas).mitadAlto + MARGEN_ARRIBA;
  const tela = useMemo(
    () =>
      crearTela({
        columnas: COLUMNAS,
        filas: FILAS,
        ancho: ANCHO_TELA,
        alto: LARGO_TELA,
        yTope,
        // Con movimiento reducido no hay desenrollado: cuelga desde el principio.
        enrollada: !reducido,
      }),
    [reducido, yTope]
  );
  const { geometria, posicion } = useMemo(() => crearGeometriaTela(tela), [tela]);
  const lienzo = useMemo(() => {
    const l = crearPantalla(768, Math.round((768 * LARGO_TELA) / ANCHO_TELA));
    dibujarBandera(l.ctx, l.ancho, l.alto, true);
    l.textura.needsUpdate = true;
    return l;
  }, []);
  const simbolo = useMemo(crearGeometriasSimbolo, []);
  // Negro, pero con brillo: así reacciona a las luces azules y se lee por los
  // bordes y el bisel aun sobre el fondo oscuro. Empieza invisible.
  const materialSimbolo = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#04050a', metalness: 0.25, roughness: 0.28, transparent: true, opacity: 0 }),
    []
  );

  const refMalla = useRef(null);
  const refSimbolo = useRef(null);
  const refAgarre = useRef(null);
  const tiempoSim = useRef(0);
  const acumulado = useRef(0);
  const get = useThree((estado) => estado.get);
  const gl = useThree((estado) => estado.gl);
  const camera = useThree((estado) => estado.camera);

  // Interacción con el puntero. Se escucha el DOM directamente (y no los eventos
  // de R3F) porque el arrastre sobre la tela tiene que ganarle al giro del
  // modelo: si el puntero cae sobre la tela se desactivan los controles de giro
  // ANTES de que los vea OrbitControls (que escucha en el contenedor, o sea
  // después de este canvas), y se reactivan al soltar.
  useEffect(() => {
    const lienzoDom = gl.domElement;
    const malla = refMalla.current;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plano = new THREE.Plane();
    const normalCamara = new THREE.Vector3();
    const local = new THREE.Vector3();
    const mundo = new THREE.Vector3();
    const direccion = new THREE.Vector3();
    const inversa = new THREE.Matrix4();
    let anterior = null;
    let instanteAnterior = 0;
    // El modelo gira solo; si lo hiciera con el cursor sobre la tela, esta se
    // movería de lugar justo cuando se la quiere agarrar. Se pausa mientras el
    // cursor está sobre ella (o la tienen agarrada) y se retoma al apartarlo.
    let giroPausado = false;
    let giroPrevio = false;
    const pausarGiro = () => {
      if (giroPausado) return;
      const controles = get().controls;
      if (!controles) return;
      giroPrevio = controles.autoRotate;
      controles.autoRotate = false;
      giroPausado = true;
    };
    const reanudarGiro = () => {
      if (!giroPausado) return;
      const controles = get().controls;
      if (controles) controles.autoRotate = giroPrevio;
      giroPausado = false;
    };

    const apuntar = (evento) => {
      const caja = lienzoDom.getBoundingClientRect();
      ndc.set(((evento.clientX - caja.left) / caja.width) * 2 - 1, -((evento.clientY - caja.top) / caja.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
    };
    const golpe = () => raycaster.intersectObject(malla, false)[0] ?? null;
    const aLocal = (puntoMundo) => malla.worldToLocal(local.copy(puntoMundo));

    const alMover = (evento) => {
      if (refAgarre.current) return;
      apuntar(evento);
      const impacto = golpe();
      if (!impacto) {
        anterior = null;
        lienzoDom.style.cursor = '';
        reanudarGiro();
        return;
      }
      lienzoDom.style.cursor = 'grab';
      pausarGiro();
      // Con el cursor sobre la tela se está jugando con ella: que no cuente como
      // "mouse quieto" para el desarme por hover. Se avisa hacia arriba (Escena3D
      // escucha este evento) y se corta la propagación para que el movimiento no
      // vuelva a iniciar esa espera.
      evento.stopPropagation();
      lienzoDom.dispatchEvent(new CustomEvent('interaccion3d', { bubbles: true }));
      const punto = aLocal(impacto.point);
      if (anterior) {
        // Velocidad del puntero sobre la tela → empuje (como pasar la mano).
        const dt = Math.min(0.1, Math.max(0.008, (evento.timeStamp - instanteAnterior) / 1000));
        const vx = (punto.x - anterior.x) / dt;
        const vy = (punto.y - anterior.y) / dt;
        const vz = (punto.z - anterior.z) / dt;
        const rapidez = Math.hypot(vx, vy, vz);
        // Como con la mano: la tela acompaña un poco el movimiento del puntero y,
        // sobre todo, se hunde (en la dirección en que mira el puntero) tanto más
        // cuanto más rápido pasa. Empujar sólo en el plano no se notaría: los
        // resortes lo frenan.
        inversa.copy(malla.matrixWorld).invert();
        direccion.copy(raycaster.ray.direction).transformDirection(inversa);
        const hundir = Math.min(0.14, 0.012 + rapidez * FUERZA_EMPUJE * PASO);
        const acompanar = FUERZA_EMPUJE * PASO * 0.35;
        empujar(
          tela,
          punto.x,
          punto.y,
          punto.z,
          vx * acompanar + direccion.x * hundir,
          vy * acompanar + direccion.y * hundir,
          vz * acompanar + direccion.z * hundir,
          RADIO_EMPUJE
        );
      }
      anterior = punto.clone();
      instanteAnterior = evento.timeStamp;
    };

    const alSoltar = () => {
      if (!refAgarre.current) return;
      refAgarre.current = null;
      const controles = get().controls;
      // El giro sigue pausado: se retoma cuando el cursor se aparta de la tela.
      if (controles) controles.enabled = true;
      lienzoDom.style.cursor = '';
      window.removeEventListener('pointermove', alArrastrar);
      window.removeEventListener('pointerup', alSoltar);
      window.removeEventListener('pointercancel', alSoltar);
    };

    function alArrastrar(evento) {
      if (!refAgarre.current) return;
      apuntar(evento);
      // El puntero arrastra la partícula sobre un plano paralelo a la pantalla.
      if (raycaster.ray.intersectPlane(plano, mundo)) {
        const punto = aLocal(mundo);
        refAgarre.current.x = punto.x;
        refAgarre.current.y = punto.y;
        refAgarre.current.z = punto.z;
      }
    }

    const alApretar = (evento) => {
      if (evento.button !== 0) return;
      apuntar(evento);
      const impacto = golpe();
      if (!impacto) return;
      const punto = aLocal(impacto.point);
      const indice = particulaMasCercana(tela, punto.x, punto.y, punto.z);
      if (indice < 0) return;
      refAgarre.current = { indice, x: punto.x, y: punto.y, z: punto.z };
      camera.getWorldDirection(normalCamara);
      plano.setFromNormalAndCoplanarPoint(normalCamara, impacto.point);
      const controles = get().controls;
      pausarGiro();
      if (controles) controles.enabled = false;
      lienzoDom.style.cursor = 'grabbing';
      window.addEventListener('pointermove', alArrastrar);
      window.addEventListener('pointerup', alSoltar);
      window.addEventListener('pointercancel', alSoltar);
    };

    const alSalir = () => {
      anterior = null;
      if (!refAgarre.current) {
        lienzoDom.style.cursor = '';
        reanudarGiro();
      }
    };

    lienzoDom.addEventListener('pointermove', alMover);
    lienzoDom.addEventListener('pointerdown', alApretar);
    lienzoDom.addEventListener('pointerleave', alSalir);
    return () => {
      lienzoDom.removeEventListener('pointermove', alMover);
      lienzoDom.removeEventListener('pointerdown', alApretar);
      lienzoDom.removeEventListener('pointerleave', alSalir);
      alSoltar();
      reanudarGiro();
      lienzoDom.style.cursor = '';
    };
  }, [gl, camera, get, tela]);

  useEffect(
    () => () => {
      geometria.dispose();
      lienzo.textura.dispose();
      simbolo.forEach((forma) => forma.dispose());
      materialSimbolo.dispose();
    },
    [geometria, lienzo, simbolo, materialSimbolo]
  );

  useFrame((_, delta) => {
    if (!activa) return;
    // Paso fijo de simulación (la física no debe depender de los cuadros por
    // segundo); como mucho 3 pasos por cuadro para no atrasarse de golpe.
    acumulado.current += Math.min(delta, 0.05);
    let pasos = 0;
    while (acumulado.current >= PASO && pasos < 3) {
      const t = tiempoSim.current;
      pasoTela(tela, PASO, {
        estiramiento: reducido ? 1 : estiramientoDesenrollado(t, RETRASO_DESENROLLE, DURACION_DESENROLLE),
        viento: reducido ? 0 : VIENTO,
        t,
        agarre: refAgarre.current,
      });
      tiempoSim.current += PASO;
      acumulado.current -= PASO;
      pasos += 1;
    }
    if (pasos > 0) {
      posicion.needsUpdate = true;
      geometria.computeVertexNormals();
    }

    // El símbolo se materializa después de la bandera: aparece y crece un poco.
    const entrada = reducido ? 1 : progresoEntrada(tiempoSim.current, RETRASO_SIMBOLO, DURACION_SIMBOLO);
    materialSimbolo.opacity = entrada;
    if (refSimbolo.current) {
      refSimbolo.current.visible = entrada > 0.001;
      refSimbolo.current.scale.setScalar(ALTO_SIMBOLO * (0.7 + 0.3 * entrada));
    }
  });

  // El grupo va desplazado a la derecha del título para no taparlo: el título va
  // por encima del canvas, pero sobre franjas celestes casi no se lee.
  return (
    <group position={[0.62, 0, 0]} rotation={[0, -0.25, 0]}>
      {/* Bandera: tela simulada colgada desde arriba del borde de la pantalla,
          sin varilla. Se puede agarrar y empujar con el mouse. */}
      <PiezaDesarmable semilla={3}>
        <mesh ref={refMalla} geometry={geometria} frustumCulled={false}>
          <meshStandardMaterial
            map={lienzo.textura}
            emissiveMap={lienzo.textura}
            emissive="#ffffff"
            emissiveIntensity={0.35}
            roughness={0.85}
            side={THREE.DoubleSide}
          />
        </mesh>
      </PiezaDesarmable>

      {/* Símbolo de la UTN: sólo las formas, extruidas y en negro, al lado de la bandera */}
      <PiezaDesarmable posicion={[1.75, 0.2, 0]} semilla={5}>
        <group ref={refSimbolo} visible={false}>
          {simbolo.map((forma, i) => (
            <mesh key={i} geometry={forma} material={materialSimbolo} />
          ))}
        </group>
      </PiezaDesarmable>
    </group>
  );
}
