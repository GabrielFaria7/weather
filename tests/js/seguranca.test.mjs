import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { BIBLIOTECAS } from "../../site/js/bibliotecas.js";

const html = readFileSync(new URL("../../site/index.html", import.meta.url), "utf8");
const politica = /<meta http-equiv="Content-Security-Policy"\s+content="([^"]+)">/.exec(html)?.[1].replace(/\s+/g, " ") ?? "";
const diretiva = (nome) => new RegExp(`(?:^|; ?)${nome} ([^;]+)`).exec(politica)?.[1].trim().split(" ") ?? [];
const recursosExternos = [...html.matchAll(/<(script|link)\b[^>]*(?:src|href)="https:\/\/[^"]+"[^>]*>/g)]
  .map(([tag]) => tag)
  .filter((tag) => tag.startsWith("<script") || tag.includes('rel="stylesheet"'))
  .filter((tag) => !tag.includes("fonts.googleapis.com"));

test("a página tem Content-Security-Policy", () => {
  assert.ok(politica, "meta Content-Security-Policy não encontrada");
  assert.deepEqual(diretiva("default-src"), ["'self'"]);
  assert.deepEqual(diretiva("object-src"), ["'none'"]);
  assert.ok(!diretiva("script-src").includes("'unsafe-inline'"));
  assert.ok(!diretiva("script-src").includes("'unsafe-eval'"));
});

test("o script inline do tema está liberado pelo hash certo", () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(([, codigo]) => codigo);
  assert.equal(scripts.length, 1, "esperado um único script inline (o do tema)");
  const hash = `'sha256-${createHash("sha256").update(scripts[0]).digest("base64")}'`;
  assert.ok(diretiva("script-src").includes(hash), `atualize o hash no script-src da CSP para ${hash}`);
});

const bibliotecas = Object.values(BIBLIOTECAS).flat();
const carregador = readFileSync(new URL("../../site/js/bibliotecas.js", import.meta.url), "utf8");

test("bibliotecas de CDN carregadas sob demanda têm integridade e versão exata", () => {
  assert.ok(bibliotecas.length >= 4);
  for (const { tipo, url, integridade } of bibliotecas) {
    assert.ok(["script", "estilo"].includes(tipo), url);
    assert.match(integridade, /^sha(384|512)-[A-Za-z0-9+/=]+$/, url);
    assert.match(url, /@\d+\.\d+\.\d+|\/\d+\.\d+\.\d+\//, `versão exata obrigatória: ${url}`);
  }
  assert.match(carregador, /elemento\.integrity = integridade;/);
  assert.match(carregador, /elemento\.crossOrigin = "anonymous";/);
});

test("scripts e estilos de CDN fixos na página têm verificação de integridade", () => {
  for (const tag of recursosExternos) {
    assert.match(tag, /integrity="sha(384|512)-[A-Za-z0-9+/=]+"/, tag);
    assert.match(tag, /crossorigin="anonymous"/, tag);
    assert.match(tag, /@\d+\.\d+\.\d+|\/\d+\.\d+\.\d+\//, `versão exata obrigatória: ${tag}`);
  }
});

test("a CSP libera todos os domínios que o site usa", () => {
  const conexoes = diretiva("connect-src");
  for (const dominio of ["https://api.open-meteo.com", "https://geocoding-api.open-meteo.com",
    "https://air-quality-api.open-meteo.com", "https://marine-api.open-meteo.com", "https://apiprevmet3.inmet.gov.br", "https://gibs.earthdata.nasa.gov",
    "https://view.eumetsat.int"]) {
    assert.ok(conexoes.includes(dominio), `connect-src sem ${dominio}`);
  }
  const imagens = diretiva("img-src");
  for (const dominio of [
    "https://*.tile.openstreetmap.org", "https://gibs.earthdata.nasa.gov", "https://view.eumetsat.int",
    "https://s3.amazonaws.com/elevation-tiles-prod/",
  ]) {
    assert.ok(imagens.includes(dominio), `img-src sem ${dominio}`);
  }
  for (const tag of recursosExternos) {
    const origem = new URL(/(?:src|href)="([^"]+)"/.exec(tag)[1]).origin;
    const lista = tag.startsWith("<script") ? diretiva("script-src") : diretiva("style-src");
    assert.ok(lista.includes(origem), `${origem} não está liberado na CSP`);
  }
  for (const { tipo, url } of bibliotecas) {
    const lista = tipo === "script" ? diretiva("script-src") : diretiva("style-src");
    assert.ok(lista.includes(new URL(url).origin), `${new URL(url).origin} não está liberado na CSP`);
  }
});
