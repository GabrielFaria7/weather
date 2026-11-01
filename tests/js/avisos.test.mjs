import assert from "node:assert/strict";
import { test } from "node:test";
import { montarPainel } from "../../site/js/painel.js";
import { previsaoFalsa } from "./dados_falsos.mjs";

const LOCAL = { nome: "X", estado: "", pais: "", latitude: 0, longitude: 0 };
const avisos = (opcoes) => montarPainel(LOCAL, previsaoFalsa(opcoes)).avisos;

test("dia tranquilo não gera aviso", () => {
  assert.deepEqual(avisos(), []);
});

test("chuva intensa e vento", () => {
  const lista = avisos({ chuvaMm: [55.0, 0.0], rajadas: [85.0, 10.0] });
  assert.deepEqual(lista.map((a) => [a.tipo, a.nivel]), [["chuva", "perigo"], ["vento", "alerta"]]);
  assert.match(lista[0].detalhe, /hoje/);
  assert.equal(lista[0].detalhe, "55 mm previstos hoje.");
});

test("tempestade, calor e frio", () => {
  const lista = avisos({ codigos: [95, 2], maximas: [36.0, 30.0], minimas: [24.0, 2.0] });
  assert.deepEqual(Object.fromEntries(lista.map((a) => [a.tipo, a.nivel])), {
    tempestade: "alerta", calor: "atencao", frio: "atencao",
  });
  assert.ok(lista.some((a) => a.detalhe.includes("amanhã")));
});

test("avisos mais graves vêm primeiro", () => {
  const lista = avisos({ rajadas: [65.0, 105.0] });
  assert.deepEqual(lista.map((a) => a.nivel), ["perigo", "atencao"]);
});
