import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { after, before, test } from "node:test";
import { iniciarServidor } from "./servidor.mjs";
import { simularServicos } from "./simulacao.mjs";

const requerer = createRequire(import.meta.url);
const { chromium } = requerer("playwright");
const AXE = readFileSync(requerer.resolve("axe-core/axe.min.js"), "utf8");

const RIO = "?lat=-22.90642&lon=-43.18223&nome=Rio+de+Janeiro&estado=Rio+de+Janeiro&pais=Brasil";
const TEMPO = { timeout: 180000 };
const DESKTOP = { viewport: { width: 1440, height: 1000 } };
const MODOS = {
  claro: { tema: "claro", opcoes: DESKTOP },
  escuro: { tema: "escuro", opcoes: DESKTOP },
  celular: { tema: "claro", opcoes: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
};

let navegador;
let servidor;

before(async () => {
  servidor = await iniciarServidor();
  navegador = await chromium.launch();
});

after(async () => {
  await navegador?.close();
  await servidor?.fechar();
});

async function abrir(modo, { caminho = RIO, ...simulacao } = {}) {
  const { tema, opcoes } = MODOS[modo];
  const contexto = await navegador.newContext({
    ...opcoes, serviceWorkers: "block", reducedMotion: "reduce", locale: "pt-BR", timezoneId: "America/Sao_Paulo",
  });
  await simularServicos(contexto, simulacao);
  await contexto.addInitScript({ content: AXE });
  await contexto.addInitScript((temaInicial) => {
    localStorage.setItem("weather.tema", temaInicial);
    document.addEventListener("securitypolicyviolation", (evento) => {
      console.error(`a CSP bloqueou ${evento.blockedURI} (${evento.violatedDirective})`);
    });
  }, tema);
  const pagina = await contexto.newPage();
  const problemas = [];
  pagina.on("pageerror", (erro) => problemas.push(`erro de JavaScript: ${erro.message}`));
  pagina.on("console", (mensagem) => {
    if (mensagem.type() === "error") problemas.push(`console: ${mensagem.text()}`);
  });
  pagina.on("requestfailed", (pedido) => {
    const motivo = pedido.failure()?.errorText ?? "";
    if (!motivo.includes("ERR_ABORTED")) problemas.push(`pedido falhou: ${pedido.url()} (${motivo})`);
  });
  await pagina.goto(servidor.endereco + caminho);
  return { pagina, contexto, problemas };
}

async function semProblemasDeAcessibilidade(pagina, onde) {
  const violacoes = await pagina.evaluate(async () => {
    const resultado = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] },
    });
    return resultado.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  });
  assert.deepEqual(violacoes, [], `acessibilidade em ${onde}`);
}

const esperarComplementos = (pagina) =>
  pagina.waitForFunction(() => !document.querySelector("main").innerText.includes("Consultando"), null, { timeout: 20000 });

for (const modo of Object.keys(MODOS)) {
  test(`painel completo no modo ${modo}`, TEMPO, async () => {
    const { pagina, contexto, problemas } = await abrir(modo);
    await pagina.waitForSelector("#atual-local");
    assert.equal(await pagina.locator("#atual-local").textContent(), "Rio de Janeiro");
    assert.match(await pagina.locator(".atual-resumo").innerText(), /próximas horas/i);
    await esperarComplementos(pagina);
    assert.match(await pagina.locator("[data-area='alertas']").innerText(), /INMET/);
    assert.match(await pagina.locator("#qualidade-ar").innerText(), /IQAr/);
    assert.ok(await pagina.evaluate(() => document.fonts.check("16px Inter")), "a fonte Inter do site não carregou");

    await pagina.locator("#por-hora").scrollIntoViewIfNeeded();
    await pagina.waitForFunction(() => window.Chart?.getChart(document.querySelector("#por-hora canvas")));
    for (const aba of ["chuva", "vento", "temperatura"]) {
      await pagina.click(`#por-hora [data-variavel='${aba}']`);
      assert.equal(await pagina.locator("#por-hora").getAttribute("data-variavel"), aba);
    }

    assert.equal(await pagina.locator(".dia-linha").count(), 10);
    await pagina.locator(".dia-linha").nth(1).click();
    await pagina.waitForFunction(() => {
      const janela = document.getElementById("modal-dia");
      return janela.open && window.Chart?.getChart(janela.querySelector("canvas"));
    });
    await semProblemasDeAcessibilidade(pagina, `janela do dia (${modo})`);
    await pagina.keyboard.press("Escape");
    assert.equal(await pagina.evaluate(() => document.getElementById("modal-dia").open), false);

    await pagina.locator("#lua").scrollIntoViewIfNeeded();
    assert.ok((await pagina.locator("#lua .lua-fase").textContent()).trim());
    assert.match(await pagina.locator("#mar").innerText(), /ondas/i);
    const sobra = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(sobra <= 1, `a página rola para o lado (${sobra} px)`);

    await semProblemasDeAcessibilidade(pagina, `painel (${modo})`);
    assert.deepEqual(problemas, []);
    await contexto.close();
  });
}

