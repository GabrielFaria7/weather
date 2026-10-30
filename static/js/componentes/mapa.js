import { buscarHorariosSatelite, buscarVentoGrade, urlTileSatelite } from "../servico.js";
import { direcao, duracao, esc, hora, horaNaCidade, vento } from "../formato.js";
import { iconeUI } from "../icones.js";

const CAMADAS = [
  { id: "radar", nome: "Radar de chuva" },
  { id: "nuvens", nome: "Nuvens" },
  { id: "temperatura", nome: "Temperatura" },
  { id: "vento", nome: "Vento" },
  { id: "precipitacao", nome: "Precipitação" },
];

const CORES_VENTO = [
  "rgb(98,182,255)", "rgb(80,215,230)", "rgb(90,230,170)", "rgb(140,240,110)", "rgb(210,245,90)",
  "rgb(255,230,80)", "rgb(255,190,60)", "rgb(255,140,50)", "rgb(250,90,60)", "rgb(235,60,110)", "rgb(200,70,200)",
];
const VENTO_MAXIMO_KMH = 54;
const VALIDADE_DADOS_MS = 30 * 60 * 1000;
const VALIDADE_SATELITE_MS = 5 * 60 * 1000;

const SATELITES = [
  { id: "GOES-East", nome: "GOES-East", oeste: -110, leste: -15 },
  { id: "GOES-West", nome: "GOES-West", oeste: -180, leste: -110 },
];
const LATITUDE_MAXIMA_SATELITE = 65;
const ZOOM_MAXIMO_NUVENS = 8;
const BRILHO_SEM_NUVEM = 80;
const BRILHO_NUVEM_DENSA = 210;
const OPACIDADE_NUVEM_DENSA = 195;

let mapa = null;
let local = null;
let fuso = "UTC";
let ctx = { vento: "kmh", hora: "24" };
let camadaAtiva = null;
let pedido = null;
let indiceQuadro = 0;
let reproducao = null;
let ultimoPonto = null;

let camadaVento = null;
let ventoCarregado = null;

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
        <span class="selo selo-demo" data-selo>Demonstrativo</span>
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
  mapa.on("mousemove click", (e) => lerVento(e.latlng));
}

export function selecionarCamada(id) {
  const camada = CAMADAS.find((c) => c.id === id);
  if (!camada) return;

  if (id === camadaAtiva) {
    desligarCamada();
    marcarChips(null);
    escreverNota(notaPadrao());
    return;
  }

  desligarCamada();
  marcarChips(id);
  if (id === "vento") ligarVento();
  else if (id === "nuvens") ligarNuvens();
  else {
    escreverNota(`<strong>${camada.nome}:</strong> camada demonstrativa. Ela será ativada quando um provedor de
      dados meteorológicos for integrado. Nada é exibido para não parecer informação real.`);
  }
}

export function atualizarMapa(contexto) {
  ctx = contexto;
  if (quadros()) atualizarQuadro();
}

export function ajustarMapa() {
  mapa?.invalidateSize();
}

function notaPadrao() {
  return `Escolha <strong>Nuvens</strong> ou <strong>Vento</strong> para ver o mapa animado. As outras camadas ainda
    não foram integradas. O mapa mostra a localização de <strong>${esc(local?.nome ?? "")}</strong>; nenhum dado de
    radar é simulado.`;
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
    camadasNuvens.forEach((camada) => mapa.removeLayer(camada));
  }
  camadaVento = null;
  camadasNuvens = [];
  mostrarControles(null);
}

function mostrarControles(id) {
  document.querySelector("[data-tempo]")?.toggleAttribute("hidden", !id);
  const legenda = document.querySelector("[data-legenda]");
  if (legenda) {
    legenda.toggleAttribute("hidden", !id);
    legenda.innerHTML = id === "vento" ? legendaVento() : id === "nuvens" ? legendaNuvens() : "";
  }
  document.getElementById("mapa-leaflet")?.classList.toggle("com-camada", Boolean(id));
  const selo = document.querySelector("[data-selo]");
  if (selo) {
    selo.classList.toggle("selo-demo", !id);
    selo.textContent = id === "vento" ? "Previsão" : id === "nuvens" ? "Satélite" : "Demonstrativo";
  }
}

