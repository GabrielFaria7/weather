import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  buscarCidades, buscarHorariosSatelite, buscarPrevisao, buscarGradeMapa, ultimosHorarios, urlTileSatelite,
} from "../../site/js/servico.js";
import { SATELITES } from "../../site/js/satelites.js";
import { previsaoFalsa } from "./dados_falsos.mjs";

const fetchOriginal = globalThis.fetch;
let pedidos = [];

function simularFetch(responder) {
  pedidos = [];
  globalThis.fetch = async (url) => {
    pedidos.push(new URL(url));
    const { status = 200, corpo = {}, falhar } = await responder(new URL(url));
    if (falhar) throw falhar;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => (typeof corpo === "string" ? JSON.parse(corpo) : corpo),
      text: async () => (typeof corpo === "string" ? corpo : JSON.stringify(corpo)),
    };
  };
}

let guardado;

beforeEach(() => {
  guardado = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: { getItem: (chave) => guardado.get(chave) ?? null, setItem: (chave, valor) => guardado.set(chave, String(valor)) },
  });
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

const satelite = (id) => SATELITES.find((s) => s.id === id);

test("últimos horários de um intervalo de 10 minutos", () => {
  const horarios = ultimosHorarios("2026-11-01T10:00:00Z/2026-11-01T12:00:00Z/PT10M", 12);
  assert.equal(horarios.length, 12);
  assert.equal(horarios[0], "2026-11-01T10:10:00Z");
  assert.equal(horarios.at(-1), "2026-11-01T12:00:00Z");
});

test("intervalo de anos com passo de 3 horas não percorre tudo", () => {
  const inicio = performance.now();
  const horarios = ultimosHorarios("2021-06-06T15:00:00.000Z/2026-11-01T18:00:00.000Z/PT3H", 8);
  assert.ok(performance.now() - inicio < 50);
  assert.deepEqual(horarios.slice(-2), ["2026-11-01T15:00:00Z", "2026-11-01T18:00:00Z"]);
  assert.equal(horarios.length, 8);
});

test("vários trechos, horários soltos e repetidos", () => {
  const dominio = "2026-11-01T09:00:00Z, 2026-11-01T10:00:00Z/2026-11-01T10:20:00Z/PT10M,2026-11-01T10:20:00Z";
  assert.deepEqual(ultimosHorarios(dominio, 10), [
    "2026-11-01T09:00:00Z", "2026-11-01T10:00:00Z", "2026-11-01T10:10:00Z", "2026-11-01T10:20:00Z",
  ]);
});

test("passo de hora e minuto juntos", () => {
  assert.deepEqual(ultimosHorarios("2026-11-01T00:00:00Z/2026-11-01T03:00:00Z/PT1H30M", 5), [
    "2026-11-01T00:00:00Z", "2026-11-01T01:30:00Z", "2026-11-01T03:00:00Z",
  ]);
});

test("endereço dos tiles da NASA GIBS", () => {
  const url = urlTileSatelite(satelite("GOES-East"), "2026-11-01T12:00:00Z")({ x: 3, y: 5, z: 4 });
  assert.equal(url, "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GOES-East_ABI_GeoColor/default/"
    + "2026-11-01T12:00:00Z/GoogleMapsCompatible_Level7/4/5/3.png");
});

test("endereço dos tiles da EUMETSAT calcula o recorte certo", () => {
  const montar = urlTileSatelite(satelite("MTG"), "2026-11-01T12:00:00Z");
  const mundo = new URL(montar({ x: 0, y: 0, z: 0 }));
  assert.equal(mundo.origin + mundo.pathname, "https://view.eumetsat.int/geoserver/wms");
  assert.equal(mundo.searchParams.get("layers"), "mtg_fd:ir105_hrfi");
  assert.equal(mundo.searchParams.get("time"), "2026-11-01T12:00:00Z");
  assert.equal(mundo.searchParams.get("crs"), "EPSG:3857");
  assert.equal(mundo.searchParams.get("bbox"), "-20037508.34,-20037508.34,20037508.34,20037508.34");
  const nordeste = new URL(montar({ x: 1, y: 0, z: 1 }));
  assert.equal(nordeste.searchParams.get("bbox"), "0.00,0.00,20037508.34,20037508.34");
  const sudoeste = new URL(montar({ x: 0, y: 1, z: 1 }));
  assert.equal(sudoeste.searchParams.get("bbox"), "-20037508.34,-20037508.34,0.00,0.00");
});

