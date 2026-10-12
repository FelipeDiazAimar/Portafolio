'use client';

import { Suspense, lazy, useMemo } from 'react';
import { ancla } from '@/lib/columna/geometria.js';
import EscalaResponsiva from '../Escena3D/EscalaResponsiva.jsx';
import { ProveedorDesarme } from '../Escena3D/useDesarme.jsx';
import { cargadorEscena } from '../Escena3D/escenas/index.js';
import Silueta from './Silueta.jsx';

// Un grupo por hito en su ancla. El activo y sus vecinos montan la escena real (los
// vecinos quietos: `activa` = false); los lejanos, una silueta. La escena de origen de
// un viaje se dispersa mientras la cámara despega.
// La última estación ("Hoy": constelación de radio 2.2 + grafo de radio 2.6, con
// escala base 0.57) se veía lejos/pequeña frente a las vecinas (hasta 0.8): se amplía
// sólo ella con factor 1.9 (0.57*1.9≈1.08 base, ~0.94 con la responsiva de escritorio).
// El neto crece ~35% frente al 1.4 anterior (1.9/1.4≈1.36). La constelación cabe en
// escritorio (radio efectivo ~2.07 frente a mitad alto ~2.07 y semiancho ~1.83: sólo
// roza los bordes laterales al girar, sin recorte feo) y el grafo se autoencuadra solo
// con tope 2.6, así acompaña el agrande sin recortarse.
const ESCALA_ULTIMA = 1.9;
function Estacion({ hito, indice, n, cercana, activa, dispersa, visita, reducido, claro, fraccion, color }) {
  const { posicion, angulo } = useMemo(() => ancla(indice, n), [indice, n]);
  const cargar = cargadorEscena(hito.id);
  const Escena = useMemo(() => (cargar ? lazy(cargar) : null), [cargar]);
  const silueta = <Silueta anio={hito.anio} color={color} reducido={reducido} />;
  const esUltima = indice === n - 1;
  return (
    <group position={[posicion.x, posicion.y, posicion.z]} rotation={[0, angulo, 0]}>
      {cercana && Escena ? (
        <ProveedorDesarme desarmado={dispersa} reducido={reducido}>
          <EscalaResponsiva fraccion={fraccion}>
            <group scale={esUltima ? ESCALA_ULTIMA : 1}>
              <Suspense fallback={silueta}>
                <Escena key={visita} activa={activa} reducido={reducido} claro={claro} />
              </Suspense>
            </group>
          </EscalaResponsiva>
        </ProveedorDesarme>
      ) : (
        silueta
      )}
    </group>
  );
}

export default function Estaciones({ hitos, activo, tipo, origen, visitas, reducido, claro, fraccion, color }) {
  return hitos.map((hito, i) => (
    <Estacion
      key={hito.id}
      hito={hito}
      indice={i}
      n={hitos.length}
      cercana={Math.abs(i - activo) <= 1}
      activa={tipo === 'estancia' && i === activo}
      dispersa={!reducido && tipo === 'viaje' && i === origen}
      visita={visitas[i]}
      reducido={reducido}
      claro={claro}
      fraccion={fraccion}
      color={color}
    />
  ));
}
