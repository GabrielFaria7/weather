import { converterTemperatura, hora, porcentagem, temperatura, vento } from "../formato.js";
import { iconeClima, iconeUI } from "../icones.js";
import { coresDoTema, degrade, graficoDisponivel, reduzirMovimento } from "../graficos.js";

let grafico = null;

export function renderizarPorHora(el, dados, ctx) {
  const horas = dados.por_hora;
  grafico?.destroy();
  grafico = null;

  el.innerHTML = `
    <section class="card" id="por-hora" aria-labelledby="titulo-horas">
      <header class="card-cabecalho">
        <h2 id="titulo-horas">Previsão por hora</h2>
        <div class="rolagem-botoes">
          <button class="btn-icone btn-pequeno" type="button" data-rolar="-1" aria-label="Horas anteriores">${iconeUI("esquerda")}</button>
          <button class="btn-icone btn-pequeno" type="button" data-rolar="1" aria-label="Próximas horas">${iconeUI("direita")}</button>
        </div>
      </header>
      <div class="horas-trilho" tabindex="0" aria-label="Próximas 24 horas, role para os lados">
        <div class="horas-conteudo" style="--colunas:${horas.length}">
          <div class="horas-grafico">${graficoDisponivel() ? '<canvas aria-hidden="true"></canvas>' : ""}</div>
          <ol class="horas-lista">
            ${horas.map((h, i) => `
              <li class="hora-item ${i === 0 ? "agora" : ""}">
                <span class="hora-rotulo">${i === 0 ? "Agora" : hora(h.horario, ctx.hora)}</span>
                ${iconeClima(h.codigo, h.dia, { tamanho: 36, rotulo: h.descricao })}
                <span class="hora-temp">${temperatura(h.temperatura, ctx.unidade)}</span>
                <span class="hora-chuva ${h.chance_chuva >= 30 ? "destaque" : ""}" title="Chance de chuva">
                  ${iconeUI("gota")}${porcentagem(h.chance_chuva)}</span>
                <span class="hora-vento" title="Vento">${vento(h.vento, ctx.vento)}</span>
              </li>`).join("")}
          </ol>
        </div>
      </div>
    </section>`;

  const trilho = el.querySelector(".horas-trilho");
  el.querySelectorAll("[data-rolar]").forEach((botao) => {
    botao.addEventListener("click", () => {
      trilho.scrollBy({ left: Number(botao.dataset.rolar) * trilho.clientWidth * 0.8, behavior: "smooth" });
    });
  });

  const canvas = el.querySelector("canvas");
  if (canvas) grafico = criarGrafico(canvas, horas, ctx);
}

function criarGrafico(canvas, horas, ctx) {
  const cores = coresDoTema();
  return new window.Chart(canvas, {
    type: "line",
    data: {
      labels: horas.map((h, i) => (i === 0 ? "Agora" : hora(h.horario, ctx.hora))),
      datasets: [{
        data: horas.map((h) => converterTemperatura(h.temperatura, ctx.unidade)),
        borderColor: cores.primaria,
        borderWidth: 2.5,
        tension: 0.4,
        fill: true,
        backgroundColor: (c) => (c.chart.chartArea ? degrade(c.chart.ctx, c.chart.chartArea, cores.primaria) : "transparent"),
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: cores.superficie,
        pointBorderColor: cores.primaria,
        pointBorderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: reduzirMovimento() ? false : { duration: 600 },
      layout: { padding: { top: 12, bottom: 4 } },
      interaction: { mode: "index", intersect: false },
      scales: {
        x: { display: false, offset: true },
        y: { display: false, grace: "15%" },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          backgroundColor: cores.texto,
          titleColor: cores.superficie,
          bodyColor: cores.superficie,
          callbacks: { label: (item) => `${Math.round(item.raw)}°${ctx.unidade}` },
        },
      },
    },
  });
}
