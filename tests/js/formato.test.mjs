import assert from "node:assert/strict";
import { test } from "node:test";
import {
  converterTemperatura, dataCurta, dataHoraLocal, diaSemana, direcao, duracao, esc, hora, horaNaCidade, minutosDoDia,
  nomeCompleto, porcentagem, temperatura, vento,
} from "../../site/js/formato.js";

test("esc protege o HTML", () => {
  assert.equal(esc(`<b a="1">'&'</b>`), "&lt;b a=&quot;1&quot;&gt;&#39;&amp;&#39;&lt;/b&gt;");
  assert.equal(esc(null), "");
});

test("temperatura em °C e °F", () => {
  assert.equal(temperatura(21.6, "C"), "22°");
  assert.equal(temperatura(0, "F"), "32°");
  assert.equal(temperatura(-40, "F"), "-40°");
  assert.equal(converterTemperatura(100, "F"), 212);
  assert.equal(temperatura(null, "C"), "—");
  assert.equal(temperatura(0, "C"), "0°");
});

test("vento nas três unidades", () => {
  assert.equal(vento(36), "36 km/h");
  assert.equal(vento(36, "ms"), "10.0 m/s");
  assert.equal(vento(16.09, "mph"), "10 mph");
  assert.equal(vento(null), "—");
  assert.equal(vento(10, "nao-existe"), "10 km/h");
});

test("direção do vento", () => {
  assert.equal(direcao(0), "N");
  assert.equal(direcao(90), "L");
  assert.equal(direcao(225, true), "sudoeste");
  assert.equal(direcao(350), "N");
  assert.equal(direcao(null), "");
});

test("porcentagem", () => {
  assert.equal(porcentagem(49.6), "50%");
  assert.equal(porcentagem(null), "—");
});

test("hora em 24 h e 12 h", () => {
  assert.equal(hora("2026-11-01T07:05"), "07:05");
  assert.equal(hora("2026-11-01T00:00", "12"), "12 AM");
  assert.equal(hora("2026-11-01T12:30", "12"), "12:30 PM");
  assert.equal(hora("2026-11-01T15:00", "12"), "3 PM");
  assert.equal(minutosDoDia("2026-11-01T01:30"), 90);
});

test("hora no fuso da cidade", () => {
  const data = new Date("2026-11-01T15:00:00Z");
  assert.equal(horaNaCidade(data, "America/Sao_Paulo"), "12:00");
  assert.equal(horaNaCidade(data, "Asia/Tokyo"), "00:00");
  assert.equal(horaNaCidade(data, "Asia/Kolkata", "12"), "8:30 PM");
  assert.equal(horaNaCidade(data, "Fuso/Invalido"), "—");
});

test("datas em português", () => {
  assert.equal(diaSemana("2026-11-01"), "Dom");
  assert.equal(diaSemana("2026-11-02T10:00", "long"), "Segunda-feira");
  assert.equal(dataCurta("2026-11-01"), "01/11");
});

test("duração", () => {
  assert.equal(duracao(45), "45min");
  assert.equal(duracao(125), "2h 05min");
});

test("nome completo do local", () => {
  assert.equal(nomeCompleto({ estado: "Rio de Janeiro", pais: "Brasil" }), "Rio de Janeiro, Brasil");
  assert.equal(nomeCompleto({ estado: "", pais: "Japão" }), "Japão");
});

test("data e hora da previsão salva no fuso do aparelho", () => {
  const fusoOriginal = process.env.TZ;
  process.env.TZ = "America/Sao_Paulo";
  try {
    assert.equal(dataHoraLocal(Date.parse("2026-11-01T15:05:00Z")), "01/11 às 12:05");
  } finally {
    if (fusoOriginal === undefined) delete process.env.TZ;
    else process.env.TZ = fusoOriginal;
  }
});
