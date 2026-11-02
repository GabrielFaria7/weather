export const LAPSO_TERMICO_C_POR_M = 0.0065;
export const ZOOM_MAXIMO_RELEVO = 12;
const BORDA_SUAVE_CELULAS = 0.6;
const CIRCUNFERENCIA_TERRA_M = 40075016.686;
const LUZ = [-0.5, 0.5, Math.SQRT1_2];
const INTENSIDADE_SOMBRA = 0.75;

export const ESCALA_TEMPERATURA_MAPA = [
  [-20, [120, 40, 150]],
  [-10, [80, 70, 200]],
  [-3, [50, 110, 225]],
  [3, [30, 165, 235]],
  [8, [20, 200, 215]],
  [12, [25, 205, 150]],
  [16, [60, 210, 70]],
  [19, [150, 225, 40]],
  [22, [240, 225, 35]],
  [25, [255, 190, 20]],
  [28, [255, 140, 20]],
  [31, [245, 90, 30]],
  [34, [220, 40, 40]],
  [38, [170, 15, 60]],
  [43, [110, 0, 90]],
];

export function corDaTemperatura(temperatura) {
  const escala = ESCALA_TEMPERATURA_MAPA;
  if (!(temperatura > escala[0][0])) return escala[0][1];
  for (let i = 1; i < escala.length; i++) {
    const [limite, cor] = escala[i];
    if (temperatura <= limite) {
      const [anterior, corAnterior] = escala[i - 1];
      const t = (temperatura - anterior) / (limite - anterior);
      return corAnterior.map((c, j) => Math.round(c + (cor[j] - c) * t));
    }
  }
  return escala.at(-1)[1];
}

const TABELA_INICIO = ESCALA_TEMPERATURA_MAPA[0][0];
const TABELA_PASSOS_POR_GRAU = 10;
let tabelaCores = null;

function corNaTabela(temperatura) {
  if (!tabelaCores) {
    const total = (ESCALA_TEMPERATURA_MAPA.at(-1)[0] - TABELA_INICIO) * TABELA_PASSOS_POR_GRAU + 1;
    tabelaCores = new Uint8Array(total * 3);
    for (let i = 0; i < total; i++) tabelaCores.set(corDaTemperatura(TABELA_INICIO + i / TABELA_PASSOS_POR_GRAU), i * 3);
  }
  const posicao = Math.round((temperatura - TABELA_INICIO) * TABELA_PASSOS_POR_GRAU);
  return Math.min(tabelaCores.length / 3 - 1, Math.max(0, posicao)) * 3;
}

export function degradeDaEscala(minimo = -10, maximo = 43) {
  const paradas = ESCALA_TEMPERATURA_MAPA
    .filter(([t]) => t >= minimo && t <= maximo)
    .map(([t, [r, g, b]]) => `rgb(${r},${g},${b}) ${Math.round(((t - minimo) / (maximo - minimo)) * 100)}%`);
  return `linear-gradient(90deg, ${paradas.join(", ")})`;
}

export const altitudeTerrarium = (r, g, b) => r * 256 + g + b / 256 - 32768;

export function altitudesDoRelevo(rgba) {
  const altitudes = new Float32Array(rgba.length / 4);
  for (let i = 0; i < altitudes.length; i++) {
    altitudes[i] = Math.max(0, altitudeTerrarium(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]));
  }
  return altitudes;
}

export function temperaturasAoNivelDoMar({ pontos }, indice) {
  return pontos.map((p) => {
    const t = p.temperatura?.[indice];
    return t == null ? NaN : t + LAPSO_TERMICO_C_POR_M * Math.max(0, p.elevacao ?? 0);
  });
}

function posicaoNaGrade(grade, latitude, longitude) {
  const linha = (grade.norte - latitude) / grade.passo;
  const coluna = ((((longitude - grade.oeste) % 360) + 360) % 360) / grade.passo;
  if (linha < 0 || linha > grade.linhas - 1 || coluna < 0 || coluna > grade.colunas - 1) return null;
  return { linha, coluna };
}

function interpolar(grade, valores, { linha, coluna }) {
  const l0 = Math.min(grade.linhas - 2, Math.floor(linha));
  const c0 = Math.min(grade.colunas - 2, Math.floor(coluna));
  const tl = linha - l0;
  const tc = coluna - c0;
  const v = (l, c) => valores[l * grade.colunas + c];
  return (v(l0, c0) * (1 - tc) + v(l0, c0 + 1) * tc) * (1 - tl) + (v(l0 + 1, c0) * (1 - tc) + v(l0 + 1, c0 + 1) * tc) * tl;
}

const elevacoesDaGrade = ({ pontos }) => pontos.map((p) => Math.max(0, p.elevacao ?? 0));

export function temperaturaNoPonto(dados, reduzidas, latitude, longitude, altitude = null) {
  const posicao = posicaoNaGrade(dados.grade, latitude, longitude);
  if (!posicao) return null;
  const aoNivelDoMar = interpolar(dados.grade, reduzidas, posicao);
  if (!Number.isFinite(aoNivelDoMar)) return null;
  const elevacao = altitude ?? interpolar(dados.grade, elevacoesDaGrade(dados), posicao);
  return aoNivelDoMar - LAPSO_TERMICO_C_POR_M * Math.max(0, elevacao);
}

const latitudeDoPixel = (pixelY, z) => {
  const n = Math.PI - (2 * Math.PI * pixelY) / (256 * 2 ** z);
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
};
const longitudeDoPixel = (pixelX, z) => (pixelX / (256 * 2 ** z)) * 360 - 180;

