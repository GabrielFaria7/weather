import assert from "node:assert/strict";
import { test } from "node:test";
import { classificarQualidadeAr, montarPainel } from "../../site/js/painel.js";
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
