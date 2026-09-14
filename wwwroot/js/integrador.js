// antes de ficar bonito, cada passo precisa continuar fiel à física
import { GM_SOL, validarEstado } from "./fisica.js";
export class Integrador {
  constructor(s, passo = 0.125) {
    if (!Number.isFinite(Number(passo)) || Number(passo) <= 0)
      throw Error("Passo de integração inválido.");
    this.s = validarEstado(s);
    this.n = s.massas.length;
    this.aceleracao = new Float64Array(this.n * 3);
    this.proxima = new Float64Array(this.n * 3);
    this.passo = Math.max(0.001, Math.min(0.5, passo));
    this.passos = 0;
    this.menorPasso = Infinity;
    this.forcas(this.aceleracao);
  }
  forcas(saida) {
    const { estado: q, massas: m, ativos } = this.s;
    saida.fill(0);
    for (let i = 0; i < this.n; i++) {
      if (!ativos[i]) continue;
      for (let j = i + 1; j < this.n; j++) {
        if (!ativos[j] || (!m[i] && !m[j])) continue;
        const x = q[j * 6] - q[i * 6],
          y = q[j * 6 + 1] - q[i * 6 + 1],
          z = q[j * 6 + 2] - q[i * 6 + 2],
          d2 = x * x + y * y + z * z;
        if (d2 < 1e-28)
          throw Error("Corpos coincidentes: integração interrompida.");
        const f = GM_SOL / (d2 * Math.sqrt(d2));
        const a = f * m[j],
          b = f * m[i];
        saida[i * 3] += x * a;
        saida[i * 3 + 1] += y * a;
        saida[i * 3 + 2] += z * a;
        saida[j * 3] -= x * b;
        saida[j * 3 + 1] -= y * b;
        saida[j * 3 + 2] -= z * b;
      }
    }
    return saida;
  }
  limitarPasso() {
    const { estado: q, massas: m, ativos } = this.s;
    let h = this.passo;
    for (let i = 0; i < this.n; i++) {
      if (!ativos[i]) continue;
      for (let j = i + 1; j < this.n; j++) {
        if (!ativos[j] || (!m[i] && !m[j])) continue;
        const d = Math.hypot(
            q[i * 6] - q[j * 6],
            q[i * 6 + 1] - q[j * 6 + 1],
            q[i * 6 + 2] - q[j * 6 + 2],
          ),
          v = Math.hypot(
            q[i * 6 + 3] - q[j * 6 + 3],
            q[i * 6 + 4] - q[j * 6 + 4],
            q[i * 6 + 5] - q[j * 6 + 5],
          );
        h = Math.min(
          h,
          0.04 * Math.sqrt((d * d * d) / (GM_SOL * (m[i] + m[j]))),
          v > 0 ? (0.04 * d) / v : Infinity,
        );
      }
    }
    if (h < 1e-8)
      throw Error("Encontro extremo: passo abaixo do limite numérico.");
    return h;
  }
  colisao() {
    const { estado: q, raios: r, ativos } = this.s;
    for (let i = 0; i < this.n; i++)
      if (ativos[i])
        for (let j = i + 1; j < this.n; j++)
          if (
            ativos[j] &&
            r[i] + r[j] > 0 &&
            Math.hypot(
              q[i * 6] - q[j * 6],
              q[i * 6 + 1] - q[j * 6 + 1],
              q[i * 6 + 2] - q[j * 6 + 2],
            ) <=
              r[i] + r[j]
          )
            return [i, j];
    return null;
  }
  avancar(h) {
    const q = this.s.estado;
    for (let i = 0; i < this.n; i++)
      if (this.s.ativos[i])
        for (let k = 0; k < 3; k++) {
          const a = this.aceleracao[i * 3 + k];
          q[i * 6 + k] += q[i * 6 + 3 + k] * h + 0.5 * a * h * h;
          q[i * 6 + 3 + k] += 0.5 * a * h;
        }
    this.forcas(this.proxima);
    for (let i = 0; i < this.n; i++)
      if (this.s.ativos[i])
        for (let k = 0; k < 3; k++)
          q[i * 6 + 3 + k] += 0.5 * this.proxima[i * 3 + k] * h;
    const a = this.aceleracao;
    this.aceleracao = this.proxima;
    this.proxima = a;
    this.s.jd += h;
    this.passos++;
    this.menorPasso = Math.min(this.menorPasso, Math.abs(h));
  }
}
