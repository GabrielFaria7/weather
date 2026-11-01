import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { favoritos, mesmoLocal, preferencias } from "../../site/js/preferencias.js";

let guardado;

function usarArmazenamento(armazenamento) {
  Object.defineProperty(globalThis, "localStorage", { value: armazenamento, configurable: true, writable: true });
}

beforeEach(() => {
  guardado = new Map();
  usarArmazenamento({
    getItem: (chave) => (guardado.has(chave) ? guardado.get(chave) : null),
    setItem: (chave, valor) => guardado.set(chave, String(valor)),
  });
});

const RIO = { nome: "Rio de Janeiro", estado: "RJ", pais: "Brasil", latitude: -22.9064, longitude: -43.1822 };
const SP = { nome: "São Paulo", estado: "SP", pais: "Brasil", latitude: -23.5475, longitude: -46.6361 };

test("valores padrão das preferências", () => {
  assert.equal(preferencias.unidade, "C");
  assert.equal(preferencias.vento, "kmh");
  assert.equal(preferencias.hora, "24");
  assert.equal(preferencias.ultimoLocal, null);
  assert.equal(preferencias.tema, null);
});

test("preferências são guardadas com o prefixo weather.", () => {
  preferencias.unidade = "F";
  preferencias.tema = "escuro";
  preferencias.ultimoLocal = RIO;
  assert.equal(preferencias.unidade, "F");
  assert.equal(preferencias.tema, "escuro");
  assert.deepEqual(preferencias.ultimoLocal, RIO);
  assert.equal(guardado.get("weather.unidade"), '"F"');
  assert.equal(guardado.get("weather.tema"), "escuro");
});

test("valor corrompido volta ao padrão", () => {
  guardado.set("weather.unidade", "{quebrado");
  assert.equal(preferencias.unidade, "C");
});

test("sem acesso ao armazenamento o app continua funcionando", () => {
  usarArmazenamento({
    getItem: () => { throw new Error("bloqueado"); },
    setItem: () => { throw new Error("bloqueado"); },
  });
  assert.equal(preferencias.hora, "24");
  assert.doesNotThrow(() => { preferencias.hora = "12"; });
  assert.doesNotThrow(() => favoritos.alternar(RIO));
  assert.deepEqual(favoritos.listar(), []);
});

test("mesmo local tolera pequenas diferenças de coordenada", () => {
  assert.ok(mesmoLocal(RIO, { latitude: -22.91, longitude: -43.18 }));
  assert.ok(!mesmoLocal(RIO, SP));
});

test("favoritar, desfavoritar e remover", () => {
  assert.equal(favoritos.alternar(RIO), true);
  assert.equal(favoritos.alternar(SP), true);
  assert.deepEqual(favoritos.listar().map((f) => f.nome), ["Rio de Janeiro", "São Paulo"]);
  assert.ok(favoritos.contem({ latitude: -22.905, longitude: -43.183 }));
  assert.equal(favoritos.alternar(RIO), false);
  assert.deepEqual(favoritos.listar().map((f) => f.nome), ["São Paulo"]);
  favoritos.remover(SP);
  assert.deepEqual(favoritos.listar(), []);
});

test("favorito guarda só os dados do local", () => {
  favoritos.alternar({ ...RIO, extra: "não guardar" });
  assert.deepEqual(Object.keys(favoritos.listar()[0]), ["nome", "estado", "pais", "latitude", "longitude"]);
});

test("limpar favoritos", () => {
  favoritos.alternar(RIO);
  favoritos.limpar();
  assert.deepEqual(favoritos.listar(), []);
});
