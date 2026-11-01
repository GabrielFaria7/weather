import { buscarHorariosSatelite, buscarVentoGrade, urlTileSatelite } from "../servico.js";
import { direcao, duracao, esc, hora, horaNaCidade, vento } from "../formato.js";
import { indiceNaGrade, quadroVento } from "../gradeVento.js";
import { iconeUI } from "../icones.js";
import { deixarSoNuvens, SATELITES, satelitePara } from "../satelites.js";

const CAMADAS = [
  { id: "nuvens", nome: "Nuvens" },
  { id: "vento", nome: "Vento" },
];

const CORES_VENTO = [
  "rgb(98,182,255)", "rgb(80,215,230)", "rgb(90,230,170)", "rgb(140,240,110)", "rgb(210,245,90)",
  "rgb(255,230,80)", "rgb(255,190,60)", "rgb(255,140,50)", "rgb(250,90,60)", "rgb(235,60,110)", "rgb(200,70,200)",
];
const VENTO_MAXIMO_KMH = 54;
const VALIDADE_DADOS_MS = 30 * 60 * 1000;
const VALIDADE_SATELITE_MS = 5 * 60 * 1000;

const ZOOM_MAXIMO_NUVENS = 8;

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
  mapa.on("mousemove click", (e) => lerVento(e.latlng));
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
  return `Escolha <strong>Nuvens</strong> para ver as imagens reais de satélite das últimas horas ou
    <strong>Vento</strong> para ver a previsão das próximas 24 horas em volta de <strong>${esc(local?.nome ?? "")}</strong>.`;
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
    selo.toggleAttribute("hidden", !id);
    selo.textContent = id === "vento" ? "Previsão" : id === "nuvens" ? "Satélite" : "";
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
  const indice = indiceNaGrade(grade, latlng.lat, latlng.lng);
  if (indice < 0) {
    leitura.textContent = "Fora da área com dados de vento";
    return;
  }
  const ponto = pontos[indice];
  leitura.textContent = `${vento(ponto.velocidade[indiceQuadro], ctx.vento)} vindo do ${direcao(ponto.direcao[indiceQuadro], true)}`;
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
