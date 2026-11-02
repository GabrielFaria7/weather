import assert from "node:assert/strict";
import { test } from "node:test";
import {
  altitudeTerrarium, altitudesDoRelevo, corDaTemperatura, degradeDaEscala, ESCALA_TEMPERATURA_MAPA, LAPSO_TERMICO_C_POR_M,
  pintarTemperatura, sombreamento, temperaturaNoPonto, temperaturasAoNivelDoMar, passoParaZoom, precisaDeNovaGrade,
  centroParaNovaGrade, indiceDoMesmoHorario,
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

test("grade mais espaçada quanto mais longe o zoom", () => {
  assert.deepEqual([9, 8, 7, 6, 5, 3].map(passoParaZoom), [0.5, 0.5, 1, 2, 4, 4]);
});

const GRADE_RIO = { norte: -19.9, oeste: -46.2, passo: 0.5, linhas: 13, colunas: 13 };

test("mapa dentro do quadrado da grade não busca outra", () => {
  assert.equal(precisaDeNovaGrade(GRADE_RIO, { sul: -23.6, norte: -22.2, oeste: -44.3, leste: -42.1, zoom: 9 }), false);
});

test("arrastar para fora do quadrado ou mudar a faixa de zoom busca outra grade", () => {
  assert.equal(precisaDeNovaGrade(GRADE_RIO, { sul: -23.6, norte: -22.2, oeste: -41.3, leste: -39.1, zoom: 9 }), true);
  assert.equal(precisaDeNovaGrade(GRADE_RIO, { sul: -20.2, norte: -18.8, oeste: -44.3, leste: -42.1, zoom: 9 }), true);
  assert.equal(precisaDeNovaGrade(GRADE_RIO, { sul: -24, norte: -21.8, oeste: -45, leste: -41.4, zoom: 7 }), true);
});

test("mapa maior que a grade só busca outra se o centro andar bastante", () => {
  const grande = { norte: 8, oeste: -70, passo: 4, linhas: 13, colunas: 13 };
  assert.equal(precisaDeNovaGrade(grande, { sul: -60, norte: 20, oeste: -90, leste: 0, zoom: 3 }), false);
  assert.equal(precisaDeNovaGrade(grande, { sul: -40, norte: 40, oeste: -10, leste: 80, zoom: 3 }), true);
});

test("centro da grade nova encaixado no espaçamento", () => {
  assert.deepEqual(centroParaNovaGrade({ sul: -23.6, norte: -22.2, oeste: -41.3, leste: -39.1, zoom: 9 }),
    { latitude: -23, longitude: -40, passo: 0.5 });
  assert.deepEqual(centroParaNovaGrade({ sul: -30, norte: -10, oeste: 170, leste: 200, zoom: 5 }),
    { latitude: -20, longitude: -176, passo: 4 });
});

test("ao trocar de grade continua no mesmo horário", () => {
  const antigas = [1000, 4600, 8200, 11800];
  assert.equal(indiceDoMesmoHorario(antigas, 2, [4600, 8200, 11800, 15400]), 1);
  assert.equal(indiceDoMesmoHorario(antigas, 0, [4600, 8200]), 0);
  assert.equal(indiceDoMesmoHorario(antigas, 3, [8300, 11900]), 1);
  assert.equal(indiceDoMesmoHorario(undefined, 0, [1, 2]), 0);
});
