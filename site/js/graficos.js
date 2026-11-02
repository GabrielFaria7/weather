import { carregarBiblioteca } from "./bibliotecas.js";

export const carregarGraficos = () => carregarBiblioteca("graficos");

function cor(variavel) {
  return getComputedStyle(document.documentElement).getPropertyValue(variavel).trim();
}

export function coresDoTema() {
  return {
    primaria: cor("--primaria"),
    secundaria: cor("--secundaria"),
    texto: cor("--texto"),
    texto2: cor("--texto-2"),
    borda: cor("--borda"),
    superficie: cor("--superficie"),
  };
}

export function graficoDisponivel() {
  return typeof window.Chart !== "undefined";
}

export function degrade(ctx, area, corBase) {
  const g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
  g.addColorStop(0, corBase + "55");
  g.addColorStop(1, corBase + "00");
  return g;
}

export const reduzirMovimento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
