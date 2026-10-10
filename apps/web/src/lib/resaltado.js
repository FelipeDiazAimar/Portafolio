// Separa un texto con marcas `**así**` en fragmentos. Una marca sin cerrar
// no se interpreta: queda como texto literal en vez de tragarse el resto.
export function dividirResaltado(texto) {
  const partes = texto.split('**');
  // Un número par de partes significa un número impar de `**`: el último no
  // tiene pareja, así que se vuelve a pegar al fragmento anterior.
  if (partes.length % 2 === 0) {
    const ultima = partes.pop();
    partes[partes.length - 1] += `**${ultima}`;
  }
  return partes
    .map((contenido, i) => ({ texto: contenido, resaltado: i % 2 === 1 }))
    .filter((parte) => parte.texto.length > 0);
}
