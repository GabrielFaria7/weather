import assert from "node:assert/strict";
import { test } from "node:test";
import {
  altitudeTerrarium, altitudesDoRelevo, corDaTemperatura, degradeDaEscala, ESCALA_TEMPERATURA_MAPA, LAPSO_TERMICO_C_POR_M,
  pintarTemperatura, sombreamento, temperaturaNoPonto, temperaturasAoNivelDoMar,
} from "../../site/js/temperaturaMapa.js";

const quase = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

function gradeUniforme(temperatura, elevacao = 0) {
  return {
    grade: { norte: 3, oeste: -3, passo: 0.5, linhas: 13, colunas: 13 },
    horas: [1793390400],
    pontos: Array.from({ length: 169 }, () => ({ temperatura: [temperatura], elevacao })),
  };
}

function gradePequena() {
  return {
    grade: { norte: 1, oeste: 10, passo: 1, linhas: 2, colunas: 2 },
    horas: [1793390400, 1793394000],
    pontos: [
      { temperatura: [20, 0], elevacao: 0 },
      { temperatura: [30, 0], elevacao: 0 },
      { temperatura: [10, 0], elevacao: 1000 },
      { temperatura: [null, 0], elevacao: 0 },
    ],
  };
}

test("cores da escala nos limites e entre eles", () => {
  for (const [limite, cor] of ESCALA_TEMPERATURA_MAPA) assert.deepEqual(corDaTemperatura(limite), cor);
  assert.deepEqual(corDaTemperatura(20.5), [195, 225, 38]);
  assert.deepEqual(corDaTemperatura(-60), ESCALA_TEMPERATURA_MAPA[0][1]);
  assert.deepEqual(corDaTemperatura(60), ESCALA_TEMPERATURA_MAPA.at(-1)[1]);
  assert.deepEqual(corDaTemperatura(NaN), ESCALA_TEMPERATURA_MAPA[0][1]);
});

test("escala de cores vai do frio ao calor sem voltar", () => {
  const limites = ESCALA_TEMPERATURA_MAPA.map(([t]) => t);
  assert.deepEqual(limites, [...limites].sort((a, b) => a - b));
});

test("degradê da legenda começa em 0% e termina em 100%", () => {
  const degrade = degradeDaEscala(-10, 40);
  assert.match(degrade, /^linear-gradient\(90deg, rgb\(80,70,200\) 0%, /);
  assert.ok(!degrade.includes("rgb(110,0,90)"));
  const ultima = ESCALA_TEMPERATURA_MAPA.find(([t]) => t === 38)[1].join(",");
  assert.ok(degrade.endsWith(`rgb(${ultima}) 96%)`));
});

test("altitude do relevo no formato terrarium", () => {
  assert.equal(altitudeTerrarium(128, 0, 0), 0);
  assert.equal(altitudeTerrarium(131, 164, 0), 932);
  assert.equal(altitudeTerrarium(131, 164, 128), 932.5);
  assert.deepEqual([...altitudesDoRelevo(new Uint8ClampedArray([131, 164, 0, 255, 120, 0, 0, 255]))], [932, 0]);
});

test("temperatura reduzida ao nível do mar pela altitude da grade", () => {
  const reduzidas = temperaturasAoNivelDoMar(gradePequena(), 0);
  assert.deepEqual(reduzidas.slice(0, 2), [20, 30]);
  quase(reduzidas[2], 10 + 1000 * LAPSO_TERMICO_C_POR_M);
  assert.ok(Number.isNaN(reduzidas[3]));
});

test("temperatura num ponto da grade e entre pontos", () => {
  const dados = gradePequena();
  dados.pontos[3].temperatura[0] = 40;
  const reduzidas = temperaturasAoNivelDoMar(dados, 0);
  quase(temperaturaNoPonto(dados, reduzidas, 1, 10), 20);
  quase(temperaturaNoPonto(dados, reduzidas, 1, 10.5), 25);
  quase(temperaturaNoPonto(dados, reduzidas, 0, 10), 10);
  quase(temperaturaNoPonto(dados, reduzidas, 0, 10, 0), 10 + 1000 * LAPSO_TERMICO_C_POR_M);
  quase(temperaturaNoPonto(dados, reduzidas, 1, 10, 2000), 20 - 2000 * LAPSO_TERMICO_C_POR_M);
  assert.equal(temperaturaNoPonto(dados, reduzidas, 2, 10), null);
  assert.equal(temperaturaNoPonto(dados, reduzidas, 1, 12), null);
});

test("ponto sem previsão não ganha temperatura inventada", () => {
  const dados = gradePequena();
  const reduzidas = temperaturasAoNivelDoMar(dados, 0);
  assert.equal(temperaturaNoPonto(dados, reduzidas, 0.5, 10.5), null);
});

test("grade que cruza a linha de data", () => {
  const dados = gradeUniforme(25);
  dados.grade.oeste = 177;
  const reduzidas = temperaturasAoNivelDoMar(dados, 0);
  quase(temperaturaNoPonto(dados, reduzidas, 0, -179), 25);
  quase(temperaturaNoPonto(dados, reduzidas, 0, 179), 25);
});

test("pinta o tile com a cor da temperatura corrigida pela altitude", () => {
  const dados = gradeUniforme(20);
  const reduzidas = temperaturasAoNivelDoMar(dados, 0);
  const lado = 4;
  const semRelevo = pintarTemperatura(null, { x: 128, y: 128, z: 8 }, dados, reduzidas, lado);
  assert.deepEqual([...semRelevo.slice(0, 4)], [...corDaTemperatura(20), 255]);
  const relevo = { altitudes: new Float32Array(lado * lado).fill(1000), sombra: new Float32Array(lado * lado).fill(1) };
  const comRelevo = pintarTemperatura(relevo, { x: 128, y: 128, z: 8 }, dados, reduzidas, lado);
  assert.deepEqual([...comRelevo.slice(0, 4)], [...corDaTemperatura(13.5), 255]);
});

test("fora da grade o tile fica transparente e a borda se apaga aos poucos", () => {
  const dados = gradeUniforme(20);
  const reduzidas = temperaturasAoNivelDoMar(dados, 0);
  const lado = 64;
  const pixels = pintarTemperatura(null, { x: 32, y: 32, z: 6 }, dados, reduzidas, lado);
  const alfa = (px) => pixels[px * 4 + 3];
  assert.equal(alfa(0), 255);
  assert.equal(alfa(lado - 1), 0);
  const parcial = Array.from({ length: lado }, (_, px) => alfa(px)).filter((a) => a > 0 && a < 255);
  assert.ok(parcial.length > 0);
});

test("relevo iluminado do noroeste fica mais claro e o oposto mais escuro", () => {
  const lado = 8;
  const plano = sombreamento(new Float32Array(lado * lado).fill(500), { x: 0, y: 128, z: 8 }, lado);
  assert.ok(plano.every((v) => Math.abs(v - 1) < 1e-6));
  const subindoParaLeste = new Float32Array(lado * lado).map((_, i) => (i % lado) * 300);
  const subindoParaOeste = new Float32Array(lado * lado).map((_, i) => (lado - i % lado) * 300);
  assert.ok(sombreamento(subindoParaLeste, { x: 0, y: 128, z: 8 }, lado).every((v) => v > 1));
  assert.ok(sombreamento(subindoParaOeste, { x: 0, y: 128, z: 8 }, lado).every((v) => v < 1));
});
