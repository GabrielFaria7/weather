import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const pasta = new URL("../../site/", import.meta.url);
const html = readFileSync(new URL("index.html", pasta), "utf8");
const manifesto = JSON.parse(readFileSync(new URL("manifest.webmanifest", pasta), "utf8"));
const sw = readFileSync(new URL("sw.js", pasta), "utf8");

const listaDoSw = (nome) => [...new RegExp(`const ${nome} = \\[([\\s\\S]*?)\\];`).exec(sw)[1].matchAll(/"([^"]+)"/g)]
  .map(([, item]) => item);

function tamanhoPng(arquivo) {
  const dados = readFileSync(new URL(arquivo, pasta));
  return `${dados.readUInt32BE(16)}x${dados.readUInt32BE(20)}`;
}

const arquivosEm = (subpasta) => readdirSync(new URL(subpasta, pasta), { recursive: true })
  .filter((nome) => /\.(js|css)$/.test(nome))
  .map((nome) => `${subpasta}${nome.replaceAll("\\", "/")}`);

test("a página aponta para o manifesto", () => {
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
});

test("manifesto completo para instalar", () => {
  for (const campo of ["id", "name", "short_name", "start_url", "scope", "display", "background_color", "theme_color"]) {
    assert.ok(manifesto[campo], `falta ${campo}`);
  }
  assert.equal(manifesto.display, "standalone");
  assert.equal(manifesto.lang, "pt-BR");
  for (const campo of ["start_url", "scope", "id"]) {
    assert.ok(!manifesto[campo].startsWith("/"), `${campo} precisa ser relativo por causa do /weather/`);
  }
});

test("ícones do manifesto existem com o tamanho declarado", () => {
  for (const icone of manifesto.icons) {
    assert.ok(existsSync(new URL(icone.src, pasta)), `falta site/${icone.src}`);
    if (icone.type === "image/png") assert.equal(tamanhoPng(icone.src), icone.sizes, icone.src);
  }
  const tamanhos = manifesto.icons.map((i) => i.sizes);
  assert.ok(tamanhos.includes("192x192") && tamanhos.includes("512x512"));
  assert.ok(manifesto.icons.some((i) => i.purpose === "maskable"), "falta ícone maskable (Android)");
});

test("o service worker guarda todos os arquivos do site", () => {
  const guardados = listaDoSw("ARQUIVOS_DO_SITE");
  for (const arquivo of [...arquivosEm("js/"), ...arquivosEm("css/")]) {
    assert.ok(guardados.includes(arquivo), `${arquivo} não está em ARQUIVOS_DO_SITE (sw.js); sem ele o site não abre offline`);
  }
  for (const arquivo of guardados.filter((a) => a !== "./")) {
    assert.ok(existsSync(new URL(arquivo, pasta)), `sw.js lista site/${arquivo}, que não existe`);
  }
  for (const icone of manifesto.icons) assert.ok(guardados.includes(icone.src), `${icone.src} fora do cache`);
  assert.ok(guardados.includes("./") && guardados.includes("index.html") && guardados.includes("manifest.webmanifest"));
});

test("o service worker guarda as mesmas versões das bibliotecas da página", () => {
  const daPagina = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="(https:\/\/(?:cdnjs|unpkg)[^"]+)"/g)].map(([, url]) => url);
  assert.deepEqual([...listaDoSw("BIBLIOTECAS")].sort(), [...daPagina].sort());
});

test("a página registra o service worker com caminho relativo", () => {
  const main = readFileSync(new URL("js/main.js", pasta), "utf8");
  assert.match(main, /serviceWorker\.register\("sw\.js"\)/);
});
