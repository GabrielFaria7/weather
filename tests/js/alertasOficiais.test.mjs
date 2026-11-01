import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import {
  alertasOficiaisPara, instanteBrasilia, municipioNaLista, noBrasil, periodoDoAlerta, pontoNaArea,
} from "../../site/js/alertasOficiais.js";
import { buscarAlertasOficiais } from "../../site/js/servico.js";

const AVISOS = JSON.parse(readFileSync(new URL("./dados/inmet-avisos-2026-11-01.json", import.meta.url), "utf8"));
const AGORA = Date.parse("2026-11-01T22:40:00Z");
const cidade = (nome, estado, latitude, longitude) => ({ nome, estado, pais: "Brasil", latitude, longitude });
const ids = (lista) => lista.map((a) => a.id);

test("horário do INMET é de Brasília", () => {
  assert.equal(instanteBrasilia("2026-11-01 08:59"), Date.parse("2026-11-01T11:59:00Z"));
  assert.equal(instanteBrasilia("2026-11-02 00:00"), Date.parse("2026-11-02T03:00:00Z"));
  assert.ok(Number.isNaN(instanteBrasilia("")));
});

test("ponto dentro da área do alerta", () => {
  const quadrado = { type: "Polygon", coordinates: [[[-50, -20], [-40, -20], [-40, -10], [-50, -10], [-50, -20]]] };
  assert.ok(pontoNaArea(-15, -45, quadrado));
  assert.ok(pontoNaArea(-15, -45, JSON.stringify(quadrado)));
  assert.ok(!pontoNaArea(-25, -45, quadrado));
  const comBuraco = { type: "Polygon", coordinates: [quadrado.coordinates[0], [[-46, -16], [-44, -16], [-44, -14], [-46, -14], [-46, -16]]] };
  assert.ok(!pontoNaArea(-15, -45, comBuraco));
  assert.ok(pontoNaArea(-12, -48, comBuraco));
  const varios = { type: "MultiPolygon", coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]], quadrado.coordinates] };
  assert.ok(pontoNaArea(-15, -45, varios));
  assert.ok(!pontoNaArea(5, 5, varios));
  assert.ok(!pontoNaArea(-15, -45, "isso não é json"));
  assert.ok(!pontoNaArea(-15, -45, null));
});

test("município na lista oficial, com acento e maiúsculas", () => {
  const lista = "Alvarães - AM (1300029),Porto Alegre - RS (4314902),Brasília - DF (5300108)";
  assert.ok(municipioNaLista(cidade("Porto Alegre", "Rio Grande do Sul"), lista));
  assert.ok(municipioNaLista(cidade("ALVARAES", "amazonas"), lista));
  assert.ok(municipioNaLista(cidade("Brasília", "Distrito Federal"), lista));
  assert.ok(!municipioNaLista(cidade("Porto Alegre", "Santa Catarina"), lista));
  assert.ok(!municipioNaLista(cidade("Alegre", "Rio Grande do Sul"), lista));
  assert.ok(!municipioNaLista(cidade("Lisboa", "Lisboa"), lista));
});

test("só consulta o INMET para lugares no Brasil", () => {
  assert.ok(noBrasil(cidade("Manaus", "", -3.1, -60)));
  assert.ok(noBrasil(cidade("Chuí", "", -33.69, -53.46)));
  assert.ok(!noBrasil(cidade("Lisboa", "", 38.72, -9.14)));
  assert.ok(!noBrasil(cidade("Buenos Aires", "", -34.6, -58.38)));
});

test("alertas oficiais de capitais nos dados reais de 01/11/2026", () => {
  assert.deepEqual(ids(alertasOficiaisPara(AVISOS, cidade("Brasília", "Distrito Federal", -15.78, -47.93), AGORA)), [28596, 28598]);
  assert.deepEqual(ids(alertasOficiaisPara(AVISOS, cidade("Curitiba", "Paraná", -25.43, -49.27), AGORA)), [28598, 28590, 28595]);
  assert.deepEqual(ids(alertasOficiaisPara(AVISOS, cidade("Londrina", "Paraná", -23.31, -51.16), AGORA)), [28589, 28598, 28590, 28595]);
  assert.deepEqual(ids(alertasOficiaisPara(AVISOS, cidade("Fortaleza", "Ceará", -3.73, -38.52), AGORA)), []);
});

test("cidade na borda entra pela lista oficial mesmo fora do desenho", () => {
  const portoAlegre = cidade("Porto Alegre", "Rio Grande do Sul", -30.03, -51.23);
  assert.deepEqual(ids(alertasOficiaisPara(AVISOS, portoAlegre, AGORA)), [28598, 28595]);
  assert.deepEqual(ids(alertasOficiaisPara(AVISOS, { ...portoAlegre, nome: "Sua localização", estado: "" }, AGORA)), [28595]);
});

test("localização pelo GPS usa o desenho da área", () => {
  assert.deepEqual(ids(alertasOficiaisPara(AVISOS, cidade("Sua localização", "", -15.78, -47.93), AGORA)), [28596, 28598]);
});

