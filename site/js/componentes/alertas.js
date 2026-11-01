import { esc } from "../formato.js";
import { iconeUI } from "../icones.js";

const ICONES = { chuva: "guardaChuva", tempestade: "alerta", vento: "vento", calor: "termometro", frio: "termometro" };
const NOMES_NIVEL = { atencao: "Atenção", alerta: "Alerta", perigo: "Perigo" };

function linkOficial(pais) {
  if (pais === "Brasil") {
    return '<a href="https://alertas2.inmet.gov.br/" target="_blank" rel="noopener">alertas oficiais do INMET</a>';
  }
  return "o serviço meteorológico oficial do seu país";
}

export function renderizarAlertas(el, dados) {
  const avisos = dados.avisos;

  const conteudo = avisos.length
    ? `<ul class="alertas-lista">
        ${avisos.map((a) => `
          <li class="alerta alerta-${a.nivel}">
            <span class="alerta-icone">${iconeUI(ICONES[a.tipo] ?? "alerta")}</span>
            <div>
              <p class="alerta-titulo">${esc(a.titulo)} <span class="alerta-nivel">${NOMES_NIVEL[a.nivel]}</span></p>
              <p class="alerta-detalhe">${esc(a.detalhe)}</p>
            </div>
          </li>`).join("")}
      </ul>`
    : `<div class="estado-mini estado-ok">${iconeUI("escudo")}<p>Nenhum risco relevante previsto para os próximos 3 dias.</p></div>`;

  el.innerHTML = `
    <section class="card" aria-labelledby="titulo-alertas">
      <header class="card-cabecalho">
        <h2 id="titulo-alertas">Alertas meteorológicos</h2>
        <span class="selo">Automático</span>
      </header>
      ${conteudo}
      <p class="card-fonte">Indicadores calculados a partir da previsão, <strong>não são alertas oficiais</strong>.
        Consulte ${linkOficial(dados.local.pais)}.</p>
    </section>`;
}
