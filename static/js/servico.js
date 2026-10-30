// Camada de dados do front: só faz pedidos ao nosso servidor Flask.
// Os componentes nunca chamam fetch direto; assim, trocar a fonte de dados mexe só aqui.

async function pedir(url, { signal } = {}) {
  let resposta;
  try {
    resposta = await fetch(url, { signal });
  } catch (erro) {
    if (erro.name === "AbortError") throw erro;
    throw new Error("Sem conexão com o servidor. Verifique sua internet ou se o web.py está rodando.");
  }
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.erro || "Algo deu errado ao buscar a previsão.");
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