test("alerta em vigor vem primeiro, depois o mais grave e o mais próximo", () => {
  const [primeiro, segundo] = alertasOficiaisPara(AVISOS, cidade("Londrina", "Paraná", -23.31, -51.16), AGORA);
  assert.equal(primeiro.nivel, "alerta");
  assert.equal(primeiro.severidade, "Perigo");
  assert.equal(segundo.nivel, "atencao");
  const [vigente] = alertasOficiaisPara(AVISOS, cidade("Brasília", "Distrito Federal", -15.78, -47.93), AGORA);
  assert.ok(vigente.vigente);
});

test("dados completos de cada alerta", () => {
  const [alerta] = alertasOficiaisPara(AVISOS, cidade("Londrina", "Paraná", -23.31, -51.16), AGORA);
  assert.equal(alerta.titulo, "Tempestade");
  assert.equal(alerta.inicio, Date.parse("2026-11-02T03:00:00Z"));
  assert.equal(alerta.fim, Date.parse("2026-11-03T02:59:00Z"));
  assert.ok(alerta.riscos[0].startsWith("Chuva entre 30 e 60 mm/h"));
  assert.equal(alerta.instrucoes.length, 3);
});

test("alertas encerrados ou já terminados não aparecem", () => {
  const brasilia = cidade("Brasília", "Distrito Federal", -15.78, -47.93);
  const depois = Date.parse("2026-11-02T03:30:00Z");
  assert.deepEqual(ids(alertasOficiaisPara(AVISOS, brasilia, depois)), [28598]);
  const encerrado = { hoje: AVISOS.hoje.map((a) => ({ ...a, encerrado: true })), futuro: [] };
  assert.deepEqual(alertasOficiaisPara(encerrado, brasilia, AGORA), []);
});

test("atualização do mesmo aviso mostra só a versão mais nova", () => {
  const original = AVISOS.hoje.find((a) => a.id_aviso === 28596);
  const dados = { hoje: [original, { ...original, id: 1, id_sequencia: 2, descricao: "Chuvas Intensas (atualizado)" }], futuro: [] };
  const lista = alertasOficiaisPara(dados, cidade("Brasília", "Distrito Federal", -15.78, -47.93), AGORA);
  assert.deepEqual(lista.map((a) => a.titulo), ["Chuvas Intensas (atualizado)"]);
});

test("respostas vazias ou estranhas não quebram", () => {
  assert.deepEqual(alertasOficiaisPara(null, cidade("Brasília", "Distrito Federal", -15.78, -47.93), AGORA), []);
  assert.deepEqual(alertasOficiaisPara({}, cidade("Brasília", "Distrito Federal", -15.78, -47.93), AGORA), []);
});

test("período do alerta em português", () => {
  const vigente = { inicio: Date.parse("2026-11-01T11:54:00Z"), fim: Date.parse("2026-11-02T02:59:00Z"), vigente: true };
  assert.equal(periodoDoAlerta(vigente, AGORA), "Em vigor até hoje às 23:59");
  const amanha = { inicio: Date.parse("2026-11-02T12:34:00Z"), fim: Date.parse("2026-11-03T02:59:00Z"), vigente: false };
  assert.equal(periodoDoAlerta(amanha, AGORA), "Amanhã, das 09:34 às 23:59");
  const depois = { inicio: Date.parse("2026-11-04T03:00:00Z"), fim: Date.parse("2026-11-05T02:59:00Z"), vigente: false };
  assert.equal(periodoDoAlerta(depois, AGORA), "04/11, das 00:00 às 23:59");
  const varios = { inicio: Date.parse("2026-11-02T12:00:00Z"), fim: Date.parse("2026-11-04T00:00:00Z"), vigente: false };
  assert.equal(periodoDoAlerta(varios, AGORA), "De amanhã às 09:00 até 03/11 às 21:00");
});

const fetchOriginal = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchOriginal; });

test("consulta ao INMET: fora do Brasil nem pergunta", async () => {
  let pedidos = 0;
  globalThis.fetch = async () => { pedidos++; return { ok: true, json: async () => AVISOS }; };
  assert.equal(await buscarAlertasOficiais(cidade("Lisboa", "Lisboa", 38.72, -9.14)), undefined);
  assert.equal(pedidos, 0);
});

test("consulta ao INMET: falha vira null, sem quebrar o painel", async () => {
  globalThis.fetch = async () => { throw new TypeError("sem rede"); };
  assert.equal(await buscarAlertasOficiais(cidade("Brasília", "Distrito Federal", -15.78, -47.93)), null);
  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
  assert.equal(await buscarAlertasOficiais(cidade("Brasília", "Distrito Federal", -15.78, -47.93)), null);
});

test("consulta ao INMET usa o endereço oficial", async () => {
  let endereco;
  globalThis.fetch = async (url) => { endereco = url; return { ok: true, json: async () => ({ hoje: [], futuro: [] }) }; };
  assert.deepEqual(await buscarAlertasOficiais(cidade("Brasília", "Distrito Federal", -15.78, -47.93)), []);
  assert.equal(endereco, "https://apiprevmet3.inmet.gov.br/avisos/ativos");
});
