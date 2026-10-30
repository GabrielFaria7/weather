import { buscarGradeMapa, buscarHorariosSatelite, buscarQuadrosRadar, URL_COBERTURA_RADAR, urlTileSatelite } from "../servico.js";
import { direcao, duracao, esc, hora, horaNaCidade, temperatura, vento } from "../formato.js";
import { iconeUI } from "../icones.js";

const CAMADAS = [
  { id: "radar", nome: "Radar de chuva", selo: "Radar", intervalo: 700 },
  { id: "nuvens", nome: "Nuvens", selo: "Satélite", intervalo: 700 },
  { id: "temperatura", nome: "Temperatura", selo: "Previsão", intervalo: 1000 },
  { id: "vento", nome: "Vento", selo: "Previsão", intervalo: 2000 },
  { id: "precipitacao", nome: "Precipitação", selo: "Previsão", intervalo: 1000 },
];
const PREVISOES = ["temperatura", "vento", "precipitacao"];

const CORES_VENTO = [
  "rgb(98,182,255)", "rgb(80,215,230)", "rgb(90,230,170)", "rgb(140,240,110)", "rgb(210,245,90)",
  "rgb(255,230,80)", "rgb(255,190,60)", "rgb(255,140,50)", "rgb(250,90,60)", "rgb(235,60,110)", "rgb(200,70,200)",
];
const VENTO_MAXIMO_KMH = 54;

const ESCALA_TEMPERATURA = [
  [-10, [94, 79, 162]], [0, [50, 136, 189]], [10, [102, 194, 165]], [18, [171, 221, 164]],
  [24, [254, 224, 139]], [30, [253, 174, 97]], [36, [244, 109, 67]], [42, [213, 62, 79]],
];
const OPACIDADE_TEMPERATURA = 0.6;
const ESCALA_PRECIPITACAO = [
  [0.1, [140, 210, 255]], [1, [60, 150, 240]], [3, [30, 90, 210]], [6, [110, 60, 200]], [12, [190, 60, 190]],
];
const CHUVA_MINIMA_MM = 0.1;
const CORES_RADAR = ["#88ddee", "#00a3e0", "#0077aa", "#005588", "#ffee00", "#ffaa00", "#ff4400", "#c10000", "#ffaaff"];
const LADO_IMAGEM_GRADE = 240;
const BORDA_SUAVE = 0.06;

const VALIDADE_DADOS_MS = 30 * 60 * 1000;
const VALIDADE_IMAGENS_MS = 5 * 60 * 1000;

const SATELITES = [
  { id: "GOES-East", nome: "GOES-East", oeste: -110, leste: -15 },
  { id: "GOES-West", nome: "GOES-West", oeste: -180, leste: -110 },
];
const LATITUDE_MAXIMA_SATELITE = 65;
const ZOOM_MAXIMO_IMAGENS = 8;
const ZOOM_NATIVO_IMAGENS = 7;
const BRILHO_SEM_NUVEM = 80;
const BRILHO_NUVEM_DENSA = 210;
const OPACIDADE_NUVEM_DENSA = 195;
const OPACIDADE_SEM_COBERTURA = 0.35;

let mapa = null;
let local = null;
let fuso = "UTC";
let ctx = { unidade: "C", vento: "kmh", hora: "24" };
let camadaAtiva = null;
let pedido = null;
let indiceQuadro = 0;
let reproducao = null;
let ultimoPonto = null;

let gradeCarregada = null;
let camadaVento = null;
let camadaGrade = null;

let camadasImagens = [];
let horariosImagens = [];
let camadaCobertura = null;
let nuvensCarregadas = null;
let radarCarregado = null;
let radarCobreLocal = null;

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
  mapa.createPane("camadas").style.zIndex = 350;
  mapa.on("mousemove click", (e) => lerPonto(e.latlng));
}

