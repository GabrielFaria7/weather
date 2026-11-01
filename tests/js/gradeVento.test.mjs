import assert from "node:assert/strict";
import { test } from "node:test";
import { indiceNaGrade, quadroVento } from "../../site/js/gradeVento.js";

const GRADE = { norte: -19.9, oeste: -46.2, passo: 0.5, linhas: 13, colunas: 13 };
const quase = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

function dados(velocidade, direcao) {
  return {
    grade: { norte: 1, oeste: 10, passo: 0.5, linhas: 1, colunas: 2 },
    horas: [1793390400, 1793394000],
    pontos: [
      { velocidade: [velocidade, 0], direcao: [direcao, 0] },
      { velocidade: [null, 0], direcao: [null, 0] },
    ],
  };
}

test("vento vindo do norte sopra para o sul", () => {
  const [u, v] = quadroVento(dados(36, 0), 0);
  quase(u.data[0], 0);
  quase(v.data[0], -10);
});

test("vento vindo do leste sopra para o oeste", () => {
  const [u, v] = quadroVento(dados(36, 90), 0);
  quase(u.data[0], -10);
  quase(v.data[0], 0);
});

test("valores ausentes viram vento zero", () => {
  const [u, v] = quadroVento(dados(36, 0), 0);
  assert.equal(u.data[1], -0);
  quase(v.data[1], 0);
});

test("cabeçalho no formato do leaflet-velocity", () => {
  const [u, v] = quadroVento(dados(10, 45), 1);
  assert.equal(u.header.parameterNumber, 2);
  assert.equal(v.header.parameterNumber, 3);
  assert.deepEqual(
    { lo1: u.header.lo1, lo2: u.header.lo2, la1: u.header.la1, la2: u.header.la2, nx: u.header.nx, ny: u.header.ny },
    { lo1: 10, lo2: 10.5, la1: 1, la2: 1, nx: 2, ny: 1 },
  );
  assert.equal(u.header.refTime, new Date(1793394000 * 1000).toISOString());
});

test("ponto da grade sob o mouse", () => {
  assert.equal(indiceNaGrade(GRADE, -19.9, -46.2), 0);
  assert.equal(indiceNaGrade(GRADE, -19.9, -40.2), 12);
  assert.equal(indiceNaGrade(GRADE, -25.9, -40.2), 168);
  assert.equal(indiceNaGrade(GRADE, -20.4, -45.7), 14);
  assert.equal(indiceNaGrade(GRADE, -20.0, -46.1), 0);
});

test("fora da grade", () => {
  assert.equal(indiceNaGrade(GRADE, -19.0, -46.2), -1);
  assert.equal(indiceNaGrade(GRADE, -27.0, -46.2), -1);
  assert.equal(indiceNaGrade(GRADE, -22.0, -39.0), -1);
  assert.equal(indiceNaGrade(GRADE, -22.0, -47.0), -1);
});

test("grade que atravessa a linha de data", () => {
  const grade = { norte: 3, oeste: 177, passo: 0.5, linhas: 13, colunas: 13 };
  assert.equal(indiceNaGrade(grade, 3, 177), 0);
  assert.equal(indiceNaGrade(grade, 3, -177), 12);
  assert.equal(indiceNaGrade(grade, 3, -179.5), 7);
});
