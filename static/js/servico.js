const URL_GEOCODIFICACAO = "https://geocoding-api.open-meteo.com/v1/search";
const URL_PREVISAO = "https://api.open-meteo.com/v1/forecast";
const URL_QUALIDADE_AR = "https://air-quality-api.open-meteo.com/v1/air-quality";
const TEMPO_LIMITE_MS = 10000;

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
