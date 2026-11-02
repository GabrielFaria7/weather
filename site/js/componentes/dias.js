import {
  converterTemperatura, dataCurta, dataLonga, diaSemana, duracao, esc, hora, milimetros, minutosDoDia, porcentagem,
  temperatura, vento,
} from "../formato.js";
import { iconeClima, iconeUI } from "../icones.js";
import { carregarGraficos, coresDoTema, reduzirMovimento } from "../graficos.js";

let graficoModal = null;

export function renderizarDias(el, dados, ctx) {
  const { dias, atual } = dados;
  const menor = Math.min(...dias.map((d) => d.min));
  const maior = Math.max(...dias.map((d) => d.max));
  const faixa = Math.max(maior - menor, 1);
  const pos = (t) => ((t - menor) / faixa) * 100;

  el.innerHTML = `
    <section class="card" id="dias" aria-labelledby="titulo-dias">
      <header class="card-cabecalho">
        <h2 id="titulo-dias">Próximos 10 dias</h2>
        <span class="card-dica">Toque em um dia para detalhes</span>
      </header>
      <ul class="dias-lista">
        ${dias.map((d, i) => `
          <li>
            <button class="dia-linha" type="button" data-dia="${i}" aria-haspopup="dialog">
              <span class="dia-nome"><strong>${i === 0 ? "Hoje" : diaSemana(d.data)}</strong><small>${dataCurta(d.data)}</small></span>
              ${iconeClima(d.codigo, true, { tamanho: 34, rotulo: d.descricao })}
              <span class="dia-desc">${esc(d.descricao)}</span>
              <span class="dia-chuva ${d.chance_chuva >= 30 ? "destaque" : ""}">${iconeUI("gota")}${porcentagem(d.chance_chuva)}</span>
              <span class="dia-min">${temperatura(d.min, ctx.unidade)}</span>
              <span class="faixa" aria-hidden="true">
                <span class="faixa-preenchida" style="left:${pos(d.min)}%;width:${pos(d.max) - pos(d.min)}%"></span>
                ${i === 0 ? `<span class="faixa-agora" style="left:${Math.min(Math.max(pos(atual.temperatura), 0), 100)}%"></span>` : ""}
              </span>
              <span class="dia-max">${temperatura(d.max, ctx.unidade)}</span>
            </button>
          </li>`).join("")}
      </ul>
    </section>`;

  el.querySelectorAll("[data-dia]").forEach((botao) => {
    botao.addEventListener("click", () => abrirDetalhe(dias[Number(botao.dataset.dia)], Number(botao.dataset.dia), ctx));
  });
}

function abrirDetalhe(dia, indice, ctx) {
  const modal = document.getElementById("modal-dia");
  const luz = minutosDoDia(dia.por) - minutosDoDia(dia.nascer);
  const itens = [
    ["guardaChuva", "Chance de chuva", porcentagem(dia.chance_chuva)],
    ["gota", "Chuva acumulada", milimetros(dia.chuva_mm)],
    ["vento", "Vento máximo", vento(dia.vento_max, ctx.vento)],
    ["vento", "Rajadas", vento(dia.rajada_max, ctx.vento)],
    ["sol", "Índice UV máx.", dia.uv_max == null ? "—" : dia.uv_max.toFixed(1)],
    ["nascer", "Nascer do sol", hora(dia.nascer, ctx.hora)],
    ["por", "Pôr do sol", hora(dia.por, ctx.hora)],
    ["relogio", "Duração do dia", duracao(luz)],
  ];

  modal.innerHTML = `
    <div class="modal-corpo">
      <header class="modal-cabecalho">
        <div>
          <p class="modal-sobre">${indice === 0 ? "Hoje" : diaSemana(dia.data, "long")}</p>
          <h2 id="modal-titulo">${dataLonga(dia.data)}</h2>
        </div>
        <button class="btn-icone" type="button" data-fechar aria-label="Fechar">${iconeUI("fechar")}</button>
      </header>
      <div class="modal-resumo">
        ${iconeClima(dia.codigo, true, { tamanho: 72, animado: true })}
        <div>
          <p class="modal-desc">${esc(dia.descricao)}</p>
          <p class="modal-temps"><strong>${temperatura(dia.max, ctx.unidade)}</strong> <span>/ ${temperatura(dia.min, ctx.unidade)}</span></p>
        </div>
      </div>
      ${dia.horas.length
        ? `<div class="modal-grafico"><canvas aria-label="Temperatura e chance de chuva ao longo do dia" role="img"></canvas></div>` : ""}
      <dl class="modal-detalhes">
        ${itens.map(([ic, rotulo, valor]) => `<div><dt>${iconeUI(ic)}${rotulo}</dt><dd>${valor}</dd></div>`).join("")}
      </dl>
    </div>`;

  modal.querySelector("[data-fechar]").addEventListener("click", () => modal.close());
  modal.onclick = (evento) => { if (evento.target === modal) modal.close(); };
  modal.onclose = () => { graficoModal?.destroy(); graficoModal = null; };
  modal.showModal();

  const canvas = modal.querySelector("canvas");
  if (!canvas) return;
  carregarGraficos().then(() => {
    if (canvas.isConnected && modal.open && !graficoModal) graficoModal = graficoDoDia(canvas, dia.horas, ctx);
  }).catch(() => modal.querySelector(".modal-grafico")?.remove());
}

function graficoDoDia(canvas, horas, ctx) {
  const cores = coresDoTema();
  return new window.Chart(canvas, {
    data: {
      labels: horas.map((h) => hora(h.horario, ctx.hora)),
      datasets: [
        {
          type: "line", label: "Temperatura", yAxisID: "t",
          data: horas.map((h) => converterTemperatura(h.temperatura, ctx.unidade)),
          borderColor: cores.primaria, borderWidth: 2.5, tension: 0.4, pointRadius: 0, pointHoverRadius: 5,
        },
        {
          type: "bar", label: "Chance de chuva", yAxisID: "c",
          data: horas.map((h) => h.chance_chuva),
          backgroundColor: cores.secundaria + "40", borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: reduzirMovimento() ? false : { duration: 500 },
      interaction: { mode: "index", intersect: false },
      scales: {
        x: { grid: { display: false }, ticks: { color: cores.texto2, maxTicksLimit: 8, font: { size: 11 } }, border: { display: false } },
        t: { position: "left", grid: { color: cores.borda }, border: { display: false },
             ticks: { color: cores.texto2, font: { size: 11 }, callback: (v) => `${Math.round(v)}°` } },
        c: { position: "right", min: 0, max: 100, display: false },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: cores.texto, titleColor: cores.superficie, bodyColor: cores.superficie,
          callbacks: {
            label: (item) => (item.dataset.yAxisID === "t"
              ? ` Temperatura: ${Math.round(item.raw)}°${ctx.unidade}`
              : ` Chance de chuva: ${item.raw ?? 0}%`),
          },
        },
      },
    },
  });
}
