import { estadoOrbital, GM_SOL } from "./fisica.js";
export function prepararCovariancia(dados) {
  const orbita = dados.orbit,
    c = orbita?.covariance;
  if (!c || !Array.isArray(c.data) || !Array.isArray(c.labels))
    throw Error(
      "Este objeto não tem matriz de covariância orbital disponível.",
    );
  const elementos =
    c.elements ||
    (Math.abs(Number(c.epoch) - Number(orbita.epoch)) < 1e-8
      ? orbita.elements
      : null);
  if (!elementos)
    throw Error(
      "A covariância não possui elementos na mesma época; importação insuficiente.",
    );
  const nomes = ["e", "q", "tp", "node", "peri", "i"],
    indices = nomes.map((n) => c.labels.indexOf(n));
  if (indices.some((i) => i < 0))
    throw Error("São necessários e, q, tp, node, peri e i na matriz.");
  const matriz = indices.map((i) => indices.map((j) => Number(c.data[i]?.[j])));
  if (!matriz.flat().every(Number.isFinite))
    throw Error("Matriz de covariância inválida.");
  const sigmas = matriz.map((r, i) => Math.sqrt(r[i]));
  if (sigmas.some((s) => !Number.isFinite(s) || s <= 0))
    throw Error("Variâncias orbitais inválidas.");
  const L = Array.from({ length: 6 }, () => Array(6).fill(0));
  for (let i = 0; i < 6; i++)
    for (let j = 0; j <= i; j++) {
      let soma = matriz[i][j] / sigmas[i] / sigmas[j];
      for (let k = 0; k < j; k++) soma -= L[i][k] * L[j][k];
      if (i === j) {
        if (soma < -1e-9) throw Error("Covariância não positiva.");
        L[i][j] = Math.sqrt(Math.max(soma, 1e-15));
      } else L[i][j] = soma / L[j][j];
    }
  for (let i = 0; i < 6; i++) for (let j = 0; j <= i; j++) L[i][j] *= sigmas[i];
  const mapa = Object.fromEntries(
      elementos.map((e) => [e.label || e.name, Number(e.value)]),
    ),
    media = nomes.map((n) => mapa[n]);
  if (!media.every(Number.isFinite))
    throw Error("Elementos nominais incompletos.");
  return {
    L,
    media,
    epoca: Number(c.epoch),
    omitidos: c.labels.filter((n) => !nomes.includes(n)),
  };
}
export function propagarAmostra(valores, jd) {
  const [e, q, tp, om, w, i] = valores,
    a = q / (1 - e);
  const n = Math.sqrt(GM_SOL / (a * a * a));
  return estadoOrbital({ a, e, i, om, w, ma: (n * (jd - tp) * 180) / Math.PI });
}
export function gerador(seed = 2029) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s + 0.5) / 4294967296;
  };
}
export function gaussiano(aleatorio) {
  return (
    Math.sqrt(-2 * Math.log(aleatorio())) * Math.cos(2 * Math.PI * aleatorio())
  );
}
export function sortearCovariancia(c, aleatorio) {
  const z = Array.from({ length: 6 }, () => gaussiano(aleatorio));
  return c.media.map((v, i) => v + c.L[i].reduce((s, x, j) => s + x * z[j], 0));
}
export function percentil(ordenados, p) {
  const k = (ordenados.length - 1) * p,
    a = Math.floor(k),
    b = Math.ceil(k);
  return ordenados[a] + (ordenados[b] - ordenados[a]) * (k - a);
}