test("horários do satélite da EUMETSAT", async () => {
  simularFetch(() => ({
    corpo: '<Layer><Dimension name="time" default="x" units="ISO8601">'
      + "2024-09-23T00:00:00.000Z/2026-11-01T18:20:00.000Z/PT10M</Dimension></Layer>",
  }));
  const horarios = await buscarHorariosSatelite(satelite("MTG"));
  assert.equal(pedidos[0].pathname, "/geoserver/mtg_fd/ir105_hrfi/ows");
  assert.equal(pedidos[0].searchParams.get("request"), "GetCapabilities");
  assert.equal(horarios.length, 12);
  assert.equal(horarios.at(-1), "2026-11-01T18:20:00Z");
});

test("horários do satélite da NASA GIBS", async () => {
  simularFetch(() => ({ corpo: "<Domain>2026-11-01T10:00:00Z/2026-11-01T12:00:00Z/PT10M</Domain>" }));
  const horarios = await buscarHorariosSatelite(satelite("GOES-West"));
  assert.match(pedidos[0].pathname, /GOES-West_ABI_GeoColor\/default\/GoogleMapsCompatible_Level7\/all\/.+--.+\.xml$/);
  assert.equal(horarios.at(-1), "2026-11-01T12:00:00Z");
});

test("satélite sem imagens ou fora do ar", async () => {
  simularFetch(() => ({ corpo: "<Layer></Layer>" }));
  await assert.rejects(buscarHorariosSatelite(satelite("MTG")), /Não há imagens de satélite recentes/);
  simularFetch(() => ({ status: 503, corpo: "erro" }));
  await assert.rejects(buscarHorariosSatelite(satelite("MTG")), /Não foi possível obter as imagens de satélite/);
  simularFetch(() => ({ falhar: new TypeError("sem rede") }));
  await assert.rejects(buscarHorariosSatelite(satelite("GOES-East")), /Não foi possível obter as imagens de satélite/);
});

test("busca de cidades", async () => {
  simularFetch(() => ({
    corpo: { results: [{ id: 1, name: "Rio de Janeiro", admin1: "Rio de Janeiro", country: "Brasil", latitude: -22.9, longitude: -43.2 },
      { id: 2, name: "Rio", latitude: 1, longitude: 2 }] },
  }));
  const cidades = await buscarCidades("Rio");
  assert.equal(pedidos[0].searchParams.get("name"), "Rio");
  assert.equal(pedidos[0].searchParams.get("language"), "pt");
  assert.deepEqual(cidades[1], { id: 2, nome: "Rio", estado: "", pais: "", latitude: 1, longitude: 2 });
  simularFetch(() => ({ corpo: {} }));
  assert.deepEqual(await buscarCidades("xyz"), []);
});

test("mensagens de erro da Open-Meteo", async () => {
  simularFetch(() => ({ status: 429, corpo: { reason: "Daily API request limit exceeded" } }));
  await assert.rejects(buscarCidades("Rio"), /limite de consultas.*Daily API request limit exceeded/);
  simularFetch(() => ({ status: 400, corpo: { reason: "Parâmetro inválido" } }));
  await assert.rejects(buscarCidades("Rio"), /recusou o pedido \(código 400\)\. Detalhe: Parâmetro inválido/);
  simularFetch(() => ({ falhar: new TypeError("sem rede") }));
  await assert.rejects(buscarCidades("Rio"), /Verifique sua internet/);
  simularFetch(() => ({ falhar: Object.assign(new Error("tempo"), { name: "TimeoutError" }) }));
  await assert.rejects(buscarCidades("Rio"), /demorou demais/);
});

test("pedido cancelado não vira mensagem de erro", async () => {
  const controle = new AbortController();
  controle.abort();
  simularFetch(() => ({ falhar: Object.assign(new Error("cancelado"), { name: "AbortError" }) }));
  await assert.rejects(buscarCidades("Rio", { signal: controle.signal }), { name: "AbortError" });
});

function respostasDaGrade(url) {
  const latitudes = url.searchParams.get("latitude").split(",");
  return latitudes.map((_, i) => ({
    utc_offset_seconds: -10800,
    elevation: 10 * i,
    hourly: {
      time: [1793390400, 1793394000],
      wind_speed_10m: [i, i + 1],
      wind_direction_10m: [90, 180],
      temperature_2m: [20 + i / 10, 19],
    },
  }));
}

