import { esc, temperatura } from "../formato.js";
import { iconeClima, iconeUI } from "../icones.js";
import { favoritos, mesmoLocal } from "../preferencias.js";
import { buscarClimaAtual } from "../servico.js";

let ultimaRenderizacao = 0;

function climaHtml(clima, unidade) {
  if (!clima) return "";
  return `${iconeClima(clima.codigo, clima.dia, { tamanho: 28, rotulo: clima.descricao })}
    <span class="favorito-temp">${temperatura(clima.temperatura, unidade)}</span>`;
}

export function renderizarFavoritos(el, localAtual, { aoEscolher, aoMudar, unidade = "C", climaDoLocalAtual = null }) {
  const lista = favoritos.listar();
  const esteDesenho = ++ultimaRenderizacao;
  const ehAtual = (f) => Boolean(localAtual && mesmoLocal(f, localAtual));

  el.innerHTML = `
    <section class="card" aria-labelledby="titulo-favoritos">
      <header class="card-cabecalho"><h2 id="titulo-favoritos">Cidades favoritas</h2></header>
      ${lista.length
        ? `<ul class="favoritos-lista">
            ${lista.map((f, i) => `
              <li class="favorito ${ehAtual(f) ? "ativo" : ""}">
                <button type="button" class="favorito-abrir" data-abrir="${i}">
                  ${iconeUI("pino")}<span class="favorito-nome"><strong>${esc(f.nome)}</strong><small>${esc([f.estado, f.pais].filter(Boolean).join(", "))}</small></span>
                  <span class="favorito-clima ${ehAtual(f) && climaDoLocalAtual ? "" : "carregando"}" data-clima="${i}">${ehAtual(f) ? climaHtml(climaDoLocalAtual, unidade) : ""}</span>
                </button>
                <button type="button" class="favorito-remover" data-remover="${i}" aria-label="Remover ${esc(f.nome)} dos favoritos">
                  ${iconeUI("fechar")}
                </button>
              </li>`).join("")}
          </ul>`
        : `<div class="estado-mini">${iconeUI("estrela")}<p>Toque na estrela do card principal para salvar uma cidade aqui.</p></div>`}
    </section>`;

  el.querySelectorAll("[data-abrir]").forEach((b) => b.addEventListener("click", () => aoEscolher(lista[b.dataset.abrir])));
  el.querySelectorAll("[data-remover]").forEach((b) => b.addEventListener("click", () => {
    favoritos.remover(lista[b.dataset.remover]);
    aoMudar();
  }));

  const pendentes = lista.map((f, i) => [f, i]).filter(([f]) => !(ehAtual(f) && climaDoLocalAtual));
  if (!pendentes.length) return;
  buscarClimaAtual(pendentes.map(([f]) => f)).then((climas) => {
    if (esteDesenho !== ultimaRenderizacao) return;
    climas.forEach((clima, j) => {
      const alvo = el.querySelector(`[data-clima="${pendentes[j][1]}"]`);
      if (!alvo) return;
      alvo.innerHTML = climaHtml(clima, unidade);
      alvo.classList.remove("carregando");
    });
  }).catch(() => {});
}
