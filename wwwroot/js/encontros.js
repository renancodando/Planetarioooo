import { juliano } from "./astronomia.js";
export const nomesCentros = {
  Earth: "Terra",
  Moon: "Lua",
  Mars: "Marte",
  Juptr: "Júpiter",
  Venus: "Vênus",
  Merc: "Mercúrio",
  Satrn: "Saturno",
  Urnus: "Urano",
  Neptn: "Netuno",
};
export function dataCAD(texto) {
  const meses = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  };
  const m = /^(\d{4})-([A-Za-z]{3})-(\d{2})\s+(\d{2}):(\d{2})/.exec(
    texto || "",
  );
  if (!m) return NaN;
  return juliano(new Date(Date.UTC(+m[1], meses[m[2]], +m[3], +m[4], +m[5])));
}
export function listarEncontros(catalogo) {
  const lista = [];
  for (const fonte of catalogo.encontros || []) {
    const dados = fonte.dados;
    for (const linha of dados.data || []) {
      const v = Object.fromEntries(dados.fields.map((f, i) => [f, linha[i]]));
      lista.push({
        ...v,
        centro: fonte.corpo,
        jd: Number(v.jd),
        fonte: fonte.fonte,
        consultado: fonte.consultado,
      });
    }
  }
  for (const fonte of catalogo.corpos || [])
    for (const v of fonte.dados.ca_data || []) {
      const jd = dataCAD(v.cd);
      if (jd > 2461041.5 && jd < 2462867.5)
        lista.push({
          ...v,
          des: fonte.dados.object.des,
          nome: fonte.dados.object.fullname,
          centro: v.body,
          jd,
          fonte: fonte.fonte,
          consultado: fonte.consultado,
          diameter: fonte.dados.phys_par?.find((p) => p.name === "diameter")
            ?.value,
        });
    }
  return lista.filter((v) => Number.isFinite(v.jd)).sort((a, b) => a.jd - b.jd);
}