test("grade do mapa (vento e temperatura) em volta da cidade", async () => {
  simularFetch((url) => ({ corpo: respostasDaGrade(url) }));
  const dados = await buscarGradeMapa({ latitude: -22.9, longitude: -43.2 });
  const latitudes = pedidos[0].searchParams.get("latitude").split(",").map(Number);
  const longitudes = pedidos[0].searchParams.get("longitude").split(",").map(Number);
  assert.equal(latitudes.length, 169);
  assert.equal(latitudes[0], -19.9);
  assert.equal(latitudes.at(-1), -25.9);
  assert.equal(longitudes[0], -46.2);
  assert.equal(longitudes[12], -40.2);
  assert.deepEqual(dados.grade, { norte: -19.9, oeste: -46.2, passo: 0.5, linhas: 13, colunas: 13 });
  assert.equal(dados.pontos.length, 169);
  assert.equal(dados.deslocamento, -10800);
  assert.equal(pedidos[0].searchParams.get("hourly"), "wind_speed_10m,wind_direction_10m,temperature_2m");
  assert.deepEqual(dados.pontos[5], { velocidade: [5, 6], direcao: [90, 180], temperatura: [20.5, 19], elevacao: 50 });
});

test("grade do mapa perto da linha de data e do polo", async () => {
  simularFetch((url) => ({ corpo: respostasDaGrade(url) }));
  const dados = await buscarGradeMapa({ latitude: 84, longitude: 179 });
  const longitudes = pedidos[0].searchParams.get("longitude").split(",").map(Number);
  assert.ok(longitudes.every((l) => l >= -180 && l < 180));
  assert.ok(longitudes.includes(-179));
  assert.equal(dados.grade.norte, 85);
});

test("previsão completa monta o painel no navegador", async () => {
  simularFetch((url) => (url.hostname.startsWith("air-quality")
    ? { corpo: { current: { european_aqi: 55, pm2_5: 9, pm10: 15, ozone: 60, nitrogen_dioxide: 8 } } }
    : url.hostname.endsWith("inmet.gov.br") ? { corpo: { hoje: [], futuro: [] } } : { corpo: previsaoFalsa() }));
  const painel = await buscarPrevisao({ nome: "Manaus", estado: "Amazonas", pais: "Brasil", latitude: -3.1, longitude: -60 });
  assert.deepEqual(pedidos.map((p) => p.hostname).sort(), [
    "air-quality-api.open-meteo.com", "api.open-meteo.com", "apiprevmet3.inmet.gov.br", "marine-api.open-meteo.com",
  ]);
  assert.deepEqual(painel.alertas_oficiais, []);
  assert.equal(painel.local.nome, "Manaus");
  assert.equal(painel.qualidade_ar.nivel, "Moderada");
  assert.equal(painel.por_hora.length, 24);
});

test("dados do mar vêm junto e a falha deles não impede a previsão", async () => {
  const mar = { current: { wave_height: 1.1, wave_direction: 128, wave_period: 6.4, sea_surface_temperature: 23.8 }, daily: { wave_height_max: [1.3, 1.5] } };
  simularFetch((url) => (url.hostname.startsWith("marine") ? { corpo: mar } : url.hostname.startsWith("air") ? { status: 500 } : { corpo: previsaoFalsa() }));
  const santos = await buscarPrevisao({ nome: "Santos", latitude: -23.96, longitude: -46.33 });
  assert.equal(santos.mar.estado, "Mar pouco agitado");
  const pedidoMar = pedidos.find((p) => p.hostname === "marine-api.open-meteo.com");
  assert.equal(pedidoMar.searchParams.get("current"), "wave_height,wave_direction,wave_period,sea_surface_temperature");
  simularFetch((url) => (url.hostname.startsWith("marine") ? { falhar: new TypeError("sem rede") } : { corpo: previsaoFalsa() }));
  const semMar = await buscarPrevisao({ nome: "Santos", latitude: -23.96, longitude: -46.33 });
  assert.equal(semMar.mar, null);
  assert.equal(semMar.por_hora.length, 24);
});

test("previsão aparece sem esperar o INMET e a qualidade do ar quando eles demoram", async () => {
  const devagar = (corpo, ms) => new Promise((resolver) => setTimeout(() => resolver({ corpo }), ms));
  simularFetch((url) => {
    if (url.hostname.endsWith("inmet.gov.br")) return devagar({ hoje: [], futuro: [] }, 700);
    if (url.hostname.startsWith("air-quality")) return devagar({ current: { european_aqi: 25 } }, 700);
    if (url.hostname.startsWith("marine")) return { corpo: {} };
    return { corpo: previsaoFalsa() };
  });
  const inicio = Date.now();
  const painel = await buscarPrevisao({ nome: "Manaus", estado: "Amazonas", pais: "Brasil", latitude: -3.1, longitude: -60 });
  assert.ok(Date.now() - inicio < 650, "o painel não pode esperar os complementos lentos");
  assert.equal(painel.pendente, true);
  assert.equal(painel.qualidade_ar, null);
  assert.equal(painel.alertas_oficiais, undefined);
  assert.equal(painel.por_hora.length, 24);
  const extras = await painel.complementos;
  assert.deepEqual(extras.alertas_oficiais, []);
  assert.equal(extras.qualidade_ar.nivel, "Razoável");
  assert.equal(extras.mar, null);
});

