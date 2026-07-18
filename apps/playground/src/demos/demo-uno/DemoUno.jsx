import { useState } from 'react';
import { Card, Button } from '@portafolio/ui';
import styles from './DemoUno.module.css';

export default function DemoUno() {
  const [count, setCount] = useState(0);

  return (
    <Card title="Demo Uno: contador">
      <p className={styles.value}>{count}</p>
      <Button onClick={() => setCount((c) => c + 1)}>Sumar</Button>
    </Card>
  );
}
