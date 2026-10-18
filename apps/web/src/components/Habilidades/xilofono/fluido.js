// Solver de fluido de baja resolución que deja una estela al pasar el mouse: esa velocidad tiñe
// las barras. Adaptado de FluidSim.ts del xilófono original (MIT), que a su vez adapta
// WebGL-Fluid-Simulation de Pavel Dobryakov (MIT, https://github.com/PavelDoGreat/WebGL-Fluid-Simulation).
import { FloatType, HalfFloatType, LinearFilter, NearestFilter, RGBAFormat, Vector2, Vector3, WebGLRenderTarget } from 'three';
import { FBO } from './fbo.js';
import {
  fluidoAdveccion,
  fluidoDivergencia,
  fluidoGota,
  fluidoGradiente,
  fluidoLimpiar,
  fluidoPresion,
  fluidoRotor,
  fluidoVert,
  fluidoVorticidad,
} from './shaders.js';

// Segundos de mouse quieto tras los que se deja de resolver (ahorra GPU y batería).
const DORMIR_TRAS = 2.5;
const delta = new Vector2();

export class Fluido {
  constructor(ayuda, opciones) {
    this.ayuda = ayuda;
    this.renderer = ayuda.renderer;
    this.config = { ...opciones, texel: 1 / opciones.resolucion, aspecto: 1 };
    this.punto = { posicion: new Vector2(0.5, 0.5), previa: new Vector2(0.5, 0.5), ultimo: 0, ultimaGota: 0, velocidad: 0 };
    this.ultimaEntrada = -1e9;
    this.fbos = this.crearFBOs();
    this.materiales = this.crearMateriales();
    this.uniforms = { velocity: { value: this.fbos.velocidad.leer.texture } };
  }

  material(fragment, precision, uniforms, defines) {
    return this.ayuda.crearMaterial({
      uniforms,
      vertexShader: fluidoVert,
      fragmentShader: fragment,
      depthTest: false,
      depthWrite: false,
      prefijoFragment: `precision ${precision} float;\nprecision ${precision} sampler2D;\n`,
      ...(defines ? { defines } : {}),
    });
  }

  crearMateriales() {
    const capacidades = this.renderer.capabilities;
    const alta = capacidades.getMaxPrecision('highp');
    const media = capacidades.getMaxPrecision('mediump');
    const texel = () => ({ u_texelSize: { value: new Vector2() } });
    return {
      gota: this.material(fluidoGota, alta, {
        ...texel(),
        u_tTarget: { value: null },
        u_aspectRatio: { value: 1 },
        u_splatColor: { value: new Vector3() },
        u_splatPosition: { value: new Vector2() },
        u_prevPoint: { value: new Vector2() },
        u_splatRadius: { value: 1 },
      }),
      rotor: this.material(fluidoRotor, media, { ...texel(), u_tVelocity: { value: null } }),
      vorticidad: this.material(fluidoVorticidad, alta, {
        ...texel(),
        u_tVelocity: { value: null },
        u_tCurl: { value: null },
        u_curl: { value: this.config.rotor },
        u_dt: { value: 1 / 60 },
      }),
      divergencia: this.material(fluidoDivergencia, media, { ...texel(), u_tVelocity: { value: null } }),
      limpiar: this.material(fluidoLimpiar, media, {
        ...texel(),
        u_tTexture: { value: null },
        u_value: { value: this.config.disipacionPresion },
        u_dt: { value: 1 / 60 },
      }),
      presion: this.material(fluidoPresion, media, { ...texel(), u_tPressure: { value: null }, u_tDivergence: { value: null } }),
      gradiente: this.material(fluidoGradiente, media, { ...texel(), u_tPressure: { value: null }, u_tVelocity: { value: null } }),
      adveccion: this.material(
        fluidoAdveccion,
        alta,
        { ...texel(), u_tVelocity: { value: null }, u_tSource: { value: null }, u_dt: { value: 1 / 60 }, u_dissipation: { value: 1 } },
        { MANUAL_FILTERING: true }
      ),
    };
  }

  crearFBOs() {
    const r = this.config.resolucion;
    const velocidad = new FBO(this.ayuda, r, r, { format: RGBAFormat, type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter });
    const presion = new FBO(this.ayuda, r, r, { minFilter: NearestFilter, magFilter: NearestFilter });
    const config = { type: FloatType, magFilter: NearestFilter, minFilter: NearestFilter, depthBuffer: false };
    return {
      velocidad,
      presion,
      divergencia: new WebGLRenderTarget(r, r, config),
      rotor: new WebGLRenderTarget(r, r, config),
    };
  }

  // `posicion` en 0..1 desde abajo a la izquierda del canvas; null si el mouse no está encima.
  actualizarPunto(posicion, tiempo) {
    const p = this.punto;
    if (!posicion) return;
    p.posicion.copy(posicion);
    if (tiempo - p.ultimo < 0.016) return;
    delta.subVectors(p.posicion, p.previa);
    const distancia = delta.length();
    p.velocidad += distancia * 2;
    if (distancia > 0) {
      if (distancia > 0.001) this.ultimaEntrada = tiempo;
      const trazoNuevo = tiempo - p.ultimaGota > 0.15;
      const g = this.materiales.gota.uniforms;
      g.u_tTarget.value = this.fbos.velocidad.leer.texture;
      g.u_aspectRatio.value = this.config.aspecto;
      g.u_splatPosition.value.copy(p.posicion);
      g.u_prevPoint.value.copy(trazoNuevo ? p.posicion : p.previa);
      g.u_splatColor.value.set(delta.x * this.config.aspecto, delta.y, 0).multiplyScalar(this.config.fuerzaGota).multiplyScalar(trazoNuevo ? 0 : 1);
      g.u_splatRadius.value = this.config.radioGota * p.velocidad;
      this.ayuda.dibujar(this.materiales.gota, this.fbos.velocidad.escribir);
      this.fbos.velocidad.intercambiar();
      p.ultimaGota = tiempo;
    }
    p.ultimo = tiempo;
    p.previa.copy(p.posicion);
    p.velocidad = Math.min(1, p.velocidad * 0.9);
  }