test("complementos rápidos já vêm junto, sem segunda etapa", async () => {
  simularFetch((url) => (url.hostname.endsWith("inmet.gov.br") ? { corpo: { hoje: [], futuro: [] } } : { corpo: previsaoFalsa() }));
  const painel = await buscarPrevisao({ nome: "Manaus", estado: "Amazonas", pais: "Brasil", latitude: -3.1, longitude: -60 });
  assert.equal(painel.pendente, undefined);
  assert.equal(painel.complementos, undefined);
  assert.deepEqual(painel.alertas_oficiais, []);
});

test("falha na qualidade do ar não impede a previsão", async () => {
  simularFetch((url) => (url.hostname.startsWith("air-quality") ? { status: 500 } : { corpo: previsaoFalsa() }));
  const painel = await buscarPrevisao({ nome: "Manaus", latitude: -3.1, longitude: -60 });
  assert.equal(painel.qualidade_ar, null);
  assert.equal(painel.atual.descricao, "Chuva leve");
});

const MANAUS = { nome: "Manaus", estado: "Amazonas", pais: "Brasil", latitude: -3.1, longitude: -60 };
const respostaCompleta = (url) => (url.hostname.startsWith("air-quality")
  ? { corpo: { current: { european_aqi: 25 } } }
  : { corpo: previsaoFalsa() });

test("previsão que deu certo fica salva no navegador", async () => {
  simularFetch(respostaCompleta);
  const painel = await buscarPrevisao(MANAUS);
  assert.equal(painel.salvaEm, undefined);
  const salvas = JSON.parse(guardado.get("weather.previsoes"));
  assert.equal(salvas.length, 1);
  assert.deepEqual(salvas[0].local, { latitude: -3.1, longitude: -60 });
  assert.equal(salvas[0].ar.current.european_aqi, 25);
});

test("sem internet usa a previsão salva e avisa quando ela é", async () => {
  simularFetch(respostaCompleta);
  await buscarPrevisao(MANAUS);
  simularFetch(() => ({ falhar: new TypeError("sem rede") }));
  const painel = await buscarPrevisao({ ...MANAUS, latitude: -3.1001 });
  assert.ok(Date.now() - painel.salvaEm < 5000);
  assert.match(painel.motivo, /Verifique sua internet/);
  assert.equal(painel.local.nome, "Manaus");
  assert.equal(painel.atual.descricao, "Chuva leve");
  assert.equal(painel.qualidade_ar.indice, 25);
});

test("limite de consultas também usa a previsão salva", async () => {
  simularFetch(respostaCompleta);
  await buscarPrevisao(MANAUS);
  simularFetch(() => ({ status: 429, corpo: { reason: "limite" } }));
  assert.ok((await buscarPrevisao(MANAUS)).salvaEm);
});

test("sem previsão salva daquela cidade mostra o erro", async () => {
  simularFetch(respostaCompleta);
  await buscarPrevisao(MANAUS);
  simularFetch(() => ({ falhar: new TypeError("sem rede") }));
  await assert.rejects(buscarPrevisao({ nome: "Recife", latitude: -8.05, longitude: -34.9 }), /Verifique sua internet/);
});

test("previsão salva há mais de 7 dias não é usada", async () => {
  const antiga = Date.now() - 8 * 24 * 60 * 60 * 1000;
  guardado.set("weather.previsoes", JSON.stringify([{ local: { latitude: -3.1, longitude: -60 }, previsao: previsaoFalsa(), ar: null, quando: antiga }]));
  simularFetch(() => ({ falhar: new TypeError("sem rede") }));
  await assert.rejects(buscarPrevisao(MANAUS), /Verifique sua internet/);
});

test("pedido cancelado não usa a previsão salva", async () => {
  simularFetch(respostaCompleta);
  await buscarPrevisao(MANAUS);
  const controle = new AbortController();
  controle.abort();
  simularFetch(() => ({ falhar: Object.assign(new Error("cancelado"), { name: "AbortError" }) }));
  await assert.rejects(buscarPrevisao(MANAUS, { signal: controle.signal }), { name: "AbortError" });
});

test("dados quebrados da API não são salvos", async () => {
  simularFetch((url) => (url.hostname.startsWith("air-quality") ? { corpo: {} } : { corpo: { current: {} } }));
  await assert.rejects(buscarPrevisao(MANAUS), /incompletos/);
  assert.equal(guardado.get("weather.previsoes"), undefined);
});
