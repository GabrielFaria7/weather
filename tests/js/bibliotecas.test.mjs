import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

let criados;
let falhar;

beforeEach(() => {
  criados = [];
  falhar = new Set();
  const cabeca = {
    append(elemento) { criados.push(elemento); setTimeout(() => (falhar.has(elemento.src) ? elemento.onerror() : elemento.onload())); },
    insertBefore(elemento) { cabeca.append(elemento); },
  };
  globalThis.document = {
    head: cabeca,
    querySelector: () => null,
    createElement: (tag) => ({ tag, remove() { this.removido = true; } }),
  };
});

afterEach(() => { delete globalThis.document; });

const importar = () => import(`../../site/js/bibliotecas.js?${Math.random()}`);

test("carrega o script com integridade e crossorigin, uma vez só", async () => {
  const { BIBLIOTECAS, carregarBiblioteca } = await importar();
  await Promise.all([carregarBiblioteca("graficos"), carregarBiblioteca("graficos")]);
  assert.equal(criados.length, 1);
  const [script] = criados;
  assert.equal(script.tag, "script");
  assert.equal(script.src, BIBLIOTECAS.graficos[0].url);
  assert.equal(script.integrity, BIBLIOTECAS.graficos[0].integridade);
  assert.equal(script.crossOrigin, "anonymous");
});

test("o mapa traz o CSS e o script; o vento espera o mapa", async () => {
  const { carregarBiblioteca } = await importar();
  await carregarBiblioteca("vento");
  assert.deepEqual(criados.map((e) => e.tag), ["link", "script", "script"]);
  assert.equal(criados[0].rel, "stylesheet");
  assert.match(criados[2].src, /leaflet-velocity/);
});

test("se falhar, avisa e deixa tentar de novo", async () => {
  const { BIBLIOTECAS, carregarBiblioteca } = await importar();
  falhar.add(BIBLIOTECAS.graficos[0].url);
  await assert.rejects(carregarBiblioteca("graficos"), /Não foi possível carregar/);
  assert.equal(criados[0].removido, true);
  falhar.clear();
  await carregarBiblioteca("graficos");
  assert.equal(criados.length, 2);
});
