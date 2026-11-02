import { converterTemperatura, hora, temperatura, vento } from "./formato.js";

const JANELA_HORAS = 12;
const CHANCE_DE_CHUVA = 50;
const CHANCE_POUCA = 30;
const RAJADA_FORTE_KMH = 50;
const TROVOADA = [95, 96, 99];

const chove = (h) => (h.chance_chuva ?? 0) >= CHANCE_DE_CHUVA && (h.chuva_mm == null || h.chuva_mm >= 0.1);
const maiuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

function noHorario(iso, formato, contracao) {
  const h = Number(iso.slice(11, 13));
  const meiaNoite = formato !== "12" && h === 0;
  const singular = meiaNoite || (formato === "12" ? h % 12 || 12 : h) === 1;
  const texto = meiaNoite ? "meia-noite" : hora(iso, formato);
  if (contracao === "de") return `${singular ? "da" : "das"} ${texto}`;
  return `${singular ? "à" : "às"} ${texto}`;
}

function extremo(horas, campo, comparar) {
  return horas.filter((h) => h[campo] != null).reduce((melhor, h) => (!melhor || comparar(h[campo], melhor[campo]) ? h : melhor), null);
}

function trechoChuva(janela, ctx) {
  const trovoada = janela.some((h) => chove(h) && TROVOADA.includes(h.codigo));
  const nome = trovoada ? "chuva com trovoadas" : "chuva";
  const chances = janela.map((h) => h.chance_chuva ?? 0);
  if (chove(janela[0])) {
    const fim = janela.findIndex((h) => !chove(h));
    return fim < 0
      ? `${nome} nas próximas ${janela.length - 1} horas`
      : `${nome} até por volta ${noHorario(janela[fim].horario, ctx.hora, "de")}`;
  }
  const inicio = janela.findIndex(chove);
  if (inicio > 0) {
    const maior = Math.max(...chances.slice(inicio));
    return `${nome} a partir ${noHorario(janela[inicio].horario, ctx.hora, "de")} (${maior}% de chance)`;
  }
  const maior = Math.max(...chances);
  return maior >= CHANCE_POUCA ? `pouca chance de chuva (até ${maior}%)` : "sem chuva prevista nas próximas horas";
}

function trechoTemperatura(horas, ctx) {
  const [agora] = horas;
  if (agora.temperatura == null) return null;
  const hoje = agora.horario.slice(0, 10);
  const pico = extremo(horas.slice(1).filter((h) => h.horario.startsWith(hoje)), "temperatura", (a, b) => a > b);
  if (pico && pico.temperatura >= agora.temperatura + 1) {
    return `máxima de ${temperatura(pico.temperatura, ctx.unidade)} ${noHorario(pico.horario, ctx.hora, "a")}`;
  }
  const vale = extremo(horas.slice(1, JANELA_HORAS + 1), "temperatura", (a, b) => a < b);
  if (vale && vale.temperatura <= agora.temperatura - 1) {
    return `temperatura caindo até ${temperatura(vale.temperatura, ctx.unidade)} ${noHorario(vale.horario, ctx.hora, "a")}`;
  }
  return null;
}

function trechoVento(janela, ctx) {
  const forte = extremo(janela, "rajada", (a, b) => a > b);
  if (!forte || forte.rajada < RAJADA_FORTE_KMH) return null;
  return `rajadas de até ${vento(forte.rajada, ctx.vento)} ${noHorario(forte.horario, ctx.hora, "a")}`;
}

export function resumoDoDia(horas, ctx = {}) {
  if (!horas?.length) return "";
  const janela = horas.slice(0, JANELA_HORAS + 1);
  const trechos = [trechoChuva(janela, ctx), trechoTemperatura(horas, ctx), trechoVento(janela, ctx)].filter(Boolean);
  const frase = trechos.length > 1 ? `${trechos.slice(0, -1).join(", ")} e ${trechos.at(-1)}` : trechos[0];
  return `${maiuscula(frase)}.`;
}

export function comparacaoComOntem(maximaDeHoje, maximaDeOntem, unidade = "C") {
  if (maximaDeHoje == null || maximaDeOntem == null) return "";
  const naTela = (valor) => Math.round(converterTemperatura(valor, unidade));
  const diferenca = naTela(maximaDeHoje) - naTela(maximaDeOntem);
  if (diferenca === 0) return "Hoje está com temperatura parecida com a de ontem";
  return `Hoje está ${Math.abs(diferenca)}° mais ${diferenca > 0 ? "quente" : "frio"} que ontem`;
}
