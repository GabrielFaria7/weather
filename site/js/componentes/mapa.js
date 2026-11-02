import { buscarGradeMapa, buscarHorariosSatelite, urlTileSatelite } from "../servico.js";
import { direcao, duracao, esc, hora, horaNaCidade, temperatura, vento } from "../formato.js";
import { indiceNaGrade, quadroVento } from "../gradeVento.js";
import { iconeUI } from "../icones.js";
import { deixarSoNuvens, SATELITES, satelitePara } from "../satelites.js";
import {
  altitudesDoRelevo, degradeDaEscala, pintarTemperatura, sombreamento, temperaturaNoPonto, temperaturasAoNivelDoMar,
  ZOOM_MAXIMO_RELEVO,
} from "../temperaturaMapa.js";

const CAMADAS = [
  { id: "temperatura", nome: "Temperatura" },
  { id: "nuvens", nome: "Nuvens" },
  { id: "vento", nome: "Vento" },
];
const PREVISOES = ["temperatura", "vento"];

const CORES_VENTO = [
  "rgb(98,182,255)", "rgb(80,215,230)", "rgb(90,230,170)", "rgb(140,240,110)", "rgb(210,245,90)",
  "rgb(255,230,80)", "rgb(255,190,60)", "rgb(255,140,50)", "rgb(250,90,60)", "rgb(235,60,110)", "rgb(200,70,200)",
];
const VENTO_MAXIMO_KMH = 54;
const VALIDADE_DADOS_MS = 30 * 60 * 1000;
const VALIDADE_SATELITE_MS = 5 * 60 * 1000;

const ZOOM_MAXIMO_NUVENS = 8;

const URL_RELEVO = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";
const CREDITO_TEMPERATURA = 'Temperatura: <a href="https://open-meteo.com/">Open-Meteo</a> · '
  + 'Relevo: <a href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles</a>';
const LEGENDA_TEMPERATURA = [-10, 15, 40];

let mapa = null;
let local = null;
let fuso = "UTC";
let ctx = { vento: "kmh", hora: "24" };
let camadaAtiva = null;
let pedido = null;
let indiceQuadro = 0;
let reproducao = null;
let ultimoPonto = null;

let gradeCarregada = null;

let camadaVento = null;

let camadaTemperatura = null;
let tilesTemperatura = new Map();
let temperaturasReduzidas = null;

let camadasNuvens = [];
let nuvensCarregadas = null;

export function renderizarMapa(el, dados, contexto) {
  const { latitude, longitude, nome } = dados.local;
  desligarCamada();
  mapa?.remove();
  mapa = null;
  local = dados.local;
  fuso = dados.fuso ?? "UTC";
  if (contexto) ctx = contexto;
  ultimoPonto = null;

  el.innerHTML = `
    <section class="card card-mapa" id="mapa" aria-labelledby="titulo-mapa">
      <header class="card-cabecalho">
        <h2 id="titulo-mapa">Mapa meteorológico</h2>
        <span class="selo" data-selo hidden></span>
      </header>
      <div class="camadas" role="group" aria-label="Camadas do mapa">
        ${CAMADAS.map((c) => `<button type="button" class="chip" data-camada="${c.id}" aria-pressed="false">${c.nome}</button>`).join("")}
      </div>
      <div class="mapa-area">
        <div class="mapa-leaflet" id="mapa-leaflet"></div>
        <div class="mapa-legenda" data-legenda hidden></div>
      </div>
      <div class="mapa-tempo" data-tempo hidden>
        <button type="button" class="btn-icone" data-reproduzir aria-label="Reproduzir" title="Reproduzir">
          ${iconeUI("reproduzir")}
        </button>
        <input type="range" min="0" max="0" value="0" step="1" data-quadro aria-label="Horário da camada">
        <output data-quadro-rotulo></output>
      </div>
      <p class="mapa-nota" data-nota>${iconeUI("mapa")}<span>${notaPadrao()}</span></p>
    </section>`;

  el.querySelectorAll("[data-camada]").forEach((chip) => {
    chip.addEventListener("click", () => selecionarCamada(chip.dataset.camada));
  });
  el.querySelector("[data-quadro]").addEventListener("input", (e) => {
    pararReproducao();
    mostrarQuadro(Number(e.target.value));
  });
  el.querySelector("[data-reproduzir]").addEventListener("click", alternarReproducao);

  const area = el.querySelector("#mapa-leaflet");
  if (typeof window.L === "undefined") {
    area.innerHTML = '<p class="estado-mini">Não foi possível carregar o mapa (verifique a internet).</p>';
    return;
  }

  mapa = window.L.map(area, { scrollWheelZoom: false, zoomControl: true }).setView([latitude, longitude], 9);
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);
  window.L.circleMarker([latitude, longitude], {
    radius: 9, color: "#fff", weight: 3, fillColor: "#1769E0", fillOpacity: 1,
  }).addTo(mapa).bindTooltip(esc(nome));
  mapa.createPane("nuvens").style.zIndex = 350;
  mapa.createPane("temperatura").style.zIndex = 350;
  mapa.on("mousemove click", (e) => lerPonto(e.latlng));
}

