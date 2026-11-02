import { temperatura } from "./formato.js";
import { resumoDoDia } from "./resumo.js";

const NOME_DA_LOCALIZACAO = "Sua localização";
const NOME_COMPARTILHADO = "Local compartilhado";

const daLocalizacao = (local) => local.nome === NOME_DA_LOCALIZACAO && !local.estado && !local.pais;

export function enderecoParaCompartilhar(local, base) {
  const escondido = daLocalizacao(local);
  const parametros = new URLSearchParams({
    lat: escondido ? Number(local.latitude).toFixed(2) : local.latitude,
    lon: escondido ? Number(local.longitude).toFixed(2) : local.longitude,
    nome: escondido ? NOME_COMPARTILHADO : local.nome,
  });
  if (local.estado) parametros.set("estado", local.estado);
  if (local.pais) parametros.set("pais", local.pais);
  return `${base}?${parametros}`;
}

export function conteudoParaCompartilhar(dados, ctx, base) {
  const { local, atual, dias } = dados;
  const nome = daLocalizacao(local) ? NOME_COMPARTILHADO : local.nome;
  const unidade = ctx.unidade === "F" ? "F" : "C";
  const hoje = dias?.[0];
  const extremos = hoje ? ` (máx. ${temperatura(hoje.max, ctx.unidade)} · mín. ${temperatura(hoje.min, ctx.unidade)})` : "";
  const agora = `${nome}: ${temperatura(atual.temperatura, ctx.unidade)}${unidade}, ${String(atual.descricao).toLowerCase()}${extremos}.`;
  const resumo = resumoDoDia(dados.por_hora, ctx);
  return {
    title: `${nome} · Weather`,
    text: resumo ? `${agora} ${resumo}` : agora,
    url: enderecoParaCompartilhar(local, base),
  };
}
