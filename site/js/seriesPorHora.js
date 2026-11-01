import { converterTemperatura, converterVento, direcao, milimetros, porcentagem, temperatura, vento } from "./formato.js";

export const VARIAVEIS_POR_HORA = [
  { id: "temperatura", nome: "Temperatura" },
  { id: "chuva", nome: "Chuva" },
  { id: "vento", nome: "Vento" },
];

const CHUVA_MINIMA_NO_EIXO_MM = 2;

export function variavelValida(id) {
  return VARIAVEIS_POR_HORA.some((v) => v.id === id) ? id : "temperatura";
}

export function seriesPorHora(variavel, horas, ctx = {}) {
  if (variavel === "chuva") {
    const milimetrosPorHora = horas.map((h) => h.chuva_mm ?? null);
    return {
      barras: milimetrosPorHora,
      linha: horas.map((h) => h.chance_chuva ?? null),
      maximoBarras: Math.max(CHUVA_MINIMA_NO_EIXO_MM, ...milimetrosPorHora.filter((v) => v != null)),
    };
  }
  if (variavel === "vento") {
    return {
      linha: horas.map((h) => converterVento(h.vento, ctx.vento)),
      tracejada: horas.map((h) => converterVento(h.rajada, ctx.vento)),
    };
  }
  return { linha: horas.map((h) => converterTemperatura(h.temperatura, ctx.unidade)) };
}

export function dicaPorHora(variavel, hora, ctx = {}) {
  if (variavel === "chuva") {
    return [`${porcentagem(hora.chance_chuva)} de chance`, milimetros(hora.chuva_mm)];
  }
  if (variavel === "vento") {
    const deOnde = hora.direcao_vento == null ? "" : ` do ${direcao(hora.direcao_vento, true)}`;
    const linhas = [`${vento(hora.vento, ctx.vento)}${deOnde}`];
    if (hora.rajada != null) linhas.push(`Rajadas de ${vento(hora.rajada, ctx.vento)}`);
    return linhas;
  }
  return [`${temperatura(hora.temperatura, ctx.unidade)}${ctx.unidade ?? "C"}`];
}
