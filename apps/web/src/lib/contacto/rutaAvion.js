// Ruta del avioncito del email: un rizo circular apoyado sobre el punto de
// despegue y una salida tangente a 45° hacia arriba a la derecha. Es analítica
// (no se muestrea), así que posición y ángulo son continuos en todo el vuelo.
export function crearRutaAvion({ inicio, ancho, alto, vueltas = 1 }) {
  const radio = Math.min(140, Math.max(84, ancho * 0.1));
  const centro = {
    x: Math.min(ancho - radio - 20, Math.max(radio + 20, inicio.x - radio * 0.2)),
    y: Math.max(inicio.y - radio, radio + 20),
  };
  const phiFin = vueltas * Math.PI * 2 + Math.PI / 4;
  const largoRizo = radio * phiFin;
  const salida = { x: centro.x + radio * Math.sin(phiFin), y: centro.y + radio * Math.cos(phiFin) };
  const direccion = { x: Math.cos(phiFin), y: -Math.sin(phiFin) };
  const largoSalida = Math.hypot(ancho, alto) * 0.9;

  function enRuta(s) {
    if (s <= largoRizo) {
      const phi = s / radio;
      return { x: centro.x + radio * Math.sin(phi), y: centro.y + radio * Math.cos(phi), angulo: -phi, phi };
    }
    const d = s - largoRizo;
    return { x: salida.x + direccion.x * d, y: salida.y + direccion.y * d, angulo: -phiFin, phi: phiFin };
  }

  return { total: largoRizo + largoSalida, enRuta };
}
