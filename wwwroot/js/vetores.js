import * as T from "../vendor/three.module.js";
import {
  relativo,
  grafica,
  elementosEstado,
  estadoOrbital,
  GM_SOL,
} from "./fisica.js";
import { visual } from "./astronomia.js";
export class Vetores {
  constructor(u) {
    this.u = u;
    this.grupo = new T.Group();
    u.cena.add(this.grupo);
    this.velocidade = new T.ArrowHelper(
      new T.Vector3(1, 0, 0),
      new T.Vector3(),
      8,
      0xaec2c0,
    );
    this.aceleracao = new T.ArrowHelper(
      new T.Vector3(1, 0, 0),
      new T.Vector3(),
      8,
      0xd1b984,
    );
    this.diferenca = new T.ArrowHelper(
      new T.Vector3(1, 0, 0),
      new T.Vector3(),
      8,
      0xbc9577,
    );
    this.grupo.add(this.velocidade, this.aceleracao, this.diferenca);
    this.grupo.visible = false;
  }
  atualizar(realidades, indice) {
    const a = realidades.a,
      b = realidades.b,
      p = realidades.posicoesB[indice];
    if (!p) return;
    const aceleracao = [0, 0, 0];
    for (let j = 0; j < realidades.r.corposB.length; j++) {
      if (j === indice || !realidades.r.ativosB[j]) continue;
      const delta = relativo(b, j, indice),
        distancia = Math.hypot(...delta);
      if (distancia > 1e-14)
        for (let k = 0; k < 3; k++)
          aceleracao[k] +=
            (GM_SOL * realidades.r.massasB[j] * delta[k]) / distancia ** 3;
    }
    const v = grafica(relativo(b, indice, 0, true)),
      forca = grafica(aceleracao),
      d = realidades.posicoesB[indice].map(
        (x, k) => x - realidades.posicoesA[indice][k],
      );
    if (
      this.ultimoIndice !== indice ||
      this.ultimaEscala !== this.u.escala ||
      this.ultimoCentro !== this.u.geocentrico ||
      performance.now() - (this.ultimaOrbita || 0) > 3000
    ) {
      this.orbital(realidades, indice);
      this.ultimoIndice = indice;
      this.ultimaEscala = this.u.escala;
      this.ultimoCentro = this.u.geocentrico;
      this.ultimaOrbita = performance.now();
    }
    for (const [seta, vetor] of [
      [this.velocidade, v],
      [this.aceleracao, forca],
      [this.diferenca, d],
    ]) {
      if (seta === this.diferenca)
        seta.position.set(...realidades.posicoesA[indice]);
      else seta.position.copy(realidades.corposB[indice].position);
      const direcao = new T.Vector3(...vetor);
      seta.visible = direcao.length() > 1e-14;
      if (seta.visible) {
        seta.setDirection(direcao.normalize());
        seta.setLength(
          seta === this.diferenca
            ? Math.min(25, Math.max(0.3, Math.hypot(...d)))
            : 8,
          1.2,
          0.6,
        );
      }
    }
  }
  orbital(realidades, indice) {
    if (this.orbita) {
      this.orbita.geometry.dispose();
      this.orbita.material.dispose();
      this.grupo.remove(this.orbita);
    }
    const e = elementosEstado(
      relativo(realidades.b, indice),
      relativo(realidades.b, indice, 0, true),
      GM_SOL * (realidades.r.massasB[0] + realidades.r.massasB[indice]),
    );
    if (!(e.e < 1 && e.a > 0) || realidades.r.corposB[indice].id === "lua")
      return;
    const pontos = [];
    for (let k = 0; k <= 180; k++)
      pontos.push(
        ...visual(
          grafica(estadoOrbital({ ...e, ma: k * 2 }).slice(0, 3)),
          this.u.escala,
        ),
      );
    const geometria = new T.BufferGeometry();
    geometria.setAttribute("position", new T.Float32BufferAttribute(pontos, 3));
    this.orbita = new T.Line(
      geometria,
      new T.LineBasicMaterial({
        color: 0xb8a575,
        transparent: true,
        opacity: 0.3,
      }),
    );
    this.orbita.position.set(...realidades.posicoesB[0]);
    this.grupo.add(this.orbita);
  }
  destruir() {
    this.grupo.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    this.grupo.removeFromParent();
  }
}
