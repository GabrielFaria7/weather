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

const ESTADOS_DO_MAR = [
  [0.5, "Mar calmo"],
  [1.25, "Mar pouco agitado"],
  [2.5, "Mar agitado"],
  [4, "Mar muito agitado"],
  [6, "Mar grosso"],
];

export function classificarMar(altura) {
  if (altura == null) return null;
  return ESTADOS_DO_MAR.find(([limite]) => altura < limite)?.[1] ?? "Mar muito grosso";
}

export function montarMar(mar) {
  const atual = mar?.current;
  if (!atual || (atual.wave_height == null && atual.sea_surface_temperature == null)) return null;
  const maximas = mar.daily?.wave_height_max ?? [];
  return {
    ondas: atual.wave_height ?? null,
    direcao: atual.wave_direction ?? null,
    periodo: atual.wave_period ?? null,
    agua: atual.sea_surface_temperature ?? null,
    ondas_max_hoje: maximas[0] ?? null,
    ondas_max_amanha: maximas[1] ?? null,
    estado: classificarMar(atual.wave_height),
  };
}

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
    chuva_mm: horas.precipitation?.[i] ?? null,
    vento: horas.wind_speed_10m[i],
    rajada: horas.wind_gusts_10m?.[i] ?? null,
    direcao_vento: horas.wind_direction_10m?.[i] ?? null,
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

export function montarPainel(local, previsao, ar = null, mar = null) {
  if (!previsao || !BLOCOS_DA_PREVISAO.every((bloco) => previsao[bloco] && typeof previsao[bloco] === "object")) {
    throw new Error("Os dados da previsão vieram incompletos. Tente de novo em instantes.");
  }
  const atual = previsao.current;
  const hoje = String(atual.time).slice(0, 10);
  let todasAsHoras;
  let todosOsDias;
  try {
    todasAsHoras = montarHoras(previsao.hourly);
    todosOsDias = montarDias(previsao.daily, todasAsHoras);
  } catch {
    throw new Error("Os dados da previsão vieram em um formato inesperado. Tente de novo em instantes.");
  }
  const inicio = Math.max(0, todasAsHoras.findIndex((h) => h.horario.slice(0, 13) === String(atual.time).slice(0, 13)));
  const ontem = todosOsDias.filter((d) => d.data < hoje).at(-1) ?? null;
  const dias = todosOsDias.some((d) => d.data >= hoje) ? todosOsDias.filter((d) => d.data >= hoje) : todosOsDias;

  return {
    local: { ...local, nome: local.nome || "Sua localização" },
    fuso: previsao.timezone ?? "UTC",
    deslocamento: previsao.utc_offset_seconds ?? 0,
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
    ontem: ontem && { data: ontem.data, max: ontem.max, min: ontem.min },
    qualidade_ar: montarQualidadeAr(ar),
    mar: montarMar(mar),
    avisos: gerarAvisos(dias),
  };
}
