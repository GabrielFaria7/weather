import { direcao, hora, milimetros, porcentagem, temperatura, vento } from "../formato.js";
import { iconeClima, iconeUI } from "../icones.js";
import { carregarGraficos, coresDoTema, degrade, graficoDisponivel, reduzirMovimento } from "../graficos.js";
import { dicaPorHora, seriesPorHora, VARIAVEIS_POR_HORA, variavelValida } from "../seriesPorHora.js";

let grafico = null;
let variavelAtiva = "temperatura";
let observadorGrafico = null;

function itemHora(h, i, ctx) {
  const seta = h.direcao_vento == null ? ""
    : `<span class="seta-vento" style="--graus:${h.direcao_vento + 180}deg" title="Vindo do ${direcao(h.direcao_vento, true)}">${iconeUI("seta")}</span>`;
  return `
    <li class="hora-item ${i === 0 ? "agora" : ""}">
      <span class="hora-rotulo">${i === 0 ? "Agora" : hora(h.horario, ctx.hora)}</span>
      ${iconeClima(h.codigo, h.dia, { tamanho: 36, rotulo: h.descricao })}
      <span class="hora-temp">${temperatura(h.temperatura, ctx.unidade)}</span>
      <span class="hora-chuva ${h.chance_chuva >= 30 ? "destaque" : ""}" title="Chance de chuva">
        ${iconeUI("gota")}${porcentagem(h.chance_chuva)}</span>
      <span class="hora-extra so-temperatura hora-vento" title="Vento">${vento(h.vento, ctx.vento)}</span>
      <span class="hora-extra so-chuva hora-mm ${h.chuva_mm >= 0.1 ? "destaque" : ""}" title="Chuva prevista na hora">${milimetros(h.chuva_mm)}</span>
      <span class="hora-extra so-vento hora-direcao" title="Vento">${seta}${vento(h.vento, ctx.vento)}</span>
      <span class="hora-extra so-vento hora-rajada" title="Rajadas">raj. ${vento(h.rajada, ctx.vento)}</span>
    </li>`;
}

export function renderizarPorHora(el, dados, ctx) {
  const horas = dados.por_hora;
  grafico?.destroy();
  grafico = null;
  variavelAtiva = variavelValida(variavelAtiva);

  el.innerHTML = `
    <section class="card" id="por-hora" aria-labelledby="titulo-horas" data-variavel="${variavelAtiva}">
      <header class="card-cabecalho horas-cabecalho">
        <h2 id="titulo-horas">Previsão por hora</h2>
        <div class="segmentado horas-variaveis" role="group" aria-label="O que mostrar no gráfico">
          ${VARIAVEIS_POR_HORA.map((v) => `
            <button type="button" data-variavel="${v.id}" aria-pressed="${v.id === variavelAtiva}">${v.nome}</button>`).join("")}
        </div>
        <div class="rolagem-botoes">
          <button class="btn-icone btn-pequeno" type="button" data-rolar="-1" aria-label="Horas anteriores">${iconeUI("esquerda")}</button>
          <button class="btn-icone btn-pequeno" type="button" data-rolar="1" aria-label="Próximas horas">${iconeUI("direita")}</button>
        </div>
      </header>
      <div class="horas-trilho" tabindex="0" aria-label="Próximas 24 horas, role para os lados">
        <div class="horas-conteudo" style="--colunas:${horas.length}">
          <div class="horas-grafico"><canvas aria-hidden="true"></canvas></div>
          <ol class="horas-lista">${horas.map((h, i) => itemHora(h, i, ctx)).join("")}</ol>
        </div>
      </div>
    </section>`;

  const secao = el.querySelector("#por-hora");
  const trilho = el.querySelector(".horas-trilho");
  el.querySelectorAll("[data-rolar]").forEach((botao) => {
    botao.addEventListener("click", () => {
      trilho.scrollBy({ left: Number(botao.dataset.rolar) * trilho.clientWidth * 0.8, behavior: "smooth" });
    });
  });

  const canvas = el.querySelector("canvas");
  const desenhar = () => {
    grafico?.destroy();
    grafico = null;
    if (!canvas) return;
    if (graficoDisponivel()) {
      grafico = criarGrafico(canvas, variavelAtiva, horas, ctx);
      return;
    }
    const carregar = () => carregarGraficos().then(() => {
      if (canvas.isConnected && !grafico) grafico = criarGrafico(canvas, variavelAtiva, horas, ctx);
    }).catch(() => {});
    observadorGrafico?.disconnect();
    if (!("IntersectionObserver" in window)) {
      carregar();
      return;
    }
    observadorGrafico = new IntersectionObserver((entradas) => {
      if (!entradas.some((entrada) => entrada.isIntersecting)) return;
      observadorGrafico.disconnect();
      carregar();
    }, { rootMargin: "300px 0px" });
    observadorGrafico.observe(canvas);
  };
  el.querySelectorAll(".horas-variaveis [data-variavel]").forEach((botao) => {
    botao.addEventListener("click", () => {
      variavelAtiva = botao.dataset.variavel;
      secao.dataset.variavel = variavelAtiva;
      el.querySelectorAll(".horas-variaveis [data-variavel]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b === botao));
      });
      desenhar();
    });
  });
  desenhar();
}

