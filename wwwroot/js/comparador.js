import * as T from "../vendor/three.module.js";
import { posicao, visual, planetas, lerData } from "./astronomia.js";
export class Comparador {
  constructor(universo) {
    this.u = universo;
    this.modo = "desligado";
    this.data = lerData("11/09/1500");
    this.mistura = 0.5;
    this.grupo = new T.Group();
    universo.cena.add(this.grupo);
    for (const p of planetas) {
      const e = new T.Mesh(
        new T.SphereGeometry(1, 24, 16),
        new T.MeshBasicMaterial({
          color: 0x87aeba,
          transparent: true,
          opacity: 0.22,
          wireframe: true,
          depthWrite: false,
        }),
      );
      this.grupo.add(e);
    }
    this.grupo.visible = false;
  }
  atualizar(jd) {
    this.grupo.visible = this.modo === "sobreposicao";
    const terra = this.u.geocentrico
      ? visual(posicao(2, this.data), this.u.escala)
      : [0, 0, 0];
    this.grupo.children.forEach((o, i) => {
      o.position.set(
        ...visual(posicao(i, this.data), this.u.escala).map(
          (v, k) => v - terra[k],
        ),
      );
      o.scale.copy(this.u.corpos[i].scale).multiplyScalar(1.05);
    });
    if (this.modo === "morph") {
      this.u.atualizar(
        jd + (this.data - jd) * this.mistura,
        this.u.tempoVisual,
      );
    }
  }
  ecos(indice, jd, cascata = false) {
    this.u.limparGrupo("ecos");
    const g = new T.Group();
    const anos = cascata
      ? [0, 10, 100, 1000]
      : [1500, 1600, 1700, 1800, 1900, 2000, 2100];
    anos.forEach((ano, k) => {
      const data = cascata ? jd + ano * 365.25 : lerData(`01/01/${ano}`);
      const terra = this.u.geocentrico
        ? visual(posicao(2, data), this.u.escala)
        : [0, 0, 0];
      const indices = cascata ? planetas.map((p) => p.indice) : [indice];
      indices.forEach((i) => {
        const e = new T.Mesh(
          new T.SphereGeometry(1, 24, 16),
          new T.MeshBasicMaterial({
            color: planetas[i].cor,
            transparent: true,
            opacity: 0.5 - k * 0.05,
            wireframe: true,
          }),
        );
        e.position.set(
          ...visual(posicao(i, data), this.u.escala).map(
            (v, k) => v - terra[k],
          ),
        );
        e.scale.copy(this.u.corpos[i].scale);
        g.add(e);
      });
    });
    this.u.cena.add(g);
    this.u.grupos.set("ecos", g);
  }
  renderizar(camera, jd) {
    const r = this.u.renderizador,
      canvas = r.domElement,
      w = canvas.clientWidth,
      h = canvas.clientHeight;
    if (this.modo !== "vertical") {
      r.setScissorTest(false);
      r.setViewport(0, 0, w, h);
      r.render(this.u.cena, camera);
      return;
    }
    const aspecto = camera.aspect;
    camera.aspect = w / 2 / h;
    camera.updateProjectionMatrix();
    r.setScissorTest(true);
    r.setViewport(0, 0, w / 2, h);
    r.setScissor(0, 0, w / 2, h);
    r.render(this.u.cena, camera);
    this.u.atualizar(this.data, this.u.tempoVisual);
    r.setViewport(w / 2, 0, w / 2, h);
    r.setScissor(w / 2, 0, w / 2, h);
    r.render(this.u.cena, camera);
    this.u.atualizar(jd, this.u.tempoVisual);
    camera.aspect = aspecto;
    camera.updateProjectionMatrix();
    r.setScissorTest(false);
    r.setViewport(0, 0, w, h);
  }
}
