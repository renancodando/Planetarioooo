import * as T from "../vendor/three.module.js";
import { grafica } from "./fisica.js";
import { visual } from "./astronomia.js";
export class Cone {
  constructor(u) {
    this.u = u;
    this.grupo = new T.Group();
    u.cena.add(this.grupo);
    this.grupo.visible = false;
  }
  definir(d, ganho = 1) {
    this.limpar();
    this.d = d;
    this.ganho = ganho;
    this.escala = this.u.escala;
    const pontos = [];
    for (let k = 1; k < d.passos; k++)
      for (let i = 0; i < d.visiveis; i++)
        for (const j of [k - 1, k]) {
          const p = Array.from(d.nominal.slice(j * 3, j * 3 + 3)).map(
            (v, t) => v + d.tracos[(j * d.visiveis + i) * 3 + t] * ganho,
          );
          pontos.push(...visual(grafica(p), this.u.escala));
        }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pontos, 3));
    this.tracos = new T.LineSegments(
      g,
      new T.LineBasicMaterial({
        color: 0xb0bfc0,
        transparent: true,
        opacity: 0.045,
        depthWrite: false,
      }),
    );
    this.grupo.add(this.tracos);
    const nom = [];
    for (let k = 0; k < d.passos; k++)
      nom.push(
        ...visual(
          grafica(Array.from(d.nominal.slice(k * 3, k * 3 + 3))),
          this.u.escala,
        ),
      );
    const ng = new T.BufferGeometry();
    ng.setAttribute("position", new T.Float32BufferAttribute(nom, 3));
    this.grupo.add(
      new T.Line(
        ng,
        new T.LineBasicMaterial({
          color: 0xd6b67e,
          transparent: true,
          opacity: 0.8,
        }),
      ),
    );
    this.grupo.visible = true;
  }
  atualizar(jd) {
    if (!this.d || !this.tracos) return;
    if (this.escala !== this.u.escala) this.definir(this.d, this.ganho);
    this.grupo.position.copy(this.u.sistema.position);
    const ds = this.d.series,
      fracao = Math.max(
        0,
        Math.min(1, (jd - ds[0].jd) / (ds.at(-1).jd - ds[0].jd)),
      );
    this.tracos.geometry.setDrawRange(
      0,
      Math.floor(fracao * (this.d.passos - 1)) * this.d.visiveis * 2,
    );
  }
  limpar() {
    this.grupo.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    this.grupo.clear();
  }
  destruir() {
    this.limpar();
    this.grupo.removeFromParent();
  }
}