function conjuntos(variavel, serie, cores) {
  const linhaPrincipal = {
    type: "line",
    data: serie.linha,
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
    spanGaps: true,
  };
  if (variavel === "chuva") {
    return [
      {
        type: "bar", data: serie.barras, yAxisID: "mm", order: 2,
        backgroundColor: `${cores.primaria}AA`, borderRadius: 4, barPercentage: 0.45, categoryPercentage: 1,
      },
      {
        type: "line", data: serie.linha, yAxisID: "chance", order: 1, spanGaps: true,
        borderColor: cores.texto2, borderWidth: 1.5, borderDash: [4, 4], tension: 0.4, pointRadius: 0, pointHoverRadius: 4,
      },
    ];
  }
  if (variavel === "vento") {
    return [
      linhaPrincipal,
      {
        type: "line", data: serie.tracejada, spanGaps: true,
        borderColor: cores.texto2, borderWidth: 1.5, borderDash: [4, 4], tension: 0.4, pointRadius: 0, pointHoverRadius: 4,
      },
    ];
  }
  return [linhaPrincipal];
}

function escalas(variavel, serie) {
  const x = { display: false, offset: true };
  if (variavel === "chuva") {
    return {
      x,
      mm: { display: false, min: 0, suggestedMax: serie.maximoBarras, grace: "10%" },
      chance: { display: false, min: 0, max: 105 },
    };
  }
  if (variavel === "vento") return { x, y: { display: false, min: 0, grace: "20%" } };
  return { x, y: { display: false, grace: "15%" } };
}

function criarGrafico(canvas, variavel, horas, ctx) {
  const cores = coresDoTema();
  const serie = seriesPorHora(variavel, horas, ctx);
  return new window.Chart(canvas, {
    type: variavel === "chuva" ? "bar" : "line",
    data: {
      labels: horas.map((h, i) => (i === 0 ? "Agora" : hora(h.horario, ctx.hora))),
      datasets: conjuntos(variavel, serie, cores),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: reduzirMovimento() ? false : { duration: 500 },
      layout: { padding: { top: 12, bottom: 4 } },
      interaction: { mode: "index", intersect: false },
      scales: escalas(variavel, serie),
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          backgroundColor: cores.texto,
          titleColor: cores.superficie,
          bodyColor: cores.superficie,
          filter: (item) => item.datasetIndex === 0,
          callbacks: { label: (item) => dicaPorHora(variavel, horas[item.dataIndex], ctx) },
        },
      },
    },
  });
}
