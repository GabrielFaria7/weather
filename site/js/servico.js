import { alertasOficiaisPara, noBrasil } from "./alertasOficiais.js";
import { descrever } from "./descricoes.js";
import { montarPainel } from "./painel.js";
import { previsoesSalvas } from "./preferencias.js";

const URL_GEOCODIFICACAO = "https://geocoding-api.open-meteo.com/v1/search";
const URL_PREVISAO = "https://api.open-meteo.com/v1/forecast";
const URL_QUALIDADE_AR = "https://air-quality-api.open-meteo.com/v1/air-quality";
const URL_ALERTAS_INMET = "https://apiprevmet3.inmet.gov.br/avisos/ativos";
const TEMPO_LIMITE_MS = 10000;
const PASSO_GRADE_MAPA = 0.5;
const RAIO_GRADE_MAPA = 3;
const HORAS_GRADE_MAPA = 24;
const URL_GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const MATRIZ_SATELITE = "GoogleMapsCompatible_Level7";
const URL_EUMETSAT = "https://view.eumetsat.int/geoserver";
const LIMITE_MERCATOR = 20037508.342789244;
const JANELA_SATELITE_MS = 4 * 60 * 60 * 1000;
const VALIDADE_PREVISAO_SALVA_MS = 7 * 24 * 60 * 60 * 1000;
const VALIDADE_CLIMA_ATUAL_MS = 10 * 60 * 1000;
const VALIDADE_ALERTAS_MS = 5 * 60 * 1000;

const POLUENTES = "pm10,pm2_5,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide";
const PARAMETROS_QUALIDADE_AR = {
  timezone: "auto",
  current: `european_aqi,${POLUENTES}`,
  hourly: POLUENTES,
  past_days: 1,
  forecast_days: 1,
};

const PARAMETROS_PREVISAO = {
  timezone: "auto",
  past_days: 1,
  forecast_days: 10,
  current: "temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,"
    + "wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,is_day,"
    + "pressure_msl,visibility,uv_index,precipitation",
  hourly: "temperature_2m,weather_code,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,"
    + "wind_direction_10m,is_day",
  daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,"
    + "precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset",
};

function sinalComLimite(signal) {
  const limite = AbortSignal.timeout(TEMPO_LIMITE_MS);
  if (!signal) return limite;
  return AbortSignal.any ? AbortSignal.any([signal, limite]) : signal;
}

async function pedirOpenMeteo(url, parametros, { signal } = {}) {
  let resposta;
  try {
    resposta = await fetch(`${url}?${new URLSearchParams(parametros)}`, { signal: sinalComLimite(signal) });
  } catch (erro) {
    if (signal?.aborted) throw erro;
    if (erro.name === "TimeoutError") {
      throw new Error("O serviço de meteorologia demorou demais para responder. Tente de novo em instantes.");
    }
    throw new Error("Não foi possível falar com o serviço de meteorologia. Verifique sua internet.");
  }

  const dados = await resposta.json().catch(() => ({}));
  if (resposta.status === 429) {
    throw new Error(`O limite de consultas ao serviço de meteorologia foi atingido. Tente de novo mais tarde. Detalhe: ${dados.reason ?? "429"}`);
  }
  if (!resposta.ok) {
    throw new Error(`O serviço de meteorologia recusou o pedido (código ${resposta.status}).${dados.reason ? ` Detalhe: ${dados.reason}` : ""}`);
  }
  return dados;
}

export async function buscarCidades(termo, opcoes) {
  const dados = await pedirOpenMeteo(URL_GEOCODIFICACAO, { name: termo, count: 6, language: "pt", format: "json" }, opcoes);
  return (dados.results ?? []).map((c) => ({
    id: c.id,
    nome: c.name,
    estado: c.admin1 ?? "",
    pais: c.country ?? "",
    latitude: c.latitude,
    longitude: c.longitude,
  }));
}

const normalizarLongitude = (longitude) => ((longitude + 540) % 360) - 180;
const arredondar = (valor) => Number(valor.toFixed(2));

