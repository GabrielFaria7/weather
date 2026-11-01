import { direcao, duracao, hora, minutosAgoraNaCidade, minutosDoDia, porcentagem, temperatura, vento } from "../formato.js";
import { iconeUI } from "../icones.js";
import { indiceEscolhido } from "./qualidadeAr.js";

function nivelUV(uv) {
  if (uv < 3) return "Baixo";
  if (uv < 6) return "Moderado";
  if (uv < 8) return "Alto";
  if (uv < 11) return "Muito alto";
  return "Extremo";
}

function nivelPressao(hpa) {
  if (hpa < 1000) return "Baixa";
  if (hpa > 1025) return "Alta";
  return "Normal";
}

function nivelVisibilidade(km) {
  if (km >= 10) return "Excelente";
  if (km >= 5) return "Boa";
  if (km >= 2) return "Moderada";
  return "Reduzida";
}

const limitar = (v, min = 0, max = 100) => Math.min(Math.max(v, min), max);

const escala = (porcento, classe) =>
  `<span class="escala ${classe}" aria-hidden="true"><span class="escala-marca" style="left:${limitar(porcento)}%"></span></span>`;

const barra = (porcento) =>
  `<span class="barra" aria-hidden="true"><span class="barra-cheia" style="width:${limitar(porcento)}%"></span></span>`;

function arcoSol(progresso) {
  const p = limitar(progresso, 0, 1);
  const angulo = Math.PI * (1 - p);
  const x = 60 + 50 * Math.cos(angulo);
  const y = 46 - 36 * Math.sin(angulo);
  const visivel = progresso > 0 && progresso < 1;
  return `<svg class="arco-sol" viewBox="0 0 120 52" aria-hidden="true">
    <path d="M10 46 A50 36 0 0 1 110 46" class="arco-trilha"/>
    <line x1="4" y1="46" x2="116" y2="46" class="arco-horizonte"/>
    ${visivel ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" class="arco-astro"/>` : ""}
  </svg>`;
}

function card({ icone, titulo, valor, unidade = "", visual = "", legenda = "" }) {
  return `
    <article class="card card-indicador">
      <h3>${iconeUI(icone)}${titulo}</h3>
      <p class="indicador-valor">${valor}${unidade ? `<small>${unidade}</small>` : ""}</p>
      ${visual}
      <p class="indicador-legenda">${legenda}</p>
    </article>`;
}

export function renderizarIndicadores(el, dados, ctx) {
  const { atual, dias, qualidade_ar: ar, fuso } = dados;
  const indiceAr = indiceEscolhido(ar, ctx.indiceAr);
  const hoje = dias[0];
  const km = atual.visibilidade == null ? null : atual.visibilidade / 1000;

  const nascer = minutosDoDia(hoje.nascer);
  const por = minutosDoDia(hoje.por);
  const agora = minutosAgoraNaCidade(fuso);
  const progresso = agora == null ? -1 : (agora - nascer) / (por - nascer);

  const cards = [
    card({
      icone: "sol", titulo: "Índice UV",
      valor: atual.uv == null ? "—" : Math.round(atual.uv),
      visual: escala(((atual.uv ?? 0) / 11) * 100, "escala-uv"),
      legenda: atual.uv == null ? "Indisponível" : `${nivelUV(atual.uv)} · máx. hoje ${Math.round(hoje.uv_max ?? 0)}`,
    }),
    card({
      icone: "gota", titulo: "Umidade",
      valor: porcentagem(atual.umidade),
      visual: barra(atual.umidade),
      legenda: `Ponto de orvalho ${temperatura(atual.ponto_orvalho, ctx.unidade)}`,
    }),
    card({
      icone: "medidor", titulo: "Pressão",
      valor: atual.pressao == null ? "—" : Math.round(atual.pressao), unidade: "hPa",
      visual: barra(((atual.pressao - 970) / 80) * 100),
      legenda: atual.pressao == null ? "" : `${nivelPressao(atual.pressao)} · ao nível do mar`,
    }),
    card({
      icone: "olho", titulo: "Visibilidade",
      valor: km == null ? "—" : km >= 10 ? Math.round(km) : km.toFixed(1), unidade: "km",
      visual: barra((km ?? 0) / 20 * 100),
      legenda: km == null ? "" : nivelVisibilidade(km),
    }),
    card({
      icone: "vento", titulo: "Vento",
      valor: vento(atual.vento, ctx.vento),
      visual: `<span class="bussola" aria-hidden="true">
        <span class="bussola-n">N</span>
        <span class="bussola-seta" style="--graus:${(atual.direcao_vento ?? 0) + 180}deg">${iconeUI("seta")}</span>
      </span>`,
      legenda: `Do ${direcao(atual.direcao_vento, true)} · rajadas ${vento(atual.rajada, ctx.vento)}`,
    }),
    card({
      icone: "nascer", titulo: "Nascer do sol",
      valor: hora(hoje.nascer, ctx.hora),
      visual: arcoSol(progresso),
      legenda: `Duração do dia ${duracao(por - nascer)}`,
    }),
    card({
      icone: "por", titulo: "Pôr do sol",
      valor: hora(hoje.por, ctx.hora),
      visual: barra(limitar(progresso, 0, 1) * 100),
      legenda: progresso < 0 ? "O sol ainda vai nascer" : progresso > 1 ? "O sol já se pôs"
        : `Faltam ${duracao(por - agora)} de luz`,
    }),
    card({
      icone: "folha", titulo: "Qualidade do ar",
      valor: indiceAr?.indice ?? "—", unidade: indiceAr?.sigla ?? "",
      visual: escala(indiceAr?.porcento ?? 0, indiceAr?.tipo === "iqar" ? "escala-iqar" : "escala-ar"),
      legenda: indiceAr?.nivel ?? "Indisponível no momento",
    }),
  ];

  el.innerHTML = `
    <section id="indicadores" aria-labelledby="titulo-indicadores">
      <h2 class="titulo-secao" id="titulo-indicadores">Informações climáticas</h2>
      <div class="indicadores-grade">${cards.join("")}</div>
    </section>`;
}
