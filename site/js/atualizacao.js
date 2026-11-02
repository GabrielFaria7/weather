import { duracao } from "./formato.js";

export const INTERVALO_ATUALIZACAO_MS = 15 * 60 * 1000;

export function deveAtualizar({ ultimaVez, visivel, online = true, ocupado = false }, agora = Date.now()) {
  return Boolean(visivel) && online !== false && !ocupado && agora - ultimaVez >= INTERVALO_ATUALIZACAO_MS;
}

export function textoAtualizacao(instante, agora = Date.now()) {
  if (!Number.isFinite(instante)) return "";
  const minutos = Math.floor((agora - instante) / 60000);
  return minutos < 1 ? "Atualizado agora" : `Atualizado há ${duracao(minutos)}`;
}
