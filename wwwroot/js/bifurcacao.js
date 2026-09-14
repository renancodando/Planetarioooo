
import * as T from "../vendor/three.module.js";
import {
  criarEstado,
  copiarEstado,
  relativo,
  norma,
  elementosEstado,
  DIA,
  UA,
  MASSA_SOL,
  grafica,
} from "./fisica.js";
import { aplicarExperimento } from "./experimentos.js";
import { Observacao } from "./observacao.js";
import { Realidades } from "./realidades.js";
import { Vetores } from "./vetores.js";
import { Cone } from "./cone.js";
import { prepararCovariancia } from "./incerteza.js";
import { listarEncontros, nomesCentros } from "./encontros.js";
import { classificarObjeto, explicacaoDefesa } from "./defesa.js";
import {
  serializarExperiencia,
  validarExperiencia,
  salvarExperiencia,
  listarExperiencias,
  baixarArquivo,
} from "./persistencia.js";
import {
  medidas,
  numero,
  lerDiagnosticos,
  botaoLeitura,
} from "./instrumentos.js";
import { lerData, formatar, juliano, visual } from "./astronomia.js";
const $ = (id) => document.getElementById(id);
const normalizar = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export class Bifurcacao {
  constructor(ui) {
    this.ui = ui;
    this.u = ui.universo;
    this.ativa = false;
    this.selecionado = "terra";
    this.catalogo = { corpos: [], encontros: [], vetores: [] };
    this.id = 0;
    this.ultimo = 0;
    this.realidades = new Realidades(this.u);
    this.vetores = new Vetores(this.u);
    this.cone = new Cone(this.u);
    this.causas = new T.Group();
    this.u.cena.add(this.causas);
    this.realidades.mostrarB = true;
  }
  async iniciar() {
    const resposta = await fetch("bifurcacao.html");
    if (!resposta.ok) throw Error("Não foi possível carregar o laboratório.");
    const modelo = document.createElement("template");
    modelo.innerHTML = await resposta.text();
    $("observatorio").append(modelo.content);
    try {
      const r = await fetch("dados/catalogo.json");
      if (r.ok) this.catalogo = await r.json();
    } catch {}
    this.worker = new Worker(
      new URL("./simulacao.worker.js", import.meta.url),
      { type: "module" },
    );
    this.worker.onmessage = ({ data: d }) => this.receber(d);
    this.worker.onerror = () => {
      this.ocupado(false);
      this.mensagem(
        "O cálculo foi interrompido pelo navegador. Reduza a duração e repita.",
      );
    };
    for (const secao of document.querySelectorAll(
      '[data-conteudo="sistema"],[data-conteudo="laboratorio"]',
    )) {
      const b = document.createElement("button");
      b.className = "bif-entrada";
      b.textContent = "⑂ Universo Bifurcado";
      b.onclick = () => this.abrir();
      secao.prepend(b);
    }
    this.observacao = new Observacao(this.ui);
    this.conectar();
    this.ui.bifurcacao = this;
    const renderizar = this.ui.comparador.renderizar.bind(this.ui.comparador);
    this.ui.comparador.renderizar = (camera, jd) => {
      if (this.ativa && this.resultado && !this.visualizandoMonteCarlo)
        this.realidades.renderizar(camera);
      else renderizar(camera, jd);
    };
  }
  mensagem(t) {
    $("bif-mensagem").textContent = t;
    this.ui.avisar(t);
  }
  mostrarPainel(nome) {
    const experimento = $("bif-config"),
      analise = $("bif-analise"),
      botaoExperimento = $("bif-instrumentos"),
      botaoAnalise = $("bif-leituras"),
      botaoCena = $("bif-cena-limpa");
    const abrirExperimento = nome === "experimento";
    const abrirAnalise = nome === "analise";
    experimento.classList.toggle("aberto", abrirExperimento);
    analise.classList.toggle("aberto", abrirAnalise);
    botaoExperimento?.setAttribute("aria-pressed", String(abrirExperimento));
    botaoAnalise?.setAttribute("aria-pressed", String(abrirAnalise));
    botaoCena?.setAttribute(
      "aria-pressed",
      String(!abrirExperimento && !abrirAnalise),
    );
  }
  fecharPaineis() {
    this.mostrarPainel("limpo");
  }
  abrir() {
    this.observacao?.fechar();
    this.ativa = true;
    $("bif-workspace").hidden = false;
    document.body.classList.add("bifurcando");
    this.mostrarPainel("experimento");
    this.ui.tempo.pausado = true;
    this.ui.comparador.modo = "desligado";
    $("comparacao").value = "desligado";
    this.ui.comparador.grupo.visible = false;
    $("divisor").hidden = true;
    this.ui.limpar();
    if (this.resultado) {
      this.realidades.ativos = true;
      this.realidades.linhas.visible = $("bif-rastros").checked;
    }
    this.atualizarInicial();
    this.prepararCatalogo();
  }
  fechar() {
    this.ativa = false;
    $("bif-workspace").hidden = true;
    document.body.classList.remove("bifurcando", "bif-dividido");
    this.realidades.grupoA.visible = false;
    this.realidades.grupoB.visible = false;
    this.realidades.linhas.visible = false;
    this.vetores.grupo.visible = false;
    this.cone.grupo.visible = false;
    this.causas.visible = false;
    this.realidades.objetosA?.forEach((o) => (o.visible = true));
    this.u.menores.forEach((o) => (o.visible = true));
    this.u.satelites.forEach((o) => (o.visible = true));
    this.u.orbitas.visible = $("orbitas").checked;
    this.ui.camera.visao(2);
  }
  atualizarInicial() {
    const adicionais = this.ui.arquivoJpl?.fontes?.sbdb?.dados
      ? [this.ui.arquivoJpl.fontes.sbdb.dados]
      : [];
    this.inicial = criarEstado(this.ui.tempo.jd, this.catalogo, adicionais);
    $("bif-data").value = formatar(this.inicial.jd);
    const select = $("bif-corpo");
    select.replaceChildren();
    this.inicial.corpos
      .slice(1)
      .forEach((c) => select.add(new Option(c.nome, c.id)));
    select.value = this.inicial.corpos.some((c) => c.id === this.selecionado)
      ? this.selecionado
      : "terra";
    this.selecionado = select.value;
    this.atualizarParametros(true);
  }
  parametros() {
    return {
      tipo: $("bif-tipo").value,
      corpo: $("bif-corpo").value,
      valor: Number($("bif-valor").value),
      direcao: $("bif-direcao").value,
      vetor: ["x", "y", "z"].map((k) => Number($("bif-" + k).value)),
      elementos: Object.fromEntries(
        ["a", "e", "i", "om", "w", "ma"].map((k) => [
          k,
          Number($("bif-" + k).value),
        ]),
      ),
      artificial: {
        nome: $("bif-art-nome").value.trim(),
        massa: Number($("bif-art-massa").value),
        raio: Number($("bif-art-raio").value),
        visual: Number($("bif-art-visual").value),
        posicao: ["x", "y", "z"].map((k) => Number($("bif-art-" + k).value)),
        velocidade: ["vx", "vy", "vz"].map((k) =>
          Number($("bif-art-" + k).value),
        ),
      },
    };
  }
  atualizarParametros(elementos = false) {
    if (!this.inicial) return;
    this.selecionado = $("bif-corpo").value;
    const i = this.inicial.corpos.findIndex((c) => c.id === this.selecionado);
    if (i < 1) return;
    const c = this.inicial.corpos[i],
      tipo = $("bif-tipo").value;
    $("bif-fonte").textContent =
      c.fonte +
      (!c.massa && c.massaConhecida === false
        ? " · Massa desconhecida: partícula teste; não perturba outros corpos."
        : "");
    $("bif-direcao-campo").hidden = tipo !== "impulso";
    $("bif-valor-campo").hidden = ![
      "impulso",
      "massa",
      "massa-absoluta",
    ].includes(tipo);
    $("bif-vetor-campo").hidden =
      !["posicao", "velocidade"].includes(tipo) &&
      !(tipo === "impulso" && $("bif-direcao").value === "manual");
    $("bif-elementos").hidden = tipo !== "elementos";
    $("bif-artificial").hidden = tipo !== "artificial";
    $("bif-valor-label").textContent =
      tipo === "massa"
        ? "Massa original · %"
        : tipo === "massa-absoluta"
          ? "Massa hipotética · kg"
          : "Magnitude do impulso · m/s";
    $("bif-vetor-label").textContent =
      tipo === "posicao"
        ? "Deslocamento XYZ · km"
        : tipo === "velocidade"
          ? "Variação de velocidade XYZ · m/s"
          : "Direção XYZ · vetor normalizado";
    const r = relativo(this.inicial.estado, i),
      v = relativo(this.inicial.estado, i, 0, true),
      e = elementosEstado(r, v);
    if (elementos)
      for (const k of ["a", "e", "i", "om", "w", "ma"])
        $("bif-" + k).value = Number.isFinite(e[k]) ? e[k] : "";
    try {
      const alterado = aplicarExperimento(this.inicial, this.parametros()),
        vb = relativo(alterado.estado, i, 0, true),
        rb = relativo(alterado.estado, i);
      medidas("bif-originais", [
        ["Velocidade inicial A", numero((norma(v) * UA) / DIA, 6) + " km/s"],
        [
          "Velocidade inicial B",
          alterado.ativos[i]
            ? numero((norma(vb) * UA) / DIA, 6) + " km/s"
            : "corpo removido",
        ],
        [
          "Δ vetor velocidade",
          numero(((norma(vb.map((x, k) => x - v[k])) * UA) / DIA) * 1000, 6) +
            " m/s",
        ],
        [
          "Δ posição inicial",
          numero(norma(rb.map((x, k) => x - r[k])) * UA, 6) + " km",
        ],
        [
          "Massa A",
          c.massa
            ? Number(c.massa * MASSA_SOL).toExponential(6) + " kg"
            : "desconhecida / teste",
        ],
        [
          "Massa B",
          Number(alterado.massas[i] * MASSA_SOL).toExponential(6) + " kg",
        ],
        ["a original", numero(e.a, 8) + " UA"],
        ["e original", numero(e.e, 9)],
      ]);
      $("bif-criar").disabled = !!this.trabalhando;
    } catch (erro) {
      medidas("bif-originais", [["Parâmetros", erro.message]]);
      $("bif-criar").disabled = true;
    }
    const densidade =
      Number($("bif-art-massa").value) /
      ((4 / 3) * Math.PI * (Number($("bif-art-raio").value) * 1000) ** 3);
    $("bif-densidade").textContent =
      "Densidade: " + numero(densidade, 2) + " kg/m³";
    this.sbdb = c.sbdb;
    try {
      const cov = prepararCovariancia(this.sbdb || {});
      $("bif-covariancia").textContent =
        "Covariância SBDB real · JD " + cov.epoca + " · " + c.nome;
      $("bif-montecarlo").disabled = !!this.trabalhando;
    } catch (erro) {
      $("bif-covariancia").textContent = erro.message;
      $("bif-montecarlo").disabled = true;
    }
    $("bif-classe").textContent = this.sbdb
      ? classificarObjeto(this.sbdb).join(" · ")
      : "Selecione um corpo menor para consultar sua classificação.";
  }
  ocupado(valor) {
    this.trabalhando = valor;
    $("bif-andamento").hidden = !valor;
    $("bif-criar").disabled = valor;
    $("bif-montecarlo").disabled = valor || !this.sbdb?.orbit?.covariance;
    if (valor) $("bif-progresso").value = 0;
  }
  carregarParametros(d) {
    this.inicial = copiarEstado(d.inicial);
    const p = d.experimento,
      campo = $("bif-corpo");
    campo.replaceChildren();
    this.inicial.corpos
      .slice(1)
      .forEach((c) => campo.add(new Option(c.nome, c.id)));
    campo.value = p.corpo;
    $("bif-data").value = formatar(this.inicial.jd);
    $("bif-tipo").value = p.tipo;
    $("bif-valor").value = p.valor ?? 0;
    $("bif-direcao").value = p.direcao || "prograde";
    $("bif-duracao").value = d.configuracao.dias / 365.25;
    $("bif-passo").value = d.configuracao.passo;
    this.atualizarParametros(true);
    if (p.vetor)
      ["x", "y", "z"].forEach((k, i) => ($("bif-" + k).value = p.vetor[i]));
    if (p.elementos)
      for (const k of ["a", "e", "i", "om", "w", "ma"])
        $("bif-" + k).value = p.elementos[k];
    if (p.artificial) {
      for (const k of ["nome", "massa", "raio", "visual"])
        $("bif-art-" + k).value = p.artificial[k];
      ["x", "y", "z"].forEach(
        (k, i) => ($("bif-art-" + k).value = p.artificial.posicao[i]),
      );
      ["vx", "vy", "vz"].forEach(
        (k, i) => ($("bif-art-" + k).value = p.artificial.velocidade[i]),
      );
    }
    this.atualizarParametros();
  }
  criar(importada = null) {
    try {
      if (importada) this.carregarParametros(importada);
      const dias = importada
        ? Number(importada.configuracao.dias)
        : Number($("bif-duracao").value) * 365.25;
      if (!Number.isFinite(dias) || dias <= 0 || dias > 365250)
        throw Error("Duração entre uma fração positiva de ano e 1.000 anos.");
      this.experimento = importada?.experimento || this.parametros();
      this.inicialExperimento = copiarEstado(
        importada?.inicial || this.inicial,
      );
      aplicarExperimento(this.inicialExperimento, this.experimento);
      this.configuracao = importada?.configuracao || {
        dias,
        passo: Number($("bif-passo").value),
        amostras: this.ui.desempenho.efetivo === "baixa" ? 720 : 1500,
      };
      this.ui.tempo.pausado = true;
      this.worker.postMessage({
        tipo: "simular",
        id: ++this.id,
        inicial: this.inicialExperimento,
        experimento: this.experimento,
        ...this.configuracao,
      });
      this.ocupado(true);
      $("bif-status").textContent = "Integrando A e B com o mesmo passo…";
    } catch (erro) {
      this.mensagem(erro.message);
    }
  }
  receber(d) {
    if (d.id !== this.id) return;
    if (d.tipo === "estado") {
      this.pedidoEstado = false;
      this.realidades.estadoExato = d;
      return;
    }
    if (d.tipo === "erro-estado") {
      this.pedidoEstado = false;
      this.ui.tempo.pausado = true;
      this.mensagem(d.mensagem);
      return;
    }
    if (d.tipo === "progresso" || d.tipo === "progresso-montecarlo") {
      $("bif-progresso").value = d.fracao;
      $("bif-status").textContent =
        (d.tipo === "progresso"
          ? "Integração A/B · "
          : "Amostragem correlacionada · ") +
        numero(d.fracao * 100, 1) +
        "%";
      return;
    }
    this.ocupado(false);
    if (d.tipo === "erro") {
      this.mensagem(d.mensagem);
      return;
    }
    if (d.tipo === "montecarlo") {
      this.montecarlo = d;
      this.percentilAnterior = null;
      this.visualizarIncerteza();
      this.cone.definir(d, Number($("bif-ganho-cone").value));
      this.cone.grupo.visible = $("bif-cone").checked;
      this.ui.tempo.jd = d.series[0].jd;
      this.ui.tempo.pausado = false;
      this.ui.tempo.destino = null;
      this.ui.tempo.direcao = 1;
      this.ui.tempo.velocidade = 365.25;
      $("velocidade").value = "365.25";
      $("bif-scrub").disabled = false;
      this.atualizarPercentis();
      this.mensagem(
        numero(d.quantidade, 0) +
          " amostras correlacionadas calculadas; propagação de dois corpos.",
      );
      return;
    }
    this.resultado = d;
    this.experienciaConcluida = serializarExperiencia(
      this.inicialExperimento,
      this.experimento,
      this.configuracao,
    );
    this.visualizandoMonteCarlo = false;
    $("bif-focar").disabled = false;
    this.pedidoEstado = false;
    this.realidades.preparar(d);
    this.ui.tempo.destino = null;
    this.ui.tempo.jd = d.inicio;
    this.ui.tempo.velocidade = 365.25;
    $("velocidade").value = "365.25";
    this.ui.tempo.direcao = 1;
    this.ui.tempo.pausado = false;
    this.ui.camera.visao(2);
    $("bif-scrub").disabled = false;
    this.atualizarModo();
    this.atualizarTrajetorias();
    this.atualizarEventos();
    this.realidades.atualizar(d.inicio);
    document.body.classList.add("bif-revelacao");
    setTimeout(() => document.body.classList.remove("bif-revelacao"), 1600);
    this.mostrarPainel("analise");
    this.mensagem(
      d.interrompido ||
        "Bifurcação calculada. A e B começam no mesmo instante; use o relógio para percorrer a divergência.",
    );
  }
  visualizarIncerteza() {
    this.visualizandoMonteCarlo = true;
    this.pedidoEstado = false;
    document.body.classList.remove("bif-dividido");
    this.realidades.grupoA.visible = false;
    this.realidades.grupoB.visible = false;
    this.realidades.linhas.visible = false;
    this.realidades.objetosA?.forEach((o) => (o.visible = true));
    this.u.satelites.forEach((o) => (o.visible = true));
    this.u.menores.forEach((o) => (o.visible = true));
    this.u.orbitas.visible = $("orbitas").checked;
    this.vetores.grupo.visible = false;
    this.causas.visible = false;
    this.ui.camera.visao(2);
    $("bif-focar").disabled = true;
  }
  atualizarModo() {
    this.visualizandoMonteCarlo = false;
    $("bif-focar").disabled = !this.resultado;
    this.realidades.grupoA.visible = !!this.resultado;
    this.realidades.modo = $("bif-modo").value;
    this.realidades.ganho = Number($("bif-ganho").value);
    this.realidades.mistura = Number($("bif-morph").value);
    $("bif-morph-campo").hidden = this.realidades.modo !== "morph";
    const dividido = ["vertical", "horizontal", "lado"].includes(
      this.realidades.modo,
    );
    document.body.classList.toggle("bif-dividido", dividido);
    if (dividido) this.ui.camera.visao(2);
  }
  atualizarTrajetorias() {
    if (!this.resultado) return;
    const i = this.resultado.corposA.findIndex(
      (c) => c.id === this.selecionado,
    );
    if (i > 0) this.realidades.trajetorias(i);
    this.realidades.linhas.visible = $("bif-rastros").checked;
  }
  atualizarEventos() {
    const alvo = $("bif-eventos");
    alvo.replaceChildren();
    if (!this.resultado?.eventos.length) {
      alvo.textContent = "Nenhum limiar registrado nesta simulação.";
      return;
    }
    for (const e of this.resultado.eventos)
      alvo.append(
        botaoLeitura(formatar(e.jd) + " · " + e.tipo, e.texto, () => {
          this.ui.tempo.jd = e.jd;
          this.ui.tempo.pausado = true;
          this.realidades.atualizar(e.jd);
          this.focar(e.corpo);
          this.mensagem(e.texto);
        }),
      );
  }
  focar(indice) {
    if (!this.resultado) return;
    const i =
      indice ??
      (this.experienciaConcluida?.experimento.tipo === "artificial"
        ? this.resultado.corposB.length - 1
        : this.resultado.corposB.findIndex((c) => c.id === this.selecionado));
    const objeto = this.realidades.corposB[i];
    if (objeto) this.ui.camera.focar(objeto);
  }
  atualizar(segundos) {
    this.observacao?.atualizar();
    if (!this.ativa) return;
    if (this.resultado && !this.visualizandoMonteCarlo) {
      const t = this.ui.tempo,
        r = this.resultado,
        min = r.tempos[0],
        max = r.tempos.at(-1);
      if (t.jd < min || t.jd > max) {
        t.jd = Math.max(min, Math.min(max, t.jd));
        t.pausado = true;
        t.destino = null;
      }
      if (
        !this.trabalhando &&
        !this.pedidoEstado &&
        Math.abs((this.realidades.estadoExato?.jd ?? -1) - t.jd) > 1e-8 &&
        segundos - (this.ultimoEstado || 0) > 0.03
      ) {
        this.pedidoEstado = true;
        this.ultimoEstado = segundos;
        this.worker.postMessage({ tipo: "estado", id: this.id, jd: t.jd });
      }
      this.realidades.atualizar(t.jd);
      $("bif-scrub").value = (t.jd - min) / (max - min || 1);
      if (segundos - this.ultimo > 0.3) {
        this.ultimo = segundos;
        const { indice } = lerDiagnosticos(this);
        this.vetores.grupo.visible =
          $("bif-vetores").checked || this.realidades.modo === "vetorial";
        if (this.vetores.grupo.visible)
          this.vetores.atualizar(this.realidades, indice);
        this.atualizarCausas();
      }
      this.realidades.grupoB.visible =
        this.realidades.modo !== "morph" && $("bif-camada-b").checked;
    }
    if (this.montecarlo) {
      if (this.visualizandoMonteCarlo) {
        const t = this.ui.tempo,
          min = this.montecarlo.series[0].jd,
          max = this.montecarlo.series.at(-1).jd;
        if (t.jd < min || t.jd > max) {
          t.jd = Math.max(min, Math.min(max, t.jd));
          t.pausado = true;
          t.destino = null;
        }
        $("bif-scrub").value = (t.jd - min) / (max - min);
        $("bif-relogio-texto").textContent =
          formatar(t.jd) +
          " · " +
          numero(this.montecarlo.quantidade, 0) +
          " futuros amostrados";
        $("bif-confianca").textContent =
          "MONTE CARLO · covariância SBDB · propagação de dois corpos; A/B suspenso";
      }
      this.cone.grupo.visible =
        this.visualizandoMonteCarlo &&
        $("bif-cone").checked &&
        $("bif-leitura").value === "incerteza";
      this.cone.atualizar(this.ui.tempo.jd);
      this.atualizarPercentis();
    }
  }
    // aqui uma pequena escolha começa a separar duas histórias
  atualizarCausas() {
    this.causas.visible = $("bif-linhas-causais").checked;
    if (!this.causas.visible) return;
    const pontos = [];
    for (const l of (this.linhasDiagnostico || [])
      .filter(
        (l) => l.distancia >= 0.001 && l.causa >= 0 && l.causa !== l.indice,
      )
      .sort((a, b) => b.distancia - a.distancia)
      .slice(0, 6)) {
      const a = this.realidades.posicoesB[l.causa],
        b = this.realidades.posicoesB[l.indice];
      if (a && b) pontos.push(...a, ...b);
    }
    if (!this.causaLinha) {
      const g = new T.BufferGeometry();
      g.setAttribute(
        "position",
        new T.BufferAttribute(new Float32Array(36), 3),
      );
      this.causaLinha = new T.LineSegments(
        g,
        new T.LineBasicMaterial({
          color: 0xc9b484,
          transparent: true,
          opacity: 0.5,
        }),
      );
      this.causas.add(this.causaLinha);
    }
    const a = this.causaLinha.geometry.attributes.position;
    a.array.fill(0);
    a.array.set(pontos);
    a.needsUpdate = true;
    this.causaLinha.geometry.setDrawRange(0, pontos.length / 3);
  }
  atualizarPercentis() {
    if (!this.montecarlo) return;
    const d = this.montecarlo,
      jd = this.ui.tempo.jd,
      k = Math.min(
        d.series.length - 1,
        Math.max(
          0,
          Math.round(
            ((jd - d.series[0].jd) / (d.series.at(-1).jd - d.series[0].jd)) *
              (d.series.length - 1),
          ),
        ),
      ),
      serie = d.series[k],
      metrica = $("bif-metrica").value,
      v = serie[metrica];
    if (this.percentilAnterior === k + metrica) return;
    this.percentilAnterior = k + metrica;
    medidas("bif-percentis", [
      ["Instante", formatar(serie.jd)],
      ["Percentil 5", numero(v[0], 6)],
      ["Percentil 50", numero(v[1], 6)],
      ["Percentil 95", numero(v[2], 6)],
      ["Amostras efetivas", numero(d.quantidade, 0)],
      ["Trajetórias desenhadas", numero(d.visiveis, 0)],
      [
        "Parâmetros não propagados",
        d.omitidos.join(", ") || "nenhum adicional",
      ],
    ]);
  }
  prepararCatalogo() {
    this.encontros = listarEncontros(this.catalogo);
    $("bif-defesa-nota").textContent = explicacaoDefesa;
    this.filtrarEncontros();
  }
  filtrarEncontros() {
    const filtro = $("bif-centro-encontro").value,
      busca = normalizar($("bif-busca-encontro").value),
      alvo = $("bif-encontros");
    alvo.replaceChildren();
    const encontrados = (this.encontros || []).filter(
      (e) =>
        (filtro === "todos" || e.centro === filtro) &&
        normalizar((e.nome || "") + " " + e.des).includes(busca),
    );
    for (const e of encontrados.slice(0, 80))
      alvo.append(
        botaoLeitura(
          (e.nome || e.des) + " · " + formatar(e.jd),
          (nomesCentros[e.centro] || e.centro) +
            " · " +
            numero(Number(e.dist) * UA, 0) +
            " km · " +
            numero(Number(e.v_rel), 3) +
            " km/s · " +
            (e.diameter
              ? "diâmetro " + e.diameter + " km"
              : "diâmetro não disponível") +
            " · Ir para o encontro",
          () => this.irEncontro(e),
        ),
      );
    if (!encontrados.length)
      alvo.textContent =
        "Nenhum encontro nesse recorte do arquivo. Importe um catálogo atualizado.";
  }
  irEncontro(e) {
    this.fechar();
    if (
      e.des === "99942" &&
      e.centro === "Earth" &&
      formatar(e.jd).endsWith("2029")
    ) {
      this.observacao.abrir(e.jd).catch((erro) => this.mensagem(erro.message));
      return;
    }
    this.ui.tempo.viajar(e.jd, this.ui.adaptativo.reduzido());
    const indices = {
      Earth: 2,
      Moon: 2,
      Mars: 3,
      Juptr: 4,
      Venus: 1,
      Satrn: 5,
    };
    this.ui.selecionar(indices[e.centro] ?? 2);
    this.ui.avisar(
      (e.nome || e.des) +
        " · distância nominal CAD " +
        numero(Number(e.dist) * UA, 0) +
        " km · limites " +
        numero(Number(e.dist_min) * UA, 0) +
        " a " +
        numero(Number(e.dist_max) * UA, 0) +
        " km. A câmera mostra o corpo central; a órbita kepleriana do objeto não reproduz este encontro oficial.",
    );
  }
  experiencia() {
    if (!this.experienciaConcluida)
      throw Error("Conclua uma bifurcação antes de salvar.");
    return structuredClone(this.experienciaConcluida);
  }
  relatorio() {
    const e = this.experiencia(),
      r = this.resultado;
    return [
      "PLANETÁRIO TEMPORAL · UNIVERSO BIFURCADO",
      "SIMULAÇÃO HIPOTÉTICA; NÃO É PREVISÃO OFICIAL",
      "Data inicial: " + formatar(e.inicial.jd),
      "Referencial físico: baricêntrico inercial, eclíptica J2000; AU, dias, massas solares.",
      "Comparações: posições relativas ao Sol.",
      "Integrador: Velocity Verlet; passo comum A/B reduzido em encontros; adaptação perde a propriedade simplética estrita.",
      "Fontes iniciais: " +
        e.inicial.corpos.map((c) => c.nome + ": " + c.fonte).join("; "),
      "Experimento: " + JSON.stringify(e.experimento),
      "Configuração: " + JSON.stringify(e.configuracao),
      "Sem relatividade, marés, pressão de radiação ou modelos de impacto. Massa desconhecida = partícula teste.",
      "Corpos: " + JSON.stringify(e.inicial.corpos),
      "Passos: " + (r?.passos || 0),
      "Maior erro relativo de energia: " +
        (r ? Math.max(...r.erros.filter((_, i) => i % 4 < 2)) : ""),
      "Eventos amostrados: " + JSON.stringify(r?.eventos || []),
      "Diagnóstico atual: " + JSON.stringify(this.linhasDiagnostico || []),
      "Monte Carlo: " +
        (this.montecarlo
          ? "covariância SBDB marginal 6D; propagação kepleriana; percentis da amostra; sem probabilidade de impacto."
          : "não executado"),
    ].join("\n\n");
  }
  reiniciarResultado() {
    this.worker.postMessage({ tipo: "cancelar" });
    this.id++;
    this.pedidoEstado = false;
    this.ocupado(false);
    this.resultado = null;
    this.experienciaConcluida = null;
    this.realidades.limpar();
    this.visualizandoMonteCarlo = false;
    this.montecarlo = null;
    this.cone.limpar();
    this.vetores.grupo.visible = false;
    this.causas.visible = false;
    $("bif-focar").disabled = true;
    $("bif-scrub").disabled = true;
    this.ui.camera.visao(2);
  }
  conectar() {
    this.tecla = (e) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) {
        if (this.ativa) {
          const painelAberto =
            $("bif-config").classList.contains("aberto") ||
            $("bif-analise").classList.contains("aberto");
          if (painelAberto) this.fecharPaineis();
          else this.fechar();
        } else this.observacao?.fechar();
      }
    };
    document.addEventListener("keydown", this.tecla);
    $("bif-voltar").onclick = () => this.fechar();
    $("bif-instrumentos").onclick = () => {
      const aberto = $("bif-config").classList.contains("aberto");
      this.mostrarPainel(aberto ? "limpo" : "experimento");
      if (!aberto) {
        $("bif-config").scrollTop = 0;
        $("bif-corpo").focus();
      }
    };
    $("bif-leituras").onclick = () => {
      const aberto = $("bif-analise").classList.contains("aberto");
      this.mostrarPainel(aberto ? "limpo" : "analise");
      if (!aberto) {
        $("bif-analise").scrollTop = 0;
        $("bif-leitura").focus();
      }
    };
    $("bif-cena-limpa").onclick = () => this.fecharPaineis();
    $("bif-fechar-experimento").onclick = () => this.fecharPaineis();
    $("bif-fechar-analise").onclick = () => this.fecharPaineis();
    $("bif-instante").onclick = () => {
      try {
        this.ui.tempo.jd = lerData($("bif-data").value);
        this.ui.tempo.destino = null;
        this.ui.tempo.pausado = true;
        this.reiniciarResultado();
        this.atualizarInicial();
      } catch (e) {
        this.mensagem(e.message);
      }
    };
    $("bif-epoca-jpl").onclick = () => {
      const v = this.catalogo.vetores?.[0];
      if (!v) {
        this.mensagem(
          "Não há vetores Horizons no arquivo. Importe um catálogo.",
        );
        return;
      }
      this.reiniciarResultado();
      this.ui.tempo.jd = v.jd;
      this.ui.tempo.destino = null;
      this.ui.tempo.pausado = true;
      this.atualizarInicial();
      this.mensagem(
        "Estados iniciais na época exata do arquivo Horizons. TDB tratado aproximadamente como UTC.",
      );
    };
    $("bif-corpo").onchange = () => {
      this.atualizarParametros(true);
      this.atualizarTrajetorias();
    };
    $("bif-tipo").onchange = () => {
      const t = $("bif-tipo").value;
      $("bif-valor").value =
        t === "massa" ? 110 : t === "massa-absoluta" ? 1e10 : 2;
      this.atualizarParametros();
    };
    for (const id of [
      "bif-direcao",
      "bif-valor",
      "bif-x",
      "bif-y",
      "bif-z",
      "bif-a",
      "bif-e",
      "bif-i",
      "bif-om",
      "bif-w",
      "bif-ma",
      "bif-art-massa",
      "bif-art-raio",
      "bif-art-visual",
      "bif-art-x",
      "bif-art-y",
      "bif-art-z",
      "bif-art-vx",
      "bif-art-vy",
      "bif-art-vz",
      "bif-art-nome",
    ])
      $(id).oninput = () => this.atualizarParametros();
    $("bif-criar").onclick = () => this.criar();
    $("bif-cancelar").onclick = () => {
      this.worker.postMessage({ tipo: "cancelar" });
      this.id++;
      this.pedidoEstado = false;
      this.ocupado(false);
      this.mensagem(
        "Cálculo interrompido. A experiência anterior foi preservada.",
      );
    };
    for (const id of ["bif-modo", "bif-morph", "bif-ganho"])
      $(id).oninput = () => this.atualizarModo();
    $("bif-rastros").onchange = () => this.atualizarTrajetorias();
    $("bif-camada-b").onchange = () =>
      (this.realidades.mostrarB = $("bif-camada-b").checked);
    $("bif-focar").onclick = () => this.focar();
    $("bif-geral").onclick = () => this.ui.camera.visao(2);
    $("bif-scrub").oninput = () => {
      if (this.visualizandoMonteCarlo && this.montecarlo) {
        this.ui.tempo.pausado = true;
        this.ui.tempo.destino = null;
        const series = this.montecarlo.series;
        this.ui.tempo.jd =
          series[0].jd +
          Number($("bif-scrub").value) * (series.at(-1).jd - series[0].jd);
      } else if (this.resultado) {
        this.ui.tempo.pausado = true;
        this.ui.tempo.destino = null;
        this.ui.tempo.jd =
          this.resultado.inicio +
          Number($("bif-scrub").value) *
            (this.resultado.tempos.at(-1) - this.resultado.inicio);
      }
    };
      // em nenhum universo sou escolhido, mas em todos os universos, a bifurcação é a mesma
    $("bif-leitura").onchange = () => {
      if ($("bif-leitura").value === "incerteza" && this.montecarlo)
        this.visualizarIncerteza();
      else if (this.visualizandoMonteCarlo && this.resultado)
        this.atualizarModo();
      document
        .querySelectorAll("[data-bif-leitura]")
        .forEach(
          (e) => (e.hidden = e.dataset.bifLeitura !== $("bif-leitura").value),
        );
    };
    $("bif-montecarlo").onclick = () => {
      try {
        prepararCovariancia(this.sbdb);
        const escolhido = $("bif-amostras").value,
          quantidade =
            escolhido === "auto"
              ? this.ui.desempenho.efetivo === "baixa"
                ? 100
                : this.ui.desempenho.efetivo === "media"
                  ? 400
                  : 1000
              : Number(escolhido);
        this.worker.postMessage({
          tipo: "montecarlo",
          id: ++this.id,
          sbdb: this.sbdb,
          quantidade,
          dias: Number($("bif-duracao").value) * 365.25,
          jd: this.inicial.jd,
          seed: Number($("bif-seed").value),
          visiveis: this.ui.desempenho.efetivo === "baixa" ? 40 : 180,
        });
        this.ocupado(true);
        $("bif-status").textContent = "Amostrando a covariância orbital…";
      } catch (e) {
        this.mensagem(e.message);
      }
    };
    $("bif-ganho-cone").onchange = () => {
      if (this.montecarlo)
        this.cone.definir(this.montecarlo, Number($("bif-ganho-cone").value));
    };
    $("bif-metrica").onchange = () => {
      this.percentilAnterior = null;
      this.atualizarPercentis();
    };
    $("bif-centro-encontro").onchange = () => this.filtrarEncontros();
    $("bif-busca-encontro").oninput = () => this.filtrarEncontros();
    for (const nome of ["sentry", "scout"])
      $("bif-" + nome).onclick = () => {
        $("dialogo-dados").showModal();
        $("fonte-jpl").value = nome;
        $("fonte-jpl").dispatchEvent(new Event("change"));
      };
    $("bif-png").onclick = () => this.ui.capturar();
    $("bif-exportar").onclick = () => {
      try {
        baixarArquivo(
          "Bifurcacao-Temporal.json",
          JSON.stringify(this.experiencia(), null, 2),
        );
      } catch (e) {
        this.mensagem(e.message);
      }
    };
    $("bif-relatorio").onclick = () => {
      try {
        baixarArquivo(
          "Relatorio-Bifurcacao.txt",
          this.relatorio(),
          "text/plain;charset=utf-8",
        );
      } catch (e) {
        this.mensagem(e.message);
      }
    };
    $("bif-salvar").onclick = async () => {
      try {
        const e = this.experiencia();
        await salvarExperiencia(
          e,
          formatar(e.inicial.jd) +
            " · " +
            e.experimento.corpo +
            " · " +
            e.experimento.tipo,
        );
        this.mensagem("Experiência salva neste navegador.");
      } catch (e) {
        this.mensagem(e.message);
      }
    };
    $("bif-listar").onclick = async () => {
      try {
        const itens = await listarExperiencias();
        $("bif-salvos").replaceChildren();
        for (const item of itens)
          $("bif-salvos").append(
            botaoLeitura(item.nome, "Recalcular a experiência salva", () => {
              try {
                this.criar(validarExperiencia(item.experiencia));
              } catch (e) {
                this.mensagem(e.message);
              }
            }),
          );
        if (!itens.length)
          $("bif-salvos").textContent =
            "Nenhuma experiência salva neste navegador.";
      } catch (e) {
        this.mensagem(e.message);
      }
    };
    $("bif-importar").onchange = async (e) => {
      try {
        const f = e.target.files[0];
        if (!f) return;
        if (f.size > 2e6) throw Error("Arquivo limitado a 2 MB.");
        this.criar(validarExperiencia(JSON.parse(await f.text())));
      } catch (erro) {
        this.mensagem(erro.message);
      } finally {
        e.target.value = "";
      }
    };
    $("bif-importar-catalogo").onchange = async (e) => {
      try {
        const f = e.target.files[0];
        if (!f) return;
        if (f.size > 8e6) throw Error("Catálogo limitado a 8 MB.");
        const d = JSON.parse(await f.text());
        if (d.object && d.orbit) {
          this.catalogo.corpos.push({
            dados: d,
            consultado: new Date().toISOString(),
            fonte: "Importação local SBDB",
          });
        } else if (Array.isArray(d.corpos) && Array.isArray(d.vetores)) {
          this.catalogo = d;
        } else
          throw Error(
            "Importe uma resposta SBDB ou um catálogo exportado pelo atualizador.",
          );
        this.atualizarInicial();
        this.prepararCatalogo();
        this.mensagem(
          "Catálogo importado. Estados não suportados permanecem fora da integração.",
        );
      } catch (erro) {
        this.mensagem(erro.message);
      } finally {
        e.target.value = "";
      }
    };
  }
  comando(s) {
    let m;
    s = normalizar(s);
    if (s === "criar bifurcacao") {
      this.abrir();
      return true;
    }
    if (s === "comparar realidades") {
      this.abrir();
      $("bif-modo").value = "sobreposicao";
      this.atualizarModo();
      return true;
    }
    if (s === "centralizar sol") {
      this.ui.camera.visao(2);
      return true;
    }
    if (s === "mostrar causalidade" || s === "mostrar cone de futuros") {
      if (!this.ativa) this.abrir();
      $("bif-leitura").value = s.includes("causalidade")
        ? "causalidade"
        : "incerteza";
      $("bif-leitura").dispatchEvent(new Event("change"));
      this.mostrarPainel("analise");
      return true;
    }
    if ((m = s.match(/^avancar (\d+(?:[.,]\d+)?) anos?$/))) {
      const anos = Number(m[1].replace(",", "."));
      if (this.ativa) {
        $("bif-duracao").value = anos;
        this.criar();
      } else this.ui.viajar(this.ui.tempo.jd + anos * 365.25);
      return true;
    }
    if (
      (m = s.match(
        /^aplicar ([\d.,]+) m\/s (prograde|retrograde|normal|antinormal|radial|antirradial) em (.+)$/,
      ))
    ) {
      if (!this.ativa) this.abrir();
      const c = this.inicial.corpos.find(
        (c) => normalizar(c.nome).includes(m[3]) || c.id === m[3],
      );
      if (!c) throw Error("Corpo não encontrado no catálogo.");
      $("bif-corpo").value = c.id;
      $("bif-tipo").value = "impulso";
      $("bif-valor").value = m[1].replace(",", ".");
      $("bif-direcao").value = m[2];
      this.atualizarParametros(true);
      this.criar();
      return true;
    }
    if ((m = s.match(/^monte carlo (100|1000|10000)$/))) {
      if (!this.ativa) this.abrir();
      $("bif-amostras").value = m[1];
      $("bif-leitura").value = "incerteza";
      $("bif-leitura").dispatchEvent(new Event("change"));
      if ($("bif-montecarlo").disabled)
        throw Error(
          "Selecione Apophis ou outro corpo com covariância SBDB disponível.",
        );
      $("bif-montecarlo").click();
      return true;
    }
    if (s === "ir para aproximacao de apophis em 2029") {
      const e = listarEncontros(this.catalogo).find(
        (e) =>
          e.des === "99942" &&
          formatar(e.jd).endsWith("2029") &&
          e.centro === "Earth",
      );
      if (!e) throw Error("Esse encontro não está no catálogo.");
      this.irEncontro(e);
      return true;
    }
    if ((m = s.match(/^mostrar (.+)$/))) {
      const registro = this.catalogo.corpos.find((c) =>
        normalizar(c.dados.object.fullname).includes(m[1]),
      );
      if (registro) {
        this.u.adicionarMenor(registro.dados);
        const o = this.u.menores.at(-1);
        this.ui.camera.focar(o);
        this.mensagem(
          registro.dados.object.fullname + " · propagação local SBDB",
        );
        return true;
      }
    }
    return false;
  }
  destruir() {
    document.removeEventListener("keydown", this.tecla);
    this.worker?.terminate();
    this.observacao?.destruir();
    this.realidades.destruir();
    this.vetores.destruir();
    this.cone.destruir();
    this.causas.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    this.causas.removeFromParent();
  }
}