function selecionarCamada(id) {
  if (!dadosCamada(id)) return;

  if (id === camadaAtiva) {
    desligarCamada();
    marcarChips(null);
    escreverNota(notaPadrao());
    return;
  }

  desligarCamada();
  marcarChips(id);
  if (PREVISOES.includes(id)) ligarPrevisao(id);
  else if (id === "nuvens") ligarNuvens();
  else ligarRadar();
}

export function atualizarMapa(contexto) {
  ctx = contexto;
  if (quadros()) atualizarQuadro();
}

export function ajustarMapa() {
  mapa?.invalidateSize();
}

function dadosCamada(id) {
  return CAMADAS.find((c) => c.id === id);
}

function notaPadrao() {
  return `Escolha uma camada para ver o mapa animado. <strong>Radar de chuva</strong> e <strong>Nuvens</strong> mostram
    imagens reais das últimas 2 horas; <strong>Temperatura</strong>, <strong>Vento</strong> e
    <strong>Precipitação</strong> mostram a previsão das próximas 24 horas em volta de
    <strong>${esc(local?.nome ?? "")}</strong>.`;
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
    [camadaVento, camadaGrade, camadaCobertura, ...camadasImagens].forEach((camada) => camada && mapa.removeLayer(camada));
  }
  camadaVento = null;
  camadaGrade = null;
  camadaCobertura = null;
  camadasImagens = [];
  horariosImagens = [];
  mostrarControles(null);
}

function mostrarControles(id) {
  document.querySelector("[data-tempo]")?.toggleAttribute("hidden", !id);
  const legenda = document.querySelector("[data-legenda]");
  if (legenda) {
    legenda.toggleAttribute("hidden", !id);
    legenda.innerHTML = id ? legendaCamada(id) : "";
  }
  document.getElementById("mapa-leaflet")?.classList.toggle("com-camada", Boolean(id));
  const selo = document.querySelector("[data-selo]");
  if (selo) {
    selo.toggleAttribute("hidden", !id);
    selo.textContent = dadosCamada(id)?.selo ?? "";
  }
}

const gradiente = (cores) => `linear-gradient(90deg, ${cores.join(", ")})`;
const rgb = ([r, g, b]) => `rgb(${r},${g},${b})`;

function legendaCamada(id) {
  const legendas = {
    radar: ["Chuva vista pelo radar", gradiente(CORES_RADAR), "Fraca", "Forte"],
    nuvens: ["Nuvens vistas do satélite", "", "Limpo", "Encoberto"],
    temperatura: ["Temperatura prevista", gradiente(ESCALA_TEMPERATURA.map(([, cor]) => rgb(cor))), "", ""],
    vento: ["Vento previsto", gradiente(CORES_VENTO), "0", ""],
    precipitacao: ["Chuva prevista na hora", gradiente(ESCALA_PRECIPITACAO.map(([, cor]) => rgb(cor))),
      `${CHUVA_MINIMA_MM} mm`, `${ESCALA_PRECIPITACAO.at(-1)[0]}+ mm`],
  };
  const [titulo, fundo, minimo, maximo] = legendas[id];
  return `
    <span class="legenda-titulo">${titulo}</span>
    <span class="legenda-barra${id === "nuvens" ? " legenda-nuvens" : ""}"${fundo ? ` style="background: ${fundo}"` : ""}></span>
    <span class="legenda-escala"><span data-legenda-min>${minimo}</span><span data-legenda-max>${maximo}</span></span>
    <span class="legenda-leitura" data-leitura>${PREVISOES.includes(id) ? "Toque ou aponte no mapa" : ""}</span>`;
}

function atualizarEscala() {
  const minimo = document.querySelector("[data-legenda-min]");
  const maximo = document.querySelector("[data-legenda-max]");
  if (!minimo || !maximo) return;
  if (camadaAtiva === "vento") maximo.textContent = `${vento(VENTO_MAXIMO_KMH, ctx.vento)}+`;
  if (camadaAtiva === "temperatura") {
    minimo.textContent = temperatura(ESCALA_TEMPERATURA[0][0], ctx.unidade);
    maximo.textContent = `${temperatura(ESCALA_TEMPERATURA.at(-1)[0], ctx.unidade)}+`;
  }
}

