import { esc } from "../formato.js";
import { iconeUI } from "../icones.js";

const RECOMENDACOES = {
  "Boa": "Ar limpo. Ótimo momento para atividades ao ar livre.",
  "Razoável": "Qualidade aceitável para a maioria das pessoas.",
  "Moderada": "Pessoas sensíveis devem reduzir esforços prolongados ao ar livre.",
  "Ruim": "Evite exercícios intensos ao ar livre, principalmente se tiver problemas respiratórios.",
  "Muito ruim": "Reduza o tempo ao ar livre. Grupos sensíveis devem ficar em ambientes fechados.",
  "Extremamente ruim": "Evite atividades ao ar livre.",
};

const classeNivel = (nivel) => `ar-${(nivel ?? "").toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}`;

const poluente = (nome, valor) =>
  `<div><dt>${nome}</dt><dd>${valor == null ? "—" : Math.round(valor)} <small>µg/m³</small></dd></div>`;

export function renderizarQualidadeAr(el, dados) {
  const ar = dados.qualidade_ar;

  if (!ar || ar.indice == null) {
    el.innerHTML = `
      <section class="card" id="qualidade-ar" aria-labelledby="titulo-ar">
        <header class="card-cabecalho"><h2 id="titulo-ar">Qualidade do ar</h2></header>
        <div class="estado-mini">${iconeUI("folha")}<p>Dados de qualidade do ar indisponíveis para este local agora.</p></div>
      </section>`;
    return;
  }

  const porcento = Math.min(ar.indice, 100);
  el.innerHTML = `
    <section class="card" id="qualidade-ar" aria-labelledby="titulo-ar">
      <header class="card-cabecalho">
        <h2 id="titulo-ar">Qualidade do ar</h2>
        <span class="card-dica">Índice europeu (EAQI)</span>
      </header>
      <div class="ar-resumo ${classeNivel(ar.nivel)}">
        <div class="ar-anel" style="--porcento:${porcento}" role="img" aria-label="Índice ${ar.indice}, ${esc(ar.nivel)}">
          <span>${ar.indice}</span>
        </div>
        <div>
          <p class="ar-nivel">${esc(ar.nivel)}</p>
          <p class="ar-recomendacao">${RECOMENDACOES[ar.nivel] ?? ""}</p>
        </div>
      </div>
      <dl class="ar-poluentes">
        ${poluente("PM2.5", ar.pm2_5)}
        ${poluente("PM10", ar.pm10)}
        ${poluente("O₃", ar.ozonio)}
        ${poluente("NO₂", ar.dioxido_nitrogenio)}
      </dl>
      <p class="card-fonte">Fonte: Open-Meteo Air Quality (modelo CAMS)</p>
    </section>`;
}
