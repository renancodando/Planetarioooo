import {
  copiarEstado,
  relativo,
  unitario,
  cruzar,
  estadoOrbital,
  GM_SOL,
  DIA,
  UA,
  MASSA_SOL,
  validarEstado,
} from "./fisica.js";
export function aplicarExperimento(original, opcoes) {
  const s = copiarEstado(original),
    i = s.corpos.findIndex((c) => c.id === opcoes.corpo);
  if (i < 1) throw Error("Selecione um corpo do catálogo.");
  const valor = Number(opcoes.valor || 0);
  if (!Number.isFinite(valor)) throw Error("Valor experimental inválido.");
  if (opcoes.tipo === "impulso") {
    if (Math.abs(valor) > 1e7) throw Error("Δv limitado a 10.000 km/s.");
    const r = relativo(s.estado, i),
      v = relativo(s.estado, i, 0, true);
    let direcao;
    if (opcoes.direcao === "manual")
      direcao = unitario(opcoes.vetor.map(Number));
    else if (["prograde", "retrograde"].includes(opcoes.direcao))
      direcao = unitario(v);
    else if (["normal", "antinormal"].includes(opcoes.direcao))
      direcao = unitario(cruzar(r, v));
    else direcao = unitario(r);
    const sinal = ["retrograde", "antinormal", "antirradial"].includes(
      opcoes.direcao,
    )
      ? -1
      : 1;
    for (let k = 0; k < 3; k++)
      s.estado[i * 6 + 3 + k] +=
        (((direcao[k] * valor * sinal) / 1000) * DIA) / UA;
  } else if (opcoes.tipo === "massa") {
    if (valor < 0 || valor > 10000)
      throw Error("Massa experimental: entre 0% e 10.000%.");
    if (!s.massas[i])
      throw Error(
        "Massa original desconhecida. Use massa absoluta hipotética.",
      );
    s.massas[i] *= valor / 100;
  } else if (opcoes.tipo === "massa-absoluta") {
    if (valor < 0 || valor > MASSA_SOL * 10)
      throw Error("Massa hipotética fora do intervalo.");
    s.massas[i] = valor / MASSA_SOL;
  } else if (opcoes.tipo === "remover") {
    s.ativos[i] = 0;
    s.massas[i] = 0;
  } else if (opcoes.tipo === "posicao" || opcoes.tipo === "velocidade") {
    const v = opcoes.vetor.map(Number);
    if (v.length !== 3 || !v.every(Number.isFinite))
      throw Error("Vetor inválido.");
    const velocidade = opcoes.tipo === "velocidade";
    for (let k = 0; k < 3; k++)
      s.estado[i * 6 + (velocidade ? 3 : 0) + k] +=
        v[k] * (velocidade ? DIA / 1000 / UA : 1 / UA);
  } else if (opcoes.tipo === "elementos") {
    const vetor = estadoOrbital(
      opcoes.elementos,
      GM_SOL * (s.massas[0] + s.massas[i]),
    );
    for (let k = 0; k < 6; k++) s.estado[i * 6 + k] = s.estado[k] + vetor[k];
  } else if (opcoes.tipo === "artificial") {
    const c = opcoes.artificial,
      estado = [
        ...c.posicao.map(Number),
        ...c.velocidade.map((v) => (Number(v) * DIA) / UA),
      ],
      massa = Number(c.massa) / MASSA_SOL,
      raio = Number(c.raio) / UA;
    if (
      !c.nome ||
      c.nome.length > 60 ||
      !estado.every(Number.isFinite) ||
      !Number.isFinite(massa) ||
      massa < 0 ||
      massa > 10 ||
      !Number.isFinite(raio) ||
      raio <= 0
    )
      throw Error("Revise os parâmetros do corpo artificial.");
    s.corpos.push({
      id: "artificial",
      nome: c.nome,
      massa,
      raio,
      raioVisual: Math.max(0.25, Math.min(8, Number(c.visual) || 1)),
      cor: "#c6a987",
      fonte: "Hipótese · corpo artificial",
    });
    s.estado = Float64Array.from([
      ...s.estado,
      ...estado.map((v, k) => v + s.estado[k]),
    ]);
    s.massas = Float64Array.from([...s.massas, massa]);
    s.raios = Float64Array.from([...s.raios, raio]);
    s.ativos = Uint8Array.from([...s.ativos, 1]);
  } else throw Error("Experimento não reconhecido.");
  s.corpos.forEach((c, k) => (c.massa = s.massas[k]));
  return validarEstado(s);
}
