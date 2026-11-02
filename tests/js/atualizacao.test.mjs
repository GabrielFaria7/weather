import assert from "node:assert/strict";
import { test } from "node:test";
import { deveAtualizar, INTERVALO_ATUALIZACAO_MS, textoAtualizacao } from "../../site/js/atualizacao.js";

const AGORA = Date.parse("2026-11-02T12:00:00Z");
const MINUTO = 60000;

test("atualiza a cada 15 minutos com a página visível", () => {
  assert.equal(INTERVALO_ATUALIZACAO_MS, 15 * MINUTO);
  assert.equal(deveAtualizar({ ultimaVez: AGORA - 14 * MINUTO, visivel: true }, AGORA), false);
  assert.equal(deveAtualizar({ ultimaVez: AGORA - 15 * MINUTO, visivel: true }, AGORA), true);
  assert.equal(deveAtualizar({ ultimaVez: AGORA - 3 * 60 * MINUTO, visivel: true }, AGORA), true);
});

test("não atualiza com a aba escondida, sem internet ou com a janela de um dia aberta", () => {
  const antiga = AGORA - 60 * MINUTO;
  assert.equal(deveAtualizar({ ultimaVez: antiga, visivel: false }, AGORA), false);
  assert.equal(deveAtualizar({ ultimaVez: antiga, visivel: true, online: false }, AGORA), false);
  assert.equal(deveAtualizar({ ultimaVez: antiga, visivel: true, ocupado: true }, AGORA), false);
});

test("texto de quando a previsão foi atualizada", () => {
  assert.equal(textoAtualizacao(AGORA - 30 * 1000, AGORA), "Atualizado agora");
  assert.equal(textoAtualizacao(AGORA - 5 * MINUTO, AGORA), "Atualizado há 5min");
  assert.equal(textoAtualizacao(AGORA - 75 * MINUTO, AGORA), "Atualizado há 1h 15min");
  assert.equal(textoAtualizacao(AGORA + MINUTO, AGORA), "Atualizado agora");
  assert.equal(textoAtualizacao(undefined, AGORA), "");
});
