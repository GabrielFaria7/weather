import { noBrasil, ufDoEstado } from "./alertasOficiais.js";
import { descrever } from "./descricoes.js";
import { hora } from "./formato.js";

export const DISTANCIA_MAXIMA_MUNICIPIO_KM = 40;
export const DISTANCIA_MAXIMA_ESTACAO_KM = 50;
export const IDADE_MAXIMA_OBSERVACAO_MS = 3 * 60 * 60 * 1000;
export const CHUVA_MINIMA_MM = 0.2;
export const NOMES_GENERICOS = ["sua localizacao", "local compartilhado", "local escolhido"];

const RAIO_DA_TERRA_KM = 6371;
const CODIGOS_DE_CHUVA = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
const CODIGOS_DE_TROVOADA = new Set([95, 96, 99]);
const PERIODOS = [["manha", "Manhã"], ["tarde", "Tarde"], ["noite", "Noite"]];
const PEQUENAS = new Set(["de", "da", "do", "das", "dos", "e"]);
const DIRECOES = { N: "N", NE: "NE", E: "L", SE: "SE", S: "S", SW: "SO", W: "O", NW: "NO" };

const normalizar = (texto) => String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const radianos = (graus) => (graus * Math.PI) / 180;

export function distanciaKm(a, b) {
  const dLat = radianos(b.latitude - a.latitude);
  const dLon = radianos(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(radianos(a.latitude)) * Math.cos(radianos(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAIO_DA_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const numero = (valor) => {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
};

export const nomeEspecifico = (local) => Boolean(local.nome) && !NOMES_GENERICOS.includes(normalizar(local.nome));

export function escolherMunicipio(resultados, local) {
  const lista = (Array.isArray(resultados) ? resultados : [])
    .map((r) => {
      const [nome, uf] = String(r.label ?? r.id ?? "").split(/-(?=[A-Z]{2}$)/);
      const latitude = numero(r.latitude);
      const longitude = numero(r.longitude);
      return { geocode: String(r.geocode ?? ""), nome, uf, latitude, longitude };
    })
    .filter((m) => /^\d{7}$/.test(m.geocode) && m.uf);
  const uf = ufDoEstado(local.estado);
  const mesmoNome = uf && nomeEspecifico(local)
    && lista.find((m) => m.uf === uf && normalizar(m.nome) === normalizar(local.nome));
  if (mesmoNome) return mesmoNome;
  const perto = lista
    .filter((m) => m.latitude != null && m.longitude != null)
    .map((m) => ({ ...m, distancia: distanciaKm(local, m) }))
    .filter((m) => m.distancia <= DISTANCIA_MAXIMA_MUNICIPIO_KM)
    .sort((a, b) => a.distancia - b.distancia)[0];
  if (!perto) return null;
  const { distancia, ...municipio } = perto;
  return municipio;
}

export function cidadesProximas(cidades, local, quantidade = 2) {
  const naRegiao = cidades
    .map((c) => ({ ...c, distancia: distanciaKm(local, c) }))
    .filter((c) => c.distancia <= DISTANCIA_MAXIMA_MUNICIPIO_KM);
  const maisPerto = [...naRegiao].sort((a, b) => a.distancia - b.distancia).slice(0, quantidade);
  const maiores = [...naRegiao].sort((a, b) => (b.populacao ?? 0) - (a.populacao ?? 0)).slice(0, quantidade);
  return [...maisPerto, ...maiores].filter((c, i, lista) => lista.findIndex((outra) => outra.nome === c.nome) === i);
}

export function nomeDaEstacao(nome) {
  return String(nome ?? "").toLowerCase().trim().split(/\s+/)
    .map((palavra, i) => (i > 0 && PEQUENAS.has(palavra) ? palavra : palavra.charAt(0).toUpperCase() + palavra.slice(1)))
    .join(" ");
}

export function instanteDaMedicao(data, horaUtc) {
  const texto = String(horaUtc ?? "").padStart(4, "0");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data ?? "")) || !/^\d{4}$/.test(texto)) return NaN;
  return Date.parse(`${data}T${texto.slice(0, 2)}:${texto.slice(2)}:00Z`);
}

export function lerObservacao(resposta, local, agora = Date.now()) {
  const estacao = resposta?.estacao;
  const dados = resposta?.dados;
  if (!estacao || !dados) return null;
  const posicao = { latitude: numero(estacao.LATITUDE ?? dados.VL_LATITUDE), longitude: numero(estacao.LONGITUDE ?? dados.VL_LONGITUDE) };
  if (posicao.latitude == null || posicao.longitude == null) return null;
  const distancia = distanciaKm(local, posicao);
  const instante = instanteDaMedicao(dados.DT_MEDICAO, dados.HR_MEDICAO);
  const temperatura = numero(dados.TEM_INS);
  if (distancia > DISTANCIA_MAXIMA_ESTACAO_KM || Number.isNaN(instante) || temperatura == null) return null;
  if (agora - instante > IDADE_MAXIMA_OBSERVACAO_MS || instante - agora > 15 * 60 * 1000) return null;
  const emKmh = (ms) => (ms == null ? null : ms * 3.6);
  return {
    codigo: String(estacao.CODIGO ?? dados.CD_ESTACAO ?? ""),
    nome: nomeDaEstacao(estacao.NOME ?? dados.DC_NOME),
    distancia_km: Math.round(distancia),
    instante,
    temperatura,
    sensacao: numero(dados.TEM_SEN),
    umidade: numero(dados.UMD_INS),
    ponto_orvalho: numero(dados.PTO_INS),
    chuva_mm: numero(dados.CHUVA),
    vento: emKmh(numero(dados.VEN_VEL)),
    rajada: emKmh(numero(dados.VEN_RAJ)),
    direcao_vento: numero(dados.VEN_DIR),
  };
}

function codigoComChuvaMedida(codigo, chuva) {
  if (chuva == null) return codigo;
  if (chuva < CHUVA_MINIMA_MM) return CODIGOS_DE_CHUVA.has(codigo) ? 3 : codigo;
  if (CODIGOS_DE_CHUVA.has(codigo) || CODIGOS_DE_TROVOADA.has(codigo)) return codigo;
  if (chuva >= 7.6) return 65;
  return chuva >= 2.5 ? 63 : 61;
}

export function combinarComObservacao(atual, observacao) {
  if (!observacao) return atual;
  const escolher = (medido, doModelo) => (medido == null ? doModelo : medido);
  const codigo = codigoComChuvaMedida(atual.codigo, observacao.chuva_mm);
  return {
    ...atual,
    temperatura: observacao.temperatura,
    sensacao: escolher(observacao.sensacao, atual.sensacao),
    umidade: escolher(observacao.umidade, atual.umidade),
    ponto_orvalho: escolher(observacao.ponto_orvalho, atual.ponto_orvalho),
    vento: escolher(observacao.vento, atual.vento),
    rajada: escolher(observacao.rajada, atual.rajada),
    direcao_vento: escolher(observacao.direcao_vento, atual.direcao_vento),
    precipitacao: escolher(observacao.chuva_mm, atual.precipitacao),
    codigo,
    descricao: codigo === atual.codigo ? atual.descricao : descrever(codigo),
  };
}

export function fonteDoAgora({ estacao, pendente, local, deslocamento = 0 }, formatoHora = "24") {
  if (estacao) {
    const horario = hora(new Date(estacao.instante + deslocamento * 1000).toISOString(), formatoHora);
    const distancia = estacao.distancia_km < 1 ? "a menos de 1 km" : `a ${estacao.distancia_km} km`;
    return `Medido às ${horario} na estação ${estacao.nome} do INMET, ${distancia}`;
  }
  if (pendente && estacao === undefined && local && noBrasil(local)) return "Consultando a estação do INMET mais próxima…";
  return "Agora: estimativa do modelo da Open-Meteo";
}

export function codigoDoResumo(resumo) {
  const texto = normalizar(resumo);
  if (!texto) return null;
  if (texto.includes("trovoada")) return 95;
  if (texto.includes("chuvisco") || texto.includes("garoa")) return 51;
  if (texto.includes("chuva forte")) return 65;
  if (/pancada|isolad|possibilidade/.test(texto) && texto.includes("chuva")) return 80;
  if (texto.includes("chuva")) return 61;
  if (/nevoeiro|neblina|nevoa/.test(texto)) return 45;
  if (/encoberto|nublado/.test(texto) && !texto.includes("parcialmente")) return 3;
  if (/muitas nuvens|parcialmente/.test(texto)) return 2;
  if (texto.includes("poucas nuvens")) return 1;
  if (/claro|limpo|sol/.test(texto)) return 0;
  return 2;
}

export function textoDoVento(intensidade, direcoes) {
  const forca = normalizar(intensidade).split("/").map((p) => p.replace(/s$/, "")).filter(Boolean).join(" a ");
  const rumo = String(direcoes ?? "").split("-").map((d) => DIRECOES[d.trim().toUpperCase()]).filter(Boolean).join("-");
  if (!forca) return rumo ? `Vento ${rumo}` : "";
  return `Vento ${forca}${rumo ? `, ${rumo}` : ""}`;
}

const dataIso = (texto) => {
  const [d, m, a] = String(texto).split("/");
  return a && m && d ? `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : null;
};

function periodo(nome, dados, noite = false) {
  return {
    nome,
    resumo: String(dados.resumo ?? "").trim(),
    codigo: codigoDoResumo(dados.resumo),
    noite,
    vento: textoDoVento(dados.int_vento, dados.dir_vento),
  };
}

export function lerPrevisaoInmet(resposta, geocode, hoje, dias = 5) {
  const porData = resposta?.[geocode];
  if (!porData || typeof porData !== "object") return null;
  const lista = Object.entries(porData)
    .map(([texto, conteudo]) => {
      const data = dataIso(texto);
      if (!data || !conteudo || typeof conteudo !== "object") return null;
      const comPeriodos = PERIODOS.filter(([chave]) => conteudo[chave]);
      const base = comPeriodos.length ? conteudo[comPeriodos[0][0]] : conteudo;
      if (!comPeriodos.length && !conteudo.resumo) return null;
      return {
        data,
        max: numero(base.temp_max),
        min: numero(base.temp_min),
        umidade_max: numero(base.umidade_max),
        umidade_min: numero(base.umidade_min),
        periodos: comPeriodos.length
          ? comPeriodos.map(([chave, nome]) => periodo(nome, conteudo[chave], chave === "noite"))
          : [periodo("Dia", conteudo)],
      };
    })
    .filter((dia) => dia && (!hoje || dia.data >= hoje))
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, dias);
  if (!lista.length) return null;
  const { entidade, uf } = Object.values(porData).map((c) => c?.manha ?? c).find((c) => c?.entidade) ?? {};
  return { municipio: entidade ? `${entidade}${uf ? ` (${uf})` : ""}` : null, dias: lista };
}