function selecionarCamada(id) {
  if (!CAMADAS.some((c) => c.id === id)) return;

  if (id === camadaAtiva) {
    desligarCamada();
    marcarChips(null);
    escreverNota(notaPadrao());
    return;
  }

  desligarCamada();
  marcarChips(id);
  if (id === "vento") ligarVento();
  else if (id === "temperatura") ligarTemperatura();
  else ligarNuvens();
}

export function atualizarMapa(contexto) {
  ctx = contexto;
  if (quadros()) atualizarQuadro();
}

export function ajustarMapa() {
  mapa?.invalidateSize();
}

function notaPadrao() {
  return `Escolha <strong>Temperatura</strong> ou <strong>Vento</strong> para ver a previsão das próximas 24 horas em volta
    de <strong>${esc(local?.nome ?? "")}</strong>, ou <strong>Nuvens</strong> para ver as imagens reais de satélite das
    últimas horas.`;
}

function escreverNota(html) {
  const nota = document.querySelector("[data-nota] span");
  if (nota) nota.innerHTML = html;
}

function marcarChips(id) {
  document.querySelectorAll(".camadas [data-camada]").forEach((chip) => {
    chip.setAttribute("aria-pressed", String(chip.dataset.camada === id));
  });
}

function falhar(nome, mensagem) {
  camadaAtiva = null;
  marcarChips(null);
  escreverNota(`<strong>${nome}:</strong> ${esc(mensagem)}`);
}

function desligarCamada() {
  camadaAtiva = null;
  pararReproducao();
  pedido?.abort();
  pedido = null;
  if (mapa) {
    if (camadaVento) mapa.removeLayer(camadaVento);
    if (camadaTemperatura) mapa.removeLayer(camadaTemperatura);
    camadasNuvens.forEach((camada) => mapa.removeLayer(camada));
  }
  camadaVento = null;
  camadaTemperatura = null;
  tilesTemperatura = new Map();
  camadasNuvens = [];
  mostrarControles(null);
}

function mostrarControles(id) {
  document.querySelector("[data-tempo]")?.toggleAttribute("hidden", !id);
  const legenda = document.querySelector("[data-legenda]");
  if (legenda) {
    legenda.toggleAttribute("hidden", !id);
    legenda.innerHTML = { vento: legendaVento, nuvens: legendaNuvens, temperatura: legendaTemperatura }[id]?.() ?? "";
  }
  const area = document.getElementById("mapa-leaflet");
  area?.classList.toggle("com-camada", id === "vento" || id === "nuvens");
  area?.classList.toggle("com-temperatura", id === "temperatura");
  const selo = document.querySelector("[data-selo]");
  if (selo) {
    selo.toggleAttribute("hidden", !id);
    selo.textContent = PREVISOES.includes(id) ? "Previsão" : id === "nuvens" ? "Satélite" : "";
  }
}

function legendaVento() {
  return `
    <span class="legenda-titulo">Vento previsto</span>
    <span class="legenda-barra" style="background: linear-gradient(90deg, ${CORES_VENTO.join(", ")})"></span>
    <span class="legenda-escala"><span>0</span><span data-legenda-max></span></span>
    <span class="legenda-leitura" data-leitura>Toque ou aponte no mapa</span>`;
}

function legendaTemperatura() {
  return `
    <span class="legenda-titulo">Temperatura prevista</span>
    <span class="legenda-barra legenda-temperatura" style="background: ${degradeDaEscala(LEGENDA_TEMPERATURA[0], LEGENDA_TEMPERATURA.at(-1))}"></span>
    <span class="legenda-escala" data-legenda-temperaturas></span>
    <span class="legenda-leitura" data-leitura>Toque ou aponte no mapa</span>`;
}

