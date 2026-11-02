import { dataCurta, diaSemana, esc, hora } from "../formato.js";
import { desenhoDaLua, luaDoDia } from "../lua.js";

const DIA_MS = 24 * 60 * 60 * 1000;
const RAIO = 36;

function desenho(fracao, sul) {
  const { caminho, espelhar } = desenhoDaLua(fracao, RAIO, sul);
  const lado = 2 * RAIO;
  return `<svg class="lua-desenho" viewBox="-2 -2 ${lado + 4} ${lado + 4}" width="76" height="76" aria-hidden="true">
    <circle class="lua-sombra" cx="${RAIO}" cy="${RAIO}" r="${RAIO}"/>
    <path class="lua-luz" d="${caminho}"${espelhar ? ` transform="matrix(-1 0 0 1 ${lado} 0)"` : ""}/>
    <circle class="lua-borda" cx="${RAIO}" cy="${RAIO}" r="${RAIO}"/>
  </svg>`;
}

function proxima(isoLocal, hoje) {
  if (!isoLocal) return { data: "—", detalhe: "" };
  const data = isoLocal.slice(0, 10);
  const dias = Math.round((Date.parse(`${data}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / DIA_MS);
  const quando = dias <= 0 ? "hoje" : dias === 1 ? "amanhã" : `em ${dias} dias`;
  return { data: dataCurta(data), detalhe: `${diaSemana(data)} · ${quando}` };
}

function horarios(lua, ctx) {
  if (!lua.nascer && !lua.por) {
    const aviso = lua.sempreAcima ? "A lua fica no céu o dia todo" : "A lua não aparece hoje";
    return [["Nascer da lua", "—", aviso], ["Pôr da lua", "—", aviso]];
  }
  return [
    ["Nascer da lua", lua.nascer ? hora(lua.nascer, ctx.hora) : "—", lua.nascer ? "" : "Não nasce hoje"],
    ["Pôr da lua", lua.por ? hora(lua.por, ctx.hora) : "—", lua.por ? "" : "Não se põe hoje"],
  ];
}

export function renderizarLua(el, dados, ctx) {
  const hoje = dados.dias?.[0]?.data ?? new Date().toISOString().slice(0, 10);
  const lua = luaDoDia(dados.local, hoje, dados.deslocamento ?? 0);
  const cheia = proxima(lua.proximaCheia, hoje);
  const nova = proxima(lua.proximaNova, hoje);
  const itens = [
    ...horarios(lua, ctx),
    ["Próxima lua cheia", cheia.data, cheia.detalhe],
    ["Próxima lua nova", nova.data, nova.detalhe],
  ];

  el.innerHTML = `
    <section class="card card-lua" id="lua" aria-labelledby="titulo-lua">
      <header class="card-cabecalho"><h2 id="titulo-lua">Lua</h2></header>
      <div class="lua-corpo">
        <div class="lua-topo">
          ${desenho(lua.fracao, dados.local.latitude < 0)}
          <div>
            <p class="lua-fase">${esc(lua.nome)}</p>
            <p class="lua-iluminacao">${Math.round(lua.iluminacao * 100)}% iluminada · ${lua.crescente ? "crescendo" : "diminuindo"}</p>
          </div>
        </div>
        <dl class="astro-metricas">
          ${itens.map(([titulo, valor, detalhe]) => `
            <div><dt>${titulo}</dt><dd>${esc(valor)}</dd>${detalhe ? `<small>${esc(detalhe)}</small>` : ""}</div>`).join("")}
        </dl>
      </div>
      <p class="card-fonte">Calculado no navegador para a posição da cidade, em horário local.</p>
    </section>`;
}
