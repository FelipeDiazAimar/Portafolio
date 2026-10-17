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