export async function buscarGradeMapa(local, opcoes) {
  const lado = Math.round((2 * RAIO_GRADE_MAPA) / PASSO_GRADE_MAPA) + 1;
  const norte = Math.min(85, Math.max(-85 + 2 * RAIO_GRADE_MAPA, local.latitude + RAIO_GRADE_MAPA));
  const oeste = local.longitude - RAIO_GRADE_MAPA;
  const grade = { norte, oeste, passo: PASSO_GRADE_MAPA, linhas: lado, colunas: lado };

  const latitudes = [];
  const longitudes = [];
  for (let linha = 0; linha < lado; linha++) {
    for (let coluna = 0; coluna < lado; coluna++) {
      latitudes.push(arredondar(norte - linha * PASSO_GRADE_MAPA));
      longitudes.push(arredondar(normalizarLongitude(oeste + coluna * PASSO_GRADE_MAPA)));
    }
  }

  const respostas = await pedirOpenMeteo(URL_PREVISAO, {
    latitude: latitudes.join(","),
    longitude: longitudes.join(","),
    hourly: "wind_speed_10m,wind_direction_10m,temperature_2m",
    forecast_hours: HORAS_GRADE_MAPA,
    timeformat: "unixtime",
    timezone: "auto",
  }, opcoes);
  const lista = Array.isArray(respostas) ? respostas : [respostas];

  return {
    grade,
    horas: lista[0].hourly.time,
    deslocamento: lista[0].utc_offset_seconds ?? 0,
    pontos: lista.map((r) => ({
      velocidade: r.hourly.wind_speed_10m,
      direcao: r.hourly.wind_direction_10m,
      temperatura: r.hourly.temperature_2m,
      elevacao: r.elevation ?? 0,
    })),
  };
}

const isoSatelite = (data) => data.toISOString().replace(/\.\d{3}Z$/, "Z");

export function ultimosHorarios(dominio, quantidade) {
  const horarios = dominio.split(",").flatMap((trecho) => {
    const [inicio, fim, periodo] = trecho.trim().split("/");
    if (!fim) return [Date.parse(inicio)];
    const [, horas = 0, minutos = 0] = /PT(?:(\d+)H)?(?:(\d+)M)?/.exec(periodo ?? "") ?? [];
    const passo = (Number(horas) * 60 + Number(minutos) || 10) * 60000;
    const lista = [];
    for (let t = Date.parse(fim); t >= Date.parse(inicio) && lista.length < quantidade; t -= passo) lista.push(t);
    return lista;
  });
  return [...new Set(horarios)].sort((a, b) => a - b).slice(-quantidade).map((t) => isoSatelite(new Date(t)));
}

function urlHorariosSatelite({ fonte, camada }) {
  if (fonte === "eumetsat") {
    return `${URL_EUMETSAT}/${camada.replace(":", "/")}/ows?service=WMS&version=1.3.0&request=GetCapabilities`;
  }
  const fim = new Date();
  const inicio = new Date(fim.getTime() - JANELA_SATELITE_MS);
  return `${URL_GIBS}/1.0.0/${camada}/default/${MATRIZ_SATELITE}/all/${isoSatelite(inicio)}--${isoSatelite(fim)}.xml`;
}

export async function buscarHorariosSatelite(satelite, { signal } = {}) {
  let texto;
  try {
    const resposta = await fetch(urlHorariosSatelite(satelite), { signal: sinalComLimite(signal) });
    if (!resposta.ok) throw new Error(String(resposta.status));
    texto = await resposta.text();
  } catch (erro) {
    if (signal?.aborted) throw erro;
    throw new Error("Não foi possível obter as imagens de satélite agora. Tente de novo em instantes.");
  }

  const padrao = satelite.fonte === "eumetsat" ? /<Dimension name="time"[^>]*>([^<]*)<\/Dimension>/ : /<Domain>([^<]*)<\/Domain>/;
  const dominio = padrao.exec(texto)?.[1] ?? "";
  const horarios = dominio ? ultimosHorarios(dominio, satelite.quadros) : [];
  if (!horarios.length) throw new Error("Não há imagens de satélite recentes para esta região.");
  return horarios;
}

export function urlTileSatelite({ fonte, camada }, horario) {
  if (fonte === "gibs") {
    return ({ x, y, z }) => `${URL_GIBS}/${camada}/default/${horario}/${MATRIZ_SATELITE}/${z}/${y}/${x}.png`;
  }
  return ({ x, y, z }) => {
    const lado = (2 * LIMITE_MERCATOR) / 2 ** z;
    const oeste = -LIMITE_MERCATOR + x * lado;
    const norte = LIMITE_MERCATOR - y * lado;
    const parametros = new URLSearchParams({
      service: "WMS", version: "1.3.0", request: "GetMap", layers: camada, styles: "", crs: "EPSG:3857",
      bbox: [oeste, norte - lado, oeste + lado, norte].map((v) => v.toFixed(2)).join(","),
      width: 256, height: 256, format: "image/png", transparent: "true", time: horario,
    });
    return `${URL_EUMETSAT}/wms?${parametros}`;
  };
}