function legendaNuvens() {
  return `
    <span class="legenda-titulo">Nuvens vistas do satélite</span>
    <span class="legenda-barra legenda-nuvens"></span>
    <span class="legenda-escala"><span>Limpo</span><span>Encoberto</span></span>
    <span class="legenda-leitura" data-leitura></span>`;
}

function quadros() {
  if ((camadaAtiva === "vento" && camadaVento) || (camadaAtiva === "temperatura" && camadaTemperatura)) {
    return gradeCarregada.dados.horas.length;
  }
  if (camadaAtiva === "nuvens" && camadasNuvens.length) return camadasNuvens.length;
  return 0;
}

function rotuloQuadro(indice) {
  return PREVISOES.includes(camadaAtiva) ? rotuloPrevisao(gradeCarregada.dados, indice) : rotuloNuvens(indice);
}

function mostrarQuadro(indice) {
  if (!quadros()) return;
  indiceQuadro = indice;
  if (camadaAtiva === "vento") camadaVento.setData(quadroVento(gradeCarregada.dados, indice));
  else if (camadaAtiva === "temperatura") pintarTemperaturas();
  else camadasNuvens.forEach((camada, i) => camada.setOpacity(i === indice ? 1 : 0));
  atualizarQuadro();
}

function atualizarQuadro() {
  const total = quadros();
  if (!total) return;
  const rotulo = rotuloQuadro(indiceQuadro);
  const controle = document.querySelector("[data-quadro]");
  if (controle) {
    controle.max = String(total - 1);
    controle.value = String(indiceQuadro);
    controle.setAttribute("aria-label", {
      vento: "Hora da previsão do vento",
      temperatura: "Hora da previsão da temperatura",
    }[camadaAtiva] ?? "Horário da imagem de satélite");
    controle.setAttribute("aria-valuetext", rotulo);
  }
  const saida = document.querySelector("[data-quadro-rotulo]");
  if (saida) saida.textContent = rotulo;

  if (camadaAtiva === "vento") {
    const maximo = document.querySelector("[data-legenda-max]");
    if (maximo) maximo.textContent = `${vento(VENTO_MAXIMO_KMH, ctx.vento)}+`;
    escreverNota(notaVento(rotulo));
    if (ultimoPonto) lerVento(ultimoPonto);
  } else if (camadaAtiva === "temperatura") {
    const escala = document.querySelector("[data-legenda-temperaturas]");
    if (escala) escala.innerHTML = LEGENDA_TEMPERATURA.map((t) => `<span>${temperatura(t, ctx.unidade)}</span>`).join("");
    escreverNota(notaTemperatura(rotulo));
    if (ultimoPonto) lerTemperatura(ultimoPonto);
  } else {
    escreverNota(notaNuvens());
  }
}

function alternarReproducao() {
  if (reproducao) {
    pararReproducao();
    return;
  }
  iniciarReproducao();
}

function iniciarReproducao() {
  const total = quadros();
  if (total < 2) return;
  const intervalo = { vento: 2000, temperatura: 1000 }[camadaAtiva] ?? 700;
  reproducao = setInterval(() => mostrarQuadro((indiceQuadro + 1) % quadros()), intervalo);
  marcarReproducao(true);
}

function pararReproducao() {
  clearInterval(reproducao);
  reproducao = null;
  marcarReproducao(false);
}

function marcarReproducao(sim) {
  const botao = document.querySelector("[data-reproduzir]");
  if (!botao) return;
  botao.innerHTML = iconeUI(sim ? "pausar" : "reproduzir");
  botao.setAttribute("aria-label", sim ? "Pausar" : "Reproduzir");
  botao.title = sim ? "Pausar" : "Reproduzir";
}

