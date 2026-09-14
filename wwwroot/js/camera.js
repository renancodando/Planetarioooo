import * as T from "../vendor/three.module.js";
import { OrbitControls } from "../vendor/OrbitControls.js";
export class Camera {
  constructor(canvas) {
    this.camera = new T.PerspectiveCamera(
      43,
      innerWidth / innerHeight,
      0.01,
      5000,
    );
    this.camera.position.set(25, 125, 180);
    this.controles = new OrbitControls(this.camera, canvas);
    this.controles.enableDamping = true;
    this.controles.dampingFactor = 0.065;
    this.controles.minDistance = 0.000003;
    this.controles.maxDistance = 650;
    this.controles.maxPolarAngle = Math.PI * 0.97;
    this.controles.zoomSpeed = 0.75;
    this.seguindo = null;
    this.transicao = null;
    this.multiplicadorVisao = 1;
    this.reduzido = false;
    this.controles.addEventListener("start", () => {
      this.transicao = null;
    });
    this.modo = "orbital";
    this.vetor = new T.Vector3();
    this.ultimo = null;
  }
  focar(objeto, modo = "orbital") {
    this.seguindo = objeto;
    this.modo = modo;
    objeto.updateWorldMatrix(true, false);
    let alvo = objeto.getWorldPosition(new T.Vector3()),
      r = Math.max(0.000003, objeto.scale.x);
    const d = Math.max(r * 7, 0.00002);
    let deslocamento = new T.Vector3(d * 0.8, d * 0.45, d * 1.35);
    if (modo === "superior") deslocamento.set(0.001, d * 1.7, 0);
    if (modo === "lateral") deslocamento.set(d * 1.7, d * 0.08, 0);
    if (modo === "sol") deslocamento.copy(alvo).normalize().multiplyScalar(d);
    if (modo === "do-sol")
      deslocamento.copy(alvo).normalize().multiplyScalar(-d);
    this.transicao = {
      posicao: this.camera.position.clone(),
      alvo: this.controles.target.clone(),
      deslocamento,
      tempo: 0,
    };
    this.ultimo = alvo.clone();
  }
  visao(tipo = 2) {
    this.seguindo = null;
    const destinos = {
      1: new T.Vector3(0, 175, 0.1),
      2: new T.Vector3(25, 105, 155),
      3: new T.Vector3(0, 15, 190),
    };
    this.transicao = {
      posicao: this.camera.position.clone(),
      alvo: this.controles.target.clone(),
      deslocamento: (destinos[tipo] || destinos[2])
        .clone()
        .multiplyScalar(this.multiplicadorVisao),
      tempo: 0,
    };
  }
  atualizar(dt) {
    let alvo = this.seguindo
      ? this.seguindo.getWorldPosition(new T.Vector3())
      : new T.Vector3();
    if (this.transicao) {
      let t = this.transicao;
      t.tempo += dt;
      let k = Math.min(1, t.tempo / (this.reduzido ? 0.001 : 2)),
        suave = k * k * (3 - 2 * k);
      this.controles.target.lerpVectors(t.alvo, alvo, suave);
      this.camera.position.lerpVectors(
        t.posicao,
        alvo.clone().add(t.deslocamento),
        suave,
      );
      if (k === 1) this.transicao = null;
    } else if (this.seguindo && this.ultimo) {
      const delta = alvo.clone().sub(this.ultimo);
      this.camera.position.add(delta);
      this.controles.target.copy(alvo);
      if (this.modo === "sol" || this.modo === "do-sol") {
        const distancia = this.camera.position.distanceTo(alvo);
        const direcao = this.seguindo.position
          .clone()
          .normalize()
          .multiplyScalar(this.modo === "sol" ? distancia : -distancia);
        this.camera.position.lerp(
          alvo.clone().add(direcao),
          1 - Math.exp(-dt * 5),
        );
      }
    }
    this.ultimo = alvo;
    const distancia = this.camera.position.distanceTo(this.controles.target);
    this.camera.near = Math.max(0.0000001, Math.min(0.1, distancia * 0.001));
    this.camera.updateProjectionMatrix();
    this.controles.update();
  }
  redimensionar(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  destruir() {
    this.controles.dispose();
  }
}
