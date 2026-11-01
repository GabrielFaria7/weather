import { gerarAvisos } from "./avisos.js";
import { descrever } from "./descricoes.js";
import { calcularIqar, concentracoesIqar } from "./iqar.js";

const HORAS_NO_PAINEL = 24;
const BLOCOS_DA_PREVISAO = ["current", "hourly", "daily"];

const NIVEIS_QUALIDADE_AR = [
  [20, "Boa"],
  [40, "Razoável"],
  [60, "Moderada"],
  [80, "Ruim"],
  [100, "Muito ruim"],
];

export function classificarQualidadeAr(indice) {
  if (indice == null) return null;
  return NIVEIS_QUALIDADE_AR.find(([limite]) => indice <= limite)?.[1] ?? "Extremamente ruim";
}

function montarHoras(horas) {
  return horas.time.map((horario, i) => ({
    horario,
    temperatura: horas.temperature_2m[i],
    codigo: horas.weather_code[i],
    descricao: descrever(horas.weather_code[i]),
    chance_chuva: horas.precipitation_probability[i],
    vento: horas.wind_speed_10m[i],
    dia: Boolean(horas.is_day[i]),
  }));
}

function montarDias(diario, todasAsHoras) {
  return diario.time.map((data, i) => ({
    data,
    codigo: diario.weather_code[i],
    descricao: descrever(diario.weather_code[i]),
    max: diario.temperature_2m_max[i],
    min: diario.temperature_2m_min[i],
    chance_chuva: diario.precipitation_probability_max[i],
    chuva_mm: diario.precipitation_sum[i],
    vento_max: diario.wind_speed_10m_max[i],
    rajada_max: diario.wind_gusts_10m_max[i],
    uv_max: diario.uv_index_max[i],
    nascer: diario.sunrise[i],
    por: diario.sunset[i],
    horas: todasAsHoras.filter((h) => h.horario.startsWith(data)),
  }));
}

function montarQualidadeAr(ar) {
  if (!ar) return null;
  const atual = ar.current ?? ar;
  return {
    indice: atual.european_aqi ?? null,
    nivel: classificarQualidadeAr(atual.european_aqi),
    iqar: ar.hourly ? calcularIqar(concentracoesIqar(ar.hourly, atual.time)) : null,
    pm2_5: atual.pm2_5 ?? null,
    pm10: atual.pm10 ?? null,
    ozonio: atual.ozone ?? null,
    dioxido_nitrogenio: atual.nitrogen_dioxide ?? null,
    dioxido_enxofre: atual.sulphur_dioxide ?? null,
    monoxido_carbono: atual.carbon_monoxide ?? null,
  };
}

export function montarPainel(local, previsao, ar = null) {
  if (!previsao || !BLOCOS_DA_PREVISAO.every((bloco) => previsao[bloco] && typeof previsao[bloco] === "object")) {
    throw new Error("Os dados da previsão vieram incompletos. Tente de novo em instantes.");
  }
  const atual = previsao.current;
  let todasAsHoras;
  let dias;
  try {
    todasAsHoras = montarHoras(previsao.hourly);
    dias = montarDias(previsao.daily, todasAsHoras);
  } catch {
    throw new Error("Os dados da previsão vieram em um formato inesperado. Tente de novo em instantes.");
  }
  const inicio = Math.max(0, todasAsHoras.findIndex((h) => h.horario.slice(0, 13) === String(atual.time).slice(0, 13)));

  return {
    local: { ...local, nome: local.nome || "Sua localização" },
    fuso: previsao.timezone ?? "UTC",
    atual: {
      horario: atual.time,
      temperatura: atual.temperature_2m,
      sensacao: atual.apparent_temperature,
      umidade: atual.relative_humidity_2m,
      ponto_orvalho: atual.dew_point_2m,
      vento: atual.wind_speed_10m,
      direcao_vento: atual.wind_direction_10m,
      rajada: atual.wind_gusts_10m,
      codigo: atual.weather_code,
      descricao: descrever(atual.weather_code),
      dia: Boolean(atual.is_day),
      pressao: atual.pressure_msl,
      visibilidade: atual.visibility,
      uv: atual.uv_index,
      precipitacao: atual.precipitation,
    },
    por_hora: todasAsHoras.slice(inicio, inicio + HORAS_NO_PAINEL),
    dias,
    qualidade_ar: montarQualidadeAr(ar),
    avisos: gerarAvisos(dias),
  };
}