export function sombreamento(altitudes, { y, z }, lado = 256) {
  const sombra = new Float32Array(lado * lado);
  const exagero = Math.max(1, 2 ** ((ZOOM_MAXIMO_RELEVO - z) / 2));
  const plano = LUZ[2];
  for (let py = 0; py < lado; py++) {
    const latitude = latitudeDoPixel(y * 256 + ((py + 0.5) * 256) / lado, z);
    const metrosPorPixel = (CIRCUNFERENCIA_TERRA_M * Math.cos((latitude * Math.PI) / 180)) / (256 * 2 ** z) * (256 / lado);
    const acima = Math.max(0, py - 1);
    const abaixo = Math.min(lado - 1, py + 1);
    for (let px = 0; px < lado; px++) {
      const esquerda = Math.max(0, px - 1);
      const direita = Math.min(lado - 1, px + 1);
      const leste = ((altitudes[py * lado + direita] - altitudes[py * lado + esquerda]) / ((direita - esquerda) * metrosPorPixel)) * exagero;
      const norte = ((altitudes[acima * lado + px] - altitudes[abaixo * lado + px]) / ((abaixo - acima) * metrosPorPixel)) * exagero;
      const luz = (-leste * LUZ[0] - norte * LUZ[1] + LUZ[2]) / Math.sqrt(leste * leste + norte * norte + 1);
      sombra[py * lado + px] = Math.min(1.2, Math.max(0.55, 1 + (luz - plano) * INTENSIDADE_SOMBRA));
    }
  }
  return sombra;
}

export function pintarTemperatura(relevo, { x, y, z }, dados, reduzidas, lado = 256) {
  const { grade } = dados;
  const elevacoes = relevo ? null : elevacoesDaGrade(dados);
  const saida = new Uint8ClampedArray(lado * lado * 4);
  const passo = 256 / lado;
  const longitudes = Array.from({ length: lado }, (_, px) => longitudeDoPixel(x * 256 + (px + 0.5) * passo, z));
  for (let py = 0; py < lado; py++) {
    const latitude = latitudeDoPixel(y * 256 + (py + 0.5) * passo, z);
    for (let px = 0; px < lado; px++) {
      const posicao = posicaoNaGrade(grade, latitude, longitudes[px]);
      if (!posicao) continue;
      const aoNivelDoMar = interpolar(grade, reduzidas, posicao);
      if (!Number.isFinite(aoNivelDoMar)) continue;
      const p = py * lado + px;
      const altitude = relevo ? relevo.altitudes[p] : interpolar(grade, elevacoes, posicao);
      const luz = relevo ? relevo.sombra[p] : 1;
      const cor = corNaTabela(aoNivelDoMar - LAPSO_TERMICO_C_POR_M * altitude);
      const borda = Math.min(posicao.linha, grade.linhas - 1 - posicao.linha, posicao.coluna, grade.colunas - 1 - posicao.coluna);
      saida[p * 4] = tabelaCores[cor] * luz;
      saida[p * 4 + 1] = tabelaCores[cor + 1] * luz;
      saida[p * 4 + 2] = tabelaCores[cor + 2] * luz;
      saida[p * 4 + 3] = 255 * Math.min(1, borda / BORDA_SUAVE_CELULAS);
    }
  }
  return saida;
}

export function passoParaZoom(zoom) {
  if (zoom >= 8) return 0.5;
  if (zoom >= 7) return 1;
  if (zoom >= 6) return 2;
  return 4;
}

const centroDaGrade = (grade) => ({
  latitude: grade.norte - ((grade.linhas - 1) * grade.passo) / 2,
  longitude: grade.oeste + ((grade.colunas - 1) * grade.passo) / 2,
});

const distanciaEmLongitude = (a, b) => Math.abs(((((a - b + 180) % 360) + 360) % 360) - 180);

export function precisaDeNovaGrade(grade, { sul, norte, oeste, leste, zoom }) {
  if (passoParaZoom(zoom) !== grade.passo) return true;
  const altura = (grade.linhas - 1) * grade.passo;
  const largura = (grade.colunas - 1) * grade.passo;
  const centro = centroDaGrade(grade);
  const meioLatitude = (sul + norte) / 2;
  const meioLongitude = (oeste + leste) / 2;
  const longeDoCentro = Math.abs(meioLatitude - centro.latitude) > altura / 4
    || distanciaEmLongitude(meioLongitude, centro.longitude) > largura / 4;
  if (norte - sul >= altura || leste - oeste >= largura) return longeDoCentro;
  const margem = grade.passo / 2;
  const limite = largura / 2 - margem;
  const foraEmLatitude = norte > grade.norte - margem || sul < grade.norte - altura + margem;
  const foraEmLongitude = distanciaEmLongitude(oeste, centro.longitude) > limite
    || distanciaEmLongitude(leste, centro.longitude) > limite;
  return foraEmLatitude || foraEmLongitude;
}

export function centroParaNovaGrade({ sul, norte, oeste, leste, zoom }) {
  const passo = passoParaZoom(zoom);
  const ajustar = (valor) => Math.round(valor / passo) * passo;
  const longitude = ((((oeste + leste) / 2 + 180) % 360) + 360) % 360 - 180;
  return { latitude: ajustar((sul + norte) / 2), longitude: ajustar(longitude), passo };
}

export function indiceDoMesmoHorario(horasAntigas, indiceAntigo, horasNovas) {
  const instante = horasAntigas?.[indiceAntigo];
  if (instante == null || !horasNovas?.length) return 0;
  let melhor = 0;
  horasNovas.forEach((hora, i) => {
    if (Math.abs(hora - instante) < Math.abs(horasNovas[melhor] - instante)) melhor = i;
  });
  return melhor;
}
