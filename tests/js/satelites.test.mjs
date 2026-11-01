import assert from "node:assert/strict";
import { test } from "node:test";
import { deixarSoNuvens, SATELITES, satelitePara } from "../../site/js/satelites.js";

const idPara = (latitude, longitude) => satelitePara({ latitude, longitude })?.id ?? null;

test("cada região usa o seu satélite", () => {
  assert.equal(idPara(-22.9, -43.2), "GOES-East");
  assert.equal(idPara(34.05, -118.24), "GOES-West");
  assert.equal(idPara(21.3, -157.8), "GOES-West");
  assert.equal(idPara(38.72, -9.14), "MTG");
  assert.equal(idPara(30.0, 31.2), "MTG");
  assert.equal(idPara(35.68, 139.69), "Mosaico");
  assert.equal(idPara(-33.9, 151.2), "Mosaico");
});

test("limites entre os satélites", () => {
  assert.equal(idPara(0, -110), "GOES-East");
  assert.equal(idPara(0, -15), "MTG");
  assert.equal(idPara(0, 60), "Mosaico");
  assert.equal(idPara(0, 180), "GOES-West");
  assert.equal(idPara(0, 200), "GOES-West");
  assert.equal(idPara(0, -190), "Mosaico");
});

test("todas as longitudes têm satélite", () => {
  for (let longitude = -180; longitude < 180; longitude += 0.5) {
    assert.ok(satelitePara({ latitude: 0, longitude }), `sem satélite em ${longitude}`);
  }
});

test("perto dos polos não há cobertura", () => {
  assert.equal(idPara(69.65, 18.96), null);
  assert.equal(idPara(-77.8, 166.7), null);
  assert.equal(idPara(65, 0), "MTG");
});

test("os satélites cobrem o mundo sem sobrepor", () => {
  const faixas = [...SATELITES].sort((a, b) => a.oeste - b.oeste);
  assert.equal(faixas[0].oeste, -180);
  assert.equal(faixas.at(-1).leste, 180);
  faixas.slice(1).forEach((s, i) => assert.equal(s.oeste, faixas[i].leste));
});

test("cada satélite tem o que a camada precisa", () => {
  for (const s of SATELITES) {
    assert.ok(["gibs", "eumetsat"].includes(s.fonte), s.id);
    assert.ok(s.camada && s.quadros > 0 && s.descricao && s.frequencia && s.atraso && s.credito, s.id);
    assert.ok(s.brilho[0] < s.brilho[1], s.id);
  }
});

const pixel = (r, g, b, a = 255, brilho = [80, 210]) => [...deixarSoNuvens(new Uint8ClampedArray([r, g, b, a]), brilho)];

test("nuvem branca fica opaca e chão escuro some", () => {
  const nuvem = pixel(250, 250, 250);
  assert.ok(nuvem[3] > 180, `alfa ${nuvem[3]}`);
  assert.equal(pixel(30, 60, 30)[3], 0);
});

test("brilho intermediário vira nuvem fina", () => {
  const alfa = pixel(145, 145, 145)[3];
  assert.ok(alfa > 40 && alfa < 140, `alfa ${alfa}`);
});

test("luzes das cidades e deserto não viram nuvem", () => {
  assert.equal(pixel(255, 190, 90)[3], 0);
  assert.equal(pixel(220, 180, 130)[3], 0);
});

test("nuvem levemente azulada continua nuvem", () => {
  assert.ok(pixel(200, 205, 225)[3] > 100);
});

test("área sem imagem continua transparente", () => {
  assert.equal(pixel(250, 250, 250, 0)[3], 0);
});

test("limites de brilho do satélite infravermelho", () => {
  assert.equal(pixel(90, 90, 90, 255, [95, 200])[3], 0);
  assert.ok(pixel(90, 90, 90, 255, [70, 190])[3] > 0);
});