function legendaVento() {
  return `
    <span class="legenda-titulo">Vento previsto</span>
    <span class="legenda-barra" style="background: linear-gradient(90deg, ${CORES_VENTO.join(", ")})"></span>
    <span class="legenda-escala"><span>0</span><span data-legenda-max></span></span>
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
  if (camadaAtiva === "vento" && camadaVento) return ventoCarregado.dados.horas.length;
  if (camadaAtiva === "nuvens" && camadasNuvens.length) return camadasNuvens.length;
  return 0;
}

function rotuloQuadro(indice) {
  return camadaAtiva === "vento" ? rotuloVento(ventoCarregado.dados, indice) : rotuloNuvens(indice);
}

function mostrarQuadro(indice) {
  if (!quadros()) return;
  indiceQuadro = indice;
  if (camadaAtiva === "vento") camadaVento.setData(quadroVento(ventoCarregado.dados, indice));
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
    controle.setAttribute("aria-label", camadaAtiva === "vento" ? "Hora da previsão do vento" : "Horário da imagem de satélite");
    controle.setAttribute("aria-valuetext", rotulo);
  }
  const saida = document.querySelector("[data-quadro-rotulo]");
  if (saida) saida.textContent = rotulo;

  if (camadaAtiva === "vento") {
    const maximo = document.querySelector("[data-legenda-max]");
    if (maximo) maximo.textContent = `${vento(VENTO_MAXIMO_KMH, ctx.vento)}+`;
    escreverNota(notaVento(rotulo));
    if (ultimoPonto) lerVento(ultimoPonto);
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
  const intervalo = camadaAtiva === "vento" ? 2000 : 700;
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
    const dados = await dadosVento();
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

async function dadosVento() {
  const chave = `${local.latitude},${local.longitude}`;
  if (ventoCarregado?.chave === chave && Date.now() - ventoCarregado.quando < VALIDADE_DADOS_MS) {
    return ventoCarregado.dados;
  }
  pedido = new AbortController();
  const dados = await buscarVentoGrade(local, { signal: pedido.signal });
  pedido = null;
  ventoCarregado = { chave, quando: Date.now(), dados };
  return dados;
}

function quadroVento({ grade, horas, pontos }, indice) {
  const u = [];
  const v = [];
  pontos.forEach((ponto) => {
    const ms = (ponto.velocidade[indice] ?? 0) / 3.6;
    const radianos = ((ponto.direcao[indice] ?? 0) * Math.PI) / 180;
    u.push(-ms * Math.sin(radianos));
    v.push(-ms * Math.cos(radianos));
  });
  const cabecalho = {
    parameterCategory: 2,
    lo1: grade.oeste,
    la1: grade.norte,
    lo2: grade.oeste + (grade.colunas - 1) * grade.passo,
    la2: grade.norte - (grade.linhas - 1) * grade.passo,
    dx: grade.passo,
    dy: grade.passo,
    nx: grade.colunas,
    ny: grade.linhas,
    refTime: new Date(horas[indice] * 1000).toISOString(),
    forecastTime: 0,
  };
  return [
    { header: { ...cabecalho, parameterNumber: 2 }, data: u },
    { header: { ...cabecalho, parameterNumber: 3 }, data: v },
  ];
}

function isoLocal(dados, indice) {
  return new Date((dados.horas[indice] + dados.deslocamento) * 1000).toISOString();
}

function rotuloVento(dados, indice) {
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

function lerVento(latlng) {
  if (camadaAtiva !== "vento" || !camadaVento) return;
  const leitura = document.querySelector("[data-leitura]");
  if (!leitura) return;
  ultimoPonto = latlng;
  const { grade, pontos } = ventoCarregado.dados;
  const linha = Math.round((grade.norte - latlng.lat) / grade.passo);
  const coluna = Math.round((((latlng.lng - grade.oeste) % 360) + 360) % 360 / grade.passo);
  if (linha < 0 || linha >= grade.linhas || coluna < 0 || coluna >= grade.colunas) {
    leitura.textContent = "Fora da área com dados de vento";
    return;
  }
  const ponto = pontos[linha * grade.colunas + coluna];
  leitura.textContent = `${vento(ponto.velocidade[indiceQuadro], ctx.vento)} vindo do ${direcao(ponto.direcao[indiceQuadro], true)}`;
}

function satelitePara({ latitude, longitude }) {
  if (Math.abs(latitude) > LATITUDE_MAXIMA_SATELITE) return null;
  const lon = ((longitude + 540) % 360) - 180;
  return SATELITES.find((s) => lon >= s.oeste && lon < s.leste) ?? null;
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
    falhar("Nuvens", "as imagens de satélite usadas aqui cobrem só as Américas e o Pacífico leste. "
      + "Para esta cidade ainda não há camada de nuvens.");
    return;
  }

  escreverNota("<strong>Nuvens:</strong> carregando as imagens de satélite…");
  try {
    const { camada, horarios } = await dadosNuvens(satelite);
    if (camadaAtiva !== "nuvens" || mapa !== meuMapa) return;
    if (meuMapa.getZoom() > ZOOM_MAXIMO_NUVENS) meuMapa.setZoom(ZOOM_MAXIMO_NUVENS);
    indiceQuadro = horarios.length - 1;
    camadasNuvens = horarios.map((horario, i) =>
      criarCamadaNuvens(urlTileSatelite(camada, horario), i === indiceQuadro ? 1 : 0).addTo(meuMapa));
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
  const dados = await buscarHorariosSatelite(satelite.id, { signal: pedido.signal });
  pedido = null;
  nuvensCarregadas = { satelite: satelite.id, quando: Date.now(), dados };
  return dados;
}

function criarCamadaNuvens(url, opacidade) {
  const camada = window.L.gridLayer({
    pane: "nuvens",
    maxNativeZoom: 7,
    maxZoom: 18,
    opacity: opacidade,
    className: "camada-nuvens",
    attribution: 'Satélite: <a href="https://www.earthdata.nasa.gov/gibs" target="_blank" rel="noopener">NOAA GOES · NASA GIBS</a>',
  });
  camada.createTile = (coords, pronto) => {
    const tile = document.createElement("canvas");
    tile.width = 256;
    tile.height = 256;
    const imagem = new Image();
    imagem.crossOrigin = "anonymous";
    imagem.onload = () => {
      desenharNuvens(tile, imagem);
      pronto(null, tile);
    };
    imagem.onerror = () => pronto(null, tile);
    imagem.src = window.L.Util.template(url, coords);
    return tile;
  };
  return camada;
}

function desenharNuvens(tile, imagem) {
  const pincel = tile.getContext("2d", { willReadFrequently: true });
  pincel.drawImage(imagem, 0, 0, 256, 256);
  const pixels = pincel.getImageData(0, 0, 256, 256);
  const d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    const brilho = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const forca = Math.min(1, Math.max(0, (brilho - BRILHO_SEM_NUVEM) / (BRILHO_NUVEM_DENSA - BRILHO_SEM_NUVEM)));
    const tom = 175 + 80 * forca;
    d[i] = tom;
    d[i + 1] = tom;
    d[i + 2] = tom + (255 - tom) * 0.4;
    d[i + 3] = (d[i + 3] / 255) * forca * OPACIDADE_NUVEM_DENSA;
  }
  pincel.putImageData(pixels, 0, 0);
}

function rotuloNuvens(indice) {
  const { horarios } = nuvensCarregadas.dados;
  const horario = horaNaCidade(new Date(horarios[indice]), fuso, ctx.hora);
  return indice === horarios.length - 1 ? `Mais recente · ${horario}` : horario;
}

function notaNuvens() {
  const { horarios } = nuvensCarregadas.dados;
  const satelite = SATELITES.find((s) => s.id === nuvensCarregadas.satelite);
  const atual = new Date(horarios[indiceQuadro]);
  const idade = Math.max(0, Math.round((Date.now() - atual.getTime()) / 60000));
  const primeira = horaNaCidade(new Date(horarios[0]), fuso, ctx.hora);
  const ultima = horaNaCidade(new Date(horarios[horarios.length - 1]), fuso, ctx.hora);
  const leitura = document.querySelector("[data-leitura]");
  if (leitura) leitura.textContent = `Imagem das ${horaNaCidade(atual, fuso, ctx.hora)} · há ${duracao(idade)}`;
  return `<strong>Nuvens:</strong> imagens reais do satélite <strong>${esc(satelite?.nome ?? "")}</strong> (NOAA, via
    NASA GIBS), das ${esc(primeira)} às ${esc(ultima)}, a cada 10 minutos. As áreas brancas são nuvens. As imagens chegam
    com cerca de 1 hora de atraso, então mostram o passado recente, não uma previsão.`;
}
