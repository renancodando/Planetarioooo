// aqui eu observo até onde uma mudança consegue chegar
import {
  relativo,
  vetor,
  norma,
  elementosEstado,
  GM_SOL,
  UA,
  DIA,
} from "./fisica.js";
export function nivelInfluencia(km) {
  return km < 0.001
    ? "imperceptível"
    : km < 1
      ? "detectável"
      : km < 1000
        ? "relevante"
        : km < 100000
          ? "forte"
          : "crítico";
}
function contribuicao(s, i, j) {
  if (
    i >= s.massas.length ||
    j >= s.massas.length ||
    !s.ativos[i] ||
    !s.ativos[j] ||
    i === j
  )
    return [0, 0, 0];
  const d = vetor(s.estado, j).map((v, k) => v - s.estado[i * 6 + k]),
    r = norma(d);
  return d.map((v) => (GM_SOL * s.massas[j] * v) / (r * r * r));
}
export function diagnosticar(a, b, origem) {
  const linhas = [];
  for (let i = 1; i < a.corpos.length; i++) {
    if (!b.ativos[i]) {
      linhas.push({
        indice: i,
        nome: a.corpos[i].nome,
        removido: true,
        distancia: 0,
        velocidade: 0,
        nivel: "removido",
        causa: origem,
      });
      continue;
    }
    const ra = relativo(a.estado, i),
      rb = relativo(b.estado, i),
      va = relativo(a.estado, i, 0, true),
      vb = relativo(b.estado, i, 0, true),
      d = rb.map((v, k) => v - ra[k]),
      dv = vb.map((v, k) => v - va[k]);
    const ea = elementosEstado(ra, va, GM_SOL * (a.massas[0] + a.massas[i])),
      eb = elementosEstado(rb, vb, GM_SOL * (b.massas[0] + b.massas[i]));
    let influencia = 0,
      causa = -1;
    for (let j = 0; j < b.corpos.length; j++) {
      if (j === i) continue;
      const fa = contribuicao(a, i, j),
        fb = contribuicao(b, i, j),
        delta = norma(fb.map((v, k) => v - fa[k]));
      if (delta > influencia) {
        influencia = delta;
        causa = j;
      }
    }
    const distancia = norma(d) * UA;
    linhas.push({
      indice: i,
      nome: a.corpos[i].nome,
      distancia,
      vetor: d,
      velocidade: ((norma(dv) * UA) / DIA) * 1000,
      radial: (norma(rb) - norma(ra)) * UA,
      periodo: ea.periodo && eb.periodo ? eb.periodo - ea.periodo : null,
      energia: (eb.energia - ea.energia) * (UA / DIA) ** 2,
      momento: ((eb.h - ea.h) * UA * UA) / DIA,
      excentricidade: eb.e - ea.e,
      nivel: nivelInfluencia(distancia),
      causa: i === origem ? origem : causa,
      influencia: (influencia * UA * 1000) / (DIA * DIA),
    });
  }
  return linhas;
}
