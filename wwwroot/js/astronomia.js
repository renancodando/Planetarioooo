export const UA = 149597870.7;
export const rad = Math.PI / 180;
const elementos = [
  [
    [
      0.38709843, 0.20563661, 7.00559432, 252.25166724, 77.45771895,
      48.33961819,
    ],
    [0, 0.00002123, -0.00590158, 149472.67486623, 0.15940013, -0.12214182],
  ],
  [
    [
      0.72332102, 0.00676399, 3.39777545, 181.9797085, 131.76755713,
      76.67261496,
    ],
    [
      -0.00000026, -0.00005107, 0.00043494, 58517.8156026, 0.05679648,
      -0.27274174,
    ],
  ],
  [
    [
      1.00000018, 0.01673163, -0.00054346, 100.46691572, 102.93005885,
      -5.11260389,
    ],
    [
      -0.00000003, -0.00003661, -0.01337178, 35999.37306329, 0.3179526,
      -0.24123856,
    ],
  ],
  [
    [
      1.52371243, 0.09336511, 1.85181869, -4.56813164, -23.91744784,
      49.71320984,
    ],
    [
      0.00000097, 0.00009149, -0.00724757, 19140.29934243, 0.45223625,
      -0.26852431,
    ],
  ],
  [
    [5.20248019, 0.0485359, 1.29861416, 34.33479152, 14.27495244, 100.29282654],
    [
      -0.00002864, 0.00018026, -0.00322699, 3034.90371757, 0.18199196,
      0.13024619,
    ],
    [-0.00012452, 0.0606406, -0.35635438, 38.35125],
  ],
  [
    [
      9.54149883, 0.05550825, 2.49424102, 50.07571329, 92.86136063,
      113.63998702,
    ],
    [
      -0.00003065, -0.00032044, 0.00451969, 1222.11494724, 0.54179478,
      -0.25015002,
    ],
    [0.00025899, -0.13434469, 0.87320147, 38.35125],
  ],
  [
    [
      19.18797948, 0.0468574, 0.77298127, 314.20276625, 172.43404441,
      73.96250215,
    ],
    [
      -0.00020455, -0.0000155, -0.00180155, 428.49512595, 0.09266985,
      0.05739699,
    ],
    [0.00058331, -0.97731848, 0.17689245, 7.67025],
  ],
  [
    [
      30.06952752, 0.00895439, 1.7700552, 304.22289287, 46.68158724,
      131.78635853,
    ],
    [0.00006447, 0.00000818, 0.000224, 218.46515314, 0.01009938, -0.00606302],
    [-0.00041348, 0.68346318, -0.10162547, 7.67025],
  ],
];
const elementosRecentes = [
  [
    [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593],
    [
      0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689,
      -0.12534081,
    ],
  ],
  [
    [
      0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718,
      76.67984255,
    ],
    [
      0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329,
      -0.27769418,
    ],
  ],
  [
    [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0],
    [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0],
  ],
  [
    [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    [
      0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088,
      -0.29257343,
    ],
  ],
  [
    [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    [
      -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668,
      0.20469106,
    ],
  ],
  [
    [
      9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831,
      113.66242448,
    ],
    [
      -0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216,
      -0.28867794,
    ],
  ],
  [
    [
      19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763,
      74.01692503,
    ],
    [
      -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281,
      0.04240589,
    ],
  ],
  [
    [
      30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227,
      131.78422574,
    ],
    [
      0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464,
      -0.00508664,
    ],
  ],
];
const fisicos = [
  [
    "Mercúrio",
    "mercury",
    4879,
    3.301e23,
    3.7,
    167,
    0.034,
    58.646,
    0,
    "#a79885",
  ],
  [
    "Vênus",
    "venus_surface",
    12104,
    4.867e24,
    8.87,
    464,
    177.36,
    -243.025,
    0,
    "#d8b273",
  ],
  [
    "Terra",
    "earth_daymap",
    12742,
    5.972e24,
    9.81,
    15,
    23.44,
    0.99727,
    1,
    "#86b5c6",
  ],
  ["Marte", "mars", 6779, 6.417e23, 3.71, -65, 25.19, 1.02596, 2, "#cc7953"],
  [
    "Júpiter",
    "jupiter",
    139820,
    1.898e27,
    24.79,
    -110,
    3.13,
    0.41354,
    null,
    "#d4b997",
  ],
  [
    "Saturno",
    "saturn",
    116460,
    5.683e26,
    10.44,
    -140,
    26.73,
    0.444,
    null,
    "#d9c18c",
  ],
  [
    "Urano",
    "uranus",
    50724,
    8.681e25,
    8.69,
    -195,
    97.77,
    -0.718,
    null,
    "#89b9b8",
  ],
  [
    "Netuno",
    "neptune",
    49244,
    1.024e26,
    11.15,
    -200,
    28.32,
    0.6713,
    null,
    "#7093bc",
  ],
];
export const planetas = fisicos.map((v, i) => ({
  indice: i,
  nome: v[0],
  textura: v[1],
  diametro: v[2],
  massa: v[3],
  gravidade: v[4],
  temperatura: v[5],
  inclinacao: v[6],
  rotacao: v[7],
  luas: v[8],
  cor: v[9],
  periodo: 365.256 * Math.pow(elementos[i][0][0], 1.5),
  elementos: elementos[i],
}));
export function juliano(data) {
  return +data / 86400000 + 2440587.5;
}
export function dataJuliana(jd) {
  return new Date((jd - 2440587.5) * 86400000);
}
export function lerData(texto) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(-?\d{1,4})$/.exec(texto.trim());
  if (!m) throw Error("Use dia/mês/ano.");
  let [, d, mes, a] = m.map(Number);
  if (a < 1 || a > 5000) throw Error("Escolha um ano entre 1 e 5000.");
  let data = new Date(0);
  data.setUTCFullYear(a, mes - 1, d);
  data.setUTCHours(12, 0, 0, 0);
  if (data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== d)
    throw Error("Essa data não existe.");
  return juliano(data);
}
export function formatar(jd) {
  const d = dataJuliana(jd);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCFullYear()).padStart(4, "0")}`;
}
export function kepler(m, e) {
  let E = m;
  for (let i = 0; i < 20; i++) {
    let passo = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
    E -= passo;
    if (Math.abs(passo) < 1e-12) break;
  }
  return E;
}
export function posicao(indice, jd, anomalia) {
  const [base, taxa, extra] = (
      jd >= 2378496.5 && jd <= 2469807.5 ? elementosRecentes : elementos
    )[indice],
    t = (jd - 2451545) / 36525;
  let [a, e, I, L, p, n] = base.map((v, i) => v + taxa[i] * t);
  I *= rad;
  const w = (p - n) * rad;
  n *= rad;
  let m = L - p;
  if (extra) {
    const [b, c, s, f] = extra;
    m += b * t * t + c * Math.cos(f * t * rad) + s * Math.sin(f * t * rad);
  }
  m = anomalia ?? (m % 360) * rad;
  const E = kepler(m, e),
    x = a * (Math.cos(E) - e),
    y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  return [
    (Math.cos(w) * Math.cos(n) - Math.sin(w) * Math.sin(n) * Math.cos(I)) * x +
      (-Math.sin(w) * Math.cos(n) - Math.cos(w) * Math.sin(n) * Math.cos(I)) *
        y,
    Math.sin(w) * Math.sin(I) * x + Math.cos(w) * Math.sin(I) * y,
    -(
      (Math.cos(w) * Math.sin(n) + Math.sin(w) * Math.cos(n) * Math.cos(I)) *
        x +
      (-Math.sin(w) * Math.sin(n) + Math.cos(w) * Math.cos(n) * Math.cos(I)) * y
    ),
  ];
}
export function distancia(v) {
  return Math.hypot(...v);
}
export function velocidade(i, jd) {
  const r = distancia(posicao(i, jd)),
    a = elementos[i][0][0];
  return 29.7847 * Math.sqrt(2 / r - 1 / a);
}
export function visual(v, escala = "didatica") {
  const r = distancia(v);
  if (!r) return [0, 0, 0];
  const fator = escala === "proporcional" ? 8 : (13 + 20 * Math.log1p(r)) / r;
  return v.map((n) => n * fator);
}
export const luas = [
  {
    nome: "Lua",
    pai: 2,
    raio: 1737,
    distancia: 384400,
    periodo: 27.3217,
    inclinacao: 5.145,
  },
  { nome: "Io", pai: 4, raio: 1822, distancia: 421700, periodo: 1.769 },
  { nome: "Europa", pai: 4, raio: 1561, distancia: 671100, periodo: 3.551 },
  { nome: "Ganimedes", pai: 4, raio: 2634, distancia: 1070400, periodo: 7.155 },
  { nome: "Calisto", pai: 4, raio: 2410, distancia: 1882700, periodo: 16.689 },
  { nome: "Titã", pai: 5, raio: 2575, distancia: 1221870, periodo: 15.945 },
  { nome: "Encélado", pai: 5, raio: 252, distancia: 238020, periodo: 1.37 },
  { nome: "Reia", pai: 5, raio: 764, distancia: 527040, periodo: 4.518 },
  { nome: "Jápeto", pai: 5, raio: 735, distancia: 3560820, periodo: 79.321 },
];

export function posicaoMenor(orbita, jd, anomalia) {
  const elementos = Object.fromEntries(
    orbita.elements.map((e) => [e.name, Number(e.value)]),
  );
  const { e, i, om, w } = elementos;
  const a = elementos.a ?? elementos.q / (1 - e);
  const n = elementos.n ?? 0.9856076686 / Math.pow(a, 1.5);
  const ma = elementos.ma ?? n * (Number(orbita.epoch) - elementos.tp);
  if (
    ![a, e, i, om, w, ma, n, Number(orbita.epoch)].every(Number.isFinite) ||
    a <= 0 ||
    e < 0 ||
    e >= 1
  )
    throw Error("Órbita elíptica inválida.");
  const E = kepler(
    anomalia ?? ((ma + n * (jd - Number(orbita.epoch))) % 360) * rad,
    e,
  );
  const x = a * (Math.cos(E) - e),
    y = a * Math.sqrt(1 - e * e) * Math.sin(E),
    I = i * rad,
    O = om * rad,
    W = w * rad;
  return [
    (Math.cos(W) * Math.cos(O) - Math.sin(W) * Math.sin(O) * Math.cos(I)) * x +
      (-Math.sin(W) * Math.cos(O) - Math.cos(W) * Math.sin(O) * Math.cos(I)) *
        y,
    Math.sin(W) * Math.sin(I) * x + Math.cos(W) * Math.sin(I) * y,
    -(
      (Math.cos(W) * Math.sin(O) + Math.sin(W) * Math.cos(O) * Math.cos(I)) *
        x +
      (-Math.sin(W) * Math.sin(O) + Math.cos(W) * Math.cos(O) * Math.cos(I)) * y
    ),
  ];
}
