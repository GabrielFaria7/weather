import { esc } from "../formato.js";
import { iconeUI } from "../icones.js";
import { favoritos, mesmoLocal } from "../preferencias.js";

export function renderizarFavoritos(el, localAtual, { aoEscolher, aoMudar }) {
  const lista = favoritos.listar();

  el.innerHTML = `
    <section class="card" aria-labelledby="titulo-favoritos">
      <header class="card-cabecalho"><h2 id="titulo-favoritos">Cidades favoritas</h2></header>
      ${lista.length
        ? `<ul class="favoritos-lista">
            ${lista.map((f, i) => `
              <li class="favorito ${localAtual && mesmoLocal(f, localAtual) ? "ativo" : ""}">
                <button type="button" class="favorito-abrir" data-abrir="${i}">
                  ${iconeUI("pino")}<span><strong>${esc(f.nome)}</strong><small>${esc([f.estado, f.pais].filter(Boolean).join(", "))}</small></span>
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
}
