import { noBrasil } from "../alertasOficiais.js";
import { dataCurta, diaSemana, esc, temperatura } from "../formato.js";
import { iconeClima, iconeUI } from "../icones.js";

const LINK_INMET = '<a href="https://portal.inmet.gov.br/" target="_blank" rel="noopener">INMET</a>';

function diaSeguinte(data) {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
}

function nomeDoDia(data, hoje) {
  if (data === hoje) return "Hoje";
  if (data === diaSeguinte(hoje)) return "Amanhã";
  return diaSemana(data, "long").replace("-feira", "");
}

const temperaturas = (dia, unidade) => `
  <p class="inmet-temps">
    <span>Máx <strong>${temperatura(dia.max, unidade)}</strong></span>
    <span>Mín <strong>${temperatura(dia.min, unidade)}</strong></span>
  </p>`;

const periodo = (p) => `
  <li class="inmet-periodo">
    ${p.codigo == null ? "" : iconeClima(p.codigo, !p.noite, { tamanho: 40 })}
    <div>
      ${p.nome === "Dia" ? "" : `<p class="inmet-periodo-nome">${esc(p.nome)}</p>`}
      <p class="inmet-resumo">${esc(p.resumo || "Sem descrição")}</p>
      ${p.vento ? `<p class="inmet-vento">${esc(p.vento)}</p>` : ""}
    </div>
  </li>`;

function dia(d, hoje, unidade) {
  const comPeriodos = d.periodos.length > 1;
  return `
    <div class="inmet-dia${comPeriodos ? " com-periodos" : ""}">
      <div class="inmet-dia-topo">
        <h3>${esc(nomeDoDia(d.data, hoje))} <small>${esc(dataCurta(d.data))}</small></h3>
        ${temperaturas(d, unidade)}
      </div>
      <ul class="inmet-periodos">${d.periodos.map(periodo).join("")}</ul>
    </div>`;
}

function corpo(dados, ctx) {
  const previsao = dados.previsao_inmet;
  if (previsao === undefined) {
    return `<div class="estado-mini">${iconeUI("recarregar")}<p>Consultando a previsão oficial do INMET…</p></div>`;
  }
  if (previsao === null) {
    return `<div class="estado-mini">${iconeUI("semSinal")}<p>Não foi possível consultar a previsão oficial do INMET agora.</p></div>`;
  }
  const hoje = String(dados.atual.horario).slice(0, 10);
  return `
    <div class="inmet-dias">${previsao.dias.map((d) => dia(d, hoje, ctx.unidade)).join("")}</div>
    <p class="card-fonte">Previsão feita pelos meteorologistas do ${LINK_INMET}${previsao.municipio
      ? ` para ${esc(previsao.municipio)}` : ""}, por período do dia. A previsão por hora e a de 10 dias vêm do modelo da
      Open-Meteo e podem ser diferentes.</p>`;
}

export function renderizarPrevisaoInmet(el, dados, ctx) {
  const consultando = dados.pendente && dados.previsao_inmet === undefined && noBrasil(dados.local);
  const mostrar = dados.previsao_inmet !== undefined || consultando;
  el.hidden = !mostrar;
  if (!mostrar) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `
    <section class="card card-inmet" id="previsao-oficial" aria-labelledby="titulo-inmet">
      <header class="card-cabecalho">
        <h2 id="titulo-inmet">Previsão oficial</h2>
        <span class="selo selo-oficial">INMET</span>
      </header>
      ${corpo(dados, ctx)}
    </section>`;
}
