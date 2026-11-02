import assert from "node:assert/strict";
import { test } from "node:test";
import { comparacaoComOntem, resumoDoDia } from "../../site/js/resumo.js";

const pad = (n) => String(n).padStart(2, "0");

function horasDesde(inicio, montar) {
  const base = Date.parse(`${inicio}:00Z`);
  return Array.from({ length: 24 }, (_, i) => {
    const horario = new Date(base + i * 3600e3).toISOString().slice(0, 16);
    return {
      horario, temperatura: 22, chance_chuva: 0, chuva_mm: 0, codigo: 1, rajada: 20,
      ...montar(Number(horario.slice(11, 13)), i),
    };
  });
}

const ctx = { unidade: "C", vento: "kmh", hora: "24" };

test("manhã seca esquentando até a máxima", () => {
  const horas = horasDesde("2026-11-02T08:00", (h) => ({ temperatura: 30 - Math.abs(14 - h) }));
  assert.equal(resumoDoDia(horas, ctx), "Sem chuva prevista nas próximas horas e máxima de 30° às 14:00.");
});

test("chuva começando à tarde diz a hora e a maior chance", () => {
  const horas = horasDesde("2026-11-02T09:00", (h) => ({
    temperatura: 24, chance_chuva: h >= 15 && h <= 19 ? (h === 17 ? 85 : 60) : 10, chuva_mm: h >= 15 && h <= 19 ? 2 : 0,
  }));
  assert.equal(resumoDoDia(horas, ctx), "Chuva a partir das 15:00 (85% de chance).");
});

test("chuva agora que para mais tarde", () => {
  const horas = horasDesde("2026-11-02T13:00", (h) => ({ chance_chuva: h < 18 ? 90 : 20, chuva_mm: h < 18 ? 3 : 0 }));
  assert.equal(resumoDoDia(horas, ctx), "Chuva até por volta das 18:00.");
});

test("chuva o tempo todo e trovoadas", () => {
  const horas = horasDesde("2026-11-02T13:00", (h, i) => ({ chance_chuva: 95, chuva_mm: 5, codigo: i === 3 ? 95 : 63 }));
  assert.equal(resumoDoDia(horas, ctx), "Chuva com trovoadas nas próximas 12 horas.");
});

test("garoa com chance alta mas sem milímetros não conta como chuva", () => {
  const horas = horasDesde("2026-11-02T13:00", () => ({ chance_chuva: 70, chuva_mm: 0 }));
  assert.equal(resumoDoDia(horas, ctx), "Pouca chance de chuva (até 70%).");
});

test("pouca chance de chuva", () => {
  const horas = horasDesde("2026-11-02T13:00", (h) => ({ chance_chuva: h === 16 ? 40 : 10 }));
  assert.equal(resumoDoDia(horas, ctx), "Pouca chance de chuva (até 40%).");
});

test("noite esfriando até a mínima da madrugada", () => {
  const horas = horasDesde("2026-11-02T20:00", (h) => ({ temperatura: h >= 20 ? 24 - (h - 20) : h <= 5 ? 20 - h * 0.6 : 18 + (h - 5) }));
  assert.equal(resumoDoDia(horas, ctx), "Sem chuva prevista nas próximas horas e temperatura caindo até 17° às 05:00.");
});

test("rajadas fortes entram no resumo, na unidade escolhida", () => {
  const horas = horasDesde("2026-11-02T10:00", (h) => ({ rajada: h === 16 ? 62 : 30 }));
  assert.equal(resumoDoDia(horas, ctx), "Sem chuva prevista nas próximas horas e rajadas de até 62 km/h às 16:00.");
  assert.equal(resumoDoDia(horas, { ...ctx, vento: "ms" }), "Sem chuva prevista nas próximas horas e rajadas de até 17.2 m/s às 16:00.");
});

test("os três juntos, em Fahrenheit e no relógio de 12 horas", () => {
  const horas = horasDesde("2026-11-02T08:00", (h) => ({
    temperatura: 30 - Math.abs(14 - h), chance_chuva: h >= 15 && h <= 17 ? 80 : 0, chuva_mm: h >= 15 && h <= 17 ? 4 : 0,
    rajada: h === 16 ? 70 : 20,
  }));
  assert.equal(resumoDoDia(horas, { unidade: "F", vento: "kmh", hora: "12" }),
    "Chuva a partir das 3 PM (80% de chance), máxima de 86° às 2 PM e rajadas de até 70 km/h às 4 PM.");
});

test("uma hora e meia-noite no singular", () => {
  const umaHora = horasDesde("2026-11-02T22:00", (h) => ({ chance_chuva: h === 1 ? 80 : 0, chuva_mm: h === 1 ? 2 : 0 }));
  assert.equal(resumoDoDia(umaHora, ctx), "Chuva a partir da 01:00 (80% de chance).");
  const meiaNoite = horasDesde("2026-11-02T22:00", (h) => ({ chance_chuva: h === 0 ? 80 : 0, chuva_mm: h === 0 ? 2 : 0 }));
  assert.equal(resumoDoDia(meiaNoite, ctx), "Chuva a partir da meia-noite (80% de chance).");
  const fria = horasDesde("2026-11-02T22:00", (h) => ({ temperatura: h === 1 ? 15 : 20 }));
  assert.equal(resumoDoDia(fria, ctx), "Sem chuva prevista nas próximas horas e temperatura caindo até 15° à 01:00.");
});

test("temperatura estável não entra no resumo", () => {
  const horas = horasDesde("2026-11-02T13:00", () => ({ temperatura: 22.4 }));
  assert.equal(resumoDoDia(horas, ctx), "Sem chuva prevista nas próximas horas.");
});

test("previsão salva antiga, sem milímetros nem rajadas por hora", () => {
  const horas = horasDesde("2026-11-02T09:00", (h) => ({ chance_chuva: h >= 12 ? 70 : 10, chuva_mm: null, rajada: null }));
  assert.equal(resumoDoDia(horas, ctx), "Chuva a partir das 12:00 (70% de chance).");
});

test("sem horas não há resumo", () => {
  assert.equal(resumoDoDia([], ctx), "");
  assert.equal(resumoDoDia(undefined, ctx), "");
});

test("hoje comparado com ontem pela máxima", () => {
  assert.equal(comparacaoComOntem(28.4, 25.1), "Hoje está 3° mais quente que ontem");
  assert.equal(comparacaoComOntem(22, 26.6), "Hoje está 5° mais frio que ontem");
  assert.equal(comparacaoComOntem(25.3, 25), "Hoje está com temperatura parecida com a de ontem");
  assert.equal(comparacaoComOntem(25, 25.4), "Hoje está com temperatura parecida com a de ontem");
});

test("diferença bate com as máximas mostradas na tela", () => {
  assert.equal(comparacaoComOntem(26.5, 25.1), "Hoje está 2° mais quente que ontem");
  assert.equal(comparacaoComOntem(26.4, 25.6), "Hoje está com temperatura parecida com a de ontem");
});

test("diferença em Fahrenheit é convertida sem somar 32", () => {
  assert.equal(comparacaoComOntem(28, 25, "F"), "Hoje está 5° mais quente que ontem");
});

test("sem o dia de ontem não há comparação", () => {
  assert.equal(comparacaoComOntem(28, null), "");
  assert.equal(comparacaoComOntem(undefined, 25), "");
});
