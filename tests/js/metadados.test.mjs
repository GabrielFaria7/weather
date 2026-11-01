import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const pasta = new URL("../../site/", import.meta.url);
const html = readFileSync(new URL("index.html", pasta), "utf8");
const ENDERECO = "https://gabrielfaria7.github.io/weather/";

const meta = (atributo, nome) => new RegExp(`<meta ${atributo}="${nome}" content="([^"]*)"`).exec(html)?.[1];
const links = (rel) => [...html.matchAll(new RegExp(`<link rel="${rel}" href="([^"]+)"`, "g"))].map(([, href]) => href);

function tamanhoPng(arquivo) {
  const dados = readFileSync(new URL(arquivo, pasta));
  assert.equal(dados.subarray(1, 4).toString(), "PNG", `${arquivo} não é PNG`);
  return [dados.readUInt32BE(16), dados.readUInt32BE(20)];
}

test("ícones existem e têm o tamanho certo", () => {
  const icones = [...links("icon"), ...links("apple-touch-icon")];
  assert.deepEqual(icones, ["favicon.svg", "favicon-32.png", "apple-touch-icon.png"]);
  for (const icone of icones) assert.ok(existsSync(new URL(icone, pasta)), `falta site/${icone}`);
  assert.match(readFileSync(new URL("favicon.svg", pasta), "utf8"), /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.deepEqual(tamanhoPng("favicon-32.png"), [32, 32]);
  assert.deepEqual(tamanhoPng("apple-touch-icon.png"), [180, 180]);
});

test("prévia do link (Open Graph) completa", () => {
  for (const nome of ["og:type", "og:site_name", "og:title", "og:description", "og:url", "og:image", "og:image:alt"]) {
    assert.ok(meta("property", nome), `falta ${nome}`);
  }
  assert.equal(meta("property", "og:url"), ENDERECO);
  assert.equal(meta("property", "og:locale"), "pt_BR");
  assert.equal(meta("name", "twitter:card"), "summary_large_image");
  assert.equal(meta("property", "og:description"), meta("name", "description"));
});

test("imagem da prévia existe com o tamanho anunciado", () => {
  const imagem = meta("property", "og:image");
  assert.ok(imagem.startsWith(ENDERECO), "og:image precisa ser endereço completo");
  const arquivo = imagem.slice(ENDERECO.length);
  assert.ok(existsSync(new URL(arquivo, pasta)), `falta site/${arquivo}`);
  const [largura, altura] = tamanhoPng(arquivo);
  assert.equal(String(largura), meta("property", "og:image:width"));
  assert.equal(String(altura), meta("property", "og:image:height"));
  assert.ok(readFileSync(new URL(arquivo, pasta)).length < 600 * 1024, "imagem da prévia acima de 600 KB");
});

test("descrição tem tamanho bom para buscadores", () => {
  const descricao = meta("name", "description");
  assert.ok(descricao.length >= 70 && descricao.length <= 170, `descrição com ${descricao.length} caracteres`);
});

test("endereço canônico é o do GitHub Pages", () => {
  assert.deepEqual(links("canonical"), [ENDERECO]);
});
