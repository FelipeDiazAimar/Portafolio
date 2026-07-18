import { useState } from 'react';
import { Card } from '@portafolio/ui';
import styles from './DemoDos.module.css';

export default function DemoDos() {
  const [texto, setTexto] = useState('');

  return (
    <Card title="Demo Dos: texto invertido">
      <input
        className={styles.input}
        value={texto}
        onChange={(event) => setTexto(event.target.value)}
        placeholder="Escribí algo..."
      />
      <p>{texto.split('').reverse().join('')}</p>
    </Card>
  );
}
