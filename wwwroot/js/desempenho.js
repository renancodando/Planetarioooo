export class Desempenho {
  constructor(renderizador) {
    this.renderizador = renderizador;
    this.nivel = "auto";
    this.fps = 60;
    this.soma = 0;
    this.quadros = 0;
    this.tempoLento = 0;
    this.escolher("auto");
    const gl = renderizador.getContext?.();
    const informacoes = gl?.getExtension("WEBGL_debug_renderer_info");
    this.gpu = informacoes
      ? gl.getParameter(informacoes.UNMASKED_RENDERER_WEBGL)
      : "Não informado";
  }
  escolher(nivel) {
    this.nivel = nivel;
    const memoria = navigator.deviceMemory || 8,
      nucleos = navigator.hardwareConcurrency || 4;
    const automatico =
      memoria < 4 || nucleos < 4
        ? "baixa"
        : matchMedia("(pointer:coarse)").matches
          ? "media"
          : "alta";
    this.efetivo = nivel === "auto" ? automatico : nivel;
    const pixel = { baixa: 0.85, media: 1.25, alta: 1.75, extrema: 2 };
    this.renderizador.setPixelRatio(
      Math.min(devicePixelRatio, pixel[this.efetivo]),
    );
  }
  atualizar(dt) {
    this.soma += dt;
    this.quadros++;
    if (this.soma > 3) {
      this.fps = Math.round(this.quadros / this.soma);
      this.tempoLento =
        this.fps < 25
          ? this.tempoLento + this.soma
          : Math.max(0, this.tempoLento - this.soma);
      if (this.nivel === "auto" && this.tempoLento >= 6) {
        this.renderizador.setPixelRatio(
          Math.max(0.65, this.renderizador.getPixelRatio() * 0.8),
        );
        this.efetivo = "baixa";
      }
      this.soma = 0;
      this.quadros = 0;
    }
  }
  aplicar(universo) {
    universo.ajustarTexturas(this.efetivo);
    const asteroides = { baixa: 500, media: 1000, alta: 1700, extrema: 1700 };
    universo.asteroides.count = asteroides[this.efetivo];
    universo.estrelas.geometry.setDrawRange(
      0,
      { baixa: 2200, media: 4500, alta: 7000, extrema: 8500 }[this.efetivo],
    );
    universo.proeminencias.visible =
      universo.escala !== "proporcional" && this.efetivo !== "baixa";
  }
}
