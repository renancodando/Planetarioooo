import { mostrarArquivo } from "./dados.js";
import * as T from "../vendor/three.module.js";
import {
  planetas,
  posicao,
  visual,
  velocidade,
  distancia,
  lerData,
  formatar,
  juliano,
  dataJuliana,
  posicaoMenor,
} from "./astronomia.js";
const $ = (id) => document.getElementById(id),
  normalizar = (s) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
export class Interface {
  constructor(aplicativo) {
    Object.assign(this, aplicativo);
    this.selecionado = 5;
    this.rotulos = [];
    this.ultimoPainel = 0;
    this.rastro = "0";
    this.relogio = false;
    this.pontosSessao = [];
    this.ultimoRastro = 0;
    this.sequencia = 0;
    this.solicitacoes = new Map();
    this.worker = new Worker(new URL("./calculos.worker.js", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = ({ data: d }) => {
      const nome = this.solicitacoes.get(d.id);
      if (!nome) return;
      this.solicitacoes.delete(d.id);
      if (this.ultimosPedidos?.[nome] !== d.id) return;
      const grupo = this.universo.linha(
        nome,
        d.pontos,
        nome === "retrogrado" ? 0x91b7bd : 0xcfb77e,
        d.tipo === "assinatura",
        d.tipo === "assinatura" ? 0.2 : 0.52,
      );
      if (d.geocentrico || nome === "retrogrado") this.universo.cena.add(grupo);
    };
    this.worker.onerror = () =>
      this.avisar("O cálculo de trajetórias não pôde ser concluído.");
    this.preparar();
    this.conectar();
  }
  avisar(texto) {
    $("aviso").textContent = texto;
    $("aviso").classList.add("visivel");
    clearTimeout(this.avisoTimer);
    this.avisoTimer = setTimeout(
      () => $("aviso").classList.remove("visivel"),
      5500,
    );
  }
  preparar() {
    for (const p of planetas) {
      const botao = document.createElement("button");
      botao.className = "planeta-linha";
      botao.innerHTML = `<span class="amostra" style="background:${p.cor}"></span>${p.nome}<small>${["☿", "♀", "⊕", "♂", "♃", "♄", "♅", "♆"][p.indice]}</small>`;
      botao.onclick = () => this.selecionar(p.indice);
      $("lista-planetas").append(botao);
      for (const id of ["corpo-a", "corpo-b"]) {
        $(id).add(new Option(p.nome, String(p.indice)));
      }
      const rotulo = document.createElement("span");
      rotulo.className = "rotulo";
      rotulo.textContent = p.nome;
      $("rotulos").append(rotulo);
      this.rotulos.push(rotulo);
    }
    const lua = document.createElement("button");
    lua.className = "planeta-linha";
    lua.textContent = "☾  Lua";
    lua.onclick = () => this.selecionarLua();
    $("lista-planetas").append(lua);
    $("corpo-a").value = "2";
    $("corpo-b").value = "1";
    this.selecionar(5, false);
    fetch("dados/jpl.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        this.arquivoJpl = d;
        if (d?.fontes?.sbdb?.dados)
          this.universo.adicionarMenor(d.fontes.sbdb.dados);
      })
      .catch(() => {});
  }
  selecionar(indice, focar = true) {
    this.selecionado = indice;
    const p = planetas[indice];
    $("nome-planeta").textContent = p.nome;
    $("icone-planeta").textContent = ["☿", "♀", "⊕", "♂", "♃", "♄", "♅", "♆"][
      indice
    ];
    document
      .querySelectorAll(".planeta-linha")
      .forEach((e, i) => e.classList.toggle("selecionado", i === indice));
    if (focar) {
      this.camera.focar(this.universo.corpos[indice]);
      $("camera-modo").value = "orbital";
      if (innerWidth < 700) {
        $("painel-esquerdo").classList.remove("aberto");
      }
    }
    this.pontosSessao = [];
    this.ultimoRastro = 0;
    this.atualizarPainel();
  }
  selecionarLua() {
    this.camera.focar(this.universo.satelites[0]);
    this.avisar("Lua · órbita ilustrativa de 27,32 dias em torno da Terra.");
    $("painel-esquerdo").classList.remove("aberto");
  }
  viajar(texto) {
    try {
      this.tempo.viajar(
        typeof texto === "number" ? texto : lerData(texto),
        this.adaptativo.reduzido(),
      );
      this.ultimoRastro = 0;
      this.pontosSessao = [];
    } catch (e) {
      this.avisar(e.message);
      $("data").value = formatar(this.tempo.jd);
    }
  }
  calcular(nome, parametros) {
    if ([...this.solicitacoes.values()].includes(nome)) return;
    this.sequencia++;
    this.ultimosPedidos ??= {};
    this.ultimosPedidos[nome] = this.sequencia;
    this.solicitacoes.set(this.sequencia, nome);
    this.worker.postMessage({
      id: this.sequencia,
      jd: this.tempo.jd,
      escala: this.universo.escala,
      ...parametros,
    });
  }
  conectar() {
    const u = this.universo,
      t = this.tempo,
      c = this.comparador;
    document.querySelectorAll("[data-aba]").forEach(
      (b) =>
        (b.onclick = () => {
          document
            .querySelectorAll("[data-aba]")
            .forEach((x) => x.classList.toggle("ativo", x === b));
          document
            .querySelectorAll("[data-conteudo]")
            .forEach((x) => (x.hidden = x.dataset.conteudo !== b.dataset.aba));
        }),
    );
    $("data").oninput = (e) => {
      this.rascunhoData = e.currentTarget.value;
    };
    $("data").onchange = () => {
      const valor = this.rascunhoData ?? $("data").value;
      this.rascunhoData = null;
      this.viajar(valor);
    };
    $("data").onblur = () => {
      if (this.rascunhoData !== null && this.rascunhoData !== undefined)
        $("data").onchange();
    };
    $("data").onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        $("data").onchange();
        $("data").blur();
      }
    };
    $("agora").onclick = () => this.viajar(juliano(new Date()));
    $("play").onclick = () => {
      t.destino = null;
      t.pausado = !t.pausado;
    };
    $("reverter").onclick = () => {
      t.direcao *= -1;
      $("reverter").setAttribute("aria-pressed", t.direcao < 0);
    };
    $("passo-atras").onclick = () => this.viajar(t.jd - 1);
    $("passo-frente").onclick = () => this.viajar(t.jd + 1);
    $("velocidade").onchange = () => {
      t.velocidade = Number($("velocidade").value);
      if (t.velocidade >= 36525 && !this.adaptativo.reduzido())
        this.camera.visao(2);
    };
    $("timeline").oninput = () => {
      const ano = Number($("timeline").value),
        inteiro = Math.floor(ano);
      t.destino = null;
      t.pausado = true;
      t.jd = Math.min(
        t.maximo,
        lerData(`01/01/${inteiro}`) + (ano - inteiro) * 365.25,
      );
    };
    $("escala").onchange = () => {
      u.escala = $("escala").value;
      this.camera.multiplicadorVisao = u.escala === "proporcional" ? 3.1 : 1;
      u.recalcularOrbitas(t.jd);
      for (const menor of u.menores) {
        const pontos = [];
        for (let k = 0; k <= 500; k++)
          pontos.push(
            ...visual(
              posicaoMenor(
                menor.userData.orbita,
                Number(menor.userData.orbita.epoch),
                (k / 500) * Math.PI * 2,
              ),
              u.escala,
            ),
          );
        u.linha("menor-" + menor.userData.nome, pontos, 0x9caa96, false, 0.4);
      }
      this.limpar();
      this.camera.visao(2);
      if (u.escala === "proporcional")
        this.avisar(
          "Escala física: use a busca ou a lista para se aproximar dos planetas.",
        );
    };
    $("referencial").onchange = () => {
      u.geocentrico = $("referencial").value === "terra";
      this.limpar();
      this.ultimoRastro = 0;
    };
    $("orbitas").onchange = () => (u.orbitas.visible = $("orbitas").checked);
    $("asteroides").onchange = () =>
      (u.mostrarAsteroides = $("asteroides").checked);
    $("nomes").onchange = () => ($("rotulos").hidden = !$("nomes").checked);
    $("grade").onchange = () => (u.grade.visible = $("grade").checked);
    $("relogio").onchange = () => {
      this.relogio = $("relogio").checked;
      if (!this.relogio) u.limparGrupo("relogio");
      else this.camera.visao(1);
    };
    $("rastro").onchange = () => {
      this.rastro = $("rastro").value;
      this.ultimoRastro = 0;
      this.pontosSessao = [];
      u.limparGrupo("rastro");
    };
    $("eco").onclick = () => c.ecos(this.selecionado, t.jd);
    $("cascata").onclick = () => c.ecos(this.selecionado, t.jd, true);
    $("limpar").onclick = () => this.limpar();
    $("seed").onchange = () => u.criarEstrelas($("seed").value);
    $("qualidade").onchange = () =>
      this.desempenho.escolher($("qualidade").value);
    $("imersao").onclick = () => this.hud();
    $("restaurar").onclick = () => this.hud();
    $("visao-superior").onclick = () => this.camera.visao(1);
    $("visao-geral").onclick = () => this.camera.visao(2);
    $("seguir").onclick = () => this.camera.focar(u.corpos[this.selecionado]);
    $("camera-modo").onchange = () => {
      const m = $("camera-modo").value;
      if (m === "livre") this.camera.seguindo = null;
      else this.camera.focar(u.corpos[this.selecionado], m);
    };
    $("evento").onchange = () => {
      if ($("evento").value) this.viajar($("evento").value);
    };
    $("data-b").onchange = () => {
      try {
        c.data = lerData($("data-b").value);
      } catch (e) {
        this.avisar(e.message);
        $("data-b").value = formatar(c.data);
      }
    };
    $("comparacao").onchange = () => {
      c.modo = $("comparacao").value;
      $("divisor").hidden = c.modo !== "vertical";
      $("morph-controle").hidden = c.modo !== "morph";
      if (c.modo === "vertical") this.camera.visao(2);
    };
    $("morph").oninput = () => {
      c.mistura = Number($("morph").value) / 100;
      $("porcentagem").textContent = $("morph").value + "%";
    };
    $("assinatura").onclick = () => {
      this.calcular("assinatura", {
        tipo: "assinatura",
        a: Number($("corpo-a").value),
        b: Number($("corpo-b").value),
        dias: Number($("periodo-assinatura").value) * 365.25,
        amostras: 2500,
      });
      this.camera.visao(1);
      this.avisar(
        "Assinatura orbital calculada com 2.501 conexões entre os corpos.",
      );
    };
    $("retrogrado").onclick = () => {
      this.calcular("retrogrado", {
        tipo: "retrogrado",
        a: Number($("corpo-retrogrado").value),
        b: 2,
        dias: 780,
        amostras: 2000,
      });
      this.camera.visao(1);
      this.avisar(
        "Direções no céu geocêntrico: 780 dias. A linha não representa distância física.",
      );
    };
    $("abrir-comando").onclick = () => this.abrirPaleta();
    $("form-comando").onsubmit = (e) => {
      e.preventDefault();
      try {
        this.comando($("comando").value);
        $("paleta").close();
      } catch (erro) {
        this.avisar(erro.message);
      }
    };
    $("ajuda").onclick = () => $("dialogo-ajuda").showModal();
    document
      .querySelectorAll("[data-fechar]")
      .forEach((b) => (b.onclick = () => b.closest("dialog").close()));
    $("menu-mobile").onclick = () => {
      $("painel-esquerdo").classList.toggle("aberto");
      $("painel-direito").classList.remove("aberto");
    };
    $("info-mobile").onclick = () => {
      $("painel-direito").classList.toggle("aberto");
      $("painel-esquerdo").classList.remove("aberto");
    };
    $("capturar").onclick = () => this.capturar();
    $("audio").onclick = () => this.audio();
    $("giroscopio").onclick = () => this.giroscopio();
    $("dados-jpl").onclick = () => {
      this.mostrarJpl();
      $("dialogo-dados").showModal();
    };
    $("fonte-jpl").onchange = () => this.mostrarJpl();
    $("importar").onchange = async () => {
      try {
        const f = $("importar").files[0];
        if (!f) return;
        if (f.size > 20000000) throw Error("O arquivo excede 20 MB.");
        const d = JSON.parse(await f.text());
        if (!d.fontes || typeof d.fontes !== "object")
          throw Error("Use o arquivo exportado pelo atualizador JPL.");
        this.arquivoJpl = d;
        if (d.fontes?.sbdb?.dados)
          this.universo.adicionarMenor(d.fontes.sbdb.dados);
        this.mostrarJpl();
        this.avisar("Arquivo científico importado.");
      } catch (e) {
        this.avisar(e.message);
      }
    };
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document
          .querySelectorAll(".aberto")
          .forEach((x) => x.classList.remove("aberto"));
        return;
      }
      if (
        e.target.matches("input,select,textarea") ||
        document.querySelector("dialog[open]")
      )
        return;
      const a = {
        " ": () => {
          $("play").click();
        },
        r: () => {
          t.velocidade = 1 / 86400;
          $("velocidade").value = "0.000011574074074";
          t.pausado = false;
        },
        h: () => this.hud(),
        f: () => this.camera.focar(u.corpos[this.selecionado]),
        1: () => this.camera.visao(1),
        2: () => this.camera.visao(2),
        3: () => this.camera.visao(3),
        "/": () => this.abrirPaleta(),
      };
      if (a[e.key.toLowerCase()]) {
        e.preventDefault();
        a[e.key.toLowerCase()]();
      }
    });
    let origem = null;
    $("universo").addEventListener("pointerdown", (e) => {
      origem = { x: e.clientX, y: e.clientY };
    });
    $("universo").addEventListener("pointerup", (e) => {
      if (
        !origem ||
        Math.hypot(e.clientX - origem.x, e.clientY - origem.y) > 6 ||
        c.modo === "vertical"
      )
        return;
      const v = new T.Vector2(
          (e.clientX / innerWidth) * 2 - 1,
          (-e.clientY / innerHeight) * 2 + 1,
        ),
        raio = new T.Raycaster();
      raio.setFromCamera(v, this.camera.camera);
      const hits = raio
        .intersectObjects(u.corpos, true)
        .filter((h) => Number.isInteger(h.object.userData.indice));
      if (hits[0]) this.selecionar(hits[0].object.userData.indice);
    });
  }
  limpar() {
    for (const n of ["rastro", "assinatura", "retrogrado", "ecos"]) {
      this.universo.limparGrupo(n);
      if (this.ultimosPedidos) this.ultimosPedidos[n] = -1;
    }
    this.rastro = "0";
    $("rastro").value = "0";
    this.pontosSessao = [];
  }
  hud() {
    const oculto = document.body.classList.toggle("sem-hud");
    $("restaurar").hidden = !oculto;
  }
  abrirPaleta() {
    $("paleta").showModal();
    $("comando").focus();
  }
  comando(texto) {
    if (this.bifurcacao?.comando(texto)) return;
    const s = normalizar(texto);
    let m;
    if ((m = s.match(/^data\s+(.+)$/))) {
      this.viajar(m[1]);
      return;
    }
    if ((m = s.match(/^acelerar\s+(\d+(?:\.\d+)?)x?$/))) {
      const v = Number(m[1]);
      if (v <= 0 || v > 31557600000)
        throw Error("Velocidade fora do intervalo.");
      this.tempo.velocidade = v / 86400;
      this.tempo.pausado = false;
      this.avisar(`Tempo acelerado ${v}×.`);
      return;
    }
    if ((m = s.match(/^comparar (\d{1,4}) com (\d{1,4})$/))) {
      this.viajar(`01/01/${m[1]}`);
      this.comparador.data = lerData(`01/01/${m[2]}`);
      $("data-b").value = formatar(this.comparador.data);
      $("comparacao").value = "sobreposicao";
      $("comparacao").dispatchEvent(new Event("change"));
      return;
    }
    if (s.includes("heliocentrico") || s.includes("geocentrico")) {
      $("referencial").value = s.includes("heliocentrico") ? "sol" : "terra";
      $("referencial").dispatchEvent(new Event("change"));
      return;
    }
    const nome = s.replace(/^(ir para|seguir)\s+/, "");
    const menor = this.universo.menores.find(
      (o) => normalizar(o.userData.nome).includes(nome) && nome.length > 2,
    );
    if (menor) {
      this.camera.focar(menor);
      this.avisar(menor.userData.nome + " · elementos orbitais SBDB");
      return;
    }
    if (nome === "lua") {
      this.selecionarLua();
      return;
    }
    const p = planetas.find((p) => normalizar(p.nome) === nome);
    if (p) {
      this.selecionar(p.indice);
      return;
    }
    throw Error("Comando não reconhecido. Experimente “ir para Saturno”.");
  }
  atualizarPainel() {
    const i = this.selecionado,
      p = planetas[i],
      jd = this.tempo.jd,
      v = posicao(i, jd),
      f = (n) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
    const dados = [
      ["Distância do Sol", f(distancia(v)) + " UA"],
      ["Velocidade orbital", f(velocidade(i, jd)) + " km/s"],
      ["Período orbital", f(p.periodo / 365.25) + " anos"],
      ["Diâmetro", f(p.diametro) + " km"],
      ["Massa", p.massa.toExponential(3) + " kg"],
      ["Gravidade", f(p.gravidade) + " m/s²"],
      ["Inclinação axial", f(p.inclinacao) + "°"],
      ["Temperatura média", p.temperatura + " °C"],
      [
        "Luas representadas",
        String(
          this.universo.satelites.filter((l) => l.userData.pai === i).length,
        ),
      ],
      ["Posição J2000 · UA", [v[0], -v[2], v[1]].map(f).join(" / ")],
    ];
    $("informacoes").replaceChildren(
      ...dados.map(([a, b]) => {
        const d = document.createElement("div");
        d.className = "dado";
        const s = document.createElement("span"),
          valor = document.createElement("span");
        s.textContent = a;
        valor.textContent = b;
        d.append(s, valor);
        return d;
      }),
    );
    $("diferencas").replaceChildren();
    if (this.comparador.modo !== "desligado") {
      for (const p of planetas) {
        const a = posicao(p.indice, jd),
          b = posicao(p.indice, this.comparador.data),
          ang =
            (Math.acos(
              Math.max(
                -1,
                Math.min(
                  1,
                  a.reduce((s, x, i) => s + x * b[i], 0) /
                    (distancia(a) * distancia(b)),
                ),
              ),
            ) *
              180) /
            Math.PI;
        const d = document.createElement("div");
        d.className = "diferenca";
        d.innerHTML = `<span>${p.nome}</span><span>${ang.toFixed(1)}°</span>`;
        $("diferencas").append(d);
      }
    }
  }
  atualizar(segundos) {
    const jd = this.tempo.jd;
    $("restaurar").textContent =
      "◎ " + formatar(jd) + " · Mostrar instrumentos · H";
    if (document.activeElement !== $("data") && this.rascunhoData == null)
      $("data").value = formatar(jd);
    $("play").textContent = this.tempo.pausado ? "▶" : "Ⅱ";
    $("estado-tempo").textContent = this.tempo.destino
      ? "ATRAVESSANDO O TEMPO"
      : this.tempo.pausado
        ? "TEMPO SUSPENSO"
        : this.tempo.direcao < 0
          ? "RETROCEDENDO"
          : "TEMPO EM MOVIMENTO";
    $("jd").textContent = "JD " + jd.toFixed(3);
    const ano = dataJuliana(jd).getUTCFullYear();
    $("precisao").textContent =
      ano > 3000
        ? "Extrapolação · precisão não garantida"
        : "Simulação astronômica aproximada";
    if (document.activeElement !== $("timeline")) $("timeline").value = ano;
    $("epoca-a").textContent = formatar(jd);
    $("epoca-b").textContent = formatar(this.comparador.data);
    $("modo-cena").textContent =
      this.comparador.modo === "morph"
        ? "MORPH · " +
          formatar(jd + (this.comparador.data - jd) * this.comparador.mistura)
        : this.universo.geocentrico
          ? "REFERENCIAL TERRESTRE"
          : "SISTEMA SOLAR";
    $("fps").textContent = this.desempenho.fps + " FPS";
    const camera = this.camera.camera,
      canvas = $("universo"),
      w = canvas.clientWidth,
      h = canvas.clientHeight;
    this.universo.cena.updateMatrixWorld();
    this.rotulos.forEach((r, i) => {
      const v = this.universo.corpos[i]
          .getWorldPosition(new T.Vector3())
          .project(camera),
        visivel =
          v.z < 1 &&
          v.z > -1 &&
          Math.abs(v.x) < 1 &&
          Math.abs(v.y) < 1 &&
          this.comparador.modo !== "vertical";
      r.hidden = !visivel;
      if (visivel)
        r.style.transform = `translate(${(v.x * 0.5 + 0.5) * w + 9}px,${(-v.y * 0.5 + 0.5) * h - 8}px)`;
    });
    if (segundos - this.ultimoPainel > 0.3) {
      this.ultimoPainel = segundos;
      if (this.som?.ativo) {
        const proximidade = this.camera.camera.position.distanceTo(
          this.camera.controles.target,
        );
        this.som.ganho.gain.setTargetAtTime(
          0.009 + 0.009 / (1 + proximidade / 30),
          this.som.contexto.currentTime,
          0.8,
        );
      }
      this.atualizarPainel();
      this.minimapa();
      if (this.relogio) {
        const pontos = [];
        this.universo.corpos.forEach((o) =>
          pontos.push(0, 0, 0, ...o.position.toArray()),
        );
        this.universo.linha("relogio", pontos, 0xd2b77f, true, 0.45);
      }
    }
    if (this.rastro !== "0" && segundos - this.ultimoRastro > 0.65) {
      this.ultimoRastro = segundos;
      if (this.rastro === "sessao") {
        const v = this.universo.corpos[this.selecionado].position.toArray();
        this.pontosSessao.push(...v);
        if (this.pontosSessao.length > 300000)
          this.pontosSessao = this.pontosSessao.filter(
            (v, i) => Math.floor(i / 3) % 2 === 0,
          );
        this.universo.linha(
          "rastro",
          this.pontosSessao,
          planetas[this.selecionado].cor,
          false,
          0.65,
        );
      } else
        this.calcular("rastro", {
          tipo: "rastro",
          a: this.selecionado,
          b: 2,
          dias: -(this.rastro === "orbita"
            ? planetas[this.selecionado].periodo
            : Number(this.rastro)),
          amostras: Math.min(
            90000,
            Math.max(
              2000,
              Math.ceil(
                ((this.rastro === "orbita"
                  ? planetas[this.selecionado].periodo
                  : Number(this.rastro)) /
                  planetas[this.selecionado].periodo) *
                  90,
              ),
            ),
          ),
          geocentrico: this.universo.geocentrico,
        });
    }
  }
  minimapa() {
    const ctx = $("minimapa").getContext("2d"),
      w = 480,
      h = 220;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "#6e736c44";
    for (let i = 0; i < 8; i++) {
      const r = 18 + i * 24;
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, r, r * 0.46, 0, 0, Math.PI * 2);
      ctx.stroke();
      const v = posicao(i, this.tempo.jd),
        a = Math.atan2(v[2], v[0]);
      ctx.fillStyle = planetas[i].cor;
      ctx.beginPath();
      ctx.arc(
        w / 2 + Math.cos(a) * r,
        h / 2 + Math.sin(a) * r * 0.46,
        i > 3 ? 4 : 3,
        0,
        7,
      );
      ctx.fill();
    }
    ctx.fillStyle = "#e6b963";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 7, 0, 7);
    ctx.fill();
  }
  async capturar() {
    try {
      const r = this.universo.renderizador,
        c = r.domElement;
      this.comparador.renderizar(this.camera.camera, this.tempo.jd);
      const imagem = document.createElement("canvas");
      imagem.width = c.width;
      imagem.height = c.height;
      const ctx = imagem.getContext("2d");
      ctx.drawImage(c, 0, 0);
      const fator = c.width / c.clientWidth;
      ctx.fillStyle = "#e2cba0";
      ctx.font = `${Math.max(18, c.width / 85)}px Georgia`;
      ctx.fillText(
        (this.bifurcacao?.ativa && this.bifurcacao.visualizandoMonteCarlo
          ? "MONTE CARLO · COVARIÂNCIA SBDB · "
          : this.bifurcacao?.ativa && this.bifurcacao.resultado
            ? "UNIVERSO BIFURCADO · HIPÓTESE A/B · "
            : "PLANETÁRIO TEMPORAL · ") +
          formatar(this.tempo.jd) +
          (this.comparador.modo === "desligado"
            ? ""
            : " / " + formatar(this.comparador.data)),
        25,
        imagem.height - 28,
      );
      if (
        $("nomes").checked &&
        this.comparador.modo !== "vertical" &&
        !(
          this.bifurcacao?.ativa &&
          !this.bifurcacao.visualizandoMonteCarlo &&
          ["vertical", "horizontal", "lado"].includes(
            this.bifurcacao.realidades.modo,
          )
        )
      ) {
        ctx.font = `${13 * fator}px Georgia`;
        this.universo.corpos.forEach((p, i) => {
          const v = p
            .getWorldPosition(new T.Vector3())
            .project(this.camera.camera);
          if (v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1)
            ctx.fillText(
              planetas[i].nome,
              (v.x * 0.5 + 0.5) * imagem.width + 10,
              (-v.y * 0.5 + 0.5) * imagem.height,
            );
        });
      }
      imagem.toBlob((b) => {
        if (!b) {
          this.avisar("Não foi possível capturar a imagem.");
          return;
        }
        const url = URL.createObjectURL(b),
          a = document.createElement("a");
        a.href = url;
        a.download =
          "Planetario-Temporal-" +
          formatar(this.tempo.jd).replaceAll("/", "-") +
          ".png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 3000);
      }, "image/png");
    } catch (e) {
      this.avisar("Falha ao capturar: " + e.message);
    }
  }
  async audio() {
    try {
      if (!this.som) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) throw Error("Áudio não suportado.");
        const contexto = new C(),
          ganho = contexto.createGain();
        ganho.gain.value = 0.018;
        ganho.connect(contexto.destination);
        [43.65, 65.4, 87.4].forEach((f) => {
          const os = contexto.createOscillator();
          os.type = "sine";
          os.frequency.value = f;
          os.connect(ganho);
          os.start();
        });
        this.som = { contexto, ganho };
      }
      if (this.som.ativo) {
        await this.som.contexto.suspend();
        this.som.ativo = false;
      } else {
        await this.som.contexto.resume();
        this.som.ativo = true;
      }
      $("audio").setAttribute("aria-pressed", String(this.som.ativo));
    } catch (e) {
      this.avisar(e.message);
    }
  }
  async giroscopio() {
    try {
      if (this.sensor) {
        window.removeEventListener("deviceorientation", this.sensor);
        this.sensor = null;
        $("giroscopio").textContent = "Ativar giroscópio";
        return;
      }
      if (!window.DeviceOrientationEvent)
        throw Error("Giroscópio indisponível neste dispositivo.");
      if (
        DeviceOrientationEvent.requestPermission &&
        (await DeviceOrientationEvent.requestPermission()) !== "granted"
      )
        throw Error("Permissão de movimento não concedida.");
      let inicial = null,
        ultimo = { b: 0, g: 0 };
      this.sensor = (e) => {
        if (e.beta === null) return;
        if (!inicial) inicial = { b: e.beta, g: e.gamma };
        const b = (e.beta - inicial.b) * 0.008,
          g = (e.gamma - inicial.g) * 0.008;
        this.camera.camera.position.x +=
          Math.max(-0.08, Math.min(0.08, g - ultimo.g)) *
          this.camera.camera.position.distanceTo(this.camera.controles.target) *
          0.02;
        this.camera.camera.position.y +=
          Math.max(-0.08, Math.min(0.08, b - ultimo.b)) *
          this.camera.camera.position.distanceTo(this.camera.controles.target) *
          0.02;
        ultimo = { b, g };
      };
      window.addEventListener("deviceorientation", this.sensor);
      $("giroscopio").textContent = "Desativar giroscópio";
      this.avisar("Movimento ativado quando o dispositivo fornecer leituras.");
    } catch (e) {
      this.avisar(e.message);
    }
  }
  mostrarJpl() {
    mostrarArquivo(this);
  }
  destruir() {
    this.worker.terminate();
    this.som?.contexto.close();
    if (this.sensor)
      window.removeEventListener("deviceorientation", this.sensor);
    clearTimeout(this.avisoTimer);
  }
}
