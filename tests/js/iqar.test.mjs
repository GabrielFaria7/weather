import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  arredondarPar, calcularIqar, categoriaIqar, concentracoesIqar, indicePoluente, posicaoNaEscala,
} from "../../site/js/iqar.js";
import { montarPainel } from "../../site/js/painel.js";
import { indiceEscolhido } from "../../site/js/componentes/qualidadeAr.js";
import { previsaoFalsa } from "./dados_falsos.mjs";

const AR_SAO_PAULO = JSON.parse(readFileSync(new URL("./dados/open-meteo-ar-sao-paulo-2026-11-01.json", import.meta.url), "utf8"));

test("exemplo oficial do MMA (Orientação Técnica IQAr, jan/2025)", () => {
  assert.equal(indicePoluente("pm10", 210), 168);
  assert.equal(indicePoluente("ozonio", 135), 86);
  assert.equal(indicePoluente("dioxido_nitrogenio", 220), 60);
  const resultado = calcularIqar({ pm10: 210, ozonio: 135, dioxido_nitrogenio: 220 });
  assert.equal(resultado.indice, 168);
  assert.equal(resultado.nivel, "Muito Ruim");
  assert.equal(resultado.codigo, "N4");
  assert.equal(resultado.nomePoluente, "MP10");
});

test("limites das faixas de cada poluente (CONAMA 506/2024)", () => {
  const casos = {
    pm10: [[45, 40], [46, 41], [100, 80], [101, 81], [150, 120], [151, 121], [250, 200], [251, 201], [600, 400]],
    pm2_5: [[15, 40], [16, 41], [50, 80], [51, 81], [75, 120], [76, 121], [125, 200], [126, 201], [300, 400]],
    ozonio: [[100, 40], [101, 41], [130, 80], [131, 81], [160, 120], [161, 121], [200, 200], [201, 201], [800, 400]],
    monoxido_carbono: [[9, 40], [9.1, 41], [11, 80], [11.1, 81], [13, 120], [13.1, 121], [15, 200], [15.1, 201], [50, 400]],
    dioxido_nitrogenio: [[200, 40], [201, 41], [240, 80], [241, 81], [320, 120], [321, 121], [1130, 200], [1131, 201], [3750, 400]],
    dioxido_enxofre: [[40, 40], [41, 41], [50, 80], [51, 81], [125, 120], [126, 121], [800, 200], [801, 201], [2620, 400]],
  };
  for (const [poluente, pares] of Object.entries(casos)) {
    for (const [concentracao, esperado] of pares) {
      assert.equal(indicePoluente(poluente, concentracao), esperado, `${poluente} ${concentracao}`);
    }
  }
});

test("acima do fim da tabela fica em 400 e valores inválidos são ignorados", () => {
  assert.equal(indicePoluente("pm2_5", 900), 400);
  assert.equal(indicePoluente("pm2_5", null), null);
  assert.equal(indicePoluente("pm2_5", -1), null);
  assert.equal(indicePoluente("pm2_5", Number.NaN), null);
  assert.equal(indicePoluente("benzeno", 10), null);
});

test("arredondamento oficial: valor ,5 vai para o par", () => {
  assert.equal(arredondarPar(0.5), 0);
  assert.equal(arredondarPar(1.5), 2);
  assert.equal(arredondarPar(2.5), 2);
  assert.equal(arredondarPar(2.6), 3);
  assert.equal(arredondarPar(9.05, 1), 9);
  assert.equal(arredondarPar(9.15, 1), 9.2);
  assert.equal(indicePoluente("pm2_5", 15.5), 41);
  assert.equal(indicePoluente("pm2_5", 16.5), 41);
  assert.equal(indicePoluente("pm2_5", 15.4), 40);
});

test("categorias e posição na escala de cores", () => {
  assert.equal(categoriaIqar(0).nome, "Boa");
  assert.equal(categoriaIqar(80).nome, "Moderada");
  assert.equal(categoriaIqar(81).nome, "Ruim");
  assert.equal(categoriaIqar(201).nome, "Péssima");
  assert.equal(posicaoNaEscala(0), 0);
  assert.equal(posicaoNaEscala(41), 20);
  assert.equal(posicaoNaEscala(81), 40);
  assert.equal(posicaoNaEscala(400), 100);
});

