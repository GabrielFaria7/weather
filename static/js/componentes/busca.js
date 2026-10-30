import { buscarCidades } from "../servico.js";
import { esc } from "../formato.js";
import { favoritos } from "../preferencias.js";

const ESPERA_MS = 250;

export function iniciarBusca({ aoEscolher }) {
  const form = document.getElementById("form-busca");
  const campo = document.getElementById("campo-busca");
  const lista = document.getElementById("sugestoes");

  let itens = [];
  let selecionado = -1;
  let temporizador;
  let pedidoAtual;

  function abrir(html) {
    lista.innerHTML = html;
    lista.hidden = false;
    campo.setAttribute("aria-expanded", "true");
  }

  function fechar() {
    lista.hidden = true;
    campo.setAttribute("aria-expanded", "false");
    campo.removeAttribute("aria-activedescendant");
    selecionado = -1;
  }

  function mostrar(cidades, titulo = "") {
    itens = cidades;
    selecionado = -1;
    if (!cidades.length) {
      abrir('<li class="sugestao-vazia">Nenhuma cidade encontrada</li>');
      return;
    }
    abrir((titulo ? `<li class="sugestao-titulo" role="presentation">${titulo}</li>` : "") + cidades.map((c, i) => `
      <li class="sugestao" id="sugestao-${i}" role="option" aria-selected="false" data-indice="${i}">
        <strong>${esc(c.nome)}</strong>
        <small>${esc([c.estado, c.pais].filter(Boolean).join(", "))}</small>
      </li>`).join(""));
  }

  function destacar(indice) {
    const opcoes = lista.querySelectorAll(".sugestao");
    if (!opcoes.length) return;
    selecionado = (indice + opcoes.length) % opcoes.length;
    opcoes.forEach((o, i) => o.setAttribute("aria-selected", String(i === selecionado)));
    campo.setAttribute("aria-activedescendant", `sugestao-${selecionado}`);
    opcoes[selecionado].scrollIntoView({ block: "nearest" });
  }

  function escolher(cidade) {
    campo.value = "";
    fechar();
    campo.blur();
    aoEscolher(cidade);
  }

  async function pesquisar(termo) {
    pedidoAtual?.abort();
    pedidoAtual = new AbortController();
    abrir('<li class="sugestao-vazia">Buscando…</li>');
    try {
      const cidades = await buscarCidades(termo, { signal: pedidoAtual.signal });
      mostrar(cidades);
      return cidades;
    } catch (erro) {
      if (erro.name !== "AbortError") abrir(`<li class="sugestao-vazia">${esc(erro.message)}</li>`);
      return [];
    }
  }

  campo.addEventListener("input", () => {
    clearTimeout(temporizador);
    const termo = campo.value.trim();
    if (termo.length < 2) {
      pedidoAtual?.abort();
      mostrarFavoritos();
      return;
    }
    temporizador = setTimeout(() => pesquisar(termo), ESPERA_MS);
  });

  function mostrarFavoritos() {
    const lista = favoritos.listar();
    if (lista.length) mostrar(lista, "Favoritas");
    else fechar();
  }
  campo.addEventListener("focus", () => { if (!campo.value.trim()) mostrarFavoritos(); });

  campo.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); destacar(selecionado + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); destacar(selecionado - 1); }
    else if (e.key === "Escape") { fechar(); }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearTimeout(temporizador);
    if (selecionado >= 0 && itens[selecionado]) return escolher(itens[selecionado]);
    const termo = campo.value.trim();
    if (termo.length < 2) return;
    const cidades = await pesquisar(termo);
    if (cidades.length) escolher(cidades[0]);
  });

  lista.addEventListener("mousedown", (e) => {
    const item = e.target.closest(".sugestao");
    if (!item) return;
    e.preventDefault();
    escolher(itens[Number(item.dataset.indice)]);
  });

  document.addEventListener("click", (e) => { if (!form.contains(e.target)) fechar(); });
}
