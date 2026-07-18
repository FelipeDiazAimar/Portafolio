import { useState } from 'react';
import { Button } from '@portafolio/ui';
import DemoUno from './demos/demo-uno/DemoUno.jsx';
import DemoDos from './demos/demo-dos/DemoDos.jsx';
import styles from './App.module.css';

const DEMOS = {
  'demo-uno': { label: 'Demo Uno', Component: DemoUno },
  'demo-dos': { label: 'Demo Dos', Component: DemoDos },
};

export default function App() {
  const [activeDemo, setActiveDemo] = useState('demo-uno');
  const { Component } = DEMOS[activeDemo];

  return (
    <div className={styles.layout}>
      <nav className={styles.nav}>
        {Object.entries(DEMOS).map(([key, demo]) => (
          <Button
            key={key}
            variant={activeDemo === key ? 'primary' : 'secondary'}
            onClick={() => setActiveDemo(key)}
          >
            {demo.label}
          </Button>
        ))}
      </nav>
      <main className={styles.content}>
        <Component />
      </main>
    </div>
  );
}
