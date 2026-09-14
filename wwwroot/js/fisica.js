import {
  planetas,
  posicao,
  posicaoMenor,
  kepler,
  rad,
  UA,
} from "./astronomia.js";
export { UA };
export const DIA = 86400;
export const MASSA_SOL = 1.98847e30;
export const GM_SOL = 2.959122082855911e-4;
export const IDS = [
  "mercurio",
  "venus",
  "terra",
  "marte",
  "jupiter",
  "saturno",
  "urano",
  "netuno",
];
export const norma = (v) => Math.hypot(...v);
export const produto = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const cruzar = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const unitario = (v) => {
  const n = norma(v);
  if (n < 1e-20) throw Error("Direção indefinida para vetor nulo.");
  return v.map((x) => x / n);
};
export const ecliptica = (v) => [v[0], -v[2], v[1]];
export const grafica = (v) => [v[0], v[2], -v[1]];
export function vetor(estado, indice, velocidade = false) {
  return Array.from(
    estado.slice(
      indice * 6 + (velocidade ? 3 : 0),
      indice * 6 + (velocidade ? 6 : 3),
    ),
  );
}
export function relativo(estado, indice, centro = 0, velocidade = false) {
  const a = vetor(estado, indice, velocidade),
    b = vetor(estado, centro, velocidade);
  return a.map((v, k) => v - b[k]);
}
export function estadoOrbital(elementos, mu = GM_SOL) {
  const { a, e, i, om, w, ma } = elementos;
  if (
    ![a, e, i, om, w, ma, mu].every(Number.isFinite) ||
    a <= 0 ||
    e < 0 ||
    e >= 1 ||
    mu <= 0
  )
    throw Error("Informe elementos de uma órbita elíptica: a > 0 e 0 ≤ e < 1.");
  const E = kepler((((ma % 360) + 360) % 360) * rad, e),
    c = Math.cos(E),
    s = Math.sin(E),
    q = Math.sqrt(1 - e * e),
    n = Math.sqrt(mu / (a * a * a)),
    den = 1 - e * c;
  const O = om * rad,
    W = w * rad,
    I = i * rad;
  const p = [
    Math.cos(O) * Math.cos(W) - Math.sin(O) * Math.sin(W) * Math.cos(I),
    Math.sin(O) * Math.cos(W) + Math.cos(O) * Math.sin(W) * Math.cos(I),
    Math.sin(W) * Math.sin(I),
  ];
  const t = [
    -Math.cos(O) * Math.sin(W) - Math.sin(O) * Math.cos(W) * Math.cos(I),
    -Math.sin(O) * Math.sin(W) + Math.cos(O) * Math.cos(W) * Math.cos(I),
    Math.cos(W) * Math.sin(I),
  ];
  return [
    ...p.map((v, k) => v * a * (c - e) + t[k] * a * q * s),
    ...p.map(
      (v, k) => v * ((-a * n * s) / den) + t[k] * ((a * n * q * c) / den),
    ),
  ];
}
export function elementosEstado(r, v, mu = GM_SOL) {
  const R = norma(r),
    h = cruzar(r, v),
    H = norma(h),
    V2 = produto(v, v),
    energia = V2 / 2 - mu / R;
  const ev = cruzar(v, h).map((x, k) => x / mu - r[k] / R),
    e = norma(ev),
    a = -mu / (2 * energia),
    n = [-h[1], h[0], 0],
    N = norma(n),
    lim = (x) => Math.max(-1, Math.min(1, x));
  const ang = (a, b) => Math.acos(lim(produto(a, b) / (norma(a) * norma(b))));
  let om = N > 1e-15 ? Math.atan2(n[1], n[0]) : 0,
    w = e > 1e-12 ? (N > 1e-15 ? ang(n, ev) : Math.atan2(ev[1], ev[0])) : 0;
  if (N > 1e-15 && ev[2] < 0) w = 2 * Math.PI - w;
  let f = e > 1e-12 ? ang(ev, r) : Math.atan2(r[1], r[0]);
  if (e > 1e-12 && produto(r, v) < 0) f = 2 * Math.PI - f;
  const E =
    e < 1
      ? 2 *
        Math.atan2(
          Math.sqrt(1 - e) * Math.sin(f / 2),
          Math.sqrt(1 + e) * Math.cos(f / 2),
        )
      : NaN;
  return {
    a,
    e,
    i: H > 0 ? Math.acos(lim(h[2] / H)) / rad : 0,
    om: om / rad,
    w: w / rad,
    ma: ((E - e * Math.sin(E)) / rad + 360) % 360,
    energia,
    h: H,
    periodo: a > 0 && e < 1 ? 2 * Math.PI * Math.sqrt((a * a * a) / mu) : null,
    perielio: a * (1 - e),
    afelio: e < 1 ? a * (1 + e) : null,
  };
}
function estadoLocal(indice, jd) {
  const d = 0.001,
    p = ecliptica(posicao(indice, jd)),
    a = ecliptica(posicao(indice, jd - d)),
    b = ecliptica(posicao(indice, jd + d));
  return [...p, ...b.map((v, k) => (v - a[k]) / (2 * d))];
}
export function corpoSBDB(registro, jd) {
  const dados = registro.dados || registro,
    orbita = dados.orbit;
  const p = ecliptica(posicaoMenor(orbita, jd)),
    a = ecliptica(posicaoMenor(orbita, jd - 0.001)),
    b = ecliptica(posicaoMenor(orbita, jd + 0.001));
  const fisicos = Object.fromEntries(
    (dados.phys_par || []).map((v) => [v.name, Number(v.value)]),
  );
  const massa = Number.isFinite(fisicos.GM)
    ? (fisicos.GM * DIA * DIA) / (UA * UA * UA) / GM_SOL
    : 0;
  return {
    id: dados.object.des,
    nome: dados.object.shortname || dados.object.fullname,
    massa,
    raio: (fisicos.diameter || 0) / 2 / UA,
    raioVisual: 0.6,
    cor: "#b8a58a",
    estado: [...p, ...b.map((v, k) => (v - a[k]) / 0.002)],
    fonte: "SBDB · propagação kepleriana local",
    massaConhecida: massa > 0,
    sbdb: dados,
  };
}
export function criarEstado(jd, catalogo = {}, adicionais = []) {
  const corpos = [
    {
      id: "sol",
      nome: "Sol",
      massa: 1,
      raio: 696340 / UA,
      raioVisual: 6.5,
      cor: "#edba68",
      estado: [0, 0, 0, 0, 0, 0],
      fonte: "Centro solar",
    },
  ];
  for (const p of planetas)
    corpos.push({
      id: IDS[p.indice],
      nome: p.nome,
      massa: p.massa / MASSA_SOL,
      raio: p.diametro / 2 / UA,
      raioVisual: Math.max(0.65, Math.sqrt(p.diametro / 12742) * 1.7),
      cor: p.cor,
      indice: p.indice,
      estado: estadoLocal(p.indice, jd),
      fonte: "Elementos JPL · cálculo local",
    });
  const lunar = estadoOrbital(
    {
      a: 384400 / UA,
      e: 0.0549,
      i: 5.145,
      om: 125.08,
      w: 318.15,
      ma: 115.3654 + 13.06499295 * (jd - 2451545),
    },
    GM_SOL * (corpos[3].massa + 7.342e22 / MASSA_SOL),
  );
  const centro = corpos[3].estado.slice(),
    fracao = 7.342e22 / (planetas[2].massa + 7.342e22);
  corpos[3].estado = centro.map((v, k) => v - lunar[k] * fracao);
  corpos.push({
    id: "lua",
    nome: "Lua",
    massa: 7.342e22 / MASSA_SOL,
    raio: 1737.4 / UA,
    raioVisual: 0.43,
    cor: "#bbb8b0",
    estado: centro.map((v, k) => v + lunar[k] * (1 - fracao)),
    fonte: "Órbita lunar aproximada, sem efeméride de fase",
  });
  const registros = [...(catalogo.corpos || []), ...adicionais];
  for (const registro of registros) {
    try {
      const c = corpoSBDB(registro, jd);
      if (!corpos.some((x) => x.id === c.id) && corpos.length < 22)
        corpos.push(c);
    } catch {}
  }
  for (const corpo of corpos) {
    const dado = (catalogo.vetores || []).find(
      (v) => v.id === corpo.id && Math.abs(v.jd - jd) < 1e-7,
    );
    if (dado) {
      corpo.estado = [...dado.posicao, ...dado.velocidade];
      corpo.fonte = "Efeméride JPL Horizons · estado inicial TDB";
    }
  }
  const missao = (catalogo.vetores || []).find(
    (v) => v.id === "voyager1" && Math.abs(v.jd - jd) < 1e-7,
  );
  if (missao)
    corpos.push({
      id: "voyager1",
      nome: "Voyager 1",
      massa: 0,
      raio: 0,
      raioVisual: 0.45,
      cor: "#d0cec5",
      estado: [...missao.posicao, ...missao.velocidade],
      fonte: "Horizons · sonda como partícula teste",
      massaConhecida: false,
    });
  const total = corpos.reduce((s, c) => s + c.massa, 0),
    baricentro = Array.from(
      { length: 6 },
      (_, k) => corpos.reduce((s, c) => s + c.estado[k] * c.massa, 0) / total,
    );
  return {
    jd,
    corpos: corpos.map(({ estado, ...c }) => c),
    estado: Float64Array.from(
      corpos.flatMap((c) => c.estado.map((v, k) => v - baricentro[k])),
    ),
    massas: Float64Array.from(corpos.map((c) => c.massa)),
    raios: Float64Array.from(corpos.map((c) => c.raio)),
    ativos: Uint8Array.from(corpos.map(() => 1)),
  };
}
export function copiarEstado(s) {
  return {
    jd: s.jd,
    corpos: s.corpos.map((c) => ({ ...c })),
    estado: Float64Array.from(s.estado),
    massas: Float64Array.from(s.massas),
    raios: Float64Array.from(s.raios),
    ativos: Uint8Array.from(s.ativos),
  };
}
export function validarEstado(s) {
  const n = s.corpos?.length;
  if (!Number.isInteger(n) || n < 2 || n > 24 || !Number.isFinite(s.jd))
    throw Error("Estado físico inválido.");
  if (
    s.estado.length !== n * 6 ||
    s.massas.length !== n ||
    s.raios.length !== n ||
    s.ativos.length !== n
  )
    throw Error("Dimensões físicas inconsistentes.");
  if (
    !Array.from(s.estado).every(
      (v) => Number.isFinite(v) && Math.abs(v) < 1e8,
    ) ||
    !Array.from(s.massas).every(
      (v) => Number.isFinite(v) && v >= 0 && v < 100,
    ) ||
    !Array.from(s.raios).every((v) => Number.isFinite(v) && v >= 0 && v < 10) ||
    !Array.from(s.ativos).every((v) => v === 0 || v === 1)
  )
    throw Error("Há valores físicos fora do intervalo suportado.");
  if (s.massas[0] <= 0) throw Error("O Sol precisa permanecer no modelo.");
  return s;
}
export function invariantes(s) {
  let energia = 0;
  const momento = [0, 0, 0],
    linear = [0, 0, 0];
  for (let i = 0; i < s.massas.length; i++) {
    if (!s.ativos[i]) continue;
    const r = vetor(s.estado, i),
      v = vetor(s.estado, i, true),
      m = s.massas[i],
      h = cruzar(r, v);
    energia += (m * produto(v, v)) / 2;
    for (let k = 0; k < 3; k++) {
      momento[k] += m * h[k];
      linear[k] += m * v[k];
    }
    for (let j = 0; j < i; j++)
      if (s.ativos[j]) {
        const d = norma(r.map((v, k) => v - s.estado[j * 6 + k]));
        if (d > 0) energia -= (GM_SOL * m * s.massas[j]) / d;
      }
  }
  return { energia, momento, linear };
}
