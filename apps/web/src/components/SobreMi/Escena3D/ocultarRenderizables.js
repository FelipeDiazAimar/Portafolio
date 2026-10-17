// Oculta (o devuelve) lo que se dibuja dentro de `grupo` SIN ocultar el grupo ni las luces
// que lleve: three cuenta sólo las luces visibles, y cada vez que esa cuenta cambia
// recompila todos los shaders del mundo (un congelamiento de segundos en pleno viaje).
// `marca` distingue quién ocultó cada objeto, y lo que ya estaba oculto por otra razón se
// respeta al devolverlo.
export function fijarOculto(grupo, oculto, marca) {
  grupo.traverse((o) => {
    if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return;
    if (oculto) {
      if (o.visible) {
        o.visible = false;
        o.userData[marca] = true;
      }
    } else if (o.userData[marca]) {
      o.visible = true;
      o.userData[marca] = false;
    }
  });
}
