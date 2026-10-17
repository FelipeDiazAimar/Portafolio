import { Matrix4, Quaternion, Ray, Vector3 } from 'three';

// Picking de barras en CPU (de picking.ts del original, MIT). Las barras existen sólo en la GPU
// (un único dibujo instanciado): se rearma la matriz de cada instancia, se lleva el rayo a su
// espacio local y se prueba contra la caja de la barra. Una caja por barra, sin triángulos.
// El giro propio (cada barra gira sobre su centro) se reconstruye con el mismo medio ángulo que
// usa el vertex shader.

export function crearEspacio() {
  return {
    giro: new Quaternion(),
    rotacionInstancia: new Quaternion(),
    rotacion: new Quaternion(),
    posicion: new Vector3(),
    escala: new Vector3(1, 1, 1),
    matriz: new Matrix4(),
    inversa: new Matrix4(),
    rayo: new Ray(),
    impacto: new Vector3(),
  };
}

export function barraBajoRayo(rayoMundo, posiciones, rotaciones, caja, matrizGrupo, tiempo, velocidadGiro, e) {
  const cantidad = posiciones.length / 3;
  const medio = tiempo * velocidadGiro * 0.5;
  e.giro.set(0, Math.sin(medio), 0, Math.cos(medio));
  let indice = -1;
  let distancia = Infinity;
  for (let i = 0; i < cantidad; i += 1) {
    e.rotacionInstancia.set(rotaciones[i * 4], rotaciones[i * 4 + 1], rotaciones[i * 4 + 2], rotaciones[i * 4 + 3]);
    e.rotacion.multiplyQuaternions(e.giro, e.rotacionInstancia);
    e.posicion.set(posiciones[i * 3], posiciones[i * 3 + 1], posiciones[i * 3 + 2]);
    e.matriz.compose(e.posicion, e.rotacion, e.escala);
    e.matriz.premultiply(matrizGrupo);
    e.inversa.copy(e.matriz).invert();
    e.rayo.copy(rayoMundo).applyMatrix4(e.inversa);
    const punto = e.rayo.intersectBox(caja, e.impacto);
    if (punto) {
      const d = e.rayo.origin.distanceTo(punto);
      if (d < distancia) {
        distancia = d;
        indice = i;
      }
    }
  }
  return indice;
}

// Cuánto mira a la cámara (eje z de mundo) la cara ancha de la barra i, en 0..1: es su eje x
// local con la rotación de la instancia y el giro propio. Las dos caras llevan logo.
export function frenteDeBarra(i, rotaciones, matrizGrupo, tiempo, velocidadGiro, destino, e) {
  const medio = tiempo * velocidadGiro * 0.5;
  e.giro.set(0, Math.sin(medio), 0, Math.cos(medio));
  e.rotacionInstancia.set(rotaciones[i * 4], rotaciones[i * 4 + 1], rotaciones[i * 4 + 2], rotaciones[i * 4 + 3]);
  e.rotacion.multiplyQuaternions(e.giro, e.rotacionInstancia);
  destino.set(1, 0, 0).applyQuaternion(e.rotacion).transformDirection(matrizGrupo);
  return Math.abs(destino.z);
}

// Centro de la barra i en coordenadas de mundo (el giro propio no lo mueve: gira sobre él).
export function centroDeBarra(i, posiciones, matrizGrupo, destino) {
  return destino.set(posiciones[i * 3], posiciones[i * 3 + 1], posiciones[i * 3 + 2]).applyMatrix4(matrizGrupo);
}
