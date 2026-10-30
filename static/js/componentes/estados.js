// Telas de estado: boas-vindas (vazio), carregando (esqueleto) e erro. E o aviso flutuante (toast).
import { esc } from "../formato.js";
import { iconeClima, iconeUI } from "../icones.js";

const SUGESTOES = [
  { nome: "São Paulo", estado: "São Paulo", pais: "Brasil", latitude: -23.5475, longitude: -46.63611 },
  { nome: "Rio de Janeiro", estado: "Rio de Janeiro", pais: "Brasil", latitude: -22.90642, longitude: -43.18223 },
  { nome: "Brasília", estado: "Distrito Federal", pais: "Brasil", latitude: -15.77972, longitude: -47.92972 },
  { nome: "Lisboa", estado: "Lisboa", pais: "Portugal", latitude: 38.71667, longitude: -9.13333 },
  { nome: "Nova York", estado: "Nova Iorque", pais: "Estados Unidos", latitude: 40.71427, longitude: -74.00597 },
];

export function renderizarVazio(el, { aoEscolher, aoLocalizar }) {
  el.innerHTML = `
    <section class="estado estado-vazio entrar">
      <div class="estado-arte">${iconeClima(2, true, { tamanho: 120, animado: true })}</div>
      <h1>Para onde vamos olhar o tempo?</h1>
      <p>Pesquise uma cidade no campo acima ou use a sua localização atual.</p>
      <button class="btn btn-primario" type="button" data-localizar>${iconeUI("localizacao")}Usar minha localização</button>
      <p class="estado-rotulo">Sugestões</p>
      <div class="chips">
        ${SUGESTOES.map((s, i) => `<button class="chip" type="button" data-sugestao="${i}">${esc(s.nome)}</button>`).join("")}
      </div>
    </section>`;
  el.querySelector("[data-localizar]").addEventListener("click", aoLocalizar);
  el.querySelectorAll("[data-sugestao]").forEach((b) => b.addEventListener("click", () => aoEscolher(SUGESTOES[b.dataset.sugestao])));
}

// Esqueleto: blocos cinza no formato do painel enquanto os dados chegam.
export function renderizarCarregando(el) {
  const bloco = (classe) => `<div class="esqueleto ${classe}"></div>`;
  el.innerHTML = `
    <div class="painel" aria-busy="true" aria-label="Carregando previsão">
      <div class="area-atual">${bloco("esq-atual")}</div>
      <div class="area-lateral">${bloco("esq-lateral")}${bloco("esq-lateral-2")}</div>
      <div class="area-horas">${bloco("esq-horas")}</div>
      <div class="area-dias">${bloco("esq-dias")}</div>
      <div class="area-indicadores"><div class="indicadores-grade">${Array(8).fill(bloco("esq-indicador")).join("")}</div></div>
    </div>`;
}

export function renderizarErro(el, mensagem, aoTentarDeNovo) {
  el.innerHTML = `
    <section class="estado estado-erro entrar" role="alert">
      <div class="estado-icone">${iconeUI("semSinal")}</div>
      <h1>Não conseguimos carregar a previsão</h1>
      <p>${esc(mensagem)}</p>
      <button class="btn btn-primario" type="button" data-tentar>${iconeUI("recarregar")}Tentar de novo</button>
    </section>`;
  el.querySelector("[data-tentar]").addEventListener("click", aoTentarDeNovo);
}

let temporizador;
export function mostrarAviso(texto) {
  const toast = document.getElementById("aviso-flutuante");
  toast.textContent = texto;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add("visivel"));
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    toast.classList.remove("visivel");
    setTimeout(() => { toast.hidden = true; }, 250);
  }, 3500);
}
