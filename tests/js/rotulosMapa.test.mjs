import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { blocosDaArea, cidadeDoBloco, escolherRotulos } from "../../site/js/rotulosMapa.js";
import { buscarCidadesDaArea } from "../../site/js/servico.js";

const fetchOriginal = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchOriginal; });

test("blocos de 10 graus que cobrem a área do mapa", () => {
  assert.deepEqual(blocosDaArea({ sul: -26, norte: -25, oeste: -50, leste: -48.5 }), ["-30_-50"]);
  assert.deepEqual(blocosDaArea({ sul: -21, norte: -19, oeste: -41, leste: -39 }).sort(), ["-20_-40", "-20_-50", "-30_-40", "-30_-50"]);
});

test("área que passa da linha de data usa os dois lados", () => {
  assert.deepEqual(blocosDaArea({ sul: 31, norte: 33, oeste: 175, leste: 185 }), ["30_170", "30_-180"]);
});

test("área enorme não pede blocos sem fim", () => {
  assert.equal(blocosDaArea({ sul: -80, norte: 80, oeste: -180, leste: 180 }).length, 40);
});

test("linha compacta do bloco vira cidade", () => {
  assert.deepEqual(cidadeDoBloco(["Curitiba", -25.428, -49.273, 1949, 924]),
    { nome: "Curitiba", latitude: -25.428, longitude: -49.273, populacao: 1949000, altitude: 924 });
});

const rotulo = (nome, x, y, prioridade, largura = 80) => ({ nome, x, y, prioridade, largura, altura: 22 });

test("cidades maiores ganham o lugar e as vizinhas que encostam ficam de fora", () => {
  const escolhidos = escolherRotulos([
    rotulo("Pequena", 105, 100, 10),
    rotulo("Grande", 100, 100, 1000),
    rotulo("Longe", 400, 300, 50),
  ], { largura: 800, altura: 600 });
  assert.deepEqual(escolhidos.map((r) => r.nome), ["Grande", "Longe"]);
});

test("rótulo cortado pela borda do mapa não aparece", () => {
  const escolhidos = escolherRotulos([rotulo("Borda", 20, 100, 100), rotulo("Dentro", 200, 100, 1)], { largura: 800, altura: 600 });
  assert.deepEqual(escolhidos.map((r) => r.nome), ["Dentro"]);
});

test("espaço reservado (o marcador da cidade) e limite de rótulos", () => {
  const reservado = [{ x0: 390, x1: 410, y0: 290, y1: 310 }];
  const escolhidos = escolherRotulos([rotulo("No marcador", 400, 300, 999), rotulo("A", 100, 100, 5), rotulo("B", 300, 100, 4),
    rotulo("C", 500, 100, 3)], { largura: 800, altura: 600, reservados: reservado, maximo: 2 });
  assert.deepEqual(escolhidos.map((r) => r.nome), ["A", "B"]);
});

test("rótulo com posições alternativas usa a primeira que couber", () => {
  const reservado = [{ x0: 300, x1: 500, y0: 60, y1: 110 }];
  const escolhidos = escolherRotulos([
    { ...rotulo("Cidade acima", 400, 80, Infinity), grupo: "local" },
    { ...rotulo("Cidade abaixo", 400, 160, Number.MAX_VALUE), grupo: "local" },
    rotulo("Vizinha", 600, 300, 10),
  ], { largura: 800, altura: 600, reservados: reservado });
  assert.deepEqual(escolhidos.map((r) => r.nome), ["Cidade abaixo", "Vizinha"]);
  const semConflito = escolherRotulos([
    { ...rotulo("Cidade acima", 400, 200, Infinity), grupo: "local" },
    { ...rotulo("Cidade abaixo", 400, 260, Number.MAX_VALUE), grupo: "local" },
  ], { largura: 800, altura: 600 });
  assert.deepEqual(semConflito.map((r) => r.nome), ["Cidade acima"]);
});

function simularArquivos(arquivos) {
  const pedidos = [];
  globalThis.fetch = async (endereco) => {
    pedidos.push(String(endereco));
    const nome = String(endereco).replace("dados/cidades/", "");
    if (!(nome in arquivos)) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => arquivos[nome] };
  };
  return pedidos;
}

test("cidades da área: lê o índice uma vez, só os blocos que existem e guarda", async () => {
  const pedidos = simularArquivos({
    "indice.json": ["-30_-50", "-30_-60"],
    "-30_-50.json": [["Curitiba", -25.428, -49.273, 1949, 924], ["Florianópolis", -27.597, -48.549, 421, 10]],
  });
  const area = { sul: -26, norte: -25, oeste: -50, leste: -48.5 };
  const cidades = await buscarCidadesDaArea(area);
  assert.deepEqual(cidades.map((c) => c.nome), ["Curitiba"]);
  assert.deepEqual(pedidos, ["dados/cidades/indice.json", "dados/cidades/-30_-50.json"]);
  await buscarCidadesDaArea({ sul: -28, norte: -27, oeste: -49, leste: -48 });
  assert.equal(pedidos.length, 2);
});
