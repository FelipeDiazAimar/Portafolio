// Física de la gelatina: cadena Verlet portada del "Jelly Slider" de TypeGPU
// (slider.ts, inspirado en Voicu Apostol). Va del ancla a la punta; cuando la
// punta se acerca al ancla la cadena sobra y se arquea hacia arriba.
const suave = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export class Gelatina {
  // Ancla y punta a ±0.85: con la punta redondeada la gelatina llena justo la ranura.
  static MIN_X = -0.2;
  static MAX_X = 0.85;
  // Altura a la que se sostiene la punta: un poquito levantada para que se
  // entienda que se puede agarrar (el original usa 0.08).
  static ALTURA_PUNTA = 0.065;

  // yOffset casi 0 (el original usa -0.03): la cinta ahora es más gruesa y tiene
  // que quedar apoyada sobre el piso de la ranura (y = -0.06) sin atravesarlo.
  constructor({ inicio = [-0.85, 0], fin = [0.85, 0], puntos = 17, yOffset = -0.004 } = {}) {
    this.n = puntos;
    this.anchor = inicio;
    this.baseY = inicio[1];
    this.yOffset = yOffset;
    this.targetX = fin[0];
    this.totalLength = Math.hypot(fin[0] - inicio[0], fin[1] - inicio[1]);
    this.restLen = this.totalLength / (puntos - 1);
    this.iterations = 16;
    this.substeps = 6;
    this.damping = 0.01;
    this.bendingStrength = 0.1;
    this.archStrength = 2;
    this.endFlatCount = 1;
    this.endFlatStiffness = 0.05;
    this.bendingExponent = 1.2;
    this.archEdgeDeadzone = 0.01;
    this.pos = [];
    this.prev = [];
    this.invMass = new Float32Array(puntos);
    for (let i = 0; i < puntos; i++) {
      const t = i / (puntos - 1);
      const x = inicio[0] * (1 - t) + fin[0] * t;
      const y = inicio[1] * (1 - t) + fin[1] * t + yOffset;
      this.pos.push([x, y]);
      this.prev.push([x, y]);
      this.invMass[i] = i === 0 || i === puntos - 1 ? 0 : 1;
    }
  }

  get punta() {
    return [this.targetX, Gelatina.ALTURA_PUNTA + this.yOffset];
  }

  setDragX(x) {
    this.targetX = Math.min(this.anchor[0] + this.totalLength, Math.max(this.anchor[0] - this.totalLength, x));
  }

  // Devuelve cuánto se movió la cadena (sirve para dejar de dibujar en reposo).
  update(dt) {
    if (dt <= 0) return 0;
    const h = dt / this.substeps;
    const damp = Math.min(0.999, Math.max(0, this.damping));
    const compression = Math.max(0, 1 - Math.abs(this.targetX - this.anchor[0]) / this.totalLength);
    let movimiento = 0;
    for (let s = 0; s < this.substeps; s++) {
      movimiento += this.integrar(h, damp, compression);
      this.restricciones();
    }
    return movimiento;
  }

  integrar(h, damp, compression) {
    const base = this.baseY + this.yOffset;
    let movimiento = 0;
    for (let i = 0; i < this.n; i++) {
      if (i === 0) {
        this.pos[0] = [this.anchor[0], this.anchor[1] + this.yOffset];
        this.prev[0] = [...this.pos[0]];
        continue;
      }
      if (i === this.n - 1) {
        this.pos[i] = this.punta;
        this.prev[i] = [...this.pos[i]];
        continue;
      }
      const [px, py] = this.pos[i];
      const vx = (px - this.prev[i][0]) * (1 - damp);
      const vy = (py - this.prev[i][1]) * (1 - damp);
      let ay = 0;
      if (compression > 0) {
        const t = i / (this.n - 1);
        const e = this.archEdgeDeadzone;
        ay = this.archStrength * Math.sin(Math.PI * t) * suave(e, 1 - e, t) * suave(e, 1 - e, 1 - t) * compression;
      }
      this.prev[i] = [px, py];
      this.pos[i] = [px + vx, Math.max(base, py + vy + ay * h * h)];
      movimiento += Math.abs(vx) + Math.abs(vy);
    }
    return movimiento;
  }

  distancia(i, j, reposo, k) {
    const a = this.pos[i];
    const b = this.pos[j];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const largo = Math.hypot(dx, dy);
    if (largo < 1e-8) return;
    const w1 = this.invMass[i];
    const w2 = this.invMass[j];
    const suma = w1 + w2;
    if (suma <= 0) return;
    const diff = (largo - reposo) / largo;
    a[0] += dx * diff * (w1 / suma) * k;
    a[1] += dy * diff * (w1 / suma) * k;
    b[0] -= dx * diff * (w2 / suma) * k;
    b[1] -= dy * diff * (w2 / suma) * k;
  }

  restricciones() {
    const base = this.baseY + this.yOffset;
    for (let it = 0; it < this.iterations; it++) {
      for (let i = 0; i < this.n - 1; i++) this.distancia(i, i + 1, this.restLen, 0.1);
      for (let i = 1; i < this.n - 1; i++) {
        const t = i / (this.n - 1);
        const fuerza = (Math.abs(t - 0.5) * 2) ** this.bendingExponent;
        this.distancia(i - 1, i + 1, 2 * this.restLen, this.bendingStrength * (0.05 + 0.95 * fuerza));
      }
      const c = Math.min(this.endFlatCount, this.n - 2);
      for (let i = 1; i <= c; i++) this.pos[i][1] += (base - this.pos[i][1]) * this.endFlatStiffness;
      for (let i = this.n - 1 - c; i < this.n - 1; i++) this.pos[i][1] += (base - this.pos[i][1]) * this.endFlatStiffness;
      // Ningún punto pasa de la punta ni del ancla: la cadena sobrante sube en
      // arco, en vez de pasarse de largo y plegarse junto a la punta.
      for (let i = 1; i < this.n - 1; i++) {
        this.pos[i][0] = Math.min(this.targetX, Math.max(this.anchor[0], this.pos[i][0]));
      }
      this.pos[0] = [this.anchor[0], this.anchor[1] + this.yOffset];
      this.pos[this.n - 1] = this.punta;
    }
  }
}

// Catmull-Rom: agrega un punto en medio de cada tramo (17 → 33) para que la
// curva que dibuja el shader no tenga quiebres.
export function suavizarCurva(puntos, piso) {
  const medio = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * 0.5 + (2 * a - 5 * b + 4 * c - d) * 0.25 + (-a + 3 * b - 3 * c + d) * 0.125);
  const salida = [];
  for (let i = 0; i < puntos.length - 1; i++) {
    const a = puntos[Math.max(0, i - 1)];
    const b = puntos[i];
    const c = puntos[i + 1];
    const d = puntos[Math.min(puntos.length - 1, i + 2)];
    salida.push(b, [medio(a[0], b[0], c[0], d[0]), Math.max(piso, medio(a[1], b[1], c[1], d[1]))]);
  }
  salida.push(puntos.at(-1));
  return salida;
}