  // Explosión: gotas en todas las direcciones desde `centro` (0..1 desde abajo a la izquierda),
  // como si el puntero saliera disparado para todos lados. Tiñe las barras alrededor.
  estallar(centro, tiempo, fuerza = 1.6, rayos = 18) {
    const g = this.materiales.gota.uniforms;
    const aspecto = this.config.aspecto || 1;
    const autoClear = this.renderer.autoClear;
    this.renderer.autoClear = false;
    for (let k = 0; k < rayos; k += 1) {
      const angulo = (k / rayos) * Math.PI * 2 + Math.random() * 0.3;
      const dx = Math.cos(angulo);
      const dy = Math.sin(angulo);
      g.u_tTarget.value = this.fbos.velocidad.leer.texture;
      g.u_aspectRatio.value = aspecto;
      g.u_prevPoint.value.copy(centro);
      g.u_splatPosition.value.set(centro.x + (dx * 0.14) / aspecto, centro.y + dy * 0.14);
      g.u_splatColor.value.set(dx * aspecto, dy, 0).multiplyScalar(fuerza * 6);
      g.u_splatRadius.value = 1.4;
      this.ayuda.dibujar(this.materiales.gota, this.fbos.velocidad.escribir);
      this.fbos.velocidad.intercambiar();
    }
    this.renderer.autoClear = autoClear;
    this.ultimaEntrada = tiempo;
    this.uniforms.velocity.value = this.fbos.velocidad.leer.texture;
  }

  resolver(posicion, tiempo, dt, aspecto) {
    this.config.aspecto = aspecto;
    const renderer = this.renderer;
    const autoClear = renderer.autoClear;
    const destino = renderer.getRenderTarget();
    renderer.autoClear = false;
    this.actualizarPunto(posicion, tiempo);
    if (tiempo - this.ultimaEntrada > DORMIR_TRAS) {
      renderer.autoClear = autoClear;
      renderer.setRenderTarget(destino);
      return;
    }
    const m = this.materiales;
    const f = this.fbos;
    const t = this.config.texel;

    m.rotor.uniforms.u_texelSize.value.setScalar(t);
    m.rotor.uniforms.u_tVelocity.value = f.velocidad.leer.texture;
    this.ayuda.dibujar(m.rotor, f.rotor);

    m.vorticidad.uniforms.u_texelSize.value.setScalar(t);
    m.vorticidad.uniforms.u_tVelocity.value = f.velocidad.leer.texture;
    m.vorticidad.uniforms.u_tCurl.value = f.rotor.texture;
    m.vorticidad.uniforms.u_dt.value = dt;
    this.ayuda.dibujar(m.vorticidad, f.velocidad.escribir);
    f.velocidad.intercambiar();

    m.divergencia.uniforms.u_texelSize.value.setScalar(t);
    m.divergencia.uniforms.u_tVelocity.value = f.velocidad.leer.texture;
    this.ayuda.dibujar(m.divergencia, f.divergencia);

    m.limpiar.uniforms.u_tTexture.value = f.presion.leer.texture;
    m.limpiar.uniforms.u_dt.value = dt;
    this.ayuda.dibujar(m.limpiar, f.presion.escribir);
    f.presion.intercambiar();

    m.presion.uniforms.u_texelSize.value.setScalar(t);
    m.presion.uniforms.u_tDivergence.value = f.divergencia.texture;
    for (let i = 0; i < this.config.iteracionesPresion; i += 1) {
      m.presion.uniforms.u_tPressure.value = f.presion.leer.texture;
      this.ayuda.dibujar(m.presion, f.presion.escribir);
      f.presion.intercambiar();
    }

    m.gradiente.uniforms.u_texelSize.value.setScalar(t);
    m.gradiente.uniforms.u_tPressure.value = f.presion.leer.texture;
    m.gradiente.uniforms.u_tVelocity.value = f.velocidad.leer.texture;
    this.ayuda.dibujar(m.gradiente, f.velocidad.escribir);
    f.velocidad.intercambiar();

    m.adveccion.uniforms.u_texelSize.value.setScalar(t);
    m.adveccion.uniforms.u_tVelocity.value = f.velocidad.leer.texture;
    m.adveccion.uniforms.u_tSource.value = f.velocidad.leer.texture;
    m.adveccion.uniforms.u_dt.value = dt;
    m.adveccion.uniforms.u_dissipation.value = this.config.disipacionVelocidad;
    this.ayuda.dibujar(m.adveccion, f.velocidad.escribir);
    f.velocidad.intercambiar();

    renderer.autoClear = autoClear;
    renderer.setRenderTarget(destino);
    this.uniforms.velocity.value = f.velocidad.leer.texture;
  }

  liberar() {
    Object.values(this.materiales).forEach((m) => m.dispose());
    this.fbos.velocidad.liberar();
    this.fbos.presion.liberar();
    this.fbos.divergencia.dispose();
    this.fbos.rotor.dispose();
  }
}
