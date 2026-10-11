'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ajusteGpu } from './ajusteGpu.js';

// Posición base de la gráfica en el código (debe coincidir con BASE_GPU de Escena3PC).
const BASE = [-0.45, -0.08, 1.25];

const BARRAS = [
  { clave: 'y', nombre: 'Altura (acercar a la placa)', min: -0.6, max: 0.6 },
  { clave: 'z', nombre: 'Adelante / atrás', min: -0.8, max: 0.8 },
  { clave: 'x', nombre: 'Izquierda / derecha', min: -0.8, max: 0.8 },
];

// TEMPORAL: panel con barras deslizadoras para mover la gráfica de 2024 y ver los
// valores finales. Se muestra sobre la página (fijo, abajo a la izquierda).
export default function AjusteGpuTemporal() {
  const [, redibujar] = useState(0);
  const [copiado, setCopiado] = useState(false);
  const enModelo = (clave, i) => (BASE[i] + ajusteGpu[clave] / ajusteGpu.escala).toFixed(3);
  const texto = `const BASE_GPU = [${enModelo('x', 0)}, ${enModelo('y', 1)}, ${enModelo('z', 2)}];`;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 90,
        width: 300,
        padding: '12px 14px',
        borderRadius: 12,
        background: 'rgba(8, 12, 26, 0.92)',
        border: '1px solid rgba(111, 168, 255, 0.5)',
        color: '#e6eeff',
        font: '13px system-ui, sans-serif',
        boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
      }}
    >
      <strong style={{ display: 'block', marginBottom: 8 }}>Ajuste temporal · gráfica</strong>
      {BARRAS.map(({ clave, nombre, min, max }) => (
        <label key={clave} style={{ display: 'block', marginBottom: 8 }}>
          {nombre}: <span style={{ color: '#6fa8ff' }}>{ajusteGpu[clave].toFixed(2)}</span>
          <input
            type="range"
            min={min}
            max={max}
            step={0.005}
            value={ajusteGpu[clave]}
            onChange={(evento) => {
              ajusteGpu[clave] = Number(evento.target.value);
              redibujar((n) => n + 1);
            }}
            style={{ width: '100%' }}
          />
        </label>
      ))}
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={ajusteGpu.congelar}
          onChange={(evento) => {
            ajusteGpu.congelar = evento.target.checked;
            redibujar((n) => n + 1);
          }}
        />
        Mantener la placa armada
      </label>
      <code style={{ display: 'block', fontSize: 11, padding: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 6, wordBreak: 'break-all' }}>
        {texto}
      </code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(texto).then(() => setCopiado(true));
        }}
        style={{ marginTop: 8, padding: '4px 10px', borderRadius: 6, border: 0, background: '#2f7bff', color: '#fff', cursor: 'pointer' }}
      >
        {copiado ? 'Copiado ✓' : 'Copiar valores'}
      </button>
      <button
        type="button"
        onClick={() => {
          ajusteGpu.x = 0;
          ajusteGpu.y = 0;
          ajusteGpu.z = 0;
          redibujar((n) => n + 1);
        }}
        style={{ marginTop: 8, marginLeft: 6, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#e6eeff', cursor: 'pointer' }}
      >
        Reiniciar
      </button>
    </div>,
    document.body
  );
}