async function ligarVento() {
  camadaAtiva = "vento";
  const meuMapa = mapa;
  if (!meuMapa || typeof window.L.velocityLayer !== "function") {
    falhar("Vento", "não foi possível carregar a animação do vento (verifique a internet).");
    return;
  }

  escreverNota("<strong>Vento:</strong> carregando a previsão…");
  try {
    const dados = await dadosGrade();
    if (camadaAtiva !== "vento" || mapa !== meuMapa) return;
    indiceQuadro = 0;
    camadaVento = window.L.velocityLayer({
      displayValues: false,
      data: quadroVento(dados, indiceQuadro),
      minVelocity: 0,
      maxVelocity: VENTO_MAXIMO_KMH / 3.6,
      colorScale: CORES_VENTO,
      velocityScale: 0.05,
      particleMultiplier: 1 / 250,
      particleAge: 60,
      lineWidth: 1.5,
      frameRate: 20,
    }).addTo(meuMapa);
    mostrarControles("vento");
    atualizarQuadro();
  } catch (erro) {
    if (erro.name === "AbortError" || camadaAtiva !== "vento" || mapa !== meuMapa) return;
    falhar("Vento", erro.message);
  }
}

async function dadosGrade() {
  const chave = `${local.latitude},${local.longitude}`;
  if (gradeCarregada?.chave === chave && Date.now() - gradeCarregada.quando < VALIDADE_DADOS_MS) {
    return gradeCarregada.dados;
  }
  pedido = new AbortController();
  const dados = await buscarGradeMapa(local, { signal: pedido.signal });
  pedido = null;
  gradeCarregada = { chave, quando: Date.now(), dados };
  return dados;
}

function isoLocal(dados, indice) {
  return new Date((dados.horas[indice] + dados.deslocamento) * 1000).toISOString();
}

function rotuloPrevisao(dados, indice) {
  const iso = isoLocal(dados, indice);
  const horario = hora(iso, ctx.hora);
  if (indice === 0) return `Agora · ${horario}`;
  return iso.slice(0, 10) === isoLocal(dados, 0).slice(0, 10) ? horario : `Amanhã · ${horario}`;
}

function notaVento(rotulo) {
  return `<strong>Vento:</strong> previsão do modelo para <strong>${esc(rotulo.toLowerCase())}</strong>, a 10 m do solo,
    num quadrado de cerca de 650 km de lado em volta de <strong>${esc(local.nome)}</strong>. As partículas mostram a
    direção e a força previstas pela Open-Meteo; não é uma medição em tempo real.`;
}

function lerPonto(latlng) {
  if (camadaAtiva === "vento") lerVento(latlng);
  else if (camadaAtiva === "temperatura") lerTemperatura(latlng);
}

function lerVento(latlng) {
  if (camadaAtiva !== "vento" || !camadaVento) return;
  const leitura = document.querySelector("[data-leitura]");
  if (!leitura) return;
  ultimoPonto = latlng;
  const { grade, pontos } = gradeCarregada.dados;
  const indice = indiceNaGrade(grade, latlng.lat, latlng.lng);
  if (indice < 0) {
    leitura.textContent = "Fora da área com dados de vento";
    return;
  }
  const ponto = pontos[indice];
  leitura.textContent = `${vento(ponto.velocidade[indiceQuadro], ctx.vento)} vindo do ${direcao(ponto.direcao[indiceQuadro], true)}`;
}

async function ligarTemperatura() {
  camadaAtiva = "temperatura";
  const meuMapa = mapa;
  if (!meuMapa) {
    falhar("Temperatura", "não foi possível carregar o mapa (verifique a internet).");
    return;
  }

  escreverNota("<strong>Temperatura:</strong> carregando a previsão…");
  try {
    const dados = await dadosGrade();
    if (camadaAtiva !== "temperatura" || mapa !== meuMapa) return;
    indiceQuadro = 0;
    temperaturasReduzidas = temperaturasAoNivelDoMar(dados, indiceQuadro);
    camadaTemperatura = criarCamadaTemperatura().addTo(meuMapa);
    mostrarControles("temperatura");
    atualizarQuadro();
  } catch (erro) {
    if (erro.name === "AbortError" || camadaAtiva !== "temperatura" || mapa !== meuMapa) return;
    falhar("Temperatura", erro.message);
  }
}

