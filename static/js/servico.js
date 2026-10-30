async function pedir(url, { signal } = {}) {
  let resposta;
  try {
    resposta = await fetch(url, { signal });
  } catch (erro) {
    if (erro.name === "AbortError") throw erro;
    throw new Error("Sem conexão com o servidor. Verifique sua internet ou se o web.py está rodando.");
  }
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const mensagem = dados.erro || `Algo deu errado ao buscar a previsão (código ${resposta.status}).`;
    throw new Error(dados.detalhe ? `${mensagem} Detalhe: ${dados.detalhe}` : mensagem);
  }
  return dados;
}

export function buscarCidades(termo, opcoes) {
  return pedir(`/api/cidades?q=${encodeURIComponent(termo)}`, opcoes);
}

export function buscarPrevisao(local, opcoes) {
  const parametros = new URLSearchParams({
    lat: local.latitude,
    lon: local.longitude,
    nome: local.nome ?? "",
    estado: local.estado ?? "",
    pais: local.pais ?? "",
  });
  return pedir(`/api/previsao?${parametros}`, opcoes);
}
