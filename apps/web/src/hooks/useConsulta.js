'use client';

import { useEffect, useState } from 'react';

// `window.matchMedia(consulta).matches`, reactivo. Arranca en `false` (en el
// servidor no hay `window`) y se corrige en el primer efecto.
export default function useConsulta(consulta) {
  const [coincide, setCoincide] = useState(false);

  useEffect(() => {
    const lista = window.matchMedia(consulta);
    const actualizar = () => setCoincide(lista.matches);
    actualizar();
    lista.addEventListener('change', actualizar);
    return () => lista.removeEventListener('change', actualizar);
  }, [consulta]);

  return coincide;
}
