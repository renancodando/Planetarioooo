// o universo fica mais bonito quando a interface sabe ficar em silêncio
import * as T from "../vendor/three.module.js";
import {
  planetas,
  luas,
  posicao,
  visual,
  rad,
  UA,
  posicaoMenor,
} from "./astronomia.js";
export class Universo {
  constructor(canvas, renderizador) {
    this.renderizador =
      renderizador ||
      new T.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      });
    this.renderizador.setClearColor(0x030508);
    this.renderizador.outputColorSpace = T.SRGBColorSpace;
    this.renderizador.toneMapping = T.ACESFilmicToneMapping;
    this.renderizador.toneMappingExposure = 1.35;
    this.cena = new T.Scene();
    this.sistema = new T.Group();
    this.cena.add(this.sistema);
    this.corpos = [];
    this.satelites = [];
    this.orbitas = new T.Group();
    this.sistema.add(this.orbitas);
    this.escala = "didatica";
    this.geocentrico = false;
    this.carregador = new T.TextureLoader();
    this.cacheTexturas = new Map();
    this.texturas = [];
    this.grupos = new Map();
    this.menores = [];
    this.materiaisAnimados = [];
    this.cena.add(new T.AmbientLight(0xabbaca, 0.16));
    this.luz = new T.PointLight(0xfff1dc, 4.2, 0, 0);
    this.sistema.add(this.luz);
    this.geometriaAlta = new T.SphereGeometry(1, 96, 64);
    this.geometriaMedia = new T.SphereGeometry(1, 32, 20);
    this.geometriaBaixa = new T.SphereGeometry(1, 16, 12);
  }
  async iniciar() {
    const [ev, ef, av, af] = await Promise.all(
      ["estrela.vert", "estrela.frag", "atmosfera.vert", "atmosfera.frag"].map(
        async (n) => {
          const r = await fetch(`shaders/${n}`);
          if (!r.ok) throw Error(`Não foi possível carregar ${n}`);
          return r.text();
        },
      ),
    );
    this.shaderAtmosfera = { vertexShader: av, fragmentShader: af };
    const mat = new T.ShaderMaterial({
      vertexShader: ev,
      fragmentShader: ef,
      uniforms: { tempo: { value: 0 } },
    });
    this.sol = new T.Mesh(this.geometriaAlta, mat);
    this.sol.scale.setScalar(6.5);
    this.sol.userData.nome = "Sol";
    this.sistema.add(this.sol);
    this.criarCorona();
    this.materiaisAnimados.push(mat);
    for (const p of planetas) {
      const mapa = await this.textura(
        p.indice === 1 ? "venus_atmosphere" : p.textura,
      );
      const material = new T.MeshStandardMaterial({
        map: mapa,
        roughness: p.indice === 2 ? 0.72 : 1,
        metalness: 0,
        bumpMap: p.indice < 4 ? mapa : null,
        bumpScale: p.indice < 4 ? 0.018 : 0,
      });
      const corpo = new T.Group();
      corpo.userData = {
        ...p,
        raio: [0.9, 1.55, 1.65, 1.2, 4.7, 4.1, 2.65, 2.5][p.indice],
      };
      const eixo = new T.Group();
      eixo.rotation.z = p.inclinacao * rad;
      const lod = new T.LOD();
      for (const [g, d] of [
        [this.geometriaAlta, 0],
        [this.geometriaMedia, 65],
        [this.geometriaBaixa, 140],
      ]) {
        const malha = new T.Mesh(g, material);
        malha.userData.indice = p.indice;
        malha.castShadow = true;
        malha.receiveShadow = true;
        if (p.indice > 3)
          malha.scale.y = [1, 1, 1, 1, 0.935, 0.902, 0.977, 0.983][p.indice];
        lod.addLevel(malha, d);
      }
      eixo.add(lod);
      corpo.add(eixo);
      corpo.userData.eixo = eixo;
      corpo.userData.lod = lod;
      corpo.userData.material = material;
      this.sistema.add(corpo);
      this.corpos.push(corpo);
      if (p.indice === 2) {
        this.iluminacaoNoturna(material, await this.textura("earth_nightmap"));
        const nuvens = await this.textura("earth_clouds");
        const camada = new T.Mesh(
          this.geometriaMedia,
          new T.MeshStandardMaterial({
            map: nuvens,
            alphaMap: nuvens,
            transparent: true,
            opacity: 0.75,
            depthWrite: false,
          }),
        );
        camada.scale.setScalar(1.018);
        eixo.add(camada);
        corpo.userData.nuvens = camada;
        this.atmosfera(eixo, 0x6fa6ca, 1.065, 0.62);
      }
      if (p.indice === 1) {
        const nuvens = new T.Mesh(
          this.geometriaMedia,
          new T.MeshStandardMaterial({
            map: await this.textura("venus_atmosphere"),
            roughness: 1,
          }),
        );
        nuvens.scale.setScalar(1.014);
        eixo.add(nuvens);
        this.atmosfera(eixo, 0xdcb778, 1.06, 0.4);
      }
      if (p.indice > 5) this.atmosfera(eixo, p.cor, 1.035, 0.34);
      if (p.indice === 5) await this.aneis(eixo);
      if (p.indice === 6) this.anelUrano(eixo);
      if (p.indice >= 4) this.turbulencia(material);
    }
    const mapaLua = await this.textura("moon");
    for (const l of luas) {
      const esfera = new T.Mesh(
        this.geometriaMedia,
        new T.MeshStandardMaterial({
          map: ["Io", "Europa", "Titã", "Encélado"].includes(l.nome)
            ? this.texturaSatelite(l.nome)
            : mapaLua,
          color: l.nome === "Ganimedes" ? 0xb6a38b : 0xffffff,
          roughness: 1,
        }),
      );
      esfera.userData = { ...l };
      this.satelites.push(esfera);
      this.sistema.add(esfera);
    }
    if (!this.estrelas) this.criarEstrelas(1977);
    this.criarAsteroides();
    this.grade = new T.GridHelper(190, 38, 0x68583c, 0x22282b);
    this.grade.material.transparent = true;
    this.grade.material.opacity = 0.22;
    this.grade.visible = false;
    this.sistema.add(this.grade);
    this.recalcularOrbitas(2451545);
    return this;
  }
  async textura(nome) {
    if (this.cacheTexturas.has(nome)) return this.cacheTexturas.get(nome);
    let mapa;
    try {
      mapa = await this.carregador.loadAsync(`texturas/${nome}.jpg`);
    } catch {
      mapa = this.texturaReserva(nome);
      this.falhasTexturas ??= [];
      this.falhasTexturas.push(nome);
    }
    this.imagensOriginais ??= new Map();
    this.imagensOriginais.set(mapa, mapa.image);
    mapa.colorSpace = T.SRGBColorSpace;
    mapa.anisotropy = Math.min(
      8,
      this.renderizador.capabilities.getMaxAnisotropy(),
    );
    this.texturas.push(mapa);
    this.cacheTexturas.set(nome, mapa);
    return mapa;
  }
  texturaReserva(nome) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d"),
      paleta = {
        earth_daymap: ["#193944", "#456454"],
        earth_nightmap: ["#050606", "#090c0d"],
        earth_clouds: ["#000000", "#d4d7cf"],
        mars: ["#663522", "#b57546"],
        jupiter: ["#ad9575", "#6e5142"],
        saturn: ["#c4b68d", "#907b58"],
        venus_atmosphere: ["#a6996b", "#ccc097"],
      },
      cores = paleta[nome] || ["#4b4e49", "#77796e"];
    ctx.fillStyle = cores[0];
    ctx.fillRect(0, 0, 512, 256);
    let seed = nome.split("").reduce((s, c) => s + c.charCodeAt(0), 1);
    const aleatorio = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 900; i++) {
      ctx.globalAlpha = 0.04 + aleatorio() * 0.13;
      ctx.fillStyle = cores[1];
      const y = aleatorio() * 256;
      ctx.fillRect(
        aleatorio() * 512,
        y,
        20 + aleatorio() * 120,
        1 + aleatorio() * 5,
      );
    }
    return new T.CanvasTexture(canvas);
  }
  ajustarTexturas(nivel) {
    const limite =
      { baixa: 512, media: 1024, alta: 2048, extrema: 2048 }[nivel] || 2048;
    if (this.limiteTexturas === limite) return;
    this.limiteTexturas = limite;
    for (const [mapa, original] of this.imagensOriginais || []) {
      if (!original?.width) continue;
      if (original.width > limite) {
        const canvas = document.createElement("canvas");
        canvas.width = limite;
        canvas.height = Math.max(
          1,
          Math.round((original.height * limite) / original.width),
        );
        canvas
          .getContext("2d")
          .drawImage(original, 0, 0, canvas.width, canvas.height);
        mapa.image = canvas;
      } else mapa.image = original;
      mapa.needsUpdate = true;
    }
  }
  texturaSatelite(nome) {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const ctx = c.getContext("2d"),
      dados = ctx.createImageData(1024, 512);
    const base =
      nome === "Io"
        ? [203, 173, 72]
        : nome === "Titã"
          ? [195, 145, 74]
          : nome === "Europa"
            ? [198, 184, 153]
            : [213, 220, 222];
    for (let y = 0; y < 512; y++)
      for (let x = 0; x < 1024; x++) {
        const u = (x / 1024) * Math.PI * 2,
          v = (y / 512) * Math.PI;
        const ruido =
          Math.sin(u * 17 + Math.sin(v * 13)) *
            Math.cos(v * 21 + Math.sin(u * 9)) *
            0.5 +
          Math.sin(u * 73 + v * 11) * Math.sin(v * 52) * 0.2;
        const fissura =
          nome === "Europa"
            ? Math.pow(
                Math.max(
                  0,
                  1 -
                    Math.abs(
                      Math.sin(
                        u * 7 + Math.sin(v * 6) * 2 + Math.sin(u * 3) * 0.5,
                      ),
                    ) *
                      16,
                ),
                2,
              )
            : 0;
        const mancha =
          nome === "Io" ? Math.pow(Math.max(0, ruido + 0.1), 4) * 280 : 0;
        const indice = (y * 1024 + x) * 4;
        for (let k = 0; k < 3; k++)
          dados.data[indice + k] =
            base[k] +
            ruido * (nome === "Titã" ? 7 : 30) -
            fissura * (k === 0 ? 40 : 65) -
            mancha;
        dados.data[indice + 3] = 255;
      }
    ctx.putImageData(dados, 0, 0);
    const mapa = new T.CanvasTexture(c);
    mapa.colorSpace = T.SRGBColorSpace;
    this.texturas.push(mapa);
    return mapa;
  }
  turbulencia(material) {
    const anterior = material.onBeforeCompile;
    const tempo = { value: 0 };
    material.userData.tempoGas = tempo;
    material.onBeforeCompile = (programa) => {
      anterior.call(material, programa);
      programa.uniforms.tempoGas = tempo;
      programa.fragmentShader = programa.fragmentShader.replace(
        "#include <common>",
        "#include <common>\nuniform float tempoGas;",
      );
      programa.fragmentShader = programa.fragmentShader.replace(
        "#include <map_fragment>",
        "#ifdef USE_MAP\nvec2 coordenadaGas=vMapUv;coordenadaGas.x+=sin(vMapUv.y*54.0+sin(vMapUv.x*22.0+tempoGas*0.03))*0.0017*sin(tempoGas*0.025);vec4 sampledDiffuseColor=texture2D(map,coordenadaGas);diffuseColor*=sampledDiffuseColor;\n#endif",
      );
    };
  }

  iluminacaoNoturna(material, mapa) {
    const luz = { value: new T.Vector3(1, 0, 0) };
    material.userData.direcaoSolar = luz;
    material.onBeforeCompile = (programa) => {
      programa.uniforms.mapaNoturno = { value: mapa };
      programa.uniforms.direcaoSolar = luz;
      programa.vertexShader = programa.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 normalPlaneta; varying vec2 uvPlaneta;",
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nnormalPlaneta=normal;uvPlaneta=uv;",
        );
      programa.fragmentShader = programa.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform sampler2D mapaNoturno; uniform vec3 direcaoSolar; varying vec3 normalPlaneta; varying vec2 uvPlaneta;",
        )
        .replace(
          "#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\nfloat noite=1.0-smoothstep(-0.15,0.12,dot(normalize(normalPlaneta),normalize(direcaoSolar)));totalEmissiveRadiance+=texture2D(mapaNoturno,uvPlaneta).rgb*noite*0.65;",
        );
    };
  }
  atmosfera(grupo, cor, tamanho, intensidade) {
    const m = new T.ShaderMaterial({
      ...this.shaderAtmosfera,
      uniforms: {
        cor: { value: new T.Color(cor) },
        intensidade: { value: intensidade },
      },
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });
    const esfera = new T.Mesh(this.geometriaMedia, m);
    esfera.scale.setScalar(tamanho);
    grupo.add(esfera);
  }
  criarCorona() {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const x = c.getContext("2d"),
      g = x.createRadialGradient(256, 256, 15, 256, 256, 256);
    g.addColorStop(0, "rgba(255,231,169,1)");
    g.addColorStop(0.16, "rgba(255,192,71,.7)");
    g.addColorStop(0.3, "rgba(244,144,33,.18)");
    g.addColorStop(0.55, "rgba(212,112,28,.035)");
    g.addColorStop(1, "rgba(100,40,0,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
    const mapa = new T.CanvasTexture(c);
    this.texturas.push(mapa);
    this.corona = new T.Sprite(
      new T.SpriteMaterial({
        map: mapa,
        transparent: true,
        blending: T.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.corona.scale.set(40, 40, 1);
    this.sistema.add(this.corona);
    const pontos = [];
    for (let i = 0; i < 14; i++) {
      let ang = i * 2.399;
      for (let k = 0; k < 40; k++) {
        let t = (k / 39) * Math.PI,
          r = 6.5 + Math.sin(t) * (0.1 + (i % 3) * 0.28);
        pontos.push(
          Math.cos(ang + t * 0.17) * r,
          Math.sin(ang + t * 0.17) * r,
          Math.sin(ang * 7) * 0.7,
        );
      }
    }
    this.proeminencias = new T.LineSegments(
      new T.BufferGeometry().setAttribute(
        "position",
        new T.Float32BufferAttribute(pontos, 3),
      ),
      new T.LineBasicMaterial({
        color: 0xffa535,
        transparent: true,
        opacity: 0.45,
      }),
    );
    this.sistema.add(this.proeminencias);
  }
  async aneis(eixo) {
    const geometria = new T.RingGeometry(1.25, 2.28, 180, 10),
      pos = geometria.attributes.position,
      uv = geometria.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      uv.setXY(i, (r - 1.25) / 1.03, 0.5);
    }
    let mapa;
    try {
      mapa = await this.carregador.loadAsync("texturas/saturn_ring_alpha.png");
    } catch {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 4;
      const c = canvas.getContext("2d");
      for (let x = 0; x < 512; x++) {
        c.fillStyle = `rgba(191,176,136,${0.35 + 0.3 * Math.sin(x * 1.7) ** 2})`;
        c.fillRect(x, 0, 1, 4);
      }
      mapa = new T.CanvasTexture(canvas);
      this.falhasTexturas ??= [];
      this.falhasTexturas.push("anéis de Saturno");
    }
    mapa.colorSpace = T.SRGBColorSpace;
    this.texturas.push(mapa);
    const anel = new T.Mesh(
      geometria,
      new T.MeshStandardMaterial({
        map: mapa,
        transparent: true,
        side: T.DoubleSide,
        roughness: 1,
        depthWrite: false,
        opacity: 0.94,
      }),
    );
    anel.rotation.x = -Math.PI / 2;
    eixo.add(anel);
    const material = this.corpos[5].userData.material;
    const luz = { value: new T.Vector3(1, 0.3, 0) };
    material.userData.direcaoSolar = luz;
    material.userData.anel = true;
    material.onBeforeCompile = (programa) => {
      programa.uniforms.direcaoSolar = luz;
      programa.uniforms.mapaAnel = { value: mapa };
      programa.vertexShader = programa.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 pontoAnel;",
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\npontoAnel=position;",
        );
      programa.fragmentShader = programa.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 pontoAnel;uniform vec3 direcaoSolar;uniform sampler2D mapaAnel;",
        )
        .replace(
          "#include <color_fragment>",
          "#include <color_fragment>\nvec3 luzAnel=normalize(direcaoSolar);float passagem=-pontoAnel.y/(abs(luzAnel.y)<0.0001?0.0001:luzAnel.y);float raioAnel=length((pontoAnel+passagem*luzAnel).xz);float sombra=step(0.0,passagem)*step(1.25,raioAnel)*step(raioAnel,2.28)*texture2D(mapaAnel,vec2(clamp((raioAnel-1.25)/1.03,0.0,1.0),0.5)).a;diffuseColor.rgb*=1.0-sombra*0.72;",
        );
    };
    const luzDoAnel = { value: new T.Vector3(1, 0.3, 0) };
    anel.material.userData.direcaoSolar = luzDoAnel;
    this.anelSaturno = anel;
    anel.material.onBeforeCompile = (programa) => {
      programa.uniforms.direcaoSolar = luzDoAnel;
      programa.vertexShader = programa.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 pontoSombra;",
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\npontoSombra=position;",
        );
      programa.fragmentShader = programa.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 pontoSombra;uniform vec3 direcaoSolar;",
        )
        .replace(
          "#include <color_fragment>",
          "#include <color_fragment>\nvec3 l=normalize(direcaoSolar);float proj=dot(-pontoSombra,l);float distCentro=length(pontoSombra+max(0.0,proj)*l);float eclipse=step(0.0,proj)*(1.0-smoothstep(0.91,1.02,distCentro));diffuseColor.rgb*=1.0-eclipse*0.91;",
        );
    };
  }

  anelUrano(eixo) {
    for (let i = 0; i < 4; i++) {
      const anel = new T.Mesh(
        new T.RingGeometry(1.65 + i * 0.08, 1.66 + i * 0.08, 100),
        new T.MeshBasicMaterial({
          color: 0x79938e,
          side: T.DoubleSide,
          transparent: true,
          opacity: 0.3,
        }),
      );
      anel.rotation.x = Math.PI / 2;
      eixo.add(anel);
    }
  }
  criarEstrelas(seed) {
    if (this.estrelas) {
      this.cena.remove(this.estrelas);
      this.estrelas.geometry.dispose();
      this.estrelas.material.dispose();
    }
    let s = Number(seed) || 1977;
    const aleatorio = () => {
      s = (Math.imul(1664525, s) + 1013904223) | 0;
      return (s >>> 0) / 4294967296;
    };
    const v = [],
      c = [];
    for (let i = 0; i < 8500; i++) {
      let az = aleatorio() * Math.PI * 2,
        z = aleatorio() * 2 - 1,
        r = 1100 + aleatorio() * 800,
        f = Math.sqrt(1 - z * z);
      v.push(Math.cos(az) * f * r, z * r, Math.sin(az) * f * r);
      const b = 0.28 + aleatorio() * 0.65;
      c.push(b, b * (0.84 + aleatorio() * 0.16), b * (0.7 + aleatorio() * 0.3));
    }
    this.estrelas = new T.Points(
      new T.BufferGeometry()
        .setAttribute("position", new T.Float32BufferAttribute(v, 3))
        .setAttribute("color", new T.Float32BufferAttribute(c, 3)),
      new T.PointsMaterial({
        size: 1.45,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
      }),
    );
    this.estrelas.material.onBeforeCompile = (programa) => {
      programa.fragmentShader = programa.fragmentShader.replace(
        "#include <map_particle_fragment>",
        "#include <map_particle_fragment>\nfloat distanciaEstrela=length(gl_PointCoord-vec2(0.5));diffuseColor.a*=1.0-smoothstep(0.08,0.5,distanciaEstrela);",
      );
    };
    this.cena.add(this.estrelas);
    if (!this.fundo) {
      this.carregador.load(
        "texturas/stars_milky_way.jpg",
        (mapa) => {
          mapa.colorSpace = T.SRGBColorSpace;
          this.texturas.push(mapa);
          this.fundo = new T.Mesh(
            new T.SphereGeometry(2200, 32, 16),
            new T.MeshBasicMaterial({
              map: mapa,
              side: T.BackSide,
              color: 0x68615a,
              depthWrite: false,
            }),
          );
          this.fundo.rotation.set(0.8, 0.2, 0.7);
          this.cena.add(this.fundo);
        },
        undefined,
        () => {
          this.falhasTexturas ??= [];
          this.falhasTexturas.push("Via Láctea");
        },
      );
    }
  }
  adicionarMenor(dados) {
    if (!dados?.orbit?.elements || !dados?.object)
      throw Error("O arquivo SBDB não contém uma órbita.");
    const nome = dados.object.shortname || dados.object.fullname;
    if (this.menores.some((o) => o.userData.nome === nome))
      return this.menores.find((o) => o.userData.nome === nome);
    posicaoMenor(dados.orbit, Number(dados.orbit.epoch));
    const diametro =
      Number(dados.phys_par?.find((v) => v.name === "diameter")?.value) || 1;
    const corpo = new T.Mesh(
      new T.IcosahedronGeometry(1, 2),
      new T.MeshStandardMaterial({
        map: this.cacheTexturas.get("moon"),
        color: 0x9b9a91,
        roughness: 1,
      }),
    );
    corpo.userData = { nome, orbita: dados.orbit, diametro };
    this.menores.push(corpo);
    this.sistema.add(corpo);
    const pontos = [];
    for (let k = 0; k <= 500; k++)
      pontos.push(
        ...visual(
          posicaoMenor(
            dados.orbit,
            Number(dados.orbit.epoch),
            (k / 500) * Math.PI * 2,
          ),
          this.escala,
        ),
      );
    this.linha("menor-" + nome, pontos, 0x9caa96, false, 0.4);
    return corpo;
  }
  criarAsteroides() {
    let seed = 88;
    const aleatorioLocal = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      return (seed >>> 0) / 4294967296;
    };
    this.asteroides = new T.InstancedMesh(
      new T.IcosahedronGeometry(1, 0),
      new T.MeshStandardMaterial({ color: 0x8c7963, roughness: 1 }),
      1700,
    );
    const objeto = new T.Object3D();
    for (let i = 0; i < 1700; i++) {
      const r = 13 + 20 * Math.log1p(2.15 + aleatorioLocal() * 1.2),
        a = aleatorioLocal() * Math.PI * 2;
      objeto.position.set(
        Math.cos(a) * r,
        (aleatorioLocal() - 0.5) * 1.1,
        Math.sin(a) * r,
      );
      objeto.scale.set(
        0.05 + aleatorioLocal() * 0.18,
        0.05 + aleatorioLocal() * 0.14,
        0.05 + aleatorioLocal() * 0.2,
      );
      objeto.rotation.set(aleatorioLocal() * 6, aleatorioLocal() * 6, aleatorioLocal() * 6);
      objeto.updateMatrix();
      this.asteroides.setMatrixAt(i, objeto.matrix);
    }
    this.sistema.add(this.asteroides);
  }
  limparGrupo(nome) {
    const g = this.grupos.get(nome);
    if (!g) return;
    g.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach((m) => m.dispose());
      }
    });
    g.removeFromParent();
    this.grupos.delete(nome);
  }
  linha(nome, pontos, cor = 0xc6a66a, segmentos = false, opacidade = 0.3) {
    const existente = this.grupos.get(nome)?.children[0];
    if (existente?.geometry.attributes.position.count === pontos.length / 3) {
      existente.geometry.attributes.position.array.set(pontos);
      existente.geometry.attributes.position.needsUpdate = true;
      existente.geometry.computeBoundingSphere();
      return existente.parent;
    }
    this.limparGrupo(nome);
    const g = new T.Group(),
      geo = new T.BufferGeometry().setAttribute(
        "position",
        new T.Float32BufferAttribute(pontos, 3),
      ),
      mat = new T.LineBasicMaterial({
        color: cor,
        transparent: true,
        opacity: opacidade,
        depthWrite: false,
      });
    g.add(segmentos ? new T.LineSegments(geo, mat) : new T.Line(geo, mat));
    this.sistema.add(g);
    this.grupos.set(nome, g);
    return g;
  }
  recalcularOrbitas(jd) {
    while (this.orbitas.children.length) {
      const l = this.orbitas.children[0];
      l.geometry.dispose();
      l.material.dispose();
      this.orbitas.remove(l);
    }
    for (const p of planetas) {
      const v = [];
      for (let i = 0; i <= 360; i++)
        v.push(
          ...visual(
            posicao(p.indice, jd, (i / 360) * Math.PI * 2),
            this.escala,
          ),
        );
      const geo = new T.BufferGeometry().setAttribute(
        "position",
        new T.Float32BufferAttribute(v, 3),
      );
      this.orbitas.add(
        new T.Line(
          geo,
          new T.LineBasicMaterial({
            color: p.cor,
            transparent: true,
            opacity: 0.34,
          }),
        ),
      );
    }
  }
  atualizar(jd, segundos) {
    this.tempoVisual = segundos;
    for (const corpo of this.menores) {
      corpo.position.set(
        ...visual(posicaoMenor(corpo.userData.orbita, jd), this.escala),
      );
      corpo.scale.setScalar(
        this.escala === "proporcional"
          ? (corpo.userData.diametro / 2 / UA) * 8
          : 0.55,
      );
      corpo.rotation.y = segundos * 0.03;
    }
    const terra = visual(posicao(2, jd), this.escala);
    this.sistema.position.set(
      ...(this.geocentrico ? terra.map((v) => -v) : [0, 0, 0]),
    );
    this.sol.scale.setScalar(
      this.escala === "proporcional" ? (696340 / UA) * 8 : 6.5,
    );
    this.corona.scale.setScalar(this.escala === "proporcional" ? 0.3 : 40);
    this.proeminencias.visible = this.escala !== "proporcional";
    this.asteroides.visible =
      this.mostrarAsteroides !== false && this.escala !== "proporcional";
    for (const p of this.corpos) {
      const i = p.userData.indice;
      p.position.set(...visual(posicao(i, jd), this.escala));
      const r =
        this.escala === "proporcional"
          ? (p.userData.diametro / 2 / UA) * 8
          : p.userData.raio;
      p.scale.setScalar(r);
      p.userData.lod.rotation.y =
        (((jd - 2451545) / p.userData.rotacao) % 1) * Math.PI * 2;
      if (p.userData.material.userData.tempoGas)
        p.userData.material.userData.tempoGas.value = segundos;
      if (p.userData.nuvens)
        p.userData.nuvens.rotation.y =
          (((jd - 2451545) / 1.03) % 1) * Math.PI * 2;
    }
    for (const corpo of this.corpos) {
      const material = corpo.userData.material;
      if (material.userData.direcaoSolar) {
        const eixo = material.userData.anel
          ? corpo.userData.eixo
          : corpo.userData.lod;
        eixo.updateWorldMatrix(true, false);
        const direcao = corpo.position.clone().negate().normalize();
        const rotacao = eixo.getWorldQuaternion(new T.Quaternion()).invert();
        material.userData.direcaoSolar.value
          .copy(direcao)
          .applyQuaternion(rotacao);
      }
    }
    if (this.anelSaturno) {
      this.anelSaturno.updateWorldMatrix(true, false);
      this.anelSaturno.material.userData.direcaoSolar.value
        .copy(this.corpos[5].position)
        .negate()
        .normalize()
        .applyQuaternion(
          this.anelSaturno.getWorldQuaternion(new T.Quaternion()).invert(),
        );
    }
    for (const l of this.satelites) {
      const d = l.userData,
        p = this.corpos[d.pai],
        angulo = ((jd - 2451545) / d.periodo) * Math.PI * 2;
      const r =
        this.escala === "proporcional"
          ? (d.distancia / UA) * 8
          : p.userData.raio * 1.7 + Math.log1p(d.distancia / 200000) * 1.8;
      l.position
        .copy(p.position)
        .add(
          new T.Vector3(
            Math.cos(angulo) * r,
            Math.sin(angulo) * r * Math.sin((d.inclinacao || 2) * rad),
            Math.sin(angulo) * r,
          ),
        );
      l.scale.setScalar(
        this.escala === "proporcional"
          ? (d.raio / UA) * 8
          : Math.max(0.16, d.raio / 5000),
      );
      l.rotation.y = angulo;
    }
    this.materiaisAnimados.forEach((m) => (m.uniforms.tempo.value = segundos));
    this.proeminencias.rotation.y = segundos * 0.018;
    this.corona.material.opacity = 0.86 + Math.sin(segundos * 0.3) * 0.035;
  }
  capturar(camera, texto) {
    this.renderizador.render(this.cena, camera);
    const origem = this.renderizador.domElement,
      c = document.createElement("canvas");
    c.width = origem.width;
    c.height = origem.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(origem, 0, 0);
    if (texto) {
      ctx.fillStyle = "#e1cfaa";
      ctx.font = `${Math.max(16, c.width / 90)}px Georgia`;
      ctx.fillText("PLANETÁRIO TEMPORAL · " + texto, 28, c.height - 30);
    }
    return new Promise((r) => c.toBlob(r, "image/png"));
  }
  destruir() {
    const geos = new Set(),
      mats = new Set();
    this.cena.traverse((o) => {
      if (o.geometry) geos.add(o.geometry);
      if (o.material)
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
          mats.add(m),
        );
    });
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    this.texturas.forEach((t) => t.dispose());
    this.renderizador.dispose();
  }
}
