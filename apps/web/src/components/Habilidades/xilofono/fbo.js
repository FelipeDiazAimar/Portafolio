import {
  ClampToEdgeWrapping,
  FloatType,
  LinearFilter,
  RawShaderMaterial,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  WebGLRenderTarget,
} from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { blitFrag, blitVert } from './shaders.js';

// Utilidades GPGPU (de FBO.ts / FBOHelper.ts del original, MIT), atadas a un renderer concreto
// en vez de a un singleton global: en el sitio puede haber más de un canvas.
export class AyudaFBO {
  constructor(renderer) {
    this.renderer = renderer;
    this.cuadro = new FullScreenQuad();
    this.precision = `precision ${renderer.capabilities.precision} float;\n`;
  }

  dibujar(material, destino) {
    this.cuadro.material = material;
    this.renderer.setRenderTarget(destino);
    this.cuadro.render(this.renderer);
    this.renderer.setRenderTarget(null);
  }

  crearDestino(ancho, alto, opciones) {
    return new WebGLRenderTarget(ancho, alto, {
      wrapS: ClampToEdgeWrapping,
      wrapT: ClampToEdgeWrapping,
      magFilter: LinearFilter,
      minFilter: LinearFilter,
      type: UnsignedByteType,
      anisotropy: 0,
      colorSpace: SRGBColorSpace,
      stencilBuffer: false,
      ...opciones,
    });
  }

  crearMaterial({ prefijoVertex, prefijoFragment, ...opciones }) {
    const o = { vertexShader: blitVert, fragmentShader: blitFrag, ...opciones };
    o.vertexShader = (prefijoVertex ?? this.precision) + o.vertexShader;
    o.fragmentShader = (prefijoFragment ?? this.precision) + o.fragmentShader;
    return new RawShaderMaterial(o);
  }

  liberar() {
    this.cuadro.dispose();
  }
}

// Par de destinos para ir y volver (un paso GPGPU no puede leer y escribir la misma textura).
export class FBO {
  constructor(ayuda, ancho, alto, opciones) {
    const config = { format: RGBAFormat, type: FloatType, generateMipmaps: false, depthBuffer: false, ...opciones };
    this.a = ayuda.crearDestino(ancho, alto, config);
    this.b = ayuda.crearDestino(ancho, alto, config);
  }

  get leer() {
    return this.a;
  }

  get escribir() {
    return this.b;
  }

  intercambiar() {
    const t = this.a;
    this.a = this.b;
    this.b = t;
  }

  liberar() {
    this.a.dispose();
    this.b.dispose();
  }
}
