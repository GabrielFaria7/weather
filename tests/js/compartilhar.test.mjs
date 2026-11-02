import assert from "node:assert/strict";
import { test } from "node:test";
import { conteudoParaCompartilhar, enderecoParaCompartilhar } from "../../site/js/compartilhar.js";
import { montarPainel } from "../../site/js/painel.js";
import { previsaoFalsa } from "./dados_falsos.mjs";

const BASE = "https://gabrielfaria7.github.io/weather/";
const RIO = { nome: "Rio de Janeiro", estado: "Rio de Janeiro", pais: "Brasil", latitude: -22.90642, longitude: -43.18223 };
const GPS = { nome: "Sua localização", estado: "", pais: "", latitude: -22.95127, longitude: -43.21048 };

test("link da cidade abre o mesmo lugar no site", () => {
  const url = new URL(enderecoParaCompartilhar(RIO, BASE));
  assert.equal(url.origin + url.pathname, BASE);
  assert.equal(url.searchParams.get("lat"), "-22.90642");
  assert.equal(url.searchParams.get("lon"), "-43.18223");
  assert.equal(url.searchParams.get("nome"), "Rio de Janeiro");
  assert.equal(url.searchParams.get("estado"), "Rio de Janeiro");
  assert.equal(url.searchParams.get("pais"), "Brasil");
});

test("localização do GPS vai arredondada e sem o nome Sua localização", () => {
  const url = new URL(enderecoParaCompartilhar(GPS, BASE));
  assert.equal(url.searchParams.get("lat"), "-22.95");
  assert.equal(url.searchParams.get("lon"), "-43.21");
  assert.equal(url.searchParams.get("nome"), "Local compartilhado");
  assert.equal(url.searchParams.has("estado"), false);
  assert.equal(url.searchParams.has("pais"), false);
});

test("texto com o tempo de agora, máxima, mínima e o resumo", () => {
  const dados = montarPainel(RIO, previsaoFalsa());
  const conteudo = conteudoParaCompartilhar(dados, { unidade: "C", vento: "kmh", hora: "24" }, BASE);
  assert.equal(conteudo.title, "Rio de Janeiro · Weather");
  assert.ok(conteudo.text.startsWith("Rio de Janeiro: 29°C, chuva leve (máx. 31° · mín. 24°). "), conteudo.text);
  assert.ok(conteudo.text.endsWith("."));
  assert.equal(conteudo.url, enderecoParaCompartilhar(RIO, BASE));
});

test("texto em Fahrenheit e sem nome da localização do GPS", () => {
  const dados = montarPainel(GPS, previsaoFalsa());
  const conteudo = conteudoParaCompartilhar(dados, { unidade: "F", vento: "kmh", hora: "12" }, BASE);
  assert.equal(conteudo.title, "Local compartilhado · Weather");
  assert.ok(conteudo.text.startsWith("Local compartilhado: 85°F, chuva leve (máx. 88° · mín. 75°)."), conteudo.text);
});

test("sem horas por hora o texto fica só com o tempo de agora", () => {
  const dados = { ...montarPainel(RIO, previsaoFalsa()), por_hora: [] };
  const conteudo = conteudoParaCompartilhar(dados, { unidade: "C" }, BASE);
  assert.equal(conteudo.text, "Rio de Janeiro: 29°C, chuva leve (máx. 31° · mín. 24°).");
});
