// Cadencia del mensaje que se escribe deslizando: cada carácter "pesa" lo que
// tardaría alguien en tipearlo, así el slide no avanza como un slice lineal.
export function pesoDe(caracter) {
  if (',;:'.includes(caracter)) return 4;
  if ('.!?…'.includes(caracter)) return 6.5;
  if (/\s/.test(caracter)) return 1.7;
  return 1;
}

export function pesosAcumulados(texto) {
  let suma = 0;
  return [...texto].map((caracter) => (suma += pesoDe(caracter)));
}

// Cuántos caracteres se ven con el slide en el progreso p (0 a 1).
export function indiceDeProgreso(acumulados, p) {
  const total = acumulados.at(-1) ?? 0;
  const objetivo = p * total + 1e-6;
  let i = 0;
  while (i < acumulados.length && acumulados[i] <= objetivo) i += 1;
  return i;
}