test("mapa: Temperatura com nomes das cidades, Vento e Nuvens", TEMPO, async () => {
  const { pagina, contexto, problemas } = await abrir("claro");
  await pagina.waitForSelector("#atual-local");
  await pagina.locator("#mapa").scrollIntoViewIfNeeded();
  await pagina.waitForSelector("#mapa .leaflet-container");

  await pagina.click("#mapa [data-camada='temperatura']");
  await pagina.waitForSelector("#mapa [data-legenda]:not([hidden])");
  await pagina.waitForSelector("#mapa .camada-temperatura canvas");
  await pagina.waitForFunction(() => document.querySelectorAll("#mapa .rotulo-cidade").length >= 3);
  assert.equal(await pagina.locator("#mapa [data-selo]").textContent(), "Previsão");
  await pagina.locator("#mapa [data-quadro]").fill("6");
  assert.notEqual(await pagina.locator("#mapa [data-quadro-rotulo]").textContent(), "");
  await semProblemasDeAcessibilidade(pagina, "mapa com Temperatura");

  await pagina.click("#mapa [data-camada='vento']");
  await pagina.waitForFunction(() => document.querySelector("#mapa [data-camada='vento']").getAttribute("aria-pressed") === "true"
    && !document.querySelector("#mapa [data-tempo]").hidden);
  assert.equal(await pagina.locator("#mapa [data-selo]").textContent(), "Previsão");
  assert.equal(await pagina.locator("#mapa .rotulo-cidade").count(), 0);

  await pagina.click("#mapa [data-camada='nuvens']");
  await pagina.waitForSelector("#mapa .camada-nuvens", { state: "attached" });
  await pagina.waitForFunction(() => document.querySelector("#mapa [data-selo]").textContent === "Satélite");

  assert.deepEqual(problemas, []);
  await contexto.close();
});

test("busca de cidade, °F e modo escuro", TEMPO, async () => {
  const { pagina, contexto, problemas } = await abrir("claro");
  await pagina.waitForSelector("#atual-local");
  await pagina.fill("#campo-busca", "São");
  await pagina.waitForSelector("#sugestoes .sugestao");
  await pagina.locator("#sugestoes .sugestao", { hasText: "São Paulo" }).click();
  await pagina.waitForFunction(() => document.querySelector("#atual-local")?.textContent === "São Paulo");

  await pagina.click("[data-unidade='F']");
  assert.match(await pagina.locator(".atual-grau").textContent(), /°F/);
  await pagina.click("#btn-tema");
  assert.equal(await pagina.evaluate(() => document.documentElement.dataset.theme), "dark");
  await esperarComplementos(pagina);
  await semProblemasDeAcessibilidade(pagina, "São Paulo em °F no modo escuro");

  assert.deepEqual(problemas, []);
  await contexto.close();
});

test("o painel aparece antes dos alertas e da qualidade do ar quando eles demoram", TEMPO, async () => {
  const { pagina, contexto, problemas } = await abrir("celular", { atrasoComplementosMs: 4000 });
  await pagina.waitForSelector("#atual-local", { timeout: 3500 });
  assert.match(await pagina.locator("[data-area='alertas']").innerText(), /Consultando os alertas oficiais do INMET/);
  assert.match(await pagina.locator("#qualidade-ar").innerText(), /Consultando a qualidade do ar/);
  await semProblemasDeAcessibilidade(pagina, "painel consultando");
  await esperarComplementos(pagina);
  assert.match(await pagina.locator("#qualidade-ar").innerText(), /IQAr/);

  assert.deepEqual(problemas, []);
  await contexto.close();
});

test("tela inicial sem cidade escolhida", TEMPO, async () => {
  const { pagina, contexto, problemas } = await abrir("celular", { caminho: "" });
  await pagina.waitForSelector("text=Para onde vamos olhar o tempo?");
  await semProblemasDeAcessibilidade(pagina, "tela inicial");
  assert.deepEqual(problemas, []);
  await contexto.close();
});
