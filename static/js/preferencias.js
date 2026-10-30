// Preferências e favoritos salvos no navegador (localStorage).
// Tudo dentro de try/catch: em janela anônima o navegador pode bloquear o armazenamento.

const PREFIXO = "weather.";

function ler(chave, padrao) {
  try {
    const valor = localStorage.getItem(PREFIXO + chave);
    return valor == null ? padrao : JSON.parse(valor);
  } catch {
    return padrao;
  }
}

function salvar(chave, valor) {
  try {
    localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
  } catch {
    /* Sem armazenamento: a preferência vale só até fechar a página. */
  }
}

export const preferencias = {
  // O tema é salvo como texto puro porque o script do <head> lê sem JSON.
  get tema() { try { return localStorage.getItem(PREFIXO + "tema"); } catch { return null; } },
  set tema(v) { try { localStorage.setItem(PREFIXO + "tema", v); } catch { /* idem */ } },

  get unidade() { return ler("unidade", "C"); },
  set unidade(v) { salvar("unidade", v); },

  get vento() { return ler("vento", "kmh"); },
  set vento(v) { salvar("vento", v); },

  get hora() { return ler("hora", "24"); },
  set hora(v) { salvar("hora", v); },

  get ultimoLocal() { return ler("ultimo", null); },
  set ultimoLocal(v) { salvar("ultimo", v); },
};

// Duas cidades são "a mesma" se as coordenadas forem praticamente iguais.
export const mesmoLocal = (a, b) =>
  Math.abs(a.latitude - b.latitude) < 0.01 && Math.abs(a.longitude - b.longitude) < 0.01;

export const favoritos = {
  listar() { return ler("favoritos", []); },
  contem(local) { return this.listar().some((f) => mesmoLocal(f, local)); },
  alternar(local) {
    const lista = this.listar();
    const nova = this.contem(local)
      ? lista.filter((f) => !mesmoLocal(f, local))
      : [...lista, { nome: local.nome, estado: local.estado, pais: local.pais, latitude: local.latitude, longitude: local.longitude }];
    salvar("favoritos", nova);
    return this.contem(local);
  },
  remover(local) { salvar("favoritos", this.listar().filter((f) => !mesmoLocal(f, local))); },
  limpar() { salvar("favoritos", []); },
};
