import assert from "node:assert/strict";
import { test } from "node:test";
import { montarPainel } from "../../site/js/painel.js";
import { dicaPorHora, seriesPorHora, VARIAVEIS_POR_HORA, variavelValida } from "../../site/js/seriesPorHora.js";
import { previsaoFalsa } from "./dados_falsos.mjs";

const HORAS = [
  { temperatura: 20, chance_chuva: 10, chuva_mm: 0, vento: 36, rajada: 54, direcao_vento: 0 },
  { temperatura: 25.4, chance_chuva: 80, chuva_mm: 3.2, vento: 18, rajada: null, direcao_vento: 225 },
  { temperatura: null, chance_chuva: null, chuva_mm: null, vento: null, rajada: null, direcao_vento: null },
];

test("três abas, com temperatura como padrão", () => {
  assert.deepEqual(VARIAVEIS_POR_HORA.map((v) => v.id), ["temperatura", "chuva", "vento"]);
  assert.equal(variavelValida("chuva"), "chuva");
  assert.equal(variavelValida("granizo"), "temperatura");
  assert.equal(variavelValida(undefined), "temperatura");
});

test("série de temperatura em °C e °F", () => {
  assert.deepEqual(seriesPorHora("temperatura", HORAS, { unidade: "C" }).linha, [20, 25.4, null]);
  assert.deepEqual(seriesPorHora("temperatura", HORAS, { unidade: "F" }).linha.map((v) => v && Math.round(v)), [68, 78, null]);
});

test("série de chuva: barras em mm e linha de chance", () => {
  const serie = seriesPorHora("chuva", HORAS, {});
  assert.deepEqual(serie.barras, [0, 3.2, null]);
  assert.deepEqual(serie.linha, [10, 80, null]);
  assert.equal(serie.maximoBarras, 3.2);
  assert.equal(seriesPorHora("chuva", [{ chuva_mm: 0.3 }], {}).maximoBarras, 2, "garoa não enche o gráfico");
});

test("série de vento nas três unidades, com rajadas", () => {
  assert.deepEqual(seriesPorHora("vento", HORAS, { vento: "kmh" }), { linha: [36, 18, null], tracejada: [54, null, null] });
  assert.deepEqual(seriesPorHora("vento", HORAS, { vento: "ms" }).linha, [10, 5, null]);
  assert.equal(Math.round(seriesPorHora("vento", HORAS, { vento: "mph" }).linha[0]), 22);
});

test("dica ao passar o mouse", () => {
  assert.deepEqual(dicaPorHora("temperatura", HORAS[1], { unidade: "C" }), ["25°C"]);
  assert.deepEqual(dicaPorHora("temperatura", HORAS[1], { unidade: "F" }), ["78°F"]);
  assert.deepEqual(dicaPorHora("chuva", HORAS[1], {}), ["80% de chance", "3,2 mm"]);
  assert.deepEqual(dicaPorHora("chuva", HORAS[2], {}), ["— de chance", "—"]);
  assert.deepEqual(dicaPorHora("vento", HORAS[0], { vento: "kmh" }), ["36 km/h do norte", "Rajadas de 54 km/h"]);
  assert.deepEqual(dicaPorHora("vento", HORAS[1], { vento: "ms" }), ["5.0 m/s do sudoeste"]);
  assert.deepEqual(dicaPorHora("vento", HORAS[2], { vento: "kmh" }), ["—"]);
});

test("painel traz chuva em mm, rajadas e direção por hora", () => {
  const previsao = previsaoFalsa();
  previsao.hourly.precipitation = previsao.hourly.time.map((_, i) => i / 10);
  previsao.hourly.wind_gusts_10m = previsao.hourly.time.map(() => 30);
  previsao.hourly.wind_direction_10m = previsao.hourly.time.map(() => 90);
  const [primeira] = montarPainel({ nome: "X", latitude: 0, longitude: 0 }, previsao).por_hora;
  assert.equal(primeira.horario, "2026-10-29T17:00");
  assert.equal(primeira.chuva_mm, 1.7);
  assert.equal(primeira.rajada, 30);
  assert.equal(primeira.direcao_vento, 90);
});

test("previsão salva antes dessas variáveis continua funcionando", () => {
  const [primeira] = montarPainel({ nome: "X", latitude: 0, longitude: 0 }, previsaoFalsa()).por_hora;
  assert.equal(primeira.chuva_mm, null);
  assert.equal(primeira.rajada, null);
  assert.equal(primeira.direcao_vento, null);
});
