import { esc } from "../formato.js";
import { iconeUI } from "../icones.js";
import { POLUENTES_IQAR, posicaoNaEscala } from "../iqar.js";

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

const ORDEM_POLUENTES = ["pm2_5", "pm10", "ozonio", "dioxido_nitrogenio", "dioxido_enxofre", "monoxido_carbono"];

function poluentesDoIqar(iqar) {
  return ORDEM_POLUENTES.map((chave) => {
    const { nome, horas, casas } = POLUENTES_IQAR[chave];
    const valor = iqar.concentracoes[chave];
    const unidade = chave === "monoxido_carbono" ? "ppm" : "µg/m³";
    const texto = valor == null ? "—" : casas ? valor.toFixed(casas).replace(".", ",") : Math.round(valor);
    return `<div class="${chave === iqar.poluente ? "ar-destaque" : ""}">
      <dt>${nome} <span>· ${horas === 1 ? "1 hora" : `média ${horas} h`}</span></dt>
      <dd>${texto} <small>${unidade}</small></dd></div>`;
  }).join("");
}

function poluentesAgora(ar) {
  return [
    poluente("MP2,5", ar.pm2_5), poluente("MP10", ar.pm10), poluente("O₃", ar.ozonio),
    poluente("NO₂", ar.dioxido_nitrogenio), poluente("SO₂", ar.dioxido_enxofre), poluente("CO", ar.monoxido_carbono),
  ].join("");
}

export function indiceEscolhido(ar, preferencia) {
  if (!ar) return null;
  const europeu = ar.indice == null ? null : {
    tipo: "eaqi", indice: ar.indice, nivel: ar.nivel, sigla: "AQI", nome: "Índice europeu (EAQI)",
    texto: RECOMENDACOES[ar.nivel] ?? "", porcento: Math.min(ar.indice, 100),
  };
  const brasileiro = ar.iqar && {
    tipo: "iqar", indice: ar.iqar.indice, nivel: ar.iqar.nivel, sigla: "IQAr", nome: "Índice brasileiro (IQAr)",
    texto: ar.iqar.efeito, principal: ar.iqar.nomePoluente, porcento: posicaoNaEscala(ar.iqar.indice),
  };
  return preferencia === "eaqi" ? europeu ?? brasileiro : brasileiro ?? europeu;
}

function fonte(escolhido) {
  if (escolhido.tipo === "iqar") {
    return `Estimativa do modelo CAMS (Open-Meteo Air Quality), não medição de estação. Índice calculado como na
      Resolução CONAMA 506/2024, com as médias acima.`;
  }
  return "Fonte: Open-Meteo Air Quality (modelo CAMS). Concentrações da hora atual.";
}

export function renderizarQualidadeAr(el, dados, ctx = {}) {
  const ar = dados.qualidade_ar;
  const escolhido = indiceEscolhido(ar, ctx.indiceAr);

  if (!escolhido) {
    el.innerHTML = `
      <section class="card" id="qualidade-ar" aria-labelledby="titulo-ar">
        <header class="card-cabecalho"><h2 id="titulo-ar">Qualidade do ar</h2></header>
        <div class="estado-mini">${iconeUI("folha")}<p>Dados de qualidade do ar indisponíveis para este local agora.</p></div>
      </section>`;
    return;
  }

  el.innerHTML = `
    <section class="card" id="qualidade-ar" aria-labelledby="titulo-ar">
      <header class="card-cabecalho">
        <h2 id="titulo-ar">Qualidade do ar</h2>
        <span class="card-dica">${escolhido.nome}</span>
      </header>
      <div class="ar-resumo ${classeNivel(escolhido.nivel)}">
        <div class="ar-anel" style="--porcento:${escolhido.porcento}" role="img" aria-label="${escolhido.sigla} ${escolhido.indice}, ${esc(escolhido.nivel)}">
          <span>${escolhido.indice}</span>
        </div>
        <div>
          <p class="ar-nivel">${esc(escolhido.nivel)}</p>
          ${escolhido.principal ? `<p class="ar-principal">Poluente principal: <strong>${esc(escolhido.principal)}</strong></p>` : ""}
          <p class="ar-recomendacao">${esc(escolhido.texto)}</p>
        </div>
      </div>
      <dl class="ar-poluentes ${classeNivel(escolhido.nivel)}">
        ${escolhido.tipo === "iqar" ? poluentesDoIqar(ar.iqar) : poluentesAgora(ar)}
      </dl>
      <p class="card-fonte">${fonte(escolhido)}</p>
    </section>`;
}
