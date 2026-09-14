import { posicao, planetas, UA, formatar } from "./astronomia.js";
const obter = (id) => document.getElementById(id);
function tabela(cabecalhos, linhas) {
  const tabela = document.createElement("table"),
    cabeca = document.createElement("thead"),
    tr = document.createElement("tr");
  for (const texto of cabecalhos) {
    const th = document.createElement("th");
    th.textContent = texto;
    tr.append(th);
  }
  cabeca.append(tr);
  tabela.append(cabeca);
  const corpo = document.createElement("tbody");
  for (const linha of linhas) {
    const tr = document.createElement("tr");
    for (const valor of linha) {
      const td = document.createElement("td");
      if (valor instanceof Node) td.append(valor);
      else td.textContent = valor ?? "—";
      tr.append(td);
    }
    corpo.append(tr);
  }
  tabela.append(corpo);
  return tabela;
}
const numero = (v, casas = 3) =>
  v === null || v === undefined
    ? "—"
    : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: casas });
function acao(texto, funcao) {
  const botao = document.createElement("button");
  botao.textContent = texto;
  botao.onclick = funcao;
  return botao;
}
export function mostrarArquivo(interfaceUsuario) {
  const nome = obter("fonte-jpl").value,
    fonte = interfaceUsuario.arquivoJpl?.fontes?.[nome],
    conteudo = obter("resultado-jpl");
  conteudo.replaceChildren();
  if (!fonte) {
    obter("resumo-jpl").textContent =
      "Não há dados importados para essa fonte. Atualize o arquivo científico pelas ferramentas locais.";
    return;
  }
  const d = fonte.dados || fonte;
  obter("resumo-jpl").textContent =
    "Consulta arquivada · " +
    new Date(fonte.consultado).toLocaleString("pt-BR", { timeZone: "UTC" }) +
    " UTC. Os dados de monitoramento não são atualizados automaticamente.";
  if (nome === "horizons" && Array.isArray(d.amostras)) {
    const linhas = d.amostras.map((a) => {
      const p = posicao(a.planeta, a.jd),
        c =
          p.reduce((s, v, i) => s + v * a.posicao[i], 0) /
          (Math.hypot(...p) * Math.hypot(...a.posicao));
      const angulo = (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
      return [
        planetas[a.planeta].nome,
        formatar(a.jd),
        numero(angulo, 4) + "°",
        numero(Math.hypot(...p.map((v, i) => v - a.posicao[i])) * UA, 0) +
          " km",
        acao("Observar", () => {
          interfaceUsuario.viajar(a.jd);
          interfaceUsuario.selecionar(a.planeta);
          obter("dialogo-dados").close();
        }),
      ];
    });
    conteudo.append(
      tabela(
        ["Planeta", "Data TDB", "Erro angular", "Erro espacial", ""],
        linhas,
      ),
    );
  } else if (
    nome === "cad" &&
    Array.isArray(d.fields) &&
    Array.isArray(d.data)
  ) {
    const dados = d.data.map((l) =>
      Object.fromEntries(d.fields.map((k, i) => [k, l[i]])),
    );
    conteudo.append(
      tabela(
        [
          "Objeto",
          "Aproximação da Terra",
          "Distância",
          "Velocidade relativa",
          "",
        ],
        dados.map((a) => [
          a.des,
          a.cd,
          numero(Number(a.dist) * UA, 0) + " km",
          numero(a.v_rel, 2) + " km/s",
          acao("Ir à data", () => {
            interfaceUsuario.viajar(Number(a.jd));
            obter("dialogo-dados").close();
          }),
        ]),
      ),
    );
  } else if (nome === "sentry" && Array.isArray(d.data)) {
    conteudo.append(
      tabela(
        ["Objeto", "Intervalo", "Probabilidade cumulativa", "Torino máx."],
        d.data.map((a) => [
          a.fullname,
          a.range,
          numero(Number(a.ip) * 100, 8) + "%",
          a.ts_max,
        ]),
      ),
    );
    obter("resumo-jpl").textContent +=
      " Probabilidades acumuladas para os intervalos apresentados; a presença na lista não significa impacto confirmado.";
  } else if (nome === "scout" && Array.isArray(d.data)) {
    conteudo.append(
      tabela(
        ["Candidato", "Observações", "Pontuação NEO", "Atualização"],
        d.data.map((a) => [a.objectName, a.nObs, a.neoScore, a.lastRun]),
      ),
    );
    obter("resumo-jpl").textContent +=
      " Scout acompanha candidatos ainda em avaliação. A pontuação NEO não é probabilidade de impacto.";
  } else if (nome === "sbdb" && d.object && d.orbit) {
    const titulo = document.createElement("h3");
    titulo.textContent = d.object.fullname;
    conteudo.append(titulo);
    const elementos = d.orbit.elements.map((e) => [
      e.title,
      e.value,
      e.units || "",
    ]);
    conteudo.append(
      tabela(["Elemento orbital", "Valor", "Unidade"], elementos),
    );
    conteudo.append(
      acao("Observar " + (d.object.shortname || d.object.fullname), () => {
        try {
          const corpo = interfaceUsuario.universo.adicionarMenor(d);
          interfaceUsuario.camera.focar(corpo);
          obter("dialogo-dados").close();
          interfaceUsuario.avisar(
            "SBDB · propagação kepleriana a partir da época " +
              formatar(Number(d.orbit.epoch)),
          );
        } catch (e) {
          interfaceUsuario.avisar(e.message);
        }
      }),
    );
  } else if (
    nome === "webgeocalc" &&
    Array.isArray(d.columns) &&
    Array.isArray(d.rows)
  ) {
    conteudo.append(
      tabela(
        d.columns.map((c) => c.name),
        d.rows,
      ),
    );
  } else {
    const pre = document.createElement("pre");
    pre.textContent = JSON.stringify(d, null, 2);
    conteudo.append(pre);
  }
}
