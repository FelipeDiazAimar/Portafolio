// Atlas de etiquetas por temática: lomos de libros, etiquetas de cajas, de frascos, de botellas.
// Una textura de 2048 px con una grilla de 8 × 8 celdas, todas distintas, así ningún objeto
// generado lleva la misma etiqueta que otro (y cada pasillo tiene las suyas).
import * as THREE from 'three';

export const CELDAS = 8;
const TAM = 2048;
const C = TAM / CELDAS;

function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fuente = (px, peso = 700, familia = 'Inter, system-ui, sans-serif') => `${peso} ${px}px ${familia}`;

// Ruido sutil para que nada se vea "plano de computadora".
function grano(ctx, x, y, w, h, r, alfa = 0.05) {
  for (let i = 0; i < (w * h) / 60; i++) {
    const v = r() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${alfa * r()})`;
    ctx.fillRect(x + r() * w, y + r() * h, 1 + r() * 2, 1 + r() * 2);
  }
}

function codigoBarras(ctx, x, y, w, h, r) {
  ctx.fillStyle = '#111';
  let cx = x;
  while (cx < x + w) {
    const ancho = 1 + Math.floor(r() * 4);
    if (r() > 0.45) ctx.fillRect(cx, y, ancho, h);
    cx += ancho + 1;
  }
}

function centrado(ctx, texto, x, y, ancho) {
  let tam = parseInt(ctx.font.match(/(\d+)px/)[1], 10);
  while (ctx.measureText(texto).width > ancho && tam > 10) {
    tam -= 2;
    ctx.font = ctx.font.replace(/\d+px/, `${tam}px`);
  }
  ctx.fillText(texto, x, y);
}

// ---- dibujos por temática (cada uno recibe la celda en (0,0)-(C,C)) ---------------------------

// Lomos de libros: vertical, con título girado, bandas y editorial.
function lomo(titulo, autor, fondo, tinta, r) {
  return (ctx) => {
    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, C, C);
    grano(ctx, 0, 0, C, C, r, 0.08);
    ctx.fillStyle = tinta;
    const bandas = r() > 0.5;
    if (bandas) {
      ctx.fillRect(0, C * 0.08, C, 6);
      ctx.fillRect(0, C * 0.92, C, 6);
    }
    ctx.save();
    ctx.translate(C / 2, C / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = fuente(30, 800, 'Georgia, serif');
    centrado(ctx, titulo, 0, -16, C * 0.8);
    ctx.font = fuente(18, 500);
    centrado(ctx, autor, 0, 22, C * 0.7);
    ctx.restore();
  };
}

function etiquetaCaja(titulo, sub, acento, r) {
  return (ctx) => {
    ctx.fillStyle = '#f4f1ea';
    ctx.fillRect(0, 0, C, C);
    grano(ctx, 0, 0, C, C, r, 0.06);
    ctx.fillStyle = acento;
    ctx.fillRect(0, 0, C, C * 0.22);
    ctx.fillStyle = '#fff';
    ctx.font = fuente(26, 800);
    ctx.textAlign = 'left';
    centrado(ctx, titulo, 14, C * 0.15, C - 28);
    ctx.fillStyle = '#222';
    ctx.font = fuente(20, 600);
    centrado(ctx, sub, 14, C * 0.4, C - 28);
    ctx.font = fuente(15, 500);
    ctx.fillStyle = '#555';
    ctx.fillText(`Cód. ${Math.floor(r() * 90000 + 10000)}`, 14, C * 0.55);
    codigoBarras(ctx, 14, C * 0.64, C - 28, C * 0.22, r);
  };
}

function etiquetaFrasco(nombre, linea, fondo, tinta, r) {
  return (ctx) => {
    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, C, C);
    grano(ctx, 0, 0, C, C, r, 0.05);
    ctx.strokeStyle = tinta;
    ctx.lineWidth = 3;
    ctx.strokeRect(14, 14, C - 28, C - 28);
    ctx.fillStyle = tinta;
    ctx.textAlign = 'center';
    ctx.font = fuente(16, 600);
    ctx.fillText(linea.toUpperCase(), C / 2, C * 0.3);
    ctx.font = fuente(40, 700, 'Georgia, serif');
    centrado(ctx, nombre, C / 2, C * 0.58, C - 40);
    ctx.font = fuente(14, 500);
    ctx.fillText('hecho a mano', C / 2, C * 0.78);
  };
}

function etiquetaLogistica(lote, producto, r) {
  return (ctx) => {
    ctx.fillStyle = '#fbfbf8';
    ctx.fillRect(0, 0, C, C);
    ctx.fillStyle = '#111';
    ctx.font = fuente(18, 800);
    ctx.textAlign = 'left';
    ctx.fillText('PLANTA SAN JORGE', 12, 28);
    ctx.font = fuente(16, 600);
    centrado(ctx, producto, 12, 54, C - 24);
    ctx.font = fuente(14, 500);
    ctx.fillText(`Lote ${lote}`, 12, 78);
    ctx.fillText(`Peso neto ${(8 + r() * 14).toFixed(2)} kg`, 12, 98);
    ctx.fillText(`Elab. ${String(1 + Math.floor(r() * 28)).padStart(2, '0')}/11/2026`, 12, 118);
    codigoBarras(ctx, 12, 132, C - 24, 80, r);
    ctx.font = fuente(13, 600);
    ctx.fillText(`(01)0779${Math.floor(r() * 1e9)}`, 12, 232);
  };
}

const TEXTOS = {
  laboratorio: (r) => {
    const items = [
      ['Resistencias', '1/4 W · surtidas'],
      ['Capacitores', '100 µF · 25 V'],
      ['Memorias RAM', 'DDR3 · 4 GB'],
      ['Tornillos M3', 'x 200 u.'],
      ['Fusibles', '5 x 20 mm'],
      ['Pasta térmica', 'jeringa 4 g'],
      ['Cables SATA', '50 cm'],
      ['Ventiladores', '80 mm · 12 V'],
      ['Placas de red', 'PCI 10/100'],
      ['Discos 3,5"', 'para revisar'],
      ['Conectores RJ45', 'cat. 6'],
      ['Termocontraíble', 'surtido'],
      ['Estaño 60/40', '0,8 mm'],
      ['Pilas', 'CR2032'],
      ['Fuentes ATX', 'en reparación'],
      ['Lab. 3 · UTN', 'inventario 2024'],
    ];
    const acentos = ['#2f7d4a', '#1d4ed8', '#b45309', '#7c3aed', '#be123c', '#0f766e'];
    return Array.from({ length: CELDAS * CELDAS }, (_, i) => {
      const [t, s] = items[i % items.length];
      return etiquetaCaja(t, i >= items.length ? `${s} · ${Math.floor(i / items.length) + 1}` : s, acentos[i % acentos.length], r);
    });
  },
  docencia: (r) => {
    const titulos = [
      ['Algoritmos', 'Cormen'],
      ['Programación en C', 'Kernighan'],
      ['Python', 'Lutz'],
      ['Análisis Matemático I', 'Rabuffetti'],
      ['Álgebra y Geometría', 'Grossman'],
      ['Física I', 'Sears'],
      ['Física II', 'Resnick'],
      ['Sistemas Operativos', 'Tanenbaum'],
      ['Redes de Datos', 'Kurose'],
      ['Bases de Datos', 'Date'],
      ['Arquitectura', 'Stallings'],
      ['Matemática Discreta', 'Johnsonbaugh'],
      ['Probabilidad', 'Walpole'],
      ['Ing. de Software', 'Pressman'],
      ['Lógica', 'Copi'],
      ['Estructuras de Datos', 'Weiss'],
      ['Química General', 'Chang'],
      ['Diagramas de Flujo', 'Apunte'],
      ['Ingreso 2025', 'Cuadernillo'],
      ['Compiladores', 'Aho'],
      ['Inglés Técnico', 'Glendinning'],
      ['Economía', 'Mochón'],
      ['Investigación Op.', 'Taha'],
      ['Simulación', 'Banks'],
    ];
    const tapas = ['#7f1d1d', '#1e3a8a', '#14532d', '#78350f', '#312e81', '#1f2937', '#9a3412', '#0f766e', '#a16207', '#f1ede4', '#4a044e'];
    return Array.from({ length: CELDAS * CELDAS }, (_, i) => {
      if (i % 4 === 3) {
        const carpetas = ['Parciales 2024', 'TP Integrador', 'Ingreso · Turno mañana', 'Ingreso · Turno tarde', 'Notas finales', 'Ejercicios resueltos', 'Planillas', 'Asistencia'];
        return etiquetaCaja(carpetas[(i >> 2) % carpetas.length], `Comisión ${1 + (i % 5)}`, tapas[i % tapas.length], r);
      }
      const [t, a] = titulos[i % titulos.length];
      const fondo = tapas[(i * 7) % tapas.length];
      return lomo(i >= titulos.length ? `${t} ${['II', 'III', 'IV'][i % 3]}` : t, a, fondo, fondo === '#f1ede4' ? '#1f2937' : '#efe7d2', r);
    });
  },
  freelance: (r) => {
    const aromas = ['Vainilla', 'Lavanda', 'Sándalo', 'Jazmín', 'Coco', 'Limón', 'Canela', 'Rosas', 'Pomelo', 'Té verde', 'Menta', 'Ámbar', 'Durazno', 'Cedro', 'Bambú', 'Mandarina'];
    const fondos = ['#f6e7d8', '#efe3f7', '#e3f1ea', '#fbf3d6', '#f7e0e4', '#e6eef8'];
    return Array.from({ length: CELDAS * CELDAS }, (_, i) => {
      if (i % 3 === 2) {
        return (ctx) => {
          // etiqueta de envío
          ctx.fillStyle = '#fffdf7';
          ctx.fillRect(0, 0, C, C);
          ctx.fillStyle = '#111';
          ctx.textAlign = 'left';
          ctx.font = fuente(16, 800);
          ctx.fillText('ENVÍO', 12, 26);
          ctx.font = fuente(15, 500);
          const destinos = ['San Francisco, Cba.', 'Córdoba Capital', 'Rafaela, Sta. Fe', 'Villa María', 'Rosario', 'Frontera, Sta. Fe'];
          ctx.fillText(`Para: ${destinos[i % destinos.length]}`, 12, 52);
          ctx.fillText(`Pedido #${1000 + i * 37}`, 12, 74);
          codigoBarras(ctx, 12, 92, C - 24, 90, r);
          ctx.font = fuente(13, 600);
          ctx.fillText('FRÁGIL · no apilar', 12, 210);
        };
      }
      return etiquetaFrasco(aromas[i % aromas.length], i % 2 ? 'Calida Esencia' : 'Algo Bonito', fondos[i % fondos.length], '#5b4636', r);
    });
  },
  tecnico: (r) => {
    const productos = [
      ['SSD 480 GB', 'SATA III'],
      ['Fuente 600 W', '80 Plus'],
      ['Mouse óptico', 'USB'],
      ['Teclado', 'español'],
      ['Cargador notebook', '19 V · 3,4 A'],
      ['Batería', 'notebook 6 celdas'],
      ['Cartucho negro', 'reemplazo'],
      ['Tóner', 'compatible'],
      ['Pantalla 15,6"', 'LED slim'],
      ['Disco 1 TB', '7200 rpm'],
      ['Placa de video', '4 GB'],
      ['Router', 'doble banda'],
      ['Cable HDMI', '1,8 m'],
      ['Pendrive', '32 GB'],
      ['Flex de pantalla', '30 pines'],
      ['Cooler CPU', 'universal'],
      ['Orden 0412', 'Notebook · Gómez'],
      ['Orden 0413', 'PC · Peralta'],
      ['Orden 0415', 'Impresora · Ruiz'],
      ['Orden 0418', 'Celular · Díaz'],
    ];
    const acentos = ['#4c1d95', '#1d4ed8', '#111827', '#b91c1c', '#065f46', '#9a3412'];
    return Array.from({ length: CELDAS * CELDAS }, (_, i) => {
      const [t, s] = productos[i % productos.length];
      return etiquetaCaja(t, i >= productos.length ? `${s} · stock ${i}` : s, acentos[i % acentos.length], r);
    });
  },
  mbrf: (r) => {
    const productos = ['Cortes envasados al vacío', 'Hamburguesas x 12', 'Medallones de pollo', 'Salchichas x 6', 'Fiambres surtidos', 'Cajas de exportación', 'Patitas de pollo', 'Menudencias', 'Milanesas congeladas', 'Mortadela 5 kg'];
    return Array.from({ length: CELDAS * CELDAS }, (_, i) => etiquetaLogistica(`26${String(300 + i * 7).padStart(4, '0')}`, productos[i % productos.length], r));
  },
};

// Textura del atlas de una temática (se crea una vez por pasillo).
export function crearAtlas(id, semilla = 7) {
  const r = azar(semilla + id.length * 131);
  const lienzo = document.createElement('canvas');
  lienzo.width = TAM;
  lienzo.height = TAM;
  const ctx = lienzo.getContext('2d');
  const dibujos = (TEXTOS[id] ?? TEXTOS.laboratorio)(r);
  dibujos.forEach((dibujar, i) => {
    const x = (i % CELDAS) * C;
    const y = Math.floor(i / CELDAS) * C;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, C, C);
    ctx.clip();
    ctx.translate(x, y);
    dibujar(ctx);
    ctx.restore();
  });
  const t = new THREE.CanvasTexture(lienzo);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Rectángulo UV de una celda (v crece hacia arriba en three).
export function rectCelda(i) {
  const col = i % CELDAS;
  const fila = Math.floor(i / CELDAS) % CELDAS;
  return [col / CELDAS, 1 - (fila + 1) / CELDAS, (col + 1) / CELDAS, 1 - fila / CELDAS];
}
