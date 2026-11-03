import { readFileSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";

const DADOS = new URL("../js/dados/", import.meta.url);
const INMET = JSON.parse(readFileSync(new URL("inmet-avisos-2026-11-01.json", DADOS), "utf8"));
const QUALIDADE_DO_AR = readFileSync(new URL("open-meteo-ar-sao-paulo-2026-11-01.json", DADOS), "utf8");
const DESLOCAMENTO = -10800;
const HORA_MS = 3600 * 1000;

function bloco(tipo, dados) {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, "ascii"), dados]);
  const verificacao = Buffer.alloc(4);
  verificacao.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tamanho, corpo, verificacao]);
}

export function pngDeUmaCor(r, g, b, a = 255) {
  const cabecalho = Buffer.alloc(13);
  cabecalho.writeUInt32BE(1, 0);
  cabecalho.writeUInt32BE(1, 4);
  cabecalho.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco("IHDR", cabecalho),
    bloco("IDAT", deflateSync(Buffer.from([0, r, g, b, a]))),
    bloco("IEND", Buffer.alloc(0)),
  ]);
}

const MAPA_BASE = pngDeUmaCor(236, 238, 240);
const NUVENS = pngDeUmaCor(250, 250, 250, 180);
const RELEVO_NO_NIVEL_DO_MAR = pngDeUmaCor(128, 0, 0);

const isoLocal = (instante) => new Date(instante + DESLOCAMENTO * 1000).toISOString().slice(0, 16);

export function previsaoDeTeste(agora = Date.now()) {
  const hojeLocal = isoLocal(agora).slice(0, 10);
  const inicio = Date.parse(`${hojeLocal}T00:00:00Z`) - DESLOCAMENTO * 1000 - 24 * HORA_MS;
  const horas = Array.from({ length: 11 * 24 }, (_, i) => isoLocal(inicio + i * HORA_MS));
  const horaDoDia = (iso) => Number(iso.slice(11, 13));
  const temperaturas = horas.map((h, i) => +(21 + 5 * Math.sin(((horaDoDia(h) - 9) / 24) * 2 * Math.PI) + i / 132).toFixed(1));
  const chances = horas.map((h, i) => (i > 24 && horaDoDia(h) >= 15 && horaDoDia(h) <= 18 ? 70 : 10));
  const datas = Array.from({ length: 11 }, (_, d) => horas[d * 24].slice(0, 10));
  const doDia = (lista, d) => lista.slice(d * 24, d * 24 + 24);
  const agoraLocal = `${isoLocal(agora).slice(0, 13)}:00`;
  return {
    latitude: -22.9, longitude: -43.18, timezone: "America/Sao_Paulo", utc_offset_seconds: DESLOCAMENTO, elevation: 12,
    current: {
      time: agoraLocal, temperature_2m: temperaturas[horas.indexOf(agoraLocal)] ?? 23, apparent_temperature: 25,
      relative_humidity_2m: 78, dew_point_2m: 19, wind_speed_10m: 9, wind_direction_10m: 160, wind_gusts_10m: 22,
      weather_code: 2, is_day: horaDoDia(agoraLocal) >= 6 && horaDoDia(agoraLocal) < 18 ? 1 : 0, pressure_msl: 1014,
      visibility: 18000, uv_index: 4, precipitation: 0,
    },
    hourly: {
      time: horas,
      temperature_2m: temperaturas,
      weather_code: chances.map((c) => (c > 50 ? 61 : 2)),
      precipitation_probability: chances,
      precipitation: chances.map((c) => (c > 50 ? 1.2 : 0)),
      wind_speed_10m: horas.map(() => 10),
      wind_gusts_10m: horas.map((h) => (horaDoDia(h) === 16 ? 55 : 24)),
      wind_direction_10m: horas.map(() => 150),
      is_day: horas.map((h) => (horaDoDia(h) >= 6 && horaDoDia(h) < 18 ? 1 : 0)),
    },
    daily: {
      time: datas,
      weather_code: datas.map(() => 61),
      temperature_2m_max: datas.map((_, d) => Math.max(...doDia(temperaturas, d))),
      temperature_2m_min: datas.map((_, d) => Math.min(...doDia(temperaturas, d))),
      precipitation_probability_max: datas.map(() => 70),
      precipitation_sum: datas.map(() => 4.8),
      wind_speed_10m_max: datas.map(() => 18),
      wind_gusts_10m_max: datas.map(() => 55),
      uv_index_max: datas.map(() => 8),
      sunrise: datas.map((d) => `${d}T05:08`),
      sunset: datas.map((d) => `${d}T18:12`),
    },
  };
}

function gradeDeTeste(parametros, agora = Date.now()) {
  const latitudes = parametros.get("latitude").split(",").map(Number);
  const longitudes = parametros.get("longitude").split(",").map(Number);
  const inicio = Math.floor(agora / HORA_MS) * 3600;
  const time = Array.from({ length: 24 }, (_, i) => inicio + i * 3600);
  return latitudes.map((latitude, k) => ({
    utc_offset_seconds: DESLOCAMENTO,
    elevation: Math.max(0, 900 - Math.abs(longitudes[k] + 43.4) * 700),
    hourly: {
      time,
      wind_speed_10m: time.map(() => 18),
      wind_direction_10m: time.map((_, h) => 140 + h),
      temperature_2m: time.map((_, h) => 27 - (latitude + 23) * 1.3 + 3 * Math.sin(h / 4)),
    },
  }));
}

