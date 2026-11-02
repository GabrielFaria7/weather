const RAD = Math.PI / 180;
const DIA_MS = 86400000;
const J2000 = 2451545;
const OBLIQUIDADE = 23.4397 * RAD;
const RAIO_TERRA_KM = 6378.14;
const RAIO_LUA_KM = 1737.4;
const DISTANCIA_SOL_KM = 149598000;
const REFRACAO = (34 / 60) * RAD;
const PASSO_BUSCA_MS = 10 * 60 * 1000;
const MES_SINODICO_DIAS = 29.530588853;

const FASES = [
  [0.0339, "Lua nova"],
  [0.2161, "Lua crescente"],
  [0.2839, "Quarto crescente"],
  [0.4661, "Crescente gibosa"],
  [0.5339, "Lua cheia"],
  [0.7161, "Minguante gibosa"],
  [0.7839, "Quarto minguante"],
  [0.9661, "Lua minguante"],
  [1, "Lua nova"],
];

const { sin, cos, tan, asin, atan2 } = Math;
const diasDesdeJ2000 = (instante) => instante / DIA_MS + 2440587.5 - J2000;
const girar = (valor) => ((valor % 1) + 1) % 1;

function eclipticaDaLua(d) {
  const L = (218.316 + 13.176396 * d) * RAD;
  const M = (134.963 + 13.064993 * d) * RAD;
  const F = (93.272 + 13.22935 * d) * RAD;
  const D = (297.85 + 12.190749 * d) * RAD;
  const Ms = (357.529 + 0.98560028 * d) * RAD;
  return {
    longitude: L + RAD * (6.288774 * sin(M) + 1.274027 * sin(2 * D - M) + 0.658314 * sin(2 * D)
      + 0.213618 * sin(2 * M) - 0.185116 * sin(Ms) - 0.114332 * sin(2 * F) + 0.058793 * sin(2 * D - 2 * M)
      + 0.057066 * sin(2 * D - Ms - M) + 0.053322 * sin(2 * D + M) + 0.045758 * sin(2 * D - Ms)
      - 0.040923 * sin(Ms - M) - 0.03472 * sin(D) - 0.030383 * sin(Ms + M) + 0.015327 * sin(2 * D - 2 * F)
      - 0.012528 * sin(M + 2 * F) + 0.01098 * sin(M - 2 * F) + 0.010675 * sin(4 * D - M) + 0.010034 * sin(3 * M)),
    latitude: RAD * (5.128 * sin(F) + 0.281 * sin(M + F) + 0.278 * sin(M - F) + 0.173 * sin(2 * D - F)),
    distancia: 385001 - 20905 * cos(M) - 3699 * cos(2 * D - M) - 2956 * cos(2 * D),
  };
}

function longitudeDoSol(d) {
  const M = (357.5291 + 0.98560028 * d) * RAD;
  const centro = RAD * (1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M));
  return (280.46646 + 0.98564736 * d) * RAD + centro;
}

export function faseDaLua(instante) {
  const d = diasDesdeJ2000(instante);
  const lua = eclipticaDaLua(d);
  const sol = longitudeDoSol(d);
  const fracao = girar((lua.longitude - sol) / (2 * Math.PI));
  const elongacao = Math.acos(cos(lua.latitude) * cos(lua.longitude - sol));
  const anguloDeFase = atan2(DISTANCIA_SOL_KM * sin(elongacao), lua.distancia - DISTANCIA_SOL_KM * cos(elongacao));
  return {
    fracao,
    iluminacao: (1 + cos(anguloDeFase)) / 2,
    nome: FASES.find(([limite]) => fracao < limite)[1],
    crescente: fracao < 0.5,
  };
}

