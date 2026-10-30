const URL_GEOCODIFICACAO = "https://geocoding-api.open-meteo.com/v1/search";
const URL_PREVISAO = "https://api.open-meteo.com/v1/forecast";
const URL_QUALIDADE_AR = "https://air-quality-api.open-meteo.com/v1/air-quality";
const TEMPO_LIMITE_MS = 10000;
const PASSO_GRADE_VENTO = 0.5;
const RAIO_GRADE_VENTO = 3;
const HORAS_VENTO = 24;
const URL_GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const MATRIZ_SATELITE = "GoogleMapsCompatible_Level7";
const QUADROS_SATELITE = 12;
const JANELA_SATELITE_MS = 4 * 60 * 60 * 1000;

const PARAMETROS_PREVISAO = {
  timezone: "auto",
  forecast_days: 10,
  current: "temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,"
    + "wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,is_day,"
    + "pressure_msl,visibility,uv_index,precipitation",
  hourly: "temperature_2m,weather_code,precipitation_probability,wind_speed_10m,is_day",
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

async function pedirServidor(url, corpo) {
  let resposta;
  try {
    resposta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new Error("Sem conexão com o servidor. Verifique sua internet ou se o web.py está rodando.");
  }
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.erro || `Algo deu errado ao montar a previsão (código ${resposta.status}).`);
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

export async function buscarVentoGrade(local, opcoes) {
  const lado = Math.round((2 * RAIO_GRADE_VENTO) / PASSO_GRADE_VENTO) + 1;
  const norte = Math.min(85, Math.max(-85 + 2 * RAIO_GRADE_VENTO, local.latitude + RAIO_GRADE_VENTO));
  const oeste = local.longitude - RAIO_GRADE_VENTO;
  const grade = { norte, oeste, passo: PASSO_GRADE_VENTO, linhas: lado, colunas: lado };

  const latitudes = [];
  const longitudes = [];
  for (let linha = 0; linha < lado; linha++) {
    for (let coluna = 0; coluna < lado; coluna++) {
      latitudes.push(arredondar(norte - linha * PASSO_GRADE_VENTO));
      longitudes.push(arredondar(normalizarLongitude(oeste + coluna * PASSO_GRADE_VENTO)));
    }
  }

  const respostas = await pedirOpenMeteo(URL_PREVISAO, {
    latitude: latitudes.join(","),
    longitude: longitudes.join(","),
    hourly: "wind_speed_10m,wind_direction_10m",
    forecast_hours: HORAS_VENTO,
    timeformat: "unixtime",
    timezone: "auto",
  }, opcoes);
  const lista = Array.isArray(respostas) ? respostas : [respostas];

  return {
    grade,
    horas: lista[0].hourly.time,
    deslocamento: lista[0].utc_offset_seconds ?? 0,
    pontos: lista.map((r) => ({ velocidade: r.hourly.wind_speed_10m, direcao: r.hourly.wind_direction_10m })),
  };
}

const isoSatelite = (data) => data.toISOString().replace(/\.\d{3}Z$/, "Z");

function expandirHorarios(dominio) {
  return dominio.split(",").flatMap((trecho) => {
    const [inicio, fim, periodo] = trecho.trim().split("/");
    if (!fim) return [inicio];
    const passo = Number(/PT(\d+)M/.exec(periodo ?? "")?.[1] ?? 10) * 60000;
    const horarios = [];
    for (let t = Date.parse(inicio); t <= Date.parse(fim); t += passo) horarios.push(isoSatelite(new Date(t)));
    return horarios;
  });
}

export async function buscarHorariosSatelite(satelite, { signal } = {}) {
  const camada = `${satelite}_ABI_GeoColor`;
  const fim = new Date();
  const inicio = new Date(fim.getTime() - JANELA_SATELITE_MS);
  const url = `${URL_GIBS}/1.0.0/${camada}/default/${MATRIZ_SATELITE}/all/${isoSatelite(inicio)}--${isoSatelite(fim)}.xml`;

  let texto;
  try {
    const resposta = await fetch(url, { signal: sinalComLimite(signal) });
    if (!resposta.ok) throw new Error(String(resposta.status));
    texto = await resposta.text();
  } catch (erro) {
    if (signal?.aborted) throw erro;
    throw new Error("Não foi possível obter as imagens de satélite agora. Tente de novo em instantes.");
  }

  const dominio = /<Domain>([^<]*)<\/Domain>/.exec(texto)?.[1] ?? "";
  const horarios = dominio ? expandirHorarios(dominio).slice(-QUADROS_SATELITE) : [];
  if (!horarios.length) throw new Error("Não há imagens de satélite recentes para esta região.");
  return { camada, horarios };
}

export function urlTileSatelite(camada, horario) {
  return `${URL_GIBS}/${camada}/default/${horario}/${MATRIZ_SATELITE}/{z}/{y}/{x}.png`;
}

export async function buscarPrevisao(local, opcoes) {
  const posicao = { latitude: local.latitude, longitude: local.longitude };
  const [previsao, ar] = await Promise.all([
    pedirOpenMeteo(URL_PREVISAO, { ...posicao, ...PARAMETROS_PREVISAO }, opcoes),
    pedirOpenMeteo(URL_QUALIDADE_AR, { ...posicao, current: "european_aqi,pm2_5,pm10,ozone,nitrogen_dioxide" }, opcoes)
      .then((dados) => dados.current ?? null)
      .catch(() => null),
  ]);

  return pedirServidor("/api/painel", {
    local: { nome: local.nome, estado: local.estado, pais: local.pais, ...posicao },
    previsao,
    ar,
  });
}