function quadros() {
  if (PREVISOES.includes(camadaAtiva) && (camadaVento || camadaGrade)) return gradeCarregada.dados.horas.length;
  if (camadasImagens.length) return camadasImagens.length;
  return 0;
}

function mostrarQuadro(indice) {
  if (!quadros()) return;
  indiceQuadro = indice;
  if (camadaVento) camadaVento.setData(quadroVento(gradeCarregada.dados, indice));
  else if (camadaGrade) camadaGrade.setUrl(imagemGrade(gradeCarregada.dados, camadaAtiva, indice).url);
  else camadasImagens.forEach((camada, i) => camada.setOpacity(i === indice ? 1 : 0));
  atualizarQuadro();
}

function atualizarQuadro() {
  const total = quadros();
  if (!total) return;
  const previsao = PREVISOES.includes(camadaAtiva);
  const rotulo = previsao ? rotuloPrevisao(gradeCarregada.dados, indiceQuadro) : rotuloImagem(indiceQuadro);
  const controle = document.querySelector("[data-quadro]");
  if (controle) {
    controle.max = String(total - 1);
    controle.value = String(indiceQuadro);
    controle.setAttribute("aria-label", previsao ? "Hora da previsão" : "Horário da imagem");
    controle.setAttribute("aria-valuetext", rotulo);
  }
  const saida = document.querySelector("[data-quadro-rotulo]");
  if (saida) saida.textContent = rotulo;

  atualizarEscala();
  if (previsao) {
    escreverNota(notaPrevisao(rotulo));
    if (ultimoPonto) lerPonto(ultimoPonto);
  } else {
    escreverNota(notaImagens());
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
  reproducao = setInterval(() => mostrarQuadro((indiceQuadro + 1) % quadros()), dadosCamada(camadaAtiva).intervalo);
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

function limitarZoom(meuMapa) {
  if (meuMapa.getZoom() > ZOOM_MAXIMO_IMAGENS) meuMapa.setZoom(ZOOM_MAXIMO_IMAGENS);
}

async function ligarPrevisao(id) {
  camadaAtiva = id;
  const { nome } = dadosCamada(id);
  const meuMapa = mapa;
  if (!meuMapa || (id === "vento" && typeof window.L.velocityLayer !== "function")) {
    falhar(nome, `não foi possível carregar ${id === "vento" ? "a animação do vento" : "o mapa"} (verifique a internet).`);
    return;
  }

  escreverNota(`<strong>${nome}:</strong> carregando a previsão…`);
  try {
    const dados = await dadosGrade();
    if (camadaAtiva !== id || mapa !== meuMapa) return;
    indiceQuadro = 0;
    if (id === "vento") {
      camadaVento = criarCamadaVento(dados).addTo(meuMapa);
    } else {
      limitarZoom(meuMapa);
      const { url, limites } = imagemGrade(dados, id, indiceQuadro);
      camadaGrade = window.L.imageOverlay(url, limites, {
        pane: "camadas",
        className: "camada-grade",
        attribution: 'Previsão: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>',
      }).addTo(meuMapa);
    }
    mostrarControles(id);
    atualizarQuadro();
  } catch (erro) {
    if (erro.name === "AbortError" || camadaAtiva !== id || mapa !== meuMapa) return;
    falhar(nome, erro.message);
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

function criarCamadaVento(dados) {
  return window.L.velocityLayer({
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
  });
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

const mercator = (latitude) => Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360));
const latitudeMercator = (y) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;

function corNaEscala(escala, valor) {
  if (valor <= escala[0][0]) return escala[0][1];
  for (let i = 1; i < escala.length; i++) {
    const [limite, cor] = escala[i];
    if (valor <= limite) {
      const [anterior, corAnterior] = escala[i - 1];
      const t = (valor - anterior) / (limite - anterior);
      return corAnterior.map((c, j) => c + (cor[j] - c) * t);
    }
  }
  return escala.at(-1)[1];
}

function corDaGrade(campo, valor) {
  if (!Number.isFinite(valor)) return null;
  if (campo === "temperatura") return [...corNaEscala(ESCALA_TEMPERATURA, valor), OPACIDADE_TEMPERATURA];
  if (valor < CHUVA_MINIMA_MM / 2) return null;
  const opacidade = Math.min(0.85, 0.35 + valor / 4);
  return [...corNaEscala(ESCALA_PRECIPITACAO, valor), opacidade * Math.min(1, (valor - CHUVA_MINIMA_MM / 2) / 0.25)];
}

function imagemGrade({ grade, pontos }, campo, indice) {
  const sul = grade.norte - (grade.linhas - 1) * grade.passo;
  const leste = grade.oeste + (grade.colunas - 1) * grade.passo;
  const yNorte = mercator(grade.norte);
  const ySul = mercator(sul);
  const lado = LADO_IMAGEM_GRADE;
  const tela = document.createElement("canvas");
  tela.width = lado;
  tela.height = lado;
  const pincel = tela.getContext("2d");
  const pixels = pincel.createImageData(lado, lado);
  const valor = (linha, coluna) => pontos[linha * grade.colunas + coluna][campo][indice] ?? NaN;
  const suavizar = (t) => Math.min(1, Math.min(t, 1 - t) / BORDA_SUAVE);

  for (let py = 0; py < lado; py++) {
    const latitude = latitudeMercator(yNorte + ((ySul - yNorte) * (py + 0.5)) / lado);
    const fl = Math.min(grade.linhas - 1, Math.max(0, (grade.norte - latitude) / grade.passo));
    const l0 = Math.min(grade.linhas - 2, Math.floor(fl));
    const tl = fl - l0;
    for (let px = 0; px < lado; px++) {
      const fc = ((px + 0.5) / lado) * (grade.colunas - 1);
      const c0 = Math.min(grade.colunas - 2, Math.floor(fc));
      const tc = fc - c0;
      const v = (valor(l0, c0) * (1 - tc) + valor(l0, c0 + 1) * tc) * (1 - tl)
        + (valor(l0 + 1, c0) * (1 - tc) + valor(l0 + 1, c0 + 1) * tc) * tl;
      const cor = corDaGrade(campo, v);
      if (!cor) continue;
      const i = (py * lado + px) * 4;
      pixels.data[i] = cor[0];
      pixels.data[i + 1] = cor[1];
      pixels.data[i + 2] = cor[2];
      pixels.data[i + 3] = 255 * cor[3] * suavizar((px + 0.5) / lado) * suavizar((py + 0.5) / lado);
    }
  }
  pincel.putImageData(pixels, 0, 0);
  return { url: tela.toDataURL(), limites: [[sul, grade.oeste], [grade.norte, leste]] };
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

function notaPrevisao(rotulo) {
  const quando = `<strong>${esc(rotulo.toLowerCase())}</strong>`;
  const area = `num quadrado de cerca de 650 km de lado em volta de <strong>${esc(local.nome)}</strong>`;
  const fonte = "Os dados são da previsão da Open-Meteo; não é uma medição em tempo real.";
  if (camadaAtiva === "vento") {
    return `<strong>Vento:</strong> previsão do modelo para ${quando}, a 10 m do solo, ${area}. As partículas mostram a
      direção e a força previstas. ${fonte}`;
  }
  if (camadaAtiva === "temperatura") {
    return `<strong>Temperatura:</strong> previsão do modelo para ${quando}, a 2 m do solo, ${area}. ${fonte}`;
  }
  const semChuva = gradeCarregada.dados.pontos.every((p) => (p.precipitacao[indiceQuadro] ?? 0) < CHUVA_MINIMA_MM);
  return `<strong>Precipitação:</strong> chuva prevista pelo modelo para a hora que termina ${quando}, ${area}.
    ${semChuva ? "<strong>Nenhuma chuva prevista nesta hora</strong> na área do mapa. " : ""}${fonte} Para ver onde está
    chovendo de fato, use o <strong>Radar de chuva</strong>.`;
}

function lerPonto(latlng) {
  if (!PREVISOES.includes(camadaAtiva) || !quadros()) return;
  const leitura = document.querySelector("[data-leitura]");
  if (!leitura) return;
  ultimoPonto = latlng;
  const { grade, pontos } = gradeCarregada.dados;
  const linha = Math.round((grade.norte - latlng.lat) / grade.passo);
  const coluna = Math.round((((latlng.lng - grade.oeste) % 360) + 360) % 360 / grade.passo);
  if (linha < 0 || linha >= grade.linhas || coluna < 0 || coluna >= grade.colunas) {
    leitura.textContent = "Fora da área com dados";
    return;
  }
  const ponto = pontos[linha * grade.colunas + coluna];
  const i = indiceQuadro;
  if (camadaAtiva === "vento") {
    leitura.textContent = `${vento(ponto.velocidade[i], ctx.vento)} vindo do ${direcao(ponto.direcao[i], true)}`;
  } else if (camadaAtiva === "temperatura") {
    leitura.textContent = `${temperatura(ponto.temperatura[i], ctx.unidade)} neste ponto`;
  } else {
    const chuva = ponto.precipitacao[i] ?? 0;
    leitura.textContent = chuva < CHUVA_MINIMA_MM ? "Sem chuva prevista aqui" : `${chuva.toFixed(1)} mm previstos aqui`;
  }
}

function mostrarImagens(meuMapa, camadas, horarios, id) {
  horariosImagens = horarios;
  indiceQuadro = horarios.length - 1;
  camadasImagens = camadas.map((camada, i) => camada.setOpacity(i === indiceQuadro ? 1 : 0).addTo(meuMapa));
  mostrarControles(id);
  atualizarQuadro();
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    mostrarQuadro(0);
    iniciarReproducao();
  }
}

async function ligarRadar() {
  camadaAtiva = "radar";
  const meuMapa = mapa;
  if (!meuMapa) {
    falhar("Radar de chuva", "não foi possível carregar o mapa (verifique a internet).");
    return;
  }

  escreverNota("<strong>Radar de chuva:</strong> carregando as imagens do radar…");
  try {
    const [{ horarios, urls }, cobre] = await Promise.all([dadosRadar(), radarCobre(local)]);
    if (camadaAtiva !== "radar" || mapa !== meuMapa) return;
    radarCobreLocal = cobre;
    limitarZoom(meuMapa);
    camadaCobertura = window.L.tileLayer(URL_COBERTURA_RADAR, {
      pane: "camadas",
      maxNativeZoom: ZOOM_NATIVO_IMAGENS,
      maxZoom: 18,
      opacity: OPACIDADE_SEM_COBERTURA,
      className: "camada-cobertura",
    }).addTo(meuMapa);
    const camadas = urls.map((url) => window.L.tileLayer(url, {
      pane: "camadas",
      maxNativeZoom: ZOOM_NATIVO_IMAGENS,
      maxZoom: 18,
      attribution: 'Radar: <a href="https://www.rainviewer.com/" target="_blank" rel="noopener">RainViewer</a>',
    }));
    mostrarImagens(meuMapa, camadas, horarios, "radar");
  } catch (erro) {
    if (erro.name === "AbortError" || camadaAtiva !== "radar" || mapa !== meuMapa) return;
    falhar("Radar de chuva", erro.message);
  }
}

async function dadosRadar() {
  if (radarCarregado && Date.now() - radarCarregado.quando < VALIDADE_IMAGENS_MS) return radarCarregado.dados;
  pedido = new AbortController();
  const dados = await buscarQuadrosRadar({ signal: pedido.signal });
  pedido = null;
  radarCarregado = { quando: Date.now(), dados };
  return dados;
}

function radarCobre({ latitude, longitude }) {
  const ponto = window.L.CRS.EPSG3857.latLngToPoint(window.L.latLng(latitude, longitude), ZOOM_NATIVO_IMAGENS);
  const x = Math.floor(ponto.x / 256);
  const y = Math.floor(ponto.y / 256);
  return new Promise((resolver) => {
    const imagem = new Image();
    imagem.crossOrigin = "anonymous";
    imagem.onload = () => {
      try {
        const tela = document.createElement("canvas");
        tela.width = 256;
        tela.height = 256;
        const pincel = tela.getContext("2d");
        pincel.drawImage(imagem, 0, 0);
        const alfa = pincel.getImageData(Math.floor(ponto.x - x * 256), Math.floor(ponto.y - y * 256), 1, 1).data[3];
        resolver(alfa < 128);
      } catch {
        resolver(null);
      }
    };
    imagem.onerror = () => resolver(null);
    imagem.src = window.L.Util.template(URL_COBERTURA_RADAR, { z: ZOOM_NATIVO_IMAGENS, x, y });
  });
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
    limitarZoom(meuMapa);
    mostrarImagens(meuMapa, horarios.map((horario) => criarCamadaNuvens(urlTileSatelite(camada, horario))), horarios, "nuvens");
  } catch (erro) {
    if (erro.name === "AbortError" || camadaAtiva !== "nuvens" || mapa !== meuMapa) return;
    falhar("Nuvens", erro.message);
  }
}

async function dadosNuvens(satelite) {
  if (nuvensCarregadas?.satelite === satelite.id && Date.now() - nuvensCarregadas.quando < VALIDADE_IMAGENS_MS) {
    return nuvensCarregadas.dados;
  }
  pedido = new AbortController();
  const dados = await buscarHorariosSatelite(satelite.id, { signal: pedido.signal });
  pedido = null;
  nuvensCarregadas = { satelite: satelite.id, quando: Date.now(), dados };
  return dados;
}

function criarCamadaNuvens(url) {
  const camada = window.L.gridLayer({
    pane: "camadas",
    maxNativeZoom: ZOOM_NATIVO_IMAGENS,
    maxZoom: 18,
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

function rotuloImagem(indice) {
  const horario = horaNaCidade(new Date(horariosImagens[indice]), fuso, ctx.hora);
  return indice === horariosImagens.length - 1 ? `Mais recente · ${horario}` : horario;
}

function notaImagens() {
  const atual = new Date(horariosImagens[indiceQuadro]);
  const idade = Math.max(0, Math.round((Date.now() - atual.getTime()) / 60000));
  const primeira = esc(horaNaCidade(new Date(horariosImagens[0]), fuso, ctx.hora));
  const ultima = esc(horaNaCidade(new Date(horariosImagens.at(-1)), fuso, ctx.hora));
  const leitura = document.querySelector("[data-leitura]");
  if (leitura) leitura.textContent = `Imagem das ${horaNaCidade(atual, fuso, ctx.hora)} · há ${duracao(idade)}`;

  if (camadaAtiva === "radar") {
    const foraDoRadar = radarCobreLocal === false
      ? ` <strong>${esc(local.nome)}</strong> fica fora da área coberta pelos radares, então a chuva ali não aparece.`
      : "";
    return `<strong>Radar de chuva:</strong> imagens reais dos radares meteorológicos, reunidas pelo RainViewer, das
      ${primeira} às ${ultima}, a cada 10 minutos. Mostram onde choveu nas últimas 2 horas, não uma previsão. As áreas
      mais escuras do mapa não têm cobertura de radar.${foraDoRadar}`;
  }
  const satelite = SATELITES.find((s) => s.id === nuvensCarregadas.satelite);
  return `<strong>Nuvens:</strong> imagens reais do satélite <strong>${esc(satelite?.nome ?? "")}</strong> (NOAA, via
    NASA GIBS), das ${primeira} às ${ultima}, a cada 10 minutos. As áreas brancas são nuvens. As imagens chegam
    com cerca de 1 hora de atraso, então mostram o passado recente, não uma previsão.`;
}
