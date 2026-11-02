import assert from "node:assert/strict";
import { test } from "node:test";
import { classificarMar, classificarQualidadeAr, montarMar, montarPainel } from "../../site/js/painel.js";
import { previsaoFalsa } from "./dados_falsos.mjs";

const LOCAL = { nome: "Manaus", estado: "Amazonas", pais: "Brasil", latitude: -3.1, longitude: -60.0 };
const QUALIDADE_AR_FALSA = { european_aqi: 35, pm2_5: 10.2, pm10: 18.0, ozone: 50.0, nitrogen_dioxide: 12.0 };

test("painel completo", () => {
  const painel = montarPainel(LOCAL, previsaoFalsa(), QUALIDADE_AR_FALSA);
  assert.equal(painel.local.nome, "Manaus");
  assert.equal(painel.fuso, "America/Manaus");
  assert.equal(painel.atual.descricao, "Chuva leve");
  assert.equal(painel.atual.dia, true);
  assert.equal(painel.qualidade_ar.nivel, "Razoável");
  assert.equal(painel.qualidade_ar.ozonio, 50.0);
});

test("por hora começa na hora atual e tem 24 horas", () => {
  const painel = montarPainel(LOCAL, previsaoFalsa());
  assert.equal(painel.por_hora[0].horario, "2026-10-29T17:00");
  assert.equal(painel.por_hora.length, 24);
});

test("dias trazem descrição e suas horas", () => {
  const hoje = montarPainel(LOCAL, previsaoFalsa()).dias[0];
  assert.equal(hoje.descricao, "Chuva leve");
  assert.equal(hoje.horas.length, 24);
  assert.ok(hoje.horas.every((h) => h.horario.startsWith("2026-10-29")));
});

test("qualidade do ar ausente", () => {
  assert.equal(montarPainel(LOCAL, previsaoFalsa(), null).qualidade_ar, null);
});

test("local sem nome vira Sua localização", () => {
  assert.equal(montarPainel({ latitude: -3.1, longitude: -60.0 }, previsaoFalsa()).local.nome, "Sua localização");
});

test("classificar qualidade do ar", () => {
  assert.equal(classificarQualidadeAr(15), "Boa");
  assert.equal(classificarQualidadeAr(55), "Moderada");
  assert.equal(classificarQualidadeAr(150), "Extremamente ruim");
  assert.equal(classificarQualidadeAr(null), null);
});

test("previsão incompleta", () => {
  const previsao = previsaoFalsa();
  delete previsao.daily;
  assert.throws(() => montarPainel(LOCAL, previsao), /incompletos/);
});

test("previsão com formato inesperado", () => {
  const previsao = previsaoFalsa();
  delete previsao.hourly.time;
  assert.throws(() => montarPainel(LOCAL, previsao), /formato inesperado/);
});

function comOntem(previsao, { maxima = 27, minima = 21, chuvaMm = 60 } = {}) {
  const horas = [...Array(24)].map((_, h) => `2026-10-28T${String(h).padStart(2, "0")}:00`);
  const antes = (lista, valores) => [...valores, ...lista];
  const { hourly, daily } = previsao;
  return {
    ...previsao,
    hourly: Object.fromEntries(Object.entries(hourly).map(([chave, lista]) =>
      [chave, antes(lista, chave === "time" ? horas : horas.map((_, i) => lista[i]))])),
    daily: {
      ...Object.fromEntries(Object.entries(daily).map(([chave, lista]) => [chave, antes(lista, [lista[0]])])),
      time: ["2026-10-28", ...daily.time],
      temperature_2m_max: [maxima, ...daily.temperature_2m_max],
      temperature_2m_min: [minima, ...daily.temperature_2m_min],
      precipitation_sum: [chuvaMm, ...daily.precipitation_sum],
    },
  };
}

test("o dia de ontem fica separado e não entra nos próximos dias", () => {
  const painel = montarPainel(LOCAL, comOntem(previsaoFalsa()));
  assert.deepEqual(painel.ontem, { data: "2026-10-28", max: 27, min: 21 });
  assert.deepEqual(painel.dias.map((d) => d.data), ["2026-10-29", "2026-10-30"]);
  assert.equal(painel.dias[0].max, 31);
  assert.equal(painel.por_hora[0].horario, "2026-10-29T17:00");
  assert.equal(painel.por_hora.length, 24);
});

test("chuva de ontem não vira alerta automático", () => {
  const painel = montarPainel(LOCAL, comOntem(previsaoFalsa(), { chuvaMm: 80 }));
  assert.ok(painel.avisos.every((a) => a.data !== "2026-10-28"));
});

test("previsão sem o dia de ontem continua funcionando", () => {
  const painel = montarPainel(LOCAL, previsaoFalsa());
  assert.equal(painel.ontem, null);
  assert.equal(painel.dias.length, 2);
});

const MAR_RIO = {
  utc_offset_seconds: -10800,
  current: { time: "2026-11-01T23:15", wave_height: 0.64, wave_direction: 143, wave_period: 6.75, sea_surface_temperature: 23.7 },
  daily: { time: ["2026-11-01", "2026-11-02"], wave_height_max: [0.9, 1.4] },
};

test("estado do mar pela altura das ondas", () => {
  assert.equal(classificarMar(0.3), "Mar calmo");
  assert.equal(classificarMar(0.64), "Mar pouco agitado");
  assert.equal(classificarMar(1.25), "Mar agitado");
  assert.equal(classificarMar(3), "Mar muito agitado");
  assert.equal(classificarMar(5), "Mar grosso");
  assert.equal(classificarMar(7), "Mar muito grosso");
  assert.equal(classificarMar(null), null);
});

test("dados do mar de uma cidade do litoral", () => {
  assert.deepEqual(montarMar(MAR_RIO), {
    ondas: 0.64, direcao: 143, periodo: 6.75, agua: 23.7, ondas_max_hoje: 0.9, ondas_max_amanha: 1.4, estado: "Mar pouco agitado",
  });
  assert.deepEqual(montarPainel(LOCAL, previsaoFalsa(), null, MAR_RIO).mar.ondas, 0.64);
});

test("cidade longe do mar não tem dados do mar", () => {
  const interior = { current: { time: "2026-11-01T23:15", wave_height: null, wave_direction: null, wave_period: null, sea_surface_temperature: null } };
  assert.equal(montarMar(interior), null);
  assert.equal(montarMar(null), null);
  assert.equal(montarPainel(LOCAL, previsaoFalsa()).mar, null);
});

test("deslocamento do fuso vem da previsão", () => {
  assert.equal(montarPainel(LOCAL, { ...previsaoFalsa(), utc_offset_seconds: -14400 }).deslocamento, -14400);
  assert.equal(montarPainel(LOCAL, previsaoFalsa()).deslocamento, 0);
});
