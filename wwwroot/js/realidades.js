import * as T from "../vendor/three.module.js";
import { grafica, relativo, vetor, UA } from "./fisica.js";
import { visual } from "./astronomia.js";
export class Realidades {
  constructor(u) {
    this.u = u;
    this.grupoA = new T.Group();
    this.grupoB = new T.Group();
    this.linhas = new T.Group();
    this.cena = u.cena;
    this.cena.add(this.grupoA, this.grupoB, this.linhas);
    this.grupoB.visible = false;
    this.modo = "sobreposicao";
    this.ganho = 1;
    this.mistura = 0.5;
    this.corposB = [];
    this.menoresA = [];
    this.ativos = false;
    this.cacheMateriais = [];
    this.geometria = new T.SphereGeometry(1, 32, 20);
    this.vetorTemporario = new T.Vector3();
  }
  preparar(r) {
    this.limpar();
    this.r = r;
    this.estadoExato = null;
    this.a = new Float64Array(r.corposA.length * 6);
    this.b = new Float64Array(r.corposB.length * 6);
    this.objetosA = r.corposA.map((c, i) =>
      i === 0
        ? this.u.sol
        : c.indice !== undefined
          ? this.u.corpos[c.indice]
          : c.id === "lua"
            ? this.u.satelites[0]
            : this.criar(c, false),
    );
    this.corposB = r.corposB.map((c) => this.criar(c, true));
    this.ativos = true;
    this.grupoB.visible = true;
    this.grupoA.visible = true;
    this.caminhos = null;
  }
  criar(c, alternativa) {
    const original = c.indice !== undefined ? this.u.corpos[c.indice] : null;
    const material = new T.MeshStandardMaterial({
      map: original?.userData.material.map || null,
      color: original ? 0xffffff : c.cor,
      roughness: 1,
      transparent: alternativa,
      opacity: alternativa ? 0.48 : 1,
      depthWrite: !alternativa,
    });
    this.cacheMateriais.push(material);
    const grupo = new T.Group(),
      esfera = new T.Mesh(this.geometria, material);
    grupo.add(esfera);
    grupo.userData = {
      id: c.id,
      nome: c.nome,
      esfera,
      material,
      raio: c.raioVisual,
    };
    if (c.id === "sol") {
      material.emissive.set(0xa17431);
      material.emissiveIntensity = 1;
    }
    if (c.id === "saturno" && this.u.anelSaturno) {
      const m = this.u.anelSaturno.material.clone();
      this.cacheMateriais.push(m);
      m.opacity = alternativa ? 0.45 : 1;
      m.transparent = true;
      m.depthWrite = false;
      const anel = new T.Mesh(this.u.anelSaturno.geometry, m);
      anel.rotation.copy(this.u.anelSaturno.rotation);
      grupo.add(anel);
      grupo.rotation.z = (26.73 * Math.PI) / 180;
    }
    (alternativa ? this.grupoB : this.grupoA).add(grupo);
    if (!alternativa) this.menoresA.push(grupo);
    return grupo;
  }
  projetar(q, i, corpos) {
    let p = visual(grafica(relativo(q, i)), this.u.escala);
    if (corpos[i]?.id === "lua" && this.u.escala === "didatica") {
      const r = grafica(relativo(q, i, 3)),
        n = Math.hypot(...r),
        terra = visual(grafica(relativo(q, 3)), this.u.escala);
      p = terra.map((v, k) => v + (r[k] / (n || 1)) * 6.3);
    }
    if (this.u.geocentrico) {
      const terra = visual(grafica(relativo(q, 3)), this.u.escala);
      p = p.map((v, k) => v - terra[k]);
    }
    return p;
  }
  atualizar(jd) {
    if (!this.ativos) return;
    jd = this.estadoExato?.jd ?? jd;
    let baixo = 0,
      alto = this.r.tempos.length - 1;
    while (baixo + 1 < alto) {
      const meio = (baixo + alto) >> 1;
      if (this.r.tempos[meio] <= jd) baixo = meio;
      else alto = meio;
    }
    if (jd >= this.r.tempos[alto]) baixo = alto;
    this.indice = baixo;
    const exato = this.estadoExato;
    if (exato) {
      this.a.set(exato.a);
      this.b.set(exato.b);
      this.jdExibido = exato.jd;
    } else {
      this.a.set(
        this.r.a.subarray(baixo * this.a.length, (baixo + 1) * this.a.length),
      );
      this.b.set(
        this.r.b.subarray(baixo * this.b.length, (baixo + 1) * this.b.length),
      );
      this.jdExibido = this.r.tempos[baixo];
    }
    this.u.orbitas.visible = false;
    this.u.sistema.position.set(0, 0, 0);
    this.posicoesA = this.r.corposA.map((c, i) =>
      this.projetar(this.a, i, this.r.corposA),
    );
    this.posicoesB = this.r.corposB.map((c, i) =>
      this.projetar(this.b, i, this.r.corposB),
    );
    for (let i = 0; i < this.objetosA.length; i++) {
      const o = this.objetosA[i],
        c = this.r.corposA[i],
        p = this.posicoesA[i];
      o.position.set(...p);
      if (c.indice === undefined && c.id !== "sol")
        o.scale.setScalar(
          this.u.escala === "proporcional"
            ? Math.max(c.raio * 8, 1e-8)
            : c.raioVisual,
        );
    }
    this.u.luz.position.copy(this.u.sol.position);
    this.u.corona.position.copy(this.u.sol.position);
    this.u.proeminencias.position.copy(this.u.sol.position);
    this.u.menores.forEach((o) => (o.visible = false));
    this.u.satelites.forEach((o, i) => {
      if (i) o.visible = false;
    });
    for (let i = 0; i < this.corposB.length; i++) {
      const o = this.corposB[i],
        c = this.r.corposB[i],
        a = this.posicoesA[i] || this.posicoesB[i],
        b = this.posicoesB[i];
      o.position.set(...b.map((v, k) => a[k] + (v - a[k]) * this.ganho));
      o.scale.setScalar(
        c.indice !== undefined
          ? this.u.corpos[c.indice].scale.x
          : this.u.escala === "proporcional"
            ? Math.max(c.raio * 8, 1e-8)
            : c.raioVisual,
      );
      o.visible = !!this.r.ativosB[i];
      o.rotation.y = jd * 0.02;
    }
    if (this.modo === "morph")
      for (let i = 0; i < this.objetosA.length; i++) {
        const a = this.posicoesA[i],
          b = this.posicoesB[i] || a;
        this.objetosA[i].position.set(
          ...a.map((v, k) => v + (b[k] - v) * this.mistura),
        );
        this.objetosA[i].visible = this.r.ativosB[i] || this.mistura < 1;
      }
    else this.objetosA.forEach((o) => (o.visible = true));
    this.grupoB.visible = this.modo !== "morph" && this.mostrarB !== false;
    for (const o of this.corposB) {
      const solido = ["vertical", "horizontal", "lado"].includes(this.modo);
      o.userData.material.opacity = solido ? 1 : 0.45;
      o.userData.material.wireframe = this.modo === "fantasma";
      o.userData.material.depthWrite = solido;
    }
  }
  trajetorias(indice) {
    if (!this.ativos) return;
    this.limparLinhas();
    const r = this.r,
      n = r.tempos.length,
      sa = r.corposA.length * 6,
      sb = r.corposB.length * 6;
    for (const [nome, dados, passo, cor, corpos] of [
      ["A", r.a, sa, 0xc6b37c, r.corposA],
      ["B", r.b, sb, 0x82acb1, r.corposB],
    ]) {
      const p = [];
      for (let k = 0; k < n; k++) {
        const q = dados.subarray(k * passo, (k + 1) * passo);
        p.push(...this.projetar(q, indice, corpos));
      }
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
      this.linhas.add(
        new T.Line(
          g,
          new T.LineBasicMaterial({
            color: cor,
            transparent: true,
            opacity: 0.58,
          }),
        ),
      );
    }
  }
  renderizar(camera) {
    const r = this.u.renderizador,
      w = r.domElement.clientWidth,
      h = r.domElement.clientHeight;
    if (!["vertical", "horizontal", "lado"].includes(this.modo)) {
      r.setScissorTest(false);
      r.setViewport(0, 0, w, h);
      r.render(this.cena, camera);
      return;
    }
    const horizontal = this.modo === "horizontal",
      largura = horizontal ? w : w / 2,
      altura = horizontal ? h / 2 : h,
      aspecto = camera.aspect;
    camera.aspect = largura / altura;
    camera.updateProjectionMatrix();
    r.setScissorTest(true);
    this.grupoB.visible = false;
    if (this.linhas.children[1]) this.linhas.children[1].visible = false;
    r.setViewport(0, horizontal ? h / 2 : 0, largura, altura);
    r.setScissor(0, horizontal ? h / 2 : 0, largura, altura);
    r.render(this.cena, camera);
    this.objetosA.forEach((o) => (o.visible = false));
    this.grupoA.visible = false;
    this.grupoB.visible = this.mostrarB !== false;
    if (this.linhas.children[0]) this.linhas.children[0].visible = false;
    if (this.linhas.children[1]) this.linhas.children[1].visible = true;
    r.setViewport(horizontal ? 0 : w / 2, 0, largura, altura);
    r.setScissor(horizontal ? 0 : w / 2, 0, largura, altura);
    r.render(this.cena, camera);
    this.objetosA.forEach((o) => (o.visible = true));
    this.grupoA.visible = true;
    this.linhas.children.forEach((o) => (o.visible = true));
    camera.aspect = aspecto;
    camera.updateProjectionMatrix();
    r.setScissorTest(false);
    r.setViewport(0, 0, w, h);
  }
  limparLinhas() {
    for (const o of [...this.linhas.children]) {
      o.geometry?.dispose();
      o.material?.dispose();
      this.linhas.remove(o);
    }
  }
  limpar() {
    this.limparLinhas();
    this.cacheMateriais.forEach((m) => m.dispose());
    this.cacheMateriais = [];
    this.menoresA = [];
    this.grupoA.clear();
    this.grupoB.clear();
    this.ativos = false;
    this.u.corpos.forEach((o) => (o.visible = true));
    this.u.sol.visible = true;
    this.u.satelites.forEach((o) => (o.visible = true));
    this.u.menores.forEach((o) => (o.visible = true));
  }
  destruir() {
    this.limpar();
    this.geometria.dispose();
    this.grupoA.removeFromParent();
    this.grupoB.removeFromParent();
    this.linhas.removeFromParent();
  }
}
