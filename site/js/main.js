import { buscarPrevisao } from "./servico.js";
import { agoraNaCidade, dataHoraLocal, esc } from "./formato.js";
import { iconeUI, preencherIcones } from "./icones.js";
import { favoritos, preferencias } from "./preferencias.js";
import { iniciarBusca } from "./componentes/busca.js";
import { renderizarAtual } from "./componentes/atual.js";
import { renderizarPorHora } from "./componentes/porHora.js";
import { renderizarDias } from "./componentes/dias.js";
import { ajustarMapa, atualizarMapa, renderizarMapa } from "./componentes/mapa.js";
import { renderizarIndicadores } from "./componentes/indicadores.js";
import { renderizarQualidadeAr } from "./componentes/qualidadeAr.js";
import { renderizarAlertas } from "./componentes/alertas.js";
import { renderizarFavoritos } from "./componentes/favoritos.js";
import { mostrarAviso, renderizarCarregando, renderizarErro, renderizarVazio } from "./componentes/estados.js";

const principal = document.getElementById("conteudo");

const estado = {
  local: null,
  dados: null,
  unidade: preferencias.unidade,
  vento: preferencias.vento,
  hora: preferencias.hora,
};

let numeroDoPedido = 0;
let observadorAbas;

async function carregar(local) {
  const meuPedido = ++numeroDoPedido;
  estado.local = local;
  renderizarCarregando(principal);
  window.scrollTo({ top: 0 });

  try {
    const dados = await buscarPrevisao(local);
    if (meuPedido !== numeroDoPedido) return;
    estado.dados = dados;
    preferencias.ultimoLocal = local;
    atualizarEndereco(local);
    document.title = `${dados.local.nome} · Weather`;
    montarPainel();
  } catch (erro) {
    if (meuPedido !== numeroDoPedido) return;
    renderizarErro(principal, erro.message, () => carregar(local));
  }
}

function atualizarEndereco(local) {
  const parametros = new URLSearchParams({ lat: local.latitude, lon: local.longitude, nome: local.nome });
  if (local.estado) parametros.set("estado", local.estado);
  if (local.pais) parametros.set("pais", local.pais);
  history.replaceState(null, "", `?${parametros}`);
}

