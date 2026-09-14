import * as T from "../vendor/three.module.js";
import { UA, DIA, grafica } from "./fisica.js";
import { formatar } from "./astronomia.js";
export function interpolarEfemeride(linhas, jd) {
  let a = 0,
    b = linhas.length - 1;
  while (a + 1 < b) {
    const m = (a + b) >> 1;
    if (linhas[m][0] <= jd) a = m;
    else b = m;
  }
  if (jd >= linhas[b][0]) a = b;
  const fim = Math.min(a + 1, linhas.length - 1),
    h = linhas[fim][0] - linhas[a][0],
    t = h ? Math.max(0, Math.min(1, (jd - linhas[a][0]) / h)) : 0,
    p = linhas[a],
    q = linhas[fim],
    v = [];
  for (let k = 1; k <= 3; k++)
    v.push(
      (2 * t ** 3 - 3 * t * t + 1) * p[k] +
        (t ** 3 - 2 * t * t + t) * h * p[k + 3] +
        (-2 * t ** 3 + 3 * t * t) * q[k] +
        (t ** 3 - t * t) * h * q[k + 3],
    );
  for (let k = 4; k <= 6; k++) v.push((1 - t) * p[k] + t * q[k]);
  return v;
}
export class Observacao {
  constructor(ui) {
    this.ui = ui;
    this.u = ui.universo;
    this.ativo = false;
    this.alvo = new T.Group();
    this.u.cena.add(this.alvo);
    this.objeto = new T.Mesh(
      new T.IcosahedronGeometry(1, 2),
      new T.MeshStandardMaterial({ color: 0xa99a84, roughness: 1 }),
    );
    this.u.cena.add(this.objeto);
    this.objeto.visible = false;
    const hud = document.createElement("div");
    hud.className = "encontro-hud hud";
    hud.hidden = true;
    const titulo = document.createElement("strong");
    titulo.textContent = "APOPHIS × TERRA · EFEMÉRIDE JPL";
    this.texto = document.createElement("p");
    const nota = document.createElement("small");
    nota.textContent =
      "Vetores arquivados a cada 10 min · interpolação cúbica · TDB ≈ UTC. Outros planetas: cálculo local.";
    const fechar = document.createElement("button");
    fechar.textContent = "Voltar ao planetário";
    fechar.onclick = () => this.fechar();
    hud.append(titulo, this.texto, nota, fechar);
    document.getElementById("observatorio").append(hud);
    this.hud = hud;
    this.rotulo = document.createElement("span");
    this.rotulo.className = "rotulo";
    this.rotulo.textContent = "◇ Apophis · marcador";
    this.rotulo.hidden = true;
    document.getElementById("observatorio").append(this.rotulo);
  }
  async abrir(jd) {
    if (!this.dados) {
      const r = await fetch("dados/encontro-apophis.json");
      if (!r.ok)
        throw Error(
          "A efeméride tridimensional do encontro não está disponível.",
        );
      this.dados = await r.json();
    }
    this.escalaAnterior = this.u.escala;
    this.centroAnterior = this.u.geocentrico;
    this.ativo = true;
    this.hud.hidden = false;
    this.objeto.visible = true;
    this.u.escala = "proporcional";
    this.u.geocentrico = false;
    this.u.recalcularOrbitas(jd);
    this.ui.camera.multiplicadorVisao = 3.1;
    document.getElementById("escala").value = "proporcional";
    document.getElementById("referencial").value = "sol";
    this.ui.tempo.jd = jd;
    this.ui.tempo.destino = null;
    this.ui.tempo.pausado = false;
    this.ui.tempo.velocidade = 1 / 24;
    document.getElementById("velocidade").value = String(1 / 24);
    this.atualizar();
    this.ui.camera.focar(this.alvo);
  }
  atualizar() {
    if (!this.ativo) return;
    const linhas = this.dados.corpos.terra.amostras,
      min = linhas[0][0],
      max = linhas.at(-1)[0],
      t = this.ui.tempo;
    if (t.jd < min || t.jd > max) {
      t.jd = Math.max(min, Math.min(max, t.jd));
      t.destino = null;
      t.pausado = true;
    }
    const terra = interpolarEfemeride(linhas, t.jd),
      lua = interpolarEfemeride(this.dados.corpos.lua.amostras, t.jd),
      asteroide = interpolarEfemeride(this.dados.corpos.apophis.amostras, t.jd);
    this.u.sistema.position.set(0, 0, 0);
    this.u.corpos[2].position.set(
      ...grafica(terra.slice(0, 3)).map((v) => v * 8),
    );
    this.u.satelites[0].position.set(
      ...grafica(lua.slice(0, 3)).map((v) => v * 8),
    );
    this.objeto.position.set(
      ...grafica(asteroide.slice(0, 3)).map((v) => v * 8),
    );
    this.objeto.scale.setScalar((0.17 / UA) * 8);
    const distancia =
        Math.hypot(...terra.slice(0, 3).map((v, k) => v - asteroide[k])) * UA,
      velocidade =
        (Math.hypot(...terra.slice(3).map((v, k) => v - asteroide[k + 3])) *
          UA) /
        DIA;
    this.alvo.position
      .copy(this.u.corpos[2].position)
      .lerp(this.objeto.position, 0.35);
    this.alvo.scale.setScalar(
      Math.max((6371 / UA) * 8, (distancia / UA) * 8 * 0.2),
    );
    this.texto.textContent =
      formatar(t.jd) +
      " · " +
      distancia.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) +
      " km entre centros · " +
      velocidade.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) +
      " km/s";
    const p = this.objeto.position.clone().project(this.ui.camera.camera);
    this.rotulo.hidden = Math.abs(p.x) > 1 || Math.abs(p.y) > 1 || p.z > 1;
    this.rotulo.style.transform = `translate(${(p.x * 0.5 + 0.5) * innerWidth + 8}px,${(-p.y * 0.5 + 0.5) * innerHeight}px)`;
  }
  fechar() {
    if (!this.ativo) return;
    this.ativo = false;
    this.hud.hidden = true;
    this.rotulo.hidden = true;
    this.objeto.visible = false;
    this.u.escala = this.escalaAnterior;
    this.u.geocentrico = this.centroAnterior;
    document.getElementById("escala").value = this.u.escala;
    document.getElementById("referencial").value = this.u.geocentrico
      ? "terra"
      : "sol";
    this.ui.camera.multiplicadorVisao =
      this.u.escala === "proporcional" ? 3.1 : 1;
    this.u.recalcularOrbitas(this.ui.tempo.jd);
    this.ui.camera.visao(2);
  }
  destruir() {
    this.fechar();
    this.hud.remove();
    this.rotulo.remove();
    this.objeto.geometry.dispose();
    this.objeto.material.dispose();
    this.objeto.removeFromParent();
    this.alvo.removeFromParent();
  }
}
