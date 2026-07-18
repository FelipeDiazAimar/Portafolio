'use client';

import { useState } from 'react';
import { Button } from '@portafolio/ui';

export default function ContactoPage() {
  const [estado, setEstado] = useState('idle');

  async function handleSubmit(event) {
    event.preventDefault();
    setEstado('enviando');

    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setEstado(response.ok ? 'enviado' : 'error');
    } catch (error) {
      setEstado('error');
    }
  }

  return (
    <section>
      <h1>Contacto</h1>
      <form onSubmit={handleSubmit}>
        <input name="nombre" placeholder="Nombre" required />
        <input name="email" type="email" placeholder="Email" required />
        <textarea name="mensaje" placeholder="Mensaje" required />
        <Button type="submit">Enviar</Button>
      </form>
      {estado === 'enviado' && <p>¡Mensaje enviado!</p>}
      {estado === 'error' && <p>Hubo un error, intentá de nuevo.</p>}
    </section>
  );
}