function climaDeAgoraDeTeste(parametros) {
  const quantidade = parametros.get("latitude").split(",").length;
  const lista = Array.from({ length: quantidade }, (_, i) => ({ current: { temperature_2m: 20 + i, weather_code: 2, is_day: 1 } }));
  return quantidade === 1 ? lista[0] : lista;
}

const CIDADES = {
  results: [
    { id: 3451190, name: "Rio de Janeiro", admin1: "Rio de Janeiro", country: "Brasil", latitude: -22.90642, longitude: -43.18223 },
    { id: 3448439, name: "São Paulo", admin1: "São Paulo", country: "Brasil", latitude: -23.5475, longitude: -46.63611 },
  ],
};

const MAR = {
  current: { wave_height: 0.8, wave_direction: 140, wave_period: 7, sea_surface_temperature: 23.5 },
  daily: { wave_height_max: [1.1, 1.3] },
};

function horariosDeSatelite(agora = Date.now()) {
  const fim = new Date(Math.floor((agora - HORA_MS) / 600000) * 600000);
  const inicio = new Date(fim.getTime() - 3 * HORA_MS);
  const iso = (data) => data.toISOString().replace(/\.\d{3}Z$/, "Z");
  return `${iso(inicio)}/${iso(fim)}/PT10M`;
}

function alertasDeHoje(agora = Date.now()) {
  const dias = Math.round((Date.parse(isoLocal(agora).slice(0, 10)) - Date.parse("2026-11-01")) / (24 * HORA_MS));
  const mover = (texto) => {
    const [data, hora] = texto.split(" ");
    return `${new Date(Date.parse(data) + dias * 24 * HORA_MS).toISOString().slice(0, 10)} ${hora}`;
  };
  const ajustar = (lista) => lista.map((alerta) => ({ ...alerta, inicio: mover(alerta.inicio), fim: mover(alerta.fim) }));
  return { ...INMET, hoje: ajustar(INMET.hoje ?? []), futuro: ajustar(INMET.futuro ?? []) };
}

const comCors = { "access-control-allow-origin": "*" };
const json = (corpo) => ({ status: 200, contentType: "application/json", headers: comCors, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) });
const png = (dados) => ({ status: 200, contentType: "image/png", headers: comCors, body: dados });
const xml = (texto) => ({ status: 200, contentType: "application/xml", headers: comCors, body: texto });
const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

export async function simularServicos(contexto, { atrasoComplementosMs = 0 } = {}) {
  const atrasar = () => (atrasoComplementosMs ? esperar(atrasoComplementosMs) : null);
  await contexto.route("https://api.open-meteo.com/**", (rota) => {
    const parametros = new URL(rota.request().url()).searchParams;
    if (parametros.get("latitude").includes(",") && parametros.get("hourly")) return rota.fulfill(json(gradeDeTeste(parametros)));
    if (parametros.get("current") === "temperature_2m,weather_code,is_day") return rota.fulfill(json(climaDeAgoraDeTeste(parametros)));
    return rota.fulfill(json(previsaoDeTeste()));
  });
  await contexto.route("https://geocoding-api.open-meteo.com/**", (rota) => rota.fulfill(json(CIDADES)));
  await contexto.route("https://air-quality-api.open-meteo.com/**", async (rota) => {
    await atrasar();
    await rota.fulfill(json(QUALIDADE_DO_AR));
  });
  await contexto.route("https://marine-api.open-meteo.com/**", (rota) => rota.fulfill(json(MAR)));
  await contexto.route("https://apiprevmet3.inmet.gov.br/**", async (rota) => {
    await atrasar();
    await rota.fulfill(json(alertasDeHoje()));
  });
  await contexto.route("https://gibs.earthdata.nasa.gov/**", (rota) => (rota.request().url().endsWith(".xml")
    ? rota.fulfill(xml(`<Domains><Domain>${horariosDeSatelite()}</Domain></Domains>`))
    : rota.fulfill(png(NUVENS))));
  await contexto.route("https://view.eumetsat.int/**", (rota) => (rota.request().url().includes("GetCapabilities")
    ? rota.fulfill(xml(`<WMS_Capabilities><Dimension name="time" units="ISO8601">${horariosDeSatelite()}</Dimension></WMS_Capabilities>`))
    : rota.fulfill(png(NUVENS))));
  await contexto.route(/^https:\/\/[abc]\.tile\.openstreetmap\.org\//, (rota) => rota.fulfill(png(MAPA_BASE)));
  await contexto.route("https://s3.amazonaws.com/elevation-tiles-prod/**", (rota) => rota.fulfill(png(RELEVO_NO_NIVEL_DO_MAR)));
}
