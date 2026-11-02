const VERSAO = "weather-v1";
const TEMPO_LIMITE_REDE_MS = 5000;

const ARQUIVOS_DO_SITE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/app.css",
  "favicon.svg",
  "favicon-32.png",
  "apple-touch-icon.png",
  "icone-192.png",
  "icone-512.png",
  "icone-mascaravel-512.png",
  "js/alertasOficiais.js",
  "js/avisos.js",
  "js/componentes/alertas.js",
  "js/componentes/atual.js",
  "js/componentes/busca.js",
  "js/componentes/dias.js",
  "js/componentes/estados.js",
  "js/componentes/favoritos.js",
  "js/componentes/indicadores.js",
  "js/componentes/mapa.js",
  "js/componentes/porHora.js",
  "js/componentes/qualidadeAr.js",
  "js/descricoes.js",
  "js/formato.js",
  "js/gradeVento.js",
  "js/graficos.js",
  "js/icones.js",
  "js/iqar.js",
  "js/main.js",
  "js/painel.js",
  "js/preferencias.js",
  "js/satelites.js",
  "js/seriesPorHora.js",
  "js/servico.js",
  "js/temperaturaMapa.js",
];

const BIBLIOTECAS = [
  "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.6.1/chart.umd.min.js",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/leaflet-velocity@1.9.2/dist/leaflet-velocity.min.js",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil((async () => {
    const cache = await caches.open(VERSAO);
    await cache.addAll(ARQUIVOS_DO_SITE);
    await Promise.all(BIBLIOTECAS.map((url) =>
      cache.add(new Request(url, { mode: "cors", credentials: "omit" })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter((nome) => nome !== VERSAO).map((nome) => caches.delete(nome)));
    await self.clients.claim();
  })());
});

function comTempoLimite(promessa) {
  return Promise.race([
    promessa,
    new Promise((_, recusar) => setTimeout(() => recusar(new Error("tempo esgotado")), TEMPO_LIMITE_REDE_MS)),
  ]);
}

async function redePrimeiro(pedido, chave) {
  const cache = await caches.open(VERSAO);
  try {
    const resposta = await comTempoLimite(fetch(pedido));
    if (resposta.ok) cache.put(chave, resposta.clone());
    return resposta;
  } catch (erro) {
    const guardada = await cache.match(chave);
    if (guardada) return guardada;
    throw erro;
  }
}

async function cachePrimeiro(pedido) {
  const guardada = await caches.match(pedido);
  if (guardada) return guardada;
  const resposta = await fetch(pedido);
  if (resposta.ok) (await caches.open(VERSAO)).put(pedido, resposta.clone());
  return resposta;
}

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET") return;
  const url = new URL(pedido.url);
  if (pedido.mode === "navigate" && url.origin === self.location.origin) {
    evento.respondWith(redePrimeiro(pedido, new URL("./", self.registration.scope).href));
  } else if (url.origin === self.location.origin) {
    evento.respondWith(redePrimeiro(pedido, pedido));
  } else if (BIBLIOTECAS.includes(url.href)) {
    evento.respondWith(cachePrimeiro(pedido));
  }
});
