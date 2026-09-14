// daqui nasce o tempo q a gente consegue enxergar
import { Universo } from "./universo.js";
import { Camera } from "./camera.js";
import { Tempo } from "./tempo.js";
import { Comparador } from "./comparador.js";
import { Interface } from "./interface.js";
import { Desempenho } from "./desempenho.js";
import { Bifurcacao } from "./bifurcacao.js";
import { iniciarAdaptativo } from "./adaptativo.js";
async function iniciar() {
  const canvas = document.getElementById("universo"),
    adaptativo = iniciarAdaptativo();
  let universo;
  try {
    universo = new Universo(canvas);
  } catch {
    document.getElementById("carregamento").textContent =
      "O navegador não disponibilizou WebGL 2. Ative a aceleração gráfica e reabra o planetário em um navegador compatível.";
    return;
  }
  const camera = new Camera(canvas),
    tempo = new Tempo(),
    desempenho = new Desempenho(universo.renderizador);
  camera.reduzido = adaptativo.reduzido();
  const redimensionar = () => {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    universo.renderizador.setSize(w, h, false);
    camera.redimensionar(w, h);
  };
  const observador = new ResizeObserver(redimensionar);
  observador.observe(canvas);
  redimensionar();
  universo.criarEstrelas(1977);
  let preparando = true,
    quadroAbertura = 0;
  const inicio = performance.now();
  function desenharAbertura(agora) {
    if (!preparando) return;
    universo.estrelas.material.opacity = Math.min(0.8, (agora - inicio) / 1800);
    if (universo.sol) {
      universo.sol.material.uniforms.tempo.value = (agora - inicio) / 1000;
      universo.sol.scale.setScalar(6.5 * Math.min(1, (agora - inicio) / 2000));
    }
    universo.renderizador.render(universo.cena, camera.camera);
    quadroAbertura = requestAnimationFrame(desenharAbertura);
  }
  document.getElementById("abertura").classList.add("revelando");
  quadroAbertura = requestAnimationFrame(desenharAbertura);
  try {
    await universo.iniciar();
  } catch (erro) {
    preparando = false;
    cancelAnimationFrame(quadroAbertura);
    observador.disconnect();
    throw erro;
  }
  preparando = false;
  cancelAnimationFrame(quadroAbertura);
  const comparador = new Comparador(universo),
    interfaceUsuario = new Interface({
      universo,
      camera,
      tempo,
      desempenho,
      comparador,
      adaptativo,
    });
  if (universo.falhasTexturas?.length)
    interfaceUsuario.avisar(
      "Texturas indisponíveis: " +
        universo.falhasTexturas.join(", ") +
        ". Materiais de reserva ativos.",
    );
  let bifurcacao = new Bifurcacao(interfaceUsuario);
  try {
    await bifurcacao.iniciar();
  } catch (erro) {
    bifurcacao.destruir();
    bifurcacao = null;
    interfaceUsuario.avisar("Laboratório indisponível: " + erro.message);
  }
  let anterior = performance.now(),
    quadro = 0,
    encerrado = false;
  universo.atualizar(tempo.jd, 0);
  camera.visao(2);
  document.getElementById("abertura").classList.add("saida");
  const apresentacao = setTimeout(
    () => {
      document.getElementById("abertura").hidden = true;
      document.body.classList.add("pronto");
    },
    adaptativo.reduzido() ? 10 : 2200,
  );
  function animar(agora) {
    if (encerrado) return;
    quadro = requestAnimationFrame(animar);
    const decorrido = Math.max(0, (agora - anterior) / 1000);
    anterior = agora;
    if (document.hidden) return;
    const dt = Math.min(0.1, decorrido);
    tempo.atualizar(decorrido);
    universo.atualizar(tempo.jd, (agora - inicio) / 1000);
    comparador.atualizar(tempo.jd);
    bifurcacao?.atualizar(agora / 1000);
    camera.atualizar(dt);
    desempenho.aplicar(universo);
    comparador.renderizar(camera.camera, tempo.jd);
    desempenho.atualizar(decorrido);
    interfaceUsuario.atualizar(agora / 1000);
  }
  quadro = requestAnimationFrame(animar);
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    interfaceUsuario.avisar(
      "O contexto gráfico foi interrompido. Recarregue a página para restaurar a cena.",
    );
    cancelAnimationFrame(quadro);
  });
  window.addEventListener(
    "pagehide",
    () => {
      encerrado = true;
      clearTimeout(apresentacao);
      cancelAnimationFrame(quadro);
      observador.disconnect();
      bifurcacao?.destruir();
      interfaceUsuario.destruir();
      camera.destruir();
      universo.destruir();
      adaptativo.destruir();
    },
    { once: true },
  );
}
iniciar().catch((erro) => {
  document.getElementById("carregamento").textContent =
    "Não foi possível abrir o observatório: " + erro.message;
  document.getElementById("abertura").classList.remove("revelando", "saida");
  console.error(erro);
});
