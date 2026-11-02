import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { buscarClimaAtual } from "../../site/js/servico.js";

const fetchOriginal = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchOriginal; });

let pedidos = [];
function simular(responder) {
  pedidos = [];
  globalThis.fetch = async (url) => {
    const endereco = new URL(url);
    pedidos.push(endereco);
    const { status = 200, corpo, falhar } = responder(endereco);
    if (falhar) throw falhar;
    return { ok: status < 300, status, json: async () => corpo };
  };
}

const respostaPara = (endereco) => {
  const latitudes = endereco.searchParams.get("latitude").split(",");
  const itens = latitudes.map((lat, i) => ({ current: { temperature_2m: 20 + i, weather_code: [0, 61, 95][i % 3], is_day: i % 2 ? 0 : 1 } }));
  return { corpo: itens.length === 1 ? itens[0] : itens };
};

const local = (latitude, longitude) => ({ nome: `L${latitude}`, latitude, longitude });

test("uma consulta só para todas as favoritas", async () => {
  simular(respostaPara);
  const climas = await buscarClimaAtual([local(1, 1), local(2, 2), local(3, 3)], { agora: 1_000 });
  assert.equal(pedidos.length, 1);
  assert.equal(pedidos[0].searchParams.get("latitude"), "1,2,3");
  assert.equal(pedidos[0].searchParams.get("current"), "temperature_2m,weather_code,is_day");
  assert.deepEqual(climas.map((c) => [c.temperatura, c.codigo, c.dia]), [[20, 0, true], [21, 61, false], [22, 95, true]]);
  assert.equal(climas[1].descricao, "Chuva leve");
});

test("uma favorita só (a API devolve objeto, não lista)", async () => {
  simular(respostaPara);
  const [clima] = await buscarClimaAtual([local(10, 10)], { agora: 1_000 });
  assert.equal(clima.temperatura, 20);
});

test("guarda por 10 minutos e só busca as que faltam", async () => {
  simular(respostaPara);
  await buscarClimaAtual([local(20, 20)], { agora: 1_000 });
  simular(respostaPara);
  const climas = await buscarClimaAtual([local(20, 20), local(21, 21)], { agora: 1_000 + 5 * 60_000 });
  assert.equal(pedidos.length, 1);
  assert.equal(pedidos[0].searchParams.get("latitude"), "21");
  assert.ok(climas.every(Boolean));
  simular(respostaPara);
  await buscarClimaAtual([local(20, 20), local(21, 21)], { agora: 1_000 + 6 * 60_000 });
  assert.equal(pedidos.length, 0);
  await buscarClimaAtual([local(20, 20)], { agora: 1_000 + 11 * 60_000 });
  assert.equal(pedidos.length, 1);
});

test("coordenadas quase iguais contam como a mesma cidade", async () => {
  simular(respostaPara);
  const climas = await buscarClimaAtual([local(30, 30), local(30.001, 30.002)], { agora: 1_000 });
  assert.equal(pedidos[0].searchParams.get("latitude"), "30");
  assert.deepEqual(climas.map((c) => c.temperatura), [20, 20]);
});

test("falha na consulta não quebra: devolve o que tiver guardado", async () => {
  simular(respostaPara);
  await buscarClimaAtual([local(40, 40)], { agora: 1_000 });
  simular(() => ({ falhar: new TypeError("sem rede") }));
  const climas = await buscarClimaAtual([local(40, 40), local(41, 41)], { agora: 1_000 + 20 * 60_000 });
  assert.equal(climas[0].temperatura, 20);
  assert.equal(climas[1], null);
  simular(() => ({ status: 429, corpo: { reason: "limite" } }));
  assert.deepEqual(await buscarClimaAtual([local(42, 42)], { agora: 1_000 }), [null]);
});

test("lista vazia não consulta nada", async () => {
  simular(respostaPara);
  assert.deepEqual(await buscarClimaAtual([], { agora: 1_000 }), []);
  assert.equal(pedidos.length, 0);
});

test("pedido cancelado é repassado", async () => {
  const controle = new AbortController();
  controle.abort();
  simular(() => ({ falhar: Object.assign(new Error("cancelado"), { name: "AbortError" }) }));
  await assert.rejects(buscarClimaAtual([local(50, 50)], { signal: controle.signal, agora: 1_000 }), { name: "AbortError" });
});
