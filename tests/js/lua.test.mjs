import assert from "node:assert/strict";
import { test } from "node:test";
import { desenhoDaLua, faseDaLua, luaDoDia, proximaFase } from "../../site/js/lua.js";

const MINUTO = 60 * 1000;
const perto = (calculado, esperado, minutos, rotulo = "") => {
  const diferenca = Math.abs(Date.parse(`${calculado}`.length > 16 ? calculado : `${calculado}:00Z`) - Date.parse(`${esperado}:00Z`));
  assert.ok(diferenca <= minutos * MINUTO, `${rotulo} ${calculado} longe de ${esperado}`);
};
const iso = (instante) => new Date(instante).toISOString().slice(0, 16);

const RIO = { latitude: -22.90642, longitude: -43.18223 };
const TROMSO = { latitude: 69.6496, longitude: 18.956 };

test("datas das fases batem com as efemérides (PyEphem) em poucos minutos", () => {
  const inicio = Date.parse("2026-11-02T00:00:00Z");
  perto(iso(proximaFase(inicio, 0)), "2026-11-09T07:02", 10, "lua nova");
  perto(iso(proximaFase(inicio, 0.25)), "2026-11-17T11:47", 10, "quarto crescente");
  perto(iso(proximaFase(inicio, 0.5)), "2026-11-24T14:53", 10, "lua cheia");
  perto(iso(proximaFase(Date.parse("2026-11-25T00:00:00Z"), 0.75)), "2026-12-01T06:08", 10, "quarto minguante");
  perto(iso(proximaFase(Date.parse("2026-12-01T00:00:00Z"), 0.5)), "2026-12-24T01:28", 10, "cheia de dezembro");
});

test("parte iluminada da lua", () => {
  const casos = [["2026-11-02T03:00", 47.1], ["2026-11-10T12:00", 1.6], ["2026-11-17T00:00", 45.4], ["2026-11-24T12:00", 99.8]];
  for (const [instante, esperado] of casos) {
    const { iluminacao } = faseDaLua(Date.parse(`${instante}:00Z`));
    assert.ok(Math.abs(iluminacao * 100 - esperado) < 0.5, `${instante}: ${iluminacao * 100} ≠ ${esperado}`);
  }
});

test("nome da fase em português e se está crescendo", () => {
  const fase = (instante) => faseDaLua(Date.parse(`${instante}:00Z`));
  assert.equal(fase("2026-11-09T07:00").nome, "Lua nova");
  assert.equal(fase("2026-11-12T00:00").nome, "Lua crescente");
  assert.equal(fase("2026-11-17T11:00").nome, "Quarto crescente");
  assert.equal(fase("2026-11-21T00:00").nome, "Crescente gibosa");
  assert.equal(fase("2026-11-24T15:00").nome, "Lua cheia");
  assert.equal(fase("2026-11-28T00:00").nome, "Minguante gibosa");
  assert.equal(fase("2026-12-01T06:00").nome, "Quarto minguante");
  assert.equal(fase("2026-12-05T00:00").nome, "Lua minguante");
  assert.equal(fase("2026-11-21T00:00").crescente, true);
  assert.equal(fase("2026-11-28T00:00").crescente, false);
});

test("nascer e pôr da lua no horário local, comparados com as efemérides", () => {
  const rio = luaDoDia(RIO, "2026-11-02", -10800, Date.parse("2026-11-02T12:00:00Z"));
  perto(rio.nascer, "2026-11-02T00:44", 5, "Rio nascer");
  perto(rio.por, "2026-11-02T12:08", 5, "Rio pôr");
  const rio10 = luaDoDia(RIO, "2026-11-10", -10800, Date.parse("2026-11-10T12:00:00Z"));
  perto(rio10.nascer, "2026-11-10T05:36", 5, "Rio nascer");
  perto(rio10.por, "2026-11-10T19:37", 5, "Rio pôr");
  const toquio = luaDoDia({ latitude: 35.6895, longitude: 139.69171 }, "2026-11-15", 32400, Date.parse("2026-11-15T03:00:00Z"));
  perto(toquio.nascer, "2026-11-15T11:12", 5, "Tóquio nascer");
  perto(toquio.por, "2026-11-15T21:11", 5, "Tóquio pôr");
});

test("dia em que a lua não nasce", () => {
  const lisboa = luaDoDia({ latitude: 38.71667, longitude: -9.13333 }, "2026-11-02", 0, Date.parse("2026-11-02T12:00:00Z"));
  assert.equal(lisboa.nascer, null);
  perto(lisboa.por, "2026-11-02T14:08", 5, "Lisboa pôr");
  assert.equal(lisboa.sempreAcima, false);
});

test("perto do polo a lua pode ficar o dia todo no céu ou nem aparecer", () => {
  const acima = luaDoDia(TROMSO, "2026-11-24", 3600, Date.parse("2026-11-24T12:00:00Z"));
  assert.deepEqual([acima.nascer, acima.por, acima.sempreAcima], [null, null, true]);
  const abaixo = luaDoDia(TROMSO, "2026-11-10", 3600, Date.parse("2026-11-10T12:00:00Z"));
  assert.deepEqual([abaixo.nascer, abaixo.por, abaixo.sempreAcima], [null, null, false]);
});

test("próximas lua cheia e lua nova vêm no horário local", () => {
  const lua = luaDoDia(RIO, "2026-11-02", -10800, Date.parse("2026-11-02T12:00:00Z"));
  perto(lua.proximaNova, "2026-11-09T04:02", 10, "nova no Rio");
  perto(lua.proximaCheia, "2026-11-24T11:53", 10, "cheia no Rio");
});

test("desenho da fase: metade, cheia, nova e espelhado no hemisfério sul", () => {
  assert.equal(desenhoDaLua(0.25, 30).caminho, "M30 0A30 30 0 0 1 30 60A0 30 0 0 1 30 0Z");
  assert.equal(desenhoDaLua(0.5, 30).caminho, "M30 0A30 30 0 0 0 30 60A30 30 0 0 0 30 0Z");
  assert.equal(desenhoDaLua(0.1, 30).caminho, "M30 0A30 30 0 0 1 30 60A24.27 30 0 0 0 30 0Z");
  assert.equal(desenhoDaLua(0.9, 30).caminho, "M30 0A30 30 0 0 0 30 60A24.27 30 0 0 1 30 0Z");
  assert.equal(desenhoDaLua(0.1, 30, true).espelhar, true);
  assert.equal(desenhoDaLua(0.1, 30, false).espelhar, false);
});
