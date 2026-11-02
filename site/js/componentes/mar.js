import { direcao, esc, temperatura } from "../formato.js";
import { iconeUI } from "../icones.js";

const metros = (valor) => (valor == null ? "—" : `${valor.toFixed(1)} m`);

export function renderizarMar(el, dados, ctx) {
  const { mar } = dados;
  el.hidden = !mar;
  if (!mar) {
    el.innerHTML = "";
    return;
  }
  const seta = mar.direcao == null ? ""
    : `<span class="seta-vento" style="--graus:${mar.direcao + 180}deg">${iconeUI("seta")}</span>`;
  const maximas = [
    mar.ondas_max_hoje == null ? "" : `máx. hoje ${metros(mar.ondas_max_hoje)}`,
    mar.ondas_max_amanha == null ? "" : `amanhã ${metros(mar.ondas_max_amanha)}`,
  ].filter(Boolean).join(" · ");
  const itens = [
    ["Ondas", metros(mar.ondas), maximas],
    ["Período", mar.periodo == null ? "—" : `${Math.round(mar.periodo)} s`, "tempo entre uma onda e a seguinte"],
    ["Direção", `${seta}${mar.direcao == null ? "—" : direcao(mar.direcao)}`,
      mar.direcao == null ? "" : `ondas vindo do ${direcao(mar.direcao, true)}`],
    ["Água do mar", `${temperatura(mar.agua, ctx.unidade)}${mar.agua == null ? "" : ctx.unidade === "F" ? "F" : "C"}`,
      "temperatura na superfície"],
  ];

  el.innerHTML = `
    <section class="card card-mar" id="mar" aria-labelledby="titulo-mar">
      <header class="card-cabecalho"><h2 id="titulo-mar">Mar</h2><span class="selo">Previsão</span></header>
      <div class="lua-corpo">
        <div class="lua-topo">
          <span class="mar-icone" aria-hidden="true">${iconeUI("ondas")}</span>
          <div>
            <p class="lua-fase">${esc(mar.estado ?? "Mar")}</p>
            <p class="lua-iluminacao">${mar.ondas == null ? "Sem dados de ondas agora" : `Ondas de ${metros(mar.ondas)} agora`}</p>
          </div>
        </div>
        <dl class="astro-metricas">
          ${itens.map(([titulo, valor, detalhe]) => `
            <div><dt>${titulo}</dt><dd>${valor}</dd>${detalhe ? `<dd class="astro-detalhe">${esc(detalhe)}</dd>` : ""}</div>`).join("")}
        </dl>
      </div>
      <p class="card-fonte">Estimativa do modelo de ondas da Open-Meteo para o mar mais próximo da cidade, não medição
        de boia. Para navegar ou surfar, confira também os avisos oficiais.</p>
    </section>`;
}
