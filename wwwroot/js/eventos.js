import {
  relativo,
  norma,
  produto,
  elementosEstado,
  GM_SOL,
  UA,
} from "./fisica.js";
export class Eventos {
  constructor() {
    this.lista = [];
    this.registrados = new Set();
    this.passagens = new Map();
  }
  registrar(chave, event) {
    if (this.registrados.has(chave) || this.lista.length >= 300) return;
    this.registrados.add(chave);
    this.lista.push(event);
  }
  analisar(a, b, linhas) {
    for (const l of linhas) {
      if (l.removido) continue;
      const i = l.indice;
      for (const limite of [1, 1000, 10000, 1000000])
        if (l.distancia >= limite)
          this.registrar(`div-${i}-${limite}`, {
            jd: b.jd,
            tipo: "divergência",
            corpo: i,
            texto: `${l.nome}: primeira amostra acima de ${limite.toLocaleString("pt-BR")} km de divergência.`,
            valor: l.distancia,
          });
      const r = relativo(b.estado, i),
        v = relativo(b.estado, i, 0, true),
        e = elementosEstado(r, v, GM_SOL * (b.massas[0] + b.massas[i]));
      if (e.energia > 0 && norma(r) > 100 && produto(r, v) > 0)
        this.registrar(`ej-${i}`, {
          jd: b.jd,
          tipo: "ejeção candidata",
          corpo: i,
          texto: `${l.nome}: energia heliocêntrica positiva, afastando-se a mais de 100 UA.`,
        });
      if (Math.abs(l.excentricidade) > 0.1)
        this.registrar(`ecc-${i}`, {
          jd: b.jd,
          tipo: "órbita",
          corpo: i,
          texto: `${l.nome}: variação de excentricidade superior a 0,1.`,
        });
      if (i !== 3) {
        const d = norma(relativo(b.estado, i, 3)) * UA,
          ant = this.passagens.get(i);
        if (ant && ant.descendo && d > ant.d && ant.d < 0.05 * UA)
          this.registrar(`encontro-${i}-${Math.floor(b.jd)}`, {
            jd: ant.jd,
            tipo: "aproximação amostrada",
            corpo: i,
            par: 3,
            texto: `${l.nome} × Terra: mínimo amostrado de ${Math.round(ant.d).toLocaleString("pt-BR")} km.`,
            valor: ant.d,
          });
        this.passagens.set(i, {
          d,
          jd: b.jd,
          descendo: ant ? d < ant.d : false,
        });
      }
    }
  }
}
