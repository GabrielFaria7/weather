import { noBrasil, periodoDoAlerta } from "../alertasOficiais.js";
import { esc } from "../formato.js";
import { iconeUI } from "../icones.js";

const ICONES = { chuva: "guardaChuva", tempestade: "alerta", vento: "vento", calor: "termometro", frio: "termometro" };
const NOMES_NIVEL = { atencao: "Atenção", alerta: "Alerta", perigo: "Perigo" };
const OFICIAIS_VISIVEIS = 2;
const LINK_INMET = '<a href="https://portal.inmet.gov.br/" target="_blank" rel="noopener">INMET</a>';

function iconeOficial(titulo) {
  const texto = titulo.toLowerCase();
  if (/chuva|alagamento/.test(texto)) return "guardaChuva";
  if (/vento|ventania/.test(texto)) return "vento";
  if (/umidade|calor|frio|geada|temperatura/.test(texto)) return "termometro";
  return "alerta";
}

function listaOficial(alertas) {
  return `<ul class="alertas-lista">
    ${alertas.map((a) => `
      <li class="alerta alerta-${a.nivel}">
        <span class="alerta-icone">${iconeUI(iconeOficial(a.titulo))}</span>
        <div class="alerta-corpo">
          <p class="alerta-titulo">${esc(a.titulo)} <span class="alerta-nivel">${esc(a.severidade)}</span></p>
          <p class="alerta-detalhe">${esc(periodoDoAlerta(a))}</p>
          ${a.riscos.length || a.instrucoes.length ? `
            <details class="alerta-mais">
              <summary>Riscos e o que fazer</summary>
              ${a.riscos.map((r) => `<p>${esc(r)}</p>`).join("")}
              ${a.instrucoes.length ? `<ul>${a.instrucoes.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}
            </details>` : ""}
        </div>
      </li>`).join("")}
  </ul>`;
}

function secaoOficial(alertas, consultando) {
  if (alertas === undefined && !consultando) return "";
  const conteudo = consultando
    ? `<div class="estado-mini">${iconeUI("recarregar")}<p>Consultando os alertas oficiais do INMET…</p></div>`
    : alertas === null
    ? `<div class="estado-mini">${iconeUI("semSinal")}<p>Não foi possível consultar os alertas do INMET agora.</p></div>`
    : alertas.length
      ? listaOficial(alertas.slice(0, OFICIAIS_VISIVEIS))
      : `<div class="estado-mini estado-ok">${iconeUI("escudo")}<p>Nenhum alerta oficial do INMET para esta cidade.</p></div>`;
  const extras = alertas?.length > OFICIAIS_VISIVEIS ? alertas.slice(OFICIAIS_VISIVEIS) : [];
  return `
    <div class="alertas-secao">
      <h3 class="alertas-subtitulo">Oficiais <span class="selo selo-oficial">INMET</span></h3>
      ${conteudo}
      ${extras.length ? `
        <details class="alertas-outros">
          <summary>Mais ${extras.length} ${extras.length === 1 ? "alerta oficial" : "alertas oficiais"}</summary>
          ${listaOficial(extras)}
        </details>` : ""}
    </div>`;
}

function secaoAutomatica(avisos, comOficiais) {
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
  if (!comOficiais) return conteudo;
  return `
    <div class="alertas-secao">
      <h3 class="alertas-subtitulo">Calculados pela previsão <span class="selo">Automático</span></h3>
      ${conteudo}
    </div>`;
}

function rodape(comOficiais) {
  if (comOficiais) {
    return `Alertas oficiais do ${LINK_INMET}, em horário de Brasília. Os calculados pela previsão
      <strong>não são alertas oficiais</strong>.`;
  }
  return `Indicadores calculados a partir da previsão, <strong>não são alertas oficiais</strong>.
    Consulte o serviço meteorológico oficial do seu país.`;
}

function indicarRolagem(corpo) {
  const marcar = () => corpo.classList.toggle("tem-mais", corpo.scrollHeight - corpo.scrollTop - corpo.clientHeight > 4);
  corpo.addEventListener("scroll", marcar, { passive: true });
  corpo.addEventListener("toggle", marcar, true);
  if (typeof ResizeObserver === "function") new ResizeObserver(marcar).observe(corpo);
  requestAnimationFrame(marcar);
}

export function renderizarAlertas(el, dados) {
  const consultando = Boolean(dados.pendente) && dados.alertas_oficiais === undefined && noBrasil(dados.local);
  const comOficiais = dados.alertas_oficiais !== undefined || consultando;
  el.innerHTML = `
    <section class="card" aria-labelledby="titulo-alertas">
      <header class="card-cabecalho">
        <h2 id="titulo-alertas">Alertas meteorológicos</h2>
        ${comOficiais ? "" : '<span class="selo">Automático</span>'}
      </header>
      <div class="alertas-corpo">
        ${secaoOficial(dados.alertas_oficiais, consultando)}
        ${secaoAutomatica(dados.avisos, comOficiais)}
        <p class="card-fonte">${rodape(comOficiais)}</p>
      </div>
    </section>`;
  indicarRolagem(el.querySelector(".alertas-corpo"));
}
