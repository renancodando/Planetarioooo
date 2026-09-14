import { diagnosticar } from "./causalidade.js";
import { relativo, norma, UA, DIA, elementosEstado } from "./fisica.js";
import { formatar } from "./astronomia.js";
export const numero = (v, d = 3) =>
  Number.isFinite(v)
    ? v.toLocaleString("pt-BR", { maximumFractionDigits: d })
    : "não definido";
export function medidas(id, linhas) {
  const alvo = typeof id === "string" ? document.getElementById(id) : id;
  alvo.replaceChildren();
  for (const [nome, valor] of linhas) {
    const linha = document.createElement("div"),
      rotulo = document.createElement("span"),
      dado = document.createElement("strong");
    rotulo.textContent = nome;
    dado.textContent = valor;
    linha.append(rotulo, dado);
    alvo.append(linha);
  }
}
export function botaoLeitura(titulo, descricao, acao) {
  const b = document.createElement("button"),
    t = document.createElement("strong"),
    d = document.createElement("small");
  b.className = "bif-linha-evento";
  t.textContent = titulo;
  d.textContent = descricao;
  b.append(t, d);
  b.onclick = acao;
  return b;
}
export function desenharGrafico(canvas, resultado, indice, atual) {
  const w = canvas.clientWidth || 270,
    h = 130,
    dpr = Math.min(devicePixelRatio || 1, 2);
  if (canvas.width !== w * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  const c = canvas.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  const n = resultado.tempos.length,
    nc = resultado.corposA.length,
    valores = Array.from({ length: n }, (_, i) =>
      Math.log10(1 + resultado.distancias[i * nc + indice]),
    ),
    max = Math.max(1e-12, ...valores),
    inicio = resultado.tempos[0],
    duracao = resultado.tempos.at(-1) - inicio;
  c.strokeStyle = "#2a3935";
  c.lineWidth = 1;
  for (let k = 0; k < 3; k++) {
    c.beginPath();
    c.moveTo(0, 15 + k * 43);
    c.lineTo(w, 15 + k * 43);
    c.stroke();
  }
  c.beginPath();
  c.strokeStyle = "#c5ab77";
  for (let k = 0; k < n; k++) {
    const x = ((resultado.tempos[k] - inicio) / (duracao || 1)) * (w - 12) + 6,
      y = 108 - (valores[k] / max) * 94;
    k ? c.lineTo(x, y) : c.moveTo(x, y);
  }
  c.stroke();
  const x = Math.max(
    6,
    Math.min(w - 6, ((atual - inicio) / (duracao || 1)) * (w - 12) + 6),
  );
  c.strokeStyle = "#9ab4b4";
  c.beginPath();
  c.moveTo(x, 8);
  c.lineTo(x, 110);
  c.stroke();
  c.fillStyle = "#89968c";
  c.font = "9px Arial";
  c.fillText("log₁₀(1 + Δ km)", 6, 126);
  c.textAlign = "right";
  c.fillText(numero(duracao / 365.25, 2) + " anos", w - 6, 126);
  c.textAlign = "left";
}
export function lerDiagnosticos(laboratorio) {
  const r = laboratorio.resultado,
    v = laboratorio.realidades,
    a = {
      estado: v.a,
      massas: r.massasA,
      ativos: r.corposA.map(() => 1),
      corpos: r.corposA,
    },
    b = {
      estado: v.b,
      massas: r.massasB,
      ativos: r.ativosB,
      corpos: r.corposB,
    },
    indice = Math.max(
      1,
      r.corposA.findIndex((c) => c.id === laboratorio.selecionado),
    ),
    linhas = diagnosticar(
      a,
      b,
      r.corposA.findIndex(
        (c) => c.id === laboratorio.experienciaConcluida.experimento.corpo,
      ),
    ),
    d = linhas.find((l) => l.indice === indice),
    t = v.jdExibido ?? laboratorio.ui.tempo.jd;
  laboratorio.linhasDiagnostico = linhas;
  const delta = d.removido
    ? [["Estado", "Removido da realidade B"]]
    : [
        ["Δ posição", numero(d.distancia, 6) + " km"],
        ["Δ velocidade", numero(d.velocidade, 6) + " m/s"],
        ["Δ distância solar", numero(d.radial, 6) + " km"],
        ["Δ período osculante", numero(d.periodo, 6) + " dias"],
        ["Δ energia específica", numero(d.energia, 9) + " km²/s²"],
        ["Δ momento angular específico", numero(d.momento, 3) + " km²/s"],
        ["Δ excentricidade", numero(d.excentricidade, 9)],
      ];
  medidas("bif-diferencas", delta);
  const k = v.indice,
    energiaA = r.erros[k * 4],
    energiaB = r.erros[k * 4 + 1];
  const eJ = elementosEstado(relativo(v.b, 5), relativo(v.b, 5, 0, true)),
    eS = elementosEstado(relativo(v.b, 6), relativo(v.b, 6, 0, true));
  medidas("bif-estabilidade", [
    ["Deriva relativa de energia A", Number(energiaA).toExponential(3)],
    ["Deriva relativa de energia B", Number(energiaB).toExponential(3)],
    [
      "Deriva de momento angular B",
      Number(r.erros[k * 4 + 3]).toExponential(3),
    ],
    ["Passos integrados", numero(r.passos, 0)],
    ["Menor passo", numero(r.menorPasso * 86400, 3) + " s"],
    [
      "Períodos Saturno / Júpiter",
      eJ.periodo && eS.periodo
        ? numero(eS.periodo / eJ.periodo, 5)
        : "órbita não ligada",
    ],
    [
      "Confiabilidade",
      Math.max(energiaA, energiaB) > 1e-4
        ? "Repetir com passo menor"
        : "Modelo local; conferir convergência",
    ],
  ]);
  const media =
      linhas.reduce((s, l) => s + l.distancia, 0) /
      Math.max(1, linhas.filter((l) => !l.removido).length),
    maior = linhas.reduce(
      (a, b) => (b.distancia > a.distancia ? b : a),
      linhas[0],
    );
  document.getElementById("bif-relogio-texto").textContent =
    "+" +
    numero((t - r.inicio) / 365.25, 3) +
    " anos · " +
    maior.nome +
    " Δ " +
    numero(maior.distancia, 2) +
    " km";
  document.getElementById("bif-confianca").textContent =
    "SIMULAÇÃO N-BODY · estado " +
    formatar(t) +
    " · divergência média " +
    numero(media, 2) +
    " km · " +
    (r.interrompido || "hipótese, não previsão oficial");
  desenharGrafico(document.getElementById("bif-grafico"), r, indice, t);
  document.getElementById("bif-grafico-legenda").textContent =
    r.corposA[indice].nome +
    " · distância heliocêntrica entre A e B. Escala vertical logarítmica.";
  const causas = document.getElementById("bif-causas");
  causas.replaceChildren();
  for (const l of [...linhas].sort((a, b) => b.distancia - a.distancia)) {
    const fonte = r.corposB[l.causa]?.nome || "sem diferença mensurável",
      inicio = r.onsets[l.indice];
    causas.append(
      botaoLeitura(
        l.nome + " · " + l.nivel,
        numero(l.distancia, 6) +
          " km · primeira amostra ≥ 1 m: " +
          (inicio ? formatar(inicio) : "não atingida") +
          " · contribuição diferencial dominante: " +
          fonte,
        () => laboratorio.focar(l.indice),
      ),
    );
  }
  const ultimo = r.eventos.filter((e) => e.jd <= t).at(-1);
  if (ultimo)
    document.getElementById("bif-confianca").textContent += " · " + ultimo.tipo;
  return { linhas, indice };
}
