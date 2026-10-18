// Lógica pura del xilófono de Habilidades (sin three ni DOM, para poder probarla).

// Mismo suavizado exponencial que MathUtils.damp: independiente de los fps.
export function amortiguar(actual, objetivo, lambda, dt) {
  return actual + (objetivo - actual) * (1 - Math.exp(-lambda * dt));
}

// Fase objetivo de la cinta: avanza con el scroll de la página (en los dos sentidos) y, sola,
// despacio (`ritmo` multiplica ese avance: 0 la frena, >1 la apura). Con movimiento reducido
// sólo la mueve el scroll.
export function avanzarFase(objetivo, deltaScrollPx, dt, cfg, reducido = false, ritmo = 1) {
  const solo = reducido ? 0 : cfg.avanceSolo * dt * ritmo;
  return objetivo + deltaScrollPx * cfg.scroll.sensibilidad + solo;
}

// Qué barra queda de foco: la que muestra su cara (con el logo) de frente a la cámara, está al
// frente y cerca del centro vertical. `centros` = [{ x, y, z, frente }] en coordenadas de
// mundo; `frente` (0..1) es cuánto mira su cara a la cámara.
export function elegirResaltada(centros, actual = -1, pesoAltura = 1.5, pesoFrente = 3) {
  let mejor = -1;
  let puntaje = -Infinity;
  for (let i = 0; i < centros.length; i += 1) {
    if (i === actual) continue;
    const c = centros[i];
    const p = c.z - Math.abs(c.y) * pesoAltura + (c.frente ?? 0) * pesoFrente;
    if (p > puntaje) {
      puntaje = p;
      mejor = i;
    }
  }
  return mejor;
}

// Distancia entre dos lugares de la cinta (que da la vuelta cada `n`).
export function distanciaCircular(a, b, n) {
  const d = Math.abs((((a - b) % n) + n) % n);
  return Math.min(d, n - d);
}

// Resalte continuo: las barras se encienden al acercarse al lugar de foco y se apagan al irse,
// con una campana suave de `ancho` lugares (en vez de saltar de una barra a otra).
export function resalteContinuo(lugarBarra, lugarFoco, n, ancho = 1.2) {
  const d = distanciaCircular(lugarBarra, lugarFoco, n);
  if (d >= ancho) return 0;
  return 0.5 + 0.5 * Math.cos((Math.PI * d) / ancho);
}

// Lleva cada valor hacia su objetivo. Devuelve si cambió algo, para subir el buffer a la GPU
// sólo cuando hace falta.
export function acercarValores(valores, objetivos, dt, lambda = 8) {
  let cambio = false;
  for (let i = 0; i < valores.length; i += 1) {
    const objetivo = objetivos[i];
    const v = valores[i];
    if (Math.abs(v - objetivo) < 1e-3) {
      if (v !== objetivo) {
        valores[i] = objetivo;
        cambio = true;
      }
      continue;
    }
    valores[i] = amortiguar(v, objetivo, lambda, dt);
    cambio = true;
  }
  return cambio;
}

// Habilidad que muestra la barra i: con tantas barras como habilidades es una por barra; si
// hubiera menos habilidades, se repiten en orden.
export function habilidadDeBarra(i, totalHabilidades) {
  return ((i % totalHabilidades) + totalHabilidades) % totalHabilidades;
}

// Orden de las barras en la hélice: reparte cada categoría a intervalos parejos a lo largo de
// toda la cinta (en vez de dejarlas juntas), así al filtrar quedan salteadas por todo el modelo.
// De la categoría más grande a la más chica, cada tecnología va al lugar libre más cercano a su
// posición ideal ((j + desfase) · n / k), evitando quedar pegada a otra de su misma categoría.
// Devuelve, para cada barra, el índice de la tecnología en `tecnologias`. Las tecnologías que
// ninguna categoría nombra completan los lugares que sobran.
export function ordenDeBarras(categorias, tecnologias) {
  const n = tecnologias.length;
  const indice = new Map(tecnologias.map((t, i) => [t.id, i]));
  const lugares = new Array(n).fill(-1);
  const grupoDe = new Array(n).fill(-1);
  const usadas = new Set();
  const grupos = categorias
    .map((c, g) => ({ g, ids: c.tecnologias.filter((id) => indice.has(id)) }))
    .sort((a, b) => b.ids.length - a.ids.length || a.g - b.g);
  grupos.forEach(({ g, ids }, orden) => {
    const k = ids.length;
    const desfase = (orden * 0.618034) % 1; // corrido distinto por categoría (proporción áurea)
    ids.forEach((id, j) => {
      if (usadas.has(id)) return;
      const ideal = ((j + desfase) * n) / k;
      let elegido = -1;
      let elegidoPegado = -1;
      for (let d = 0; d < n && elegido === -1; d += 1) {
        for (const lugar of [Math.round(ideal + d), Math.round(ideal - d)]) {
          const l = ((lugar % n) + n) % n;
          if (lugares[l] !== -1) continue;
          const pegado = grupoDe[(l + 1) % n] === g || grupoDe[(l - 1 + n) % n] === g;
          if (!pegado) {
            elegido = l;
            break;
          }
          if (elegidoPegado === -1) elegidoPegado = l;
        }
      }
      const l = elegido !== -1 ? elegido : elegidoPegado;
      lugares[l] = indice.get(id);
      grupoDe[l] = g;
      usadas.add(id);
    });
  });
  const sobrantes = tecnologias.map((_, i) => i).filter((i) => !lugares.includes(i));
  return lugares.map((v) => (v === -1 ? sobrantes.shift() : v)).filter((v) => v !== undefined);
}

// Zoom de la vista: se acota para que la cámara no quede del otro lado del modelo.
export function limitarZoom(valor, minimo = 0.4, maximo = 12) {
  return Math.min(maximo, Math.max(minimo, valor));
}

// Curva suave 0..1 (empieza y termina despacio).
export function suave(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

// Progreso propio de cada barra en la transición hélice ↔ árbol: arranca cuando el progreso
// general llega a su `retardo` y tarda `ventana` en llegar. Con retardos de 0 a 0,5 y ventana
// de 0,5, todas llegan a 1 justo cuando el progreso general llega a 1.
export function progresoBarra(progreso, retardo, ventana = 0.5) {
  return suave((progreso - retardo) / ventana);
}

// Retardo escalonado: las barras de los anillos de adentro salen primero, y dentro de cada
// anillo un poco desparejas para que el vuelo se vea orgánico (siempre en 0..0,48).
export function retardoArbol(barra, nivel) {
  const azar = (barra * 0.6180339887) % 1;
  return nivel * 0.14 + azar * 0.2;
}