const climaAtualGuardado = new Map();
const chaveDoLocal = ({ latitude, longitude }) => `${Number(latitude).toFixed(2)},${Number(longitude).toFixed(2)}`;

export async function buscarClimaAtual(locais, { signal, agora = Date.now() } = {}) {
  const faltandoPorChave = new Map();
  for (const l of locais) {
    const chave = chaveDoLocal(l);
    const guardado = climaAtualGuardado.get(chave);
    const valido = guardado && agora - guardado.quando < VALIDADE_CLIMA_ATUAL_MS;
    if (!valido && !faltandoPorChave.has(chave)) faltandoPorChave.set(chave, l);
  }
  const faltando = [...faltandoPorChave.values()];

  if (faltando.length) {
    try {
      const resposta = await pedirOpenMeteo(URL_PREVISAO, {
        latitude: faltando.map((l) => l.latitude).join(","),
        longitude: faltando.map((l) => l.longitude).join(","),
        current: "temperature_2m,weather_code,is_day",
        timezone: "auto",
      }, { signal });
      const lista = Array.isArray(resposta) ? resposta : [resposta];
      faltando.forEach((local, i) => {
        const atual = lista[i]?.current;
        if (!atual) return;
        climaAtualGuardado.set(chaveDoLocal(local), {
          quando: agora,
          dados: {
            temperatura: atual.temperature_2m ?? null,
            codigo: atual.weather_code ?? null,
            descricao: descrever(atual.weather_code),
            dia: Boolean(atual.is_day),
          },
        });
      });
    } catch (erro) {
      if (erro.name === "AbortError") throw erro;
    }
  }
  return locais.map((l) => climaAtualGuardado.get(chaveDoLocal(l))?.dados ?? null);
}

let alertasGuardados = null;

async function respostaDoInmet({ signal, agora = Date.now() } = {}) {
  const idade = agora - (alertasGuardados?.quando ?? -Infinity);
  if (idade >= 0 && idade < VALIDADE_ALERTAS_MS) return alertasGuardados.resposta;
  const resposta = await fetch(URL_ALERTAS_INMET, { signal: sinalComLimite(signal) });
  if (!resposta.ok) throw new Error(`O INMET respondeu com o código ${resposta.status}.`);
  const dados = await resposta.json();
  alertasGuardados = { quando: agora, resposta: dados };
  return dados;
}

export async function buscarAlertasDosLugares(lugares, opcoes = {}) {
  const noPais = lugares.map((l) => noBrasil(l));
  if (!noPais.some(Boolean)) return lugares.map(() => undefined);
  try {
    const resposta = await respostaDoInmet(opcoes);
    return lugares.map((l, i) => (noPais[i] ? alertasOficiaisPara(resposta, l, opcoes.agora) : undefined));
  } catch {
    return noPais.map((sim) => (sim ? null : undefined));
  }
}

export async function buscarAlertasOficiais(local, opcoes) {
  const [alertas] = await buscarAlertasDosLugares([local], opcoes);
  return alertas;
}

function previsaoSalvaRecente(posicao) {
  const salva = previsoesSalvas.buscar(posicao);
  return salva && Date.now() - salva.quando < VALIDADE_PREVISAO_SALVA_MS ? salva : null;
}

export async function buscarPrevisao(local, opcoes) {
  const posicao = { latitude: local.latitude, longitude: local.longitude };
  const dadosDoLocal = { nome: local.nome, estado: local.estado, pais: local.pais, ...posicao };
  const alertasOficiais = buscarAlertasOficiais(dadosDoLocal, opcoes);
  let previsao;
  let ar;
  try {
    [previsao, ar] = await Promise.all([
      pedirOpenMeteo(URL_PREVISAO, { ...posicao, ...PARAMETROS_PREVISAO }, opcoes),
      pedirOpenMeteo(URL_QUALIDADE_AR, { ...posicao, ...PARAMETROS_QUALIDADE_AR }, opcoes)
        .then((dados) => (dados.current ? { current: dados.current, hourly: dados.hourly ?? null } : null))
        .catch(() => null),
    ]);
  } catch (erro) {
    const salva = erro.name === "AbortError" ? null : previsaoSalvaRecente(posicao);
    if (!salva) throw erro;
    const painel = montarPainel(dadosDoLocal, salva.previsao, salva.ar);
    return { ...painel, alertas_oficiais: await alertasOficiais, salvaEm: salva.quando, motivo: erro.message };
  }

  const painel = montarPainel(dadosDoLocal, previsao, ar);
  previsoesSalvas.guardar(posicao, previsao, ar);
  return { ...painel, alertas_oficiais: await alertasOficiais };
}
