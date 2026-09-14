import { posicao, visual } from "./astronomia.js";
self.onmessage = ({ data: d }) => {
  const pontos = [],
    n = d.amostras || 1500;
  for (let k = 0; k <= n; k++) {
    const jd = d.jd + (k / n) * d.dias;
    let a = posicao(d.a, jd),
      b = posicao(d.b ?? 2, jd);
    if (d.tipo === "retrogrado") {
      a = a.map((v, i) => v - b[i]);
      const r = Math.hypot(...a);
      pontos.push(...a.map((v) => (v / r) * 55));
    } else if (d.tipo === "assinatura") {
      pontos.push(...visual(a, d.escala), ...visual(b, d.escala));
    } else {
      a = visual(a, d.escala);
      if (d.geocentrico) {
        b = visual(b, d.escala);
        a = a.map((v, i) => v - b[i]);
      }
      pontos.push(...a);
    }
  }
  const buffer = new Float32Array(pontos);
  self.postMessage(
    { id: d.id, tipo: d.tipo, geocentrico: d.geocentrico, pontos: buffer },
    [buffer.buffer],
  );
};
