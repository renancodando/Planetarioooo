import { copiarEstado, validarEstado } from "./fisica.js";
export function serializarExperiencia(inicial, experimento, configuracao) {
  return {
    formato: "planetario-bifurcacao",
    versao: 1,
    salvo: new Date().toISOString(),
    inicial: {
      ...inicial,
      estado: Array.from(inicial.estado),
      massas: Array.from(inicial.massas),
      raios: Array.from(inicial.raios),
      ativos: Array.from(inicial.ativos),
    },
    experimento,
    configuracao,
  };
}
export function validarExperiencia(d) {
  if (
    d?.formato !== "planetario-bifurcacao" ||
    d.versao !== 1 ||
    !d.experimento ||
    !d.configuracao
  )
    throw Error("Arquivo de experiência não reconhecido.");
  validarEstado(d.inicial);
  if (
    !Number.isFinite(Number(d.configuracao.dias)) ||
    d.configuracao.dias <= 0 ||
    d.configuracao.dias > 365250
  )
    throw Error("Duração inválida.");
  return { ...d, inicial: copiarEstado(d.inicial) };
}
function abrir() {
  return new Promise((resolver, rejeitar) => {
    if (!globalThis.indexedDB) {
      rejeitar(Error("Armazenamento local indisponível. Exporte o JSON."));
      return;
    }
    const pedido = indexedDB.open("planetario-experiencias", 1);
    pedido.onupgradeneeded = () =>
      pedido.result.createObjectStore("experiencias", { keyPath: "id" });
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rejeitar(pedido.error);
  });
}
export async function salvarExperiencia(d, nome) {
  const banco = await abrir();
  return new Promise((resolver, rejeitar) => {
    const transacao = banco.transaction("experiencias", "readwrite"),
      id = crypto.randomUUID?.() || String(Date.now());
    transacao.objectStore("experiencias").put({ id, nome, experiencia: d });
    transacao.oncomplete = () => {
      banco.close();
      resolver(id);
    };
    transacao.onerror = () => {
      banco.close();
      rejeitar(Error("Não foi possível salvar localmente. Exporte o JSON."));
    };
  });
}
export async function listarExperiencias() {
  const banco = await abrir();
  return new Promise((resolver, rejeitar) => {
    const pedido = banco
      .transaction("experiencias")
      .objectStore("experiencias")
      .getAll();
    pedido.onsuccess = () => {
      banco.close();
      resolver(pedido.result);
    };
    pedido.onerror = () => {
      banco.close();
      rejeitar(pedido.error);
    };
  });
}
export function baixarArquivo(nome, conteudo, tipo = "application/json") {
  const arquivo = new Blob([conteudo], { type: tipo }),
    url = URL.createObjectURL(arquivo),
    a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
