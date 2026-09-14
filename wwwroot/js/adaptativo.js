export function iniciarAdaptativo() {
  const raiz = document.documentElement;
  let agendado = false,
    encerrado = false;
  const ponteiro = matchMedia("(pointer:coarse)"),
    movimento = matchMedia("(prefers-reduced-motion: reduce)");
  const medir = () => {
    agendado = false;
    if (encerrado) return;
    const viewport = window.visualViewport,
      largura = viewport?.width || innerWidth,
      altura = viewport?.height || innerHeight;
    const compacto = largura < 760 || (altura < 500 && largura < 1150);
    raiz.style.setProperty("--altura", `${altura}px`);
    raiz.dataset.dispositivo = compacto
      ? "celular"
      : largura < 1160
        ? "tablet"
        : "desktop";
    raiz.dataset.baixo = altura < 560 ? "sim" : "nao";
    raiz.dataset.toque = String(ponteiro.matches);
    raiz.dataset.reduzido = String(movimento.matches);
    raiz.dataset.orientacao = largura > altura ? "paisagem" : "retrato";
    raiz.style.setProperty("--densidade", Math.min(devicePixelRatio, 2));
    const linha = document.querySelector(".temporal");
    if (linha) {
      const medidas = linha.getBoundingClientRect();
      raiz.style.setProperty("--topo-temporal", `${medidas.top}px`);
      raiz.style.setProperty("--altura-temporal", `${medidas.height}px`);
    }
    const cabecalho = document.querySelector(".cabecalho");
    if (cabecalho)
      raiz.dataset.cabecalhoCompacto = String(cabecalho.scrollWidth > largura);
  };
  const atualizar = () => {
    if (!agendado) {
      agendado = true;
      requestAnimationFrame(medir);
    }
  };
  const observador = new ResizeObserver(atualizar);
  observador.observe(document.body);
  const linha = document.querySelector(".temporal");
  if (linha) observador.observe(linha);
  window.visualViewport?.addEventListener("resize", atualizar);
  window.visualViewport?.addEventListener("scroll", atualizar);
  window.addEventListener("resize", atualizar);
  ponteiro.addEventListener("change", atualizar);
  movimento.addEventListener("change", atualizar);
  medir();
  return {
    reduzido: () => movimento.matches,
    destruir() {
      encerrado = true;
      observador.disconnect();
      window.removeEventListener("resize", atualizar);
      window.visualViewport?.removeEventListener("resize", atualizar);
      window.visualViewport?.removeEventListener("scroll", atualizar);
      ponteiro.removeEventListener("change", atualizar);
      movimento.removeEventListener("change", atualizar);
    },
  };
}