export function alturaDaLua(instante, latitude, longitude) {
  const d = diasDesdeJ2000(instante);
  const lua = eclipticaDaLua(d);
  const ascensaoReta = atan2(sin(lua.longitude) * cos(OBLIQUIDADE) - tan(lua.latitude) * sin(OBLIQUIDADE), cos(lua.longitude));
  const declinacao = asin(sin(lua.latitude) * cos(OBLIQUIDADE) + cos(lua.latitude) * sin(OBLIQUIDADE) * sin(lua.longitude));
  const tempoSideral = (280.16 + 360.9856235 * d) * RAD + longitude * RAD;
  const anguloHorario = tempoSideral - ascensaoReta;
  const phi = latitude * RAD;
  const altura = asin(sin(phi) * sin(declinacao) + cos(phi) * cos(declinacao) * cos(anguloHorario));
  const paralaxe = asin(RAIO_TERRA_KM / lua.distancia);
  return { altura: altura - paralaxe * cos(altura), raioAparente: asin(RAIO_LUA_KM / lua.distancia) };
}

function bordaAcimaDoHorizonte(instante, latitude, longitude) {
  const { altura, raioAparente } = alturaDaLua(instante, latitude, longitude);
  return altura + raioAparente + REFRACAO;
}

function refinar(funcao, inicio, fim) {
  let [a, b] = [inicio, fim];
  const sinal = Math.sign(funcao(a));
  for (let i = 0; i < 20; i++) {
    const meio = (a + b) / 2;
    if (Math.sign(funcao(meio)) === sinal) a = meio;
    else b = meio;
  }
  return Math.round((a + b) / 2);
}

export function nascerEPorDaLua(inicioDoDia, latitude, longitude) {
  const acima = (t) => bordaAcimaDoHorizonte(t, latitude, longitude);
  let nascer = null;
  let por = null;
  let anterior = acima(inicioDoDia);
  for (let t = inicioDoDia + PASSO_BUSCA_MS; t <= inicioDoDia + DIA_MS; t += PASSO_BUSCA_MS) {
    const atual = acima(t);
    if (anterior < 0 && atual >= 0 && nascer == null) nascer = refinar(acima, t - PASSO_BUSCA_MS, t);
    if (anterior >= 0 && atual < 0 && por == null) por = refinar(acima, t - PASSO_BUSCA_MS, t);
    anterior = atual;
  }
  return { nascer, por, sempreAcima: nascer == null && por == null && anterior >= 0 };
}

export function proximaFase(instante, alvo) {
  const distancia = (t) => girar(faseDaLua(t).fracao - alvo + 0.5) - 0.5;
  const passo = 6 * 60 * 60 * 1000;
  let anterior = distancia(instante);
  for (let t = instante + passo; t <= instante + (MES_SINODICO_DIAS + 2) * DIA_MS; t += passo) {
    const atual = distancia(t);
    if (anterior < 0 && atual >= 0) return refinar(distancia, t - passo, t);
    anterior = atual;
  }
  return null;
}

const isoLocal = (instante, deslocamento) =>
  (instante == null ? null : new Date(instante + deslocamento * 1000).toISOString().slice(0, 16));

export function luaDoDia({ latitude, longitude }, dataLocal, deslocamento = 0, agora = Date.now()) {
  const inicioDoDia = Date.parse(`${dataLocal}T00:00:00Z`) - deslocamento * 1000;
  const fase = faseDaLua(agora);
  const { nascer, por, sempreAcima } = nascerEPorDaLua(inicioDoDia, latitude, longitude);
  return {
    ...fase,
    nascer: isoLocal(nascer, deslocamento),
    por: isoLocal(por, deslocamento),
    sempreAcima,
    proximaCheia: isoLocal(proximaFase(agora, 0.5), deslocamento),
    proximaNova: isoLocal(proximaFase(agora, 0), deslocamento),
  };
}

export function desenhoDaLua(fracao, raio = 32, sul = false) {
  const crescente = fracao < 0.5;
  const largura = Math.abs(cos(2 * Math.PI * fracao)) * raio;
  const fina = crescente ? fracao < 0.25 : fracao > 0.75;
  const limbo = crescente ? 1 : 0;
  const terminador = crescente ? (fina ? 0 : 1) : (fina ? 1 : 0);
  const n = (v) => Number(v.toFixed(2));
  const caminho = `M${n(raio)} 0A${n(raio)} ${n(raio)} 0 0 ${limbo} ${n(raio)} ${n(2 * raio)}`
    + `A${n(largura)} ${n(raio)} 0 0 ${terminador} ${n(raio)} 0Z`;
  return { caminho, espelhar: sul };
}