function criarCamadaTemperatura() {
  const camada = window.L.gridLayer({
    pane: "temperatura",
    maxNativeZoom: ZOOM_MAXIMO_RELEVO,
    maxZoom: 18,
    className: "camada-temperatura",
    attribution: CREDITO_TEMPERATURA,
  });
  camada.createTile = (coords, pronto) => {
    const tile = document.createElement("canvas");
    tile.width = 256;
    tile.height = 256;
    const registro = { tile, coords: { x: coords.x, y: coords.y, z: coords.z }, relevo: null };
    tilesTemperatura.set(tile, registro);
    const imagem = new Image();
    imagem.crossOrigin = "anonymous";
    imagem.onload = () => {
      registro.relevo = lerRelevo(imagem, registro.coords);
      pintarTile(registro);
      pronto(null, tile);
    };
    imagem.onerror = () => {
      pintarTile(registro);
      pronto(null, tile);
    };
    imagem.src = `${URL_RELEVO}/${coords.z}/${coords.x}/${coords.y}.png`;
    return tile;
  };
  camada.on("tileunload", (e) => tilesTemperatura.delete(e.tile));
  return camada;
}

function lerRelevo(imagem, coords) {
  const tela = document.createElement("canvas");
  tela.width = 256;
  tela.height = 256;
  const pincel = tela.getContext("2d", { willReadFrequently: true });
  pincel.drawImage(imagem, 0, 0);
  const altitudes = altitudesDoRelevo(pincel.getImageData(0, 0, 256, 256).data);
  return { altitudes, sombra: sombreamento(altitudes, coords) };
}

function pintarTile({ tile, coords, relevo }) {
  const pincel = tile.getContext("2d");
  const pixels = pincel.createImageData(256, 256);
  pixels.data.set(pintarTemperatura(relevo, coords, gradeCarregada.dados, temperaturasReduzidas));
  pincel.putImageData(pixels, 0, 0);
}

function pintarTemperaturas() {
  temperaturasReduzidas = temperaturasAoNivelDoMar(gradeCarregada.dados, indiceQuadro);
  tilesTemperatura.forEach(pintarTile);
}

function altitudeNoMapa(latlng) {
  const z = Math.min(Math.round(mapa.getZoom()), ZOOM_MAXIMO_RELEVO);
  const ponto = mapa.project(latlng, z);
  const x = Math.floor(ponto.x / 256);
  const y = Math.floor(ponto.y / 256);
  const n = 2 ** z;
  const xNoMundo = ((x % n) + n) % n;
  for (const { coords, relevo } of tilesTemperatura.values()) {
    if (relevo && coords.z === z && coords.x === xNoMundo && coords.y === y) {
      return relevo.altitudes[Math.floor(ponto.y - y * 256) * 256 + Math.floor(ponto.x - x * 256)];
    }
  }
  return null;
}

function lerTemperatura(latlng) {
  if (camadaAtiva !== "temperatura" || !camadaTemperatura) return;
  const leitura = document.querySelector("[data-leitura]");
  if (!leitura) return;
  ultimoPonto = latlng;
  const altitude = altitudeNoMapa(latlng);
  const valor = temperaturaNoPonto(gradeCarregada.dados, temperaturasReduzidas, latlng.lat, latlng.lng, altitude);
  if (valor == null) {
    leitura.textContent = "Fora da área com dados de temperatura";
    return;
  }
  const relevo = altitude == null ? "" : ` · ${Math.round(altitude).toLocaleString("pt-BR")} m de altitude`;
  leitura.textContent = `${temperatura(valor, ctx.unidade)}${ctx.unidade ?? "C"}${relevo}`;
}

function notaTemperatura(rotulo) {
  return `<strong>Temperatura:</strong> previsão do modelo para <strong>${esc(rotulo.toLowerCase())}</strong>, a 2 m do
    solo, num quadrado de cerca de 650 km de lado em volta de <strong>${esc(local.nome)}</strong>. A previsão da
    Open-Meteo é ajustada à altitude de cada ponto do relevo (cerca de 0,65 °C a menos a cada 100 m de subida), por isso
    serras e vales aparecem. Não é uma medição em tempo real.`;
}

