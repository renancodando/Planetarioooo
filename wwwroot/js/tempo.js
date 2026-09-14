import { juliano, lerData } from "./astronomia.js";
export class Tempo {
  constructor() {
    this.jd = juliano(new Date());
    this.velocidade = 1;
    this.direcao = 1;
    this.pausado = true;
    this.origem = this.jd;
    this.destino = null;
    this.minimo = lerData("01/01/0001");
    this.maximo = lerData("31/12/5000");
  }
  viajar(jd, reduzido = false) {
    if (!Number.isFinite(jd)) return;
    this.destino = {
      inicio: this.jd,
      fim: Math.max(this.minimo, Math.min(this.maximo, jd)),
      decorrido: 0,
      duracao: reduzido ? 0.01 : 1.8,
    };
    this.pausado = true;
  }
  atualizar(dt) {
    if (this.destino) {
      let d = this.destino;
      d.decorrido += dt;
      let t = Math.min(1, d.decorrido / d.duracao);
      this.jd = d.inicio + (d.fim - d.inicio) * (t * t * (3 - 2 * t));
      if (t === 1) this.destino = null;
    } else if (!this.pausado) {
      this.jd += dt * this.velocidade * this.direcao;
      if (this.jd <= this.minimo || this.jd >= this.maximo) {
        this.jd = Math.max(this.minimo, Math.min(this.maximo, this.jd));
        this.pausado = true;
      }
    }
  }
}
