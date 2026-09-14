import {
  prepararCovariancia,
  sortearCovariancia,
  propagarAmostra,
  gerador,
  percentil,
} from "./incerteza.js";
import { ecliptica, UA, DIA, norma } from "./fisica.js";
import { posicao } from "./astronomia.js";
export async function executarMonteCarlo(d, enviar, cancelado) {
  const c = prepararCovariancia(d.sbdb),
    n = Number(d.quantidade),
    dias = Number(d.dias),
    jd = Number(d.jd);
  if (
    !Number.isInteger(n) ||
    n < 10 ||
    n > 10000 ||
    !Number.isFinite(dias) ||
    dias <= 0 ||
    dias > 365250 ||
    !Number.isFinite(jd)
  )
    throw Error("Parâmetros Monte Carlo inválidos.");
  const aleatorio = gerador(d.seed || 2029),
    amostras = [];
  for (let i = 0; i < n; i++) {
    const valores = sortearCovariancia(c, aleatorio);
    if (valores[0] < 0 || valores[0] >= 1 || valores[1] <= 0)
      throw Error(
        "Amostragem saiu do domínio elíptico. É necessário outro modelo de propagação.",
      );
    amostras.push(valores);
  }
  const passos = 81,
    visiveis = Math.min(n, d.visiveis || 180),
    tracos = new Float32Array(passos * visiveis * 3),
    nominal = new Float64Array(passos * 3),
    nuvem = new Float64Array(n * 3),
    series = [];
  for (let k = 0; k < passos; k++) {
    if (cancelado()) return;
    const data = jd + (dias * k) / (passos - 1),
      nom = propagarAmostra(c.media, data),
      terra = ecliptica(posicao(2, data)),
      dispersoes = [],
      velocidades = [],
      distanciasTerra = [],
      distanciasSol = [];
    nominal.set(nom.slice(0, 3), k * 3);
    for (let i = 0; i < n; i++) {
      const q = propagarAmostra(amostras[i], data),
        p = q.slice(0, 3),
        v = q.slice(3);
      dispersoes.push(norma(p.map((x, j) => x - nom[j])) * UA);
      velocidades.push((norma(v) * UA) / DIA);
      distanciasTerra.push(norma(p.map((x, j) => x - terra[j])) * UA);
      distanciasSol.push(norma(p) * UA);
      if (i < visiveis)
        tracos.set(
          p.map((x, j) => x - nom[j]),
          (k * visiveis + i) * 3,
        );
      if (k === passos - 1) nuvem.set(p, i * 3);
    }
    const resumir = (a) => {
      a.sort((x, y) => x - y);
      return [percentil(a, 0.05), percentil(a, 0.5), percentil(a, 0.95)];
    };
    series.push({
      jd: data,
      dispersao: resumir(dispersoes),
      velocidade: resumir(velocidades),
      terra: resumir(distanciasTerra),
      sol: resumir(distanciasSol),
    });
    if (k % 4 === 0) {
      enviar({ tipo: "progresso-montecarlo", fracao: k / (passos - 1) });
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  enviar({
    tipo: "montecarlo",
    quantidade: n,
    visiveis,
    passos,
    tracos,
    nominal,
    nuvem,
    series,
    epoca: c.epoca,
    omitidos: c.omitidos,
    seed: d.seed || 2029,
  });
}
