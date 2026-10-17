import { GaussianBlurPass, Pass } from 'postprocessing';
import { LinearFilter, SRGBColorSpace, UnsignedByteType, WebGLRenderTarget } from 'three';
import { CAPA_FONDO } from './config.js';

// Pasada propia del xilófono (de FrostBackdropPass.ts del original, MIT). Es un render "de
// costado": escribe en sus propios destinos y no toca los buffers del compositor (needsSwap = false).

// Renderiza sólo el fondo (CAPA_FONDO) y lo desenfoca: es lo que cada barra de vidrio
// esmerilado deja ver a través de sí. Tiene que correr antes del render principal.
export class PasadaEscarcha extends Pass {
  constructor(escena, camara) {
    super('PasadaEscarcha');
    this.needsSwap = false;
    this.escena = escena;
    this.camara = camara;
    const opciones = { minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false, stencilBuffer: false, colorSpace: SRGBColorSpace };
    this.nitido = new WebGLRenderTarget(1, 1, opciones);
    this.desenfocado = new WebGLRenderTarget(1, 1, opciones);
    this.desenfoque = new GaussianBlurPass({ kernelSize: 35, iterations: 3, resolutionScale: 0.25 });
    this.materialDesenfoque = this.desenfoque.blurMaterial;
    this.desenfoqueListo = false;
  }

  get textura() {
    return this.desenfocado.texture;
  }

  set radio(px) {
    this.materialDesenfoque.scale = px / 48;
  }

  render(renderer) {
    const destino = renderer.getRenderTarget();
    const capas = this.camara.layers.mask;
    this.camara.layers.set(CAPA_FONDO);
    renderer.setRenderTarget(this.nitido);
    renderer.render(this.escena, this.camara);
    this.camara.layers.mask = capas;
    renderer.setRenderTarget(destino);
    if (!this.desenfoqueListo) {
      this.desenfoque.initialize(renderer, true, UnsignedByteType);
      this.desenfoqueListo = true;
    }
    this.desenfoque.render(renderer, this.nitido, this.desenfocado);
  }

  setSize(ancho, alto) {
    const w = Math.max(1, ancho);
    const h = Math.max(1, alto);
    this.nitido.setSize(w, h);
    this.desenfocado.setSize(w, h);
    this.desenfoque.setSize(w, h);
  }

  dispose() {
    this.nitido.dispose();
    this.desenfocado.dispose();
    this.desenfoque.dispose();
    super.dispose();
  }
}