async function ligarNuvens() {
  camadaAtiva = "nuvens";
  const meuMapa = mapa;
  if (!meuMapa) {
    falhar("Nuvens", "não foi possível carregar o mapa (verifique a internet).");
    return;
  }
  const satelite = satelitePara(local);
  if (!satelite) {
    falhar("Nuvens", "os satélites usados aqui não enxergam bem as regiões perto dos polos. "
      + "Para esta cidade ainda não há camada de nuvens.");
    return;
  }

  escreverNota("<strong>Nuvens:</strong> carregando as imagens de satélite…");
  try {
    const horarios = await dadosNuvens(satelite);
    if (camadaAtiva !== "nuvens" || mapa !== meuMapa) return;
    if (meuMapa.getZoom() > ZOOM_MAXIMO_NUVENS) meuMapa.setZoom(ZOOM_MAXIMO_NUVENS);
    indiceQuadro = horarios.length - 1;
    camadasNuvens = horarios.map((horario, i) =>
      criarCamadaNuvens(satelite, urlTileSatelite(satelite, horario), i === indiceQuadro ? 1 : 0).addTo(meuMapa));
    mostrarControles("nuvens");
    atualizarQuadro();
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      indiceQuadro = 0;
      mostrarQuadro(0);
      iniciarReproducao();
    }
  } catch (erro) {
    if (erro.name === "AbortError" || camadaAtiva !== "nuvens" || mapa !== meuMapa) return;
    falhar("Nuvens", erro.message);
  }
}

async function dadosNuvens(satelite) {
  if (nuvensCarregadas?.satelite === satelite.id && Date.now() - nuvensCarregadas.quando < VALIDADE_SATELITE_MS) {
    return nuvensCarregadas.dados;
  }
  pedido = new AbortController();
  const dados = await buscarHorariosSatelite(satelite, { signal: pedido.signal });
  pedido = null;
  nuvensCarregadas = { satelite: satelite.id, quando: Date.now(), dados };
  return dados;
}

function criarCamadaNuvens(satelite, url, opacidade) {
  const camada = window.L.gridLayer({
    pane: "nuvens",
    maxNativeZoom: 7,
    maxZoom: 18,
    opacity: opacidade,
    className: "camada-nuvens",
    attribution: satelite.credito,
  });
  camada.createTile = (coords, pronto) => {
    const tile = document.createElement("canvas");
    tile.width = 256;
    tile.height = 256;
    const imagem = new Image();
    imagem.crossOrigin = "anonymous";
    imagem.onload = () => {
      desenharNuvens(tile, imagem, satelite.brilho);
      pronto(null, tile);
    };
    imagem.onerror = () => pronto(null, tile);
    imagem.src = url(coords);
    return tile;
  };
  return camada;
}

function desenharNuvens(tile, imagem, brilho) {
  const pincel = tile.getContext("2d", { willReadFrequently: true });
  pincel.drawImage(imagem, 0, 0, 256, 256);
  const pixels = pincel.getImageData(0, 0, 256, 256);
  deixarSoNuvens(pixels.data, brilho);
  pincel.putImageData(pixels, 0, 0);
}

function diaNaCidade(data) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuso }).format(data);
}

function rotuloNuvens(indice) {
  const horarios = nuvensCarregadas.dados;
  const data = new Date(horarios[indice]);
  const horario = horaNaCidade(data, fuso, ctx.hora);
  if (indice === horarios.length - 1) return `Mais recente · ${horario}`;
  const ultimo = new Date(horarios[horarios.length - 1]);
  return diaNaCidade(data) === diaNaCidade(ultimo) ? horario : `Dia anterior · ${horario}`;
}

function notaNuvens() {
  const horarios = nuvensCarregadas.dados;
  const satelite = SATELITES.find((s) => s.id === nuvensCarregadas.satelite);
  const atual = new Date(horarios[indiceQuadro]);
  const idade = Math.max(0, Math.round((Date.now() - atual.getTime()) / 60000));
  const inicio = new Date(horarios[0]);
  const fim = new Date(horarios[horarios.length - 1]);
  const primeira = horaNaCidade(inicio, fuso, ctx.hora) + (diaNaCidade(inicio) === diaNaCidade(fim) ? "" : " do dia anterior");
  const ultima = horaNaCidade(fim, fuso, ctx.hora);
  const leitura = document.querySelector("[data-leitura]");
  if (leitura) leitura.textContent = `Imagem das ${horaNaCidade(atual, fuso, ctx.hora)} · há ${duracao(idade)}`;
  return `<strong>Nuvens:</strong> imagens reais ${satelite.descricao}, das ${esc(primeira)} às ${esc(ultima)}, a cada
    ${satelite.frequencia}. As áreas brancas são nuvens. As imagens chegam com ${satelite.atraso} de atraso, então mostram
    o passado recente, não uma previsão.${satelite.aviso ?? ""}`;
}
