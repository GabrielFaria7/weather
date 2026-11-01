import assert from "node:assert/strict";
import { test } from "node:test";
import { descrever } from "../../site/js/descricoes.js";

test("descrições conhecidas", () => {
  assert.equal(descrever(0), "Céu limpo");
  assert.equal(descrever(61), "Chuva leve");
  assert.equal(descrever(95), "Trovoada");
});

test("código desconhecido", () => {
  assert.equal(descrever(999), "Condição desconhecida");
});
