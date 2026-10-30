import { buscarVentoGrade } from "../servico.js";
import { direcao, esc, hora, vento } from "../formato.js";
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
const VALIDADE_VENTO_MS = 30 * 60 * 1000;
const INTERVALO_REPRODUCAO_MS = 2000;

let mapa = null;
let local = null;
let ctx = { vento: "kmh", hora: "24" };
let camadaVento = null;
let ventoAtivo = false;
let ventoCarregado = null;
let pedidoVento = null;
let indiceHora = 0;
let reproducao = null;
let ultimoPonto = null;

export function renderizarMapa(el, dados, contexto) {
  const { latitude, longitude, nome } = dados.local;
  desligarVento();
  mapa?.remove();
  mapa = null;
  local = dados.local;
  if (contexto) ctx = contexto;
  indiceHora = 0;
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
        <div class="mapa-legenda" data-legenda hidden>
          <span class="legenda-titulo">Vento previsto</span>
          <span class="legenda-barra" style="background: linear-gradient(90deg, ${CORES_VENTO.join(", ")})"></span>
          <span class="legenda-escala"><span>0</span><span data-legenda-max></span></span>
          <span class="legenda-leitura" data-leitura>Toque ou aponte no mapa</span>
        </div>
      </div>
      <div class="mapa-tempo" data-tempo hidden>
        <button type="button" class="btn-icone" data-reproduzir aria-label="Reproduzir as próximas horas" title="Reproduzir">
          ${iconeUI("reproduzir")}
        </button>
        <input type="range" min="0" max="0" value="0" step="1" data-hora-vento aria-label="Hora da previsão do vento">
        <output data-hora-rotulo></output>
      </div>
      <p class="mapa-nota" data-nota>${iconeUI("mapa")}<span>${notaPadrao()}</span></p>
    </section>`;

  el.querySelectorAll("[data-camada]").forEach((chip) => {
    chip.addEventListener("click", () => selecionarCamada(chip.dataset.camada));
  });
  el.querySelector("[data-hora-vento]").addEventListener("input", (e) => {
    pararReproducao();
    mostrarHora(Number(e.target.value));
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
  mapa.on("mousemove click", (e) => lerVento(e.latlng));
}

export function selecionarCamada(id) {
  const camada = CAMADAS.find((c) => c.id === id);
  if (!camada) return;

  if (id === "vento") {
    if (ventoAtivo) {
      desligarVento();
      marcarChips(null);
      escreverNota(notaPadrao());
    } else {
      marcarChips(id);
      ligarVento();
    }
    return;
  }

  desligarVento();
  marcarChips(id);
  escreverNota(`<strong>${camada.nome}:</strong> camada demonstrativa. Ela será ativada quando um provedor de
    dados meteorológicos for integrado. Nada é exibido para não parecer informação real.`);
}

export function atualizarMapa(contexto) {
  ctx = contexto;
  if (camadaVento) atualizarVento();
}

export function ajustarMapa() {
  mapa?.invalidateSize();
}

function notaPadrao() {
  return `Escolha <strong>Vento</strong> para ver a previsão animada. As outras camadas ainda não foram integradas.
    O mapa mostra a localização de <strong>${esc(local?.nome ?? "")}</strong>; nenhum dado de radar é simulado.`;
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

async function ligarVento() {
  ventoAtivo = true;
  const meuMapa = mapa;
  if (!meuMapa || typeof window.L.velocityLayer !== "function") {
    ventoAtivo = false;
    marcarChips(null);
    escreverNota("<strong>Vento:</strong> não foi possível carregar a animação do vento (verifique a internet).");
    return;
  }

  escreverNota("<strong>Vento:</strong> carregando a previsão…");
  try {
    const dados = await dadosVento();
    if (!ventoAtivo || mapa !== meuMapa) return;
    indiceHora = Math.min(indiceHora, dados.horas.length - 1);
    camadaVento = window.L.velocityLayer({
      displayValues: false,
      data: quadroVento(dados, indiceHora),
      minVelocity: 0,
      maxVelocity: VENTO_MAXIMO_KMH / 3.6,
      colorScale: CORES_VENTO,
      velocityScale: 0.05,
      particleMultiplier: 1 / 250,
      particleAge: 60,
      lineWidth: 1.5,
      frameRate: 20,
    }).addTo(meuMapa);
    mostrarControlesVento(true);
    atualizarVento();
  } catch (erro) {
    if (erro.name === "AbortError" || !ventoAtivo || mapa !== meuMapa) return;
    ventoAtivo = false;
    marcarChips(null);
    escreverNota(`<strong>Vento:</strong> ${esc(erro.message)}`);
  }
}

function desligarVento() {
  ventoAtivo = false;
  pararReproducao();
  pedidoVento?.abort();
  pedidoVento = null;
  if (camadaVento && mapa) mapa.removeLayer(camadaVento);
  camadaVento = null;
  mostrarControlesVento(false);
}

async function dadosVento() {
  const chave = `${local.latitude},${local.longitude}`;
  if (ventoCarregado?.chave === chave && Date.now() - ventoCarregado.quando < VALIDADE_VENTO_MS) {
    return ventoCarregado.dados;
  }
  pedidoVento?.abort();
  pedidoVento = new AbortController();
  const dados = await buscarVentoGrade(local, { signal: pedidoVento.signal });
  pedidoVento = null;
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

function mostrarControlesVento(sim) {
  document.querySelector("[data-tempo]")?.toggleAttribute("hidden", !sim);
  document.querySelector("[data-legenda]")?.toggleAttribute("hidden", !sim);
  document.getElementById("mapa-leaflet")?.classList.toggle("com-vento", sim);
  const selo = document.querySelector("[data-selo]");
  if (selo) {
    selo.classList.toggle("selo-demo", !sim);
    selo.textContent = sim ? "Previsão" : "Demonstrativo";
  }
}

function isoLocal(dados, indice) {
  return new Date((dados.horas[indice] + dados.deslocamento) * 1000).toISOString();
}

function rotuloHora(dados, indice) {
  const iso = isoLocal(dados, indice);
  const horario = hora(iso, ctx.hora);
  if (indice === 0) return `Agora · ${horario}`;
  return iso.slice(0, 10) === isoLocal(dados, 0).slice(0, 10) ? horario : `Amanhã · ${horario}`;
}

function atualizarVento() {
  const dados = ventoCarregado?.dados;
  if (!dados) return;
  const rotulo = rotuloHora(dados, indiceHora);
  const controle = document.querySelector("[data-hora-vento]");
  if (controle) {
    controle.max = String(dados.horas.length - 1);
    controle.value = String(indiceHora);
    controle.setAttribute("aria-valuetext", rotulo);
  }
  const saida = document.querySelector("[data-hora-rotulo]");
  if (saida) saida.textContent = rotulo;
  const maximo = document.querySelector("[data-legenda-max]");
  if (maximo) maximo.textContent = `${vento(VENTO_MAXIMO_KMH, ctx.vento)}+`;
  escreverNota(`<strong>Vento:</strong> previsão do modelo para <strong>${esc(rotulo.toLowerCase())}</strong>, a 10 m do solo,
    num quadrado de cerca de 650 km de lado em volta de <strong>${esc(local.nome)}</strong>. As partículas mostram a
    direção e a força previstas pela Open-Meteo; não é uma medição em tempo real.`);
  if (ultimoPonto) lerVento(ultimoPonto);
}

function mostrarHora(indice) {
  const dados = ventoCarregado?.dados;
  if (!dados || !camadaVento) return;
  indiceHora = indice;
  camadaVento.setData(quadroVento(dados, indiceHora));
  atualizarVento();
}

function alternarReproducao() {
  if (reproducao) {
    pararReproducao();
    return;
  }
  const total = ventoCarregado?.dados.horas.length ?? 0;
  if (!camadaVento || total < 2) return;
  reproducao = setInterval(() => mostrarHora((indiceHora + 1) % total), INTERVALO_REPRODUCAO_MS);
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
  botao.setAttribute("aria-label", sim ? "Pausar" : "Reproduzir as próximas horas");
  botao.title = sim ? "Pausar" : "Reproduzir";
}

function lerVento(latlng) {
  const leitura = document.querySelector("[data-leitura]");
  const dados = ventoCarregado?.dados;
  if (!leitura || !camadaVento || !dados) return;
  ultimoPonto = latlng;
  const { grade, pontos } = dados;
  const linha = Math.round((grade.norte - latlng.lat) / grade.passo);
  const coluna = Math.round((((latlng.lng - grade.oeste) % 360) + 360) % 360 / grade.passo);
  if (linha < 0 || linha >= grade.linhas || coluna < 0 || coluna >= grade.colunas) {
    leitura.textContent = "Fora da área com dados de vento";
    return;
  }
  const ponto = pontos[linha * grade.colunas + coluna];
  leitura.textContent = `${vento(ponto.velocidade[indiceHora], ctx.vento)} vindo do ${direcao(ponto.direcao[indiceHora], true)}`;
}
