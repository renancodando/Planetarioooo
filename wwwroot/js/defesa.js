export function classificarObjeto(d) {
  const o = d.object || {},
    classes = [];
  if (o.neo) classes.push("Objeto próximo da Terra");
  if (o.pha)
    classes.push(
      "Classificação PHA: critério orbital e de magnitude, não previsão de impacto",
    );
  if (d.orbit?.condition_code != null)
    classes.push("Código de condição orbital: " + d.orbit.condition_code);
  if (d.orbit?.covariance) classes.push("Covariância disponível");
  return classes.length
    ? classes
    : ["Corpo catalogado; classificação de risco não inferida"];
}
export const explicacaoDefesa =
  "Proximidade não significa impacto. PHA é uma classificação orbital; Sentry avalia soluções de impacto e Scout acompanha candidatos com arcos observacionais curtos. Dados arquivados não constituem alerta em tempo real.";
