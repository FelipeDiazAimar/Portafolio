// Dirección (y alcance) en que sale una pieza al desarmarse, relativa a su
// posición armada: hacia afuera del centro de la escena con un poco de azar.
// Determinista (misma semilla → misma dirección) para que el desarme sea siempre
// igual. `caida.js` la usa para el empuje inicial.
export function calcularDispersion([x, y, z], semilla, radio = 2.2) {
  const azar = (n) => {
    const s = Math.sin(semilla * 12.9898 + n * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  const dx = x + (azar(1) - 0.5);
  const dy = y + (azar(2) - 0.5);
  const dz = z + (azar(3) - 0.5);
  const largo = Math.hypot(dx, dy, dz) || 1;
  const alcance = radio * (0.6 + azar(4) * 0.8);
  return [(dx / largo) * alcance, (dy / largo) * alcance, (dz / largo) * alcance];
}
