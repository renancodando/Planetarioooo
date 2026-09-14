import { Integrador } from "./integrador.js";
import { copiarEstado, invariantes, norma } from "./fisica.js";
import { aplicarExperimento } from "./experimentos.js";
import { diagnosticar } from "./causalidade.js";
import { Eventos } from "./eventos.js";
import { executarMonteCarlo } from "./montecarlo.js";
let geracao = 0;
let memoria = null;
const ceder = () => new Promise((r) => setTimeout(r, 0));
self.onmessage = async ({ data: d }) => {
  if (d.tipo === "estado") {
    if (!memoria) return;
    try {
      const jd = Math.max(
        memoria.tempos[0],
        Math.min(memoria.tempos.at(-1), Number(d.jd)),
      );
      if (!Number.isFinite(jd)) throw Error("Data inválida.");
      let k = 0;
      while (k + 1 < memoria.tempos.length && memoria.tempos[k + 1] <= jd) k++;
      const a = copiarEstado(memoria.a),
        b = copiarEstado(memoria.b);
      a.estado.set(
        memoria.qa.subarray(k * a.estado.length, (k + 1) * a.estado.length),
      );
      b.estado.set(
        memoria.qb.subarray(k * b.estado.length, (k + 1) * b.estado.length),
      );
      a.jd = b.jd = memoria.tempos[k];
      const ia = new Integrador(a, memoria.passo),
        ib = new Integrador(b, memoria.passo);
      while (a.jd < jd - 1e-10) {
        if (ia.colisao() || ib.colisao()) break;
        const h = Math.min(ia.limitarPasso(), ib.limitarPasso(), jd - a.jd);
        ia.avancar(h);
        ib.avancar(h);
      }
      self.postMessage(
        { tipo: "estado", id: d.id, a: a.estado, b: b.estado, jd: a.jd },
        [a.estado.buffer, b.estado.buffer],
      );
    } catch (erro) {
      self.postMessage({
        tipo: "erro-estado",
        id: d.id,
        mensagem: erro.message,
      });
    }
    return;
  }
  if (d.tipo === "cancelar") {
    geracao++;
    return;
  }
  const id = ++geracao;
  try {
    if (d.tipo === "montecarlo") {
      await executarMonteCarlo(
        d,
        (p) => {
          if (id === geracao) self.postMessage({ ...p, id: d.id });
        },
        () => id !== geracao,
      );
      return;
    }
    const a = copiarEstado(d.inicial),
      b = aplicarExperimento(d.inicial, d.experimento),
      ia = new Integrador(a, d.passo),
      ib = new Integrador(b, d.passo),
      origem = a.corpos.findIndex((c) => c.id === d.experimento.corpo),
      inicio = a.jd;
    const dias = Number(d.dias);
    if (!Number.isFinite(dias) || dias <= 0 || dias > 365250)
      throw Error("Duração entre 0 e 1.000 anos.");
    const n = Math.min(2048, Math.max(64, Number(d.amostras) || 720)),
      datas = Array.from({ length: n + 1 }, (_, k) => (dias * k) / n);
    for (const v of [1 / 1440, 1 / 24, 1, 365.25, 3652.5, 36525, 365250])
      if (v < dias) datas.push(v);
    datas.sort((a, b) => a - b);
    const tempos = [...new Set(datas)],
      total = tempos.length,
      qa = new Float64Array(total * a.estado.length),
      qb = new Float64Array(total * b.estado.length),
      cronologia = new Float64Array(total),
      erros = new Float64Array(total * 4),
      distancias = new Float64Array(total * a.corpos.length),
      eventos = new Eventos(),
      onsets = {};
    const e0a = invariantes(a),
      e0b = invariantes(b);
    let fim = 0,
      ultimoEnvio = performance.now(),
      interrompido = null;
    const salvar = (k) => {
      qa.set(a.estado, k * a.estado.length);
      qb.set(b.estado, k * b.estado.length);
      cronologia[k] = a.jd;
      const linhas = diagnosticar(a, b, origem);
      for (const l of linhas) {
        distancias[k * a.corpos.length + l.indice] = l.distancia;
        if (l.distancia >= 0.001 && onsets[l.indice] === undefined)
          onsets[l.indice] = a.jd;
      }
      eventos.analisar(a, b, linhas);
      const ea = invariantes(a),
        eb = invariantes(b);
      erros[k * 4] = Math.abs((ea.energia - e0a.energia) / (e0a.energia || 1));
      erros[k * 4 + 1] = Math.abs(
        (eb.energia - e0b.energia) / (e0b.energia || 1),
      );
      erros[k * 4 + 2] =
        norma(ea.momento.map((v, i) => v - e0a.momento[i])) /
        (norma(e0a.momento) || 1);
      erros[k * 4 + 3] =
        norma(eb.momento.map((v, i) => v - e0b.momento[i])) /
        (norma(e0b.momento) || 1);
      fim = k + 1;
    };
    salvar(0);
    externo: for (let k = 1; k < total; k++) {
      const alvo = inicio + tempos[k];
      while (a.jd < alvo - 1e-10) {
        if (id !== geracao) return;
        const ca = ia.colisao(),
          cb = ib.colisao();
        if (ca || cb) {
          const par = cb || ca;
          interrompido =
            "Colisão geométrica detectada; integração interrompida antes de modelar o impacto.";
          eventos.registrar("colisao", {
            jd: a.jd,
            tipo: "colisão",
            corpo: par[0],
            par: par[1],
            realidade: cb ? "B" : "A",
            texto: interrompido,
          });
          salvar(k);
          break externo;
        }
        const h = Math.min(ia.limitarPasso(), ib.limitarPasso(), alvo - a.jd);
        ia.avancar(h);
        ib.avancar(h);
        if (ia.passos % 256 === 0 && performance.now() - ultimoEnvio > 90) {
          self.postMessage({
            tipo: "progresso",
            id: d.id,
            fracao: (a.jd - inicio) / dias,
            passos: ia.passos,
          });
          ultimoEnvio = performance.now();
          await ceder();
        }
        if (ia.passos > 12000000)
          throw Error(
            "Limite de passos atingido. Reduza a duração ou retire o encontro extremo.",
          );
      }
      salvar(k);
      if (erros[k * 4] > 0.01 || erros[k * 4 + 1] > 0.01) {
        interrompido =
          "Erro relativo de energia acima de 1%. Resultado interrompido; repita com passo menor.";
        break;
      }
    }
    if (id !== geracao) return;
    const resultado = {
      tipo: "resultado",
      id: d.id,
      inicio,
      corposA: a.corpos,
      corposB: b.corpos,
      massasA: Array.from(a.massas),
      massasB: Array.from(b.massas),
      ativosB: Array.from(b.ativos),
      tempos: cronologia.slice(0, fim),
      a: qa.slice(0, fim * a.estado.length),
      b: qb.slice(0, fim * b.estado.length),
      distancias: distancias.slice(0, fim * a.corpos.length),
      erros: erros.slice(0, fim * 4),
      eventos: eventos.lista,
      onsets,
      passos: ia.passos,
      menorPasso: ia.menorPasso,
      interrompido,
    };
    memoria = {
      a: copiarEstado(a),
      b: copiarEstado(b),
      qa,
      qb,
      tempos: cronologia.slice(0, fim),
      passo: d.passo,
    };
    self.postMessage(resultado, [
      resultado.tempos.buffer,
      resultado.a.buffer,
      resultado.b.buffer,
      resultado.distancias.buffer,
      resultado.erros.buffer,
    ]);
  } catch (erro) {
    if (id === geracao)
      self.postMessage({ tipo: "erro", id: d.id, mensagem: erro.message });
  }
};