function localDoEndereco() {
  const p = new URLSearchParams(location.search);
  const latitude = Number(p.get("lat"));
  const longitude = Number(p.get("lon"));
  if (!p.has("lat") || !p.has("lon") || Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
  return { nome: p.get("nome") || "Local escolhido", estado: p.get("estado") || "", pais: p.get("pais") || "", latitude, longitude };
}

function avisoPrevisaoSalva() {
  if (!estado.dados.salvaEm) return "";
  return `
    <div class="aviso-salvo" role="status">
      ${iconeUI("semSinal")}
      <p><strong>Sem conexão com o serviço de meteorologia.</strong> Mostrando a previsão salva em
        ${esc(dataHoraLocal(estado.dados.salvaEm))}; ela pode estar desatualizada.</p>
      <button class="btn-texto" type="button" data-recarregar>${iconeUI("recarregar")}Tentar de novo</button>
    </div>`;
}

function montarPainel() {
  principal.innerHTML = `${avisoPrevisaoSalva()}
    <div class="painel">
      <div class="area-atual" data-area="atual"></div>
      <div class="area-lateral">
        <div data-area="alertas"></div>
        <div data-area="favoritos"></div>
      </div>
      <div class="area-horas" data-area="horas"></div>
      <div class="area-dias" data-area="dias"></div>
      <div class="area-indicadores" data-area="indicadores"></div>
      <div class="area-ar" data-area="ar"></div>
      <div class="area-mapa" data-area="mapa"></div>
    </div>`;
  renderizarConteudo();
  principal.querySelector("[data-recarregar]")?.addEventListener("click", () => carregar(estado.local));
  renderizarMapa(area("mapa"), estado.dados, contexto());
  ativarAba(document.querySelector('.aba[href="#hoje"]'));
  observarAbas();
}

const area = (nome) => principal.querySelector(`[data-area="${nome}"]`);

function contexto() {
  return {
    unidade: estado.unidade,
    vento: estado.vento,
    hora: estado.hora,
    favorito: favoritos.contem(estado.dados.local),
  };
}

function renderizarConteudo() {
  if (!estado.dados) return;
  const ctx = contexto();
  renderizarAtual(area("atual"), estado.dados, ctx);
  renderizarAlertas(area("alertas"), estado.dados);
  renderizarListaFavoritos();
  renderizarPorHora(area("horas"), estado.dados, ctx);
  renderizarDias(area("dias"), estado.dados, ctx);
  renderizarIndicadores(area("indicadores"), estado.dados, ctx);
  renderizarQualidadeAr(area("ar"), estado.dados);
  atualizarMapa(ctx);
}

function renderizarListaFavoritos() {
  if (!area("favoritos")) return;
  renderizarFavoritos(area("favoritos"), estado.dados?.local, {
    aoEscolher: carregar,
    aoMudar: renderizarConteudo,
  });
}

function mostrarInicio() {
  numeroDoPedido++;
  estado.dados = null;
  history.replaceState(null, "", location.pathname);
  document.title = "Weather";
  renderizarVazio(principal, { aoEscolher: carregar, aoLocalizar: localizar });
}

function localizar() {
  if (!("geolocation" in navigator)) {
    mostrarAviso("Seu navegador não permite localização.");
    return;
  }
  const botao = document.getElementById("btn-localizacao");
  botao.classList.add("carregando");
  navigator.geolocation.getCurrentPosition(
    (posicao) => {
      botao.classList.remove("carregando");
      carregar({
        nome: "Sua localização", estado: "", pais: "",
        latitude: Number(posicao.coords.latitude.toFixed(4)),
        longitude: Number(posicao.coords.longitude.toFixed(4)),
      });
    },
    (erro) => {
      botao.classList.remove("carregando");
      mostrarAviso(erro.code === erro.PERMISSION_DENIED
        ? "Permissão de localização negada. Você pode buscar a cidade pelo nome."
        : "Não foi possível descobrir sua localização.");
    },
    { timeout: 10000, maximumAge: 600000 },
  );
}

function alternarFavorito() {
  const salvo = favoritos.alternar(estado.dados.local);
  mostrarAviso(salvo ? "Cidade salva nos favoritos." : "Cidade removida dos favoritos.");
  renderizarConteudo();
}

function definirUnidade(unidade) {
  estado.unidade = unidade;
  preferencias.unidade = unidade;
  document.querySelectorAll("[data-unidade]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.unidade === unidade)));
  renderizarConteudo();
}

function alternarTema() {
  const escuro = document.documentElement.dataset.theme !== "dark";
  document.documentElement.dataset.theme = escuro ? "dark" : "light";
  preferencias.tema = escuro ? "escuro" : "claro";
  renderizarConteudo();
}

function iniciarConfiguracoes() {
  const botao = document.getElementById("btn-config");
  const painel = document.getElementById("painel-config");

  const abrir = (sim) => {
    painel.hidden = !sim;
    botao.setAttribute("aria-expanded", String(sim));
  };
  botao.addEventListener("click", (e) => { e.stopPropagation(); abrir(painel.hidden); });
  document.addEventListener("click", (e) => { if (!painel.contains(e.target)) abrir(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !painel.hidden) { abrir(false); botao.focus(); } });

  const marcar = () => {
    painel.querySelectorAll("[data-preferencia]").forEach((grupo) => {
      grupo.querySelectorAll("[data-valor]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b.dataset.valor === estado[grupo.dataset.preferencia]));
      });
    });
  };
  painel.querySelectorAll("[data-preferencia]").forEach((grupo) => {
    grupo.addEventListener("click", (e) => {
      const opcao = e.target.closest("[data-valor]");
      if (!opcao) return;
      const chave = grupo.dataset.preferencia;
      estado[chave] = opcao.dataset.valor;
      preferencias[chave] = opcao.dataset.valor;
      marcar();
      renderizarConteudo();
    });
  });
  marcar();

  document.getElementById("btn-limpar-favoritos").addEventListener("click", () => {
    favoritos.limpar();
    abrir(false);
    mostrarAviso("Favoritos apagados.");
    renderizarConteudo();
  });
}

function iniciarAbas() {
  document.querySelectorAll(".aba").forEach((aba) => {
    aba.addEventListener("click", (e) => {
      const alvo = document.querySelector(aba.getAttribute("href"));
      if (!alvo) { e.preventDefault(); return; }
      e.preventDefault();
      alvo.scrollIntoView({ behavior: "smooth", block: "start" });
      ativarAba(aba);
    });
  });
}

function ativarAba(ativa) {
  document.querySelectorAll(".aba").forEach((a) => a.toggleAttribute("aria-current", a === ativa));
  ativa.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function observarAbas() {
  observadorAbas?.disconnect();
  observadorAbas = new IntersectionObserver((entradas) => {
    const visivel = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!visivel) return;
    const aba = [...document.querySelectorAll(".aba")].find((a) => a.getAttribute("href") === `#${visivel.target.id}`);
    if (aba) document.querySelectorAll(".aba").forEach((a) => a.toggleAttribute("aria-current", a === aba));
  }, { rootMargin: "-140px 0px -55% 0px" });
  ["hoje", "por-hora", "dias", "indicadores", "mapa"].forEach((id) => {
    const secao = document.getElementById(id);
    if (secao) observadorAbas.observe(secao);
  });
}

function iniciar() {
  preencherIcones();
  iniciarBusca({ aoEscolher: carregar });
  iniciarConfiguracoes();
  iniciarAbas();

  document.getElementById("btn-localizacao").addEventListener("click", localizar);
  document.getElementById("btn-tema").addEventListener("click", alternarTema);
  document.querySelectorAll("[data-unidade]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.unidade === estado.unidade));
    b.addEventListener("click", () => definirUnidade(b.dataset.unidade));
  });

  principal.addEventListener("click", (e) => {
    if (e.target.closest('[data-acao="favorito"]')) alternarFavorito();
  });

  document.querySelector(".logo").addEventListener("click", (e) => { e.preventDefault(); mostrarInicio(); });

  setInterval(() => {
    const relogio = document.querySelector("[data-relogio]");
    if (relogio && estado.dados) relogio.textContent = agoraNaCidade(estado.dados.fuso, estado.hora);
  }, 30000);

  window.addEventListener("resize", ajustarMapa);

  window.addEventListener("online", () => {
    if (estado.dados?.salvaEm) carregar(estado.local);
  });
  iniciarAplicativo();

  const inicial = localDoEndereco() ?? preferencias.ultimoLocal;
  if (inicial) carregar(inicial);
  else mostrarInicio();
}

function iniciarAplicativo() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  const botao = document.getElementById("btn-instalar");
  let pedidoDeInstalacao = null;
  window.addEventListener("beforeinstallprompt", (evento) => {
    evento.preventDefault();
    pedidoDeInstalacao = evento;
    botao.hidden = false;
  });
  botao.addEventListener("click", async () => {
    if (!pedidoDeInstalacao) return;
    pedidoDeInstalacao.prompt();
    await pedidoDeInstalacao.userChoice;
    pedidoDeInstalacao = null;
    botao.hidden = true;
  });
  window.addEventListener("appinstalled", () => {
    botao.hidden = true;
    mostrarAviso("Weather instalado como aplicativo.");
  });
}

iniciar();
