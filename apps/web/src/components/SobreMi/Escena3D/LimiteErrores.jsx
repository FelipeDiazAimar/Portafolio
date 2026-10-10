'use client';

import { Component } from 'react';

// Atrapa errores de render del canvas (por ejemplo un fallo al crear el
// contexto WebGL) y avisa para que se muestre el respaldo en vez de romper la
// sección entera.
export default class LimiteErrores extends Component {
  state = { fallo: false };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    return this.state.fallo ? null : this.props.children;
  }
}
