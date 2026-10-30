import { esc } from "../formato.js";
import { iconeUI } from "../icones.js";

const CAMADAS = [
  { id: "radar", nome: "Radar de chuva" },
  { id: "nuvens", nome: "Nuvens" },
  { id: "temperatura", nome: "Temperatura" },
  { id: "vento", nome: "Vento" },
  { id: "precipitacao", nome: "Precipitação" },
];

let mapa = null;

export function renderizarMapa(el, dados) {
  const { latitude, longitude, nome } = dados.local;
  mapa?.remove();
  mapa = null;

  el.innerHTML = `
    <section class="card card-mapa" id="mapa" aria-labelledby="titulo-mapa">
      <header class="card-cabecalho">
        <h2 id="titulo-mapa">Mapa meteorológico</h2>
        <span class="selo selo-demo">Demonstrativo</span>
      </header>
      <div class="camadas" role="group" aria-label="Camadas do mapa">
        ${CAMADAS.map((c) => `<button type="button" class="chip" data-camada="${c.id}" aria-pressed="false">${c.nome}</button>`).join("")}
      </div>
      <div class="mapa-area"><div class="mapa-leaflet" id="mapa-leaflet"></div></div>
      <p class="mapa-nota" data-nota>
        ${iconeUI("mapa")}<span>Camadas meteorológicas ainda não integradas. O mapa mostra apenas a localização de
        <strong>${esc(nome)}</strong>; nenhum dado de radar é simulado.</span>
      </p>
    </section>`;

  el.querySelectorAll("[data-camada]").forEach((chip) => {
    chip.addEventListener("click", () => selecionarCamada(chip.dataset.camada));
  });

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
}

export function selecionarCamada(id) {
  const camada = CAMADAS.find((c) => c.id === id);
  if (!camada) return;
  document.querySelectorAll(".camadas [data-camada]").forEach((chip) => {
    chip.setAttribute("aria-pressed", String(chip.dataset.camada === id));
  });
  const nota = document.querySelector("[data-nota] span");
  if (nota) {
    nota.innerHTML = `<strong>${camada.nome}:</strong> camada demonstrativa. Ela será ativada quando um provedor de
      dados meteorológicos for integrado. Nada é exibido para não parecer informação real.`;
  }
}

export function ajustarMapa() {
  mapa?.invalidateSize();
}