test("médias de 24 h, 8 h e 1 h a partir das horas da Open-Meteo (São Paulo, 01/11/2026 20h)", () => {
  const c = concentracoesIqar(AR_SAO_PAULO.hourly, AR_SAO_PAULO.current.time);
  assert.equal(c.dioxido_nitrogenio, 28.4);
  assert.ok(Math.abs(c.pm2_5 - 21.14) < 0.01);
  assert.ok(Math.abs(c.pm10 - 21.38) < 0.01);
  assert.ok(Math.abs(c.ozonio - 130.88) < 0.01);
  assert.ok(Math.abs(c.dioxido_enxofre - 11.39) < 0.01);
  assert.ok(Math.abs(c.monoxido_carbono - 0.3467) < 0.001, "CO convertido de µg/m³ para ppm");
  const resultado = calcularIqar(c);
  assert.deepEqual([resultado.indice, resultado.nivel, resultado.nomePoluente], [81, "Ruim", "O₃"]);
});

test("poucos dados na janela: poluente fica de fora", () => {
  const hourly = { time: ["2026-11-01T00:00", "2026-11-01T01:00"], pm2_5: [10, 12], nitrogen_dioxide: [30, 40] };
  const c = concentracoesIqar(hourly, "2026-11-01T01:00");
  assert.equal(c.pm2_5, undefined);
  assert.equal(c.dioxido_nitrogenio, 40);
  const comBuracos = { time: [...Array(24)].map((_, h) => `2026-11-01T${String(h).padStart(2, "0")}:00`), pm2_5: Array(24).fill(null) };
  comBuracos.pm2_5.fill(20, 0, 18);
  assert.equal(concentracoesIqar(comBuracos, "2026-11-01T23:00").pm2_5, 20);
  comBuracos.pm2_5[17] = null;
  assert.equal(concentracoesIqar(comBuracos, "2026-11-01T23:00").pm2_5, undefined);
});

test("sem nenhum dado não há índice", () => {
  assert.equal(calcularIqar({}), null);
  assert.equal(calcularIqar(null), null);
  assert.equal(concentracoesIqar(null, "2026-11-01T20:00"), null);
  assert.equal(concentracoesIqar({ time: [] }, "2026-11-01T20:00"), null);
});

test("painel traz os dois índices", () => {
  const painel = montarPainel({ nome: "São Paulo", latitude: -23.55, longitude: -46.63 }, previsaoFalsa(), AR_SAO_PAULO);
  assert.equal(painel.qualidade_ar.indice, 46);
  assert.equal(painel.qualidade_ar.nivel, "Moderada");
  assert.equal(painel.qualidade_ar.iqar.indice, 81);
  assert.equal(painel.qualidade_ar.dioxido_enxofre, 14);
  assert.equal(painel.qualidade_ar.monoxido_carbono, 387);
});

test("previsão salva no formato antigo continua funcionando, só sem IQAr", () => {
  const painel = montarPainel({ nome: "X", latitude: 0, longitude: 0 }, previsaoFalsa(), { european_aqi: 30, pm2_5: 8 });
  assert.equal(painel.qualidade_ar.indice, 30);
  assert.equal(painel.qualidade_ar.iqar, null);
});

test("índice mostrado segue a preferência e cai para o outro se faltar", () => {
  const ar = montarPainel({ nome: "SP", latitude: 0, longitude: 0 }, previsaoFalsa(), AR_SAO_PAULO).qualidade_ar;
  assert.deepEqual([indiceEscolhido(ar, "iqar").tipo, indiceEscolhido(ar, "iqar").indice], ["iqar", 81]);
  assert.deepEqual([indiceEscolhido(ar, "eaqi").tipo, indiceEscolhido(ar, "eaqi").indice], ["eaqi", 46]);
  assert.equal(indiceEscolhido(ar, undefined).tipo, "iqar");
  assert.equal(indiceEscolhido({ ...ar, iqar: null }, "iqar").tipo, "eaqi");
  assert.equal(indiceEscolhido({ ...ar, indice: null }, "eaqi").tipo, "iqar");
  assert.equal(indiceEscolhido(null, "iqar"), null);
});
