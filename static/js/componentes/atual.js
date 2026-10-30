// Card principal: clima de agora. A temperatura é o maior destaque da página.
import { agoraNaCidade, direcao, esc, nomeCompleto, porcentagem, temperatura, vento } from "../formato.js";
import { classeFundo, iconeClima, iconeUI } from "../icones.js";

export function renderizarAtual(el, dados, ctx) {
  const { local, atual, dias, fuso } = dados;
  const hoje = dias[0];
  const unidadeTexto = ctx.unidade === "F" ? "F" : "C";

  el.innerHTML = `
    <article class="card card-atual ${classeFundo(atual.codigo, atual.dia)}" id="hoje" aria-labelledby="atual-local">
      <div class="atual-topo">
        <div>
          <h1 class="atual-local" id="atual-local">${esc(local.nome)}</h1>
          <p class="atual-regiao">${esc(nomeCompleto(local))}</p>
          <p class="atual-relogio">${iconeUI("relogio")}<span data-relogio>${esc(agoraNaCidade(fuso, ctx.hora))}</span></p>
        </div>
        <button class="btn-favorito" type="button" data-acao="favorito" aria-pressed="${ctx.favorito}"
                aria-label="${ctx.favorito ? "Remover dos favoritos" : "Salvar nos favoritos"}"
                title="${ctx.favorito ? "Remover dos favoritos" : "Salvar nos favoritos"}">
          ${iconeUI("estrela")}
        </button>
      </div>

      <div class="atual-centro">
        <div class="atual-icone">${iconeClima(atual.codigo, atual.dia, { tamanho: 132, animado: true, rotulo: atual.descricao })}</div>
        <div class="atual-leitura">
          <p class="atual-temp" aria-label="Temperatura ${temperatura(atual.temperatura, ctx.unidade)}${unidadeTexto}">
            ${temperatura(atual.temperatura, ctx.unidade).replace("°", "")}<span class="atual-grau">°${unidadeTexto}</span>
          </p>
          <p class="atual-desc">${esc(atual.descricao)}</p>
          <p class="atual-sensacao">Sensação térmica de <strong>${temperatura(atual.sensacao, ctx.unidade)}</strong></p>
        </div>
        <div class="atual-maxmin" aria-label="Máxima e mínima de hoje">
          <span><small>Máx</small><strong>${temperatura(hoje.max, ctx.unidade)}</strong></span>
          <span><small>Mín</small><strong>${temperatura(hoje.min, ctx.unidade)}</strong></span>
        </div>
      </div>

      <dl class="atual-metricas">
        <div><dt>${iconeUI("guardaChuva")}Chance de chuva</dt><dd>${porcentagem(hoje.chance_chuva)}</dd></div>
        <div><dt>${iconeUI("gota")}Umidade</dt><dd>${porcentagem(atual.umidade)}</dd></div>
        <div>
          <dt>${iconeUI("vento")}Vento</dt>
          <dd>
            <span class="seta-vento" style="--graus:${(atual.direcao_vento ?? 0) + 180}deg"
                  title="Vindo do ${direcao(atual.direcao_vento, true)}">${iconeUI("seta")}</span>
            ${vento(atual.vento, ctx.vento)} <small>${direcao(atual.direcao_vento)}</small>
          </dd>
        </div>
      </dl>
    </article>`;
}
