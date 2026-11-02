const DESLOCAMENTO_BRASILIA_MS = 3 * 60 * 60 * 1000;
const NIVEIS = { 6: "atencao", 7: "alerta", 8: "perigo" };
const ORDEM_NIVEIS = ["atencao", "alerta", "perigo"];
const LIMITES_BRASIL = { sul: -34, norte: 5.5, oeste: -74.5, leste: -28.5 };

const UFS = {
  acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA", ceara: "CE", "distrito federal": "DF",
  "espirito santo": "ES", goias: "GO", maranhao: "MA", "mato grosso": "MT", "mato grosso do sul": "MS",
  "minas gerais": "MG", para: "PA", paraiba: "PB", parana: "PR", pernambuco: "PE", piaui: "PI", "rio de janeiro": "RJ",
  "rio grande do norte": "RN", "rio grande do sul": "RS", rondonia: "RO", roraima: "RR", "santa catarina": "SC",
  "sao paulo": "SP", sergipe: "SE", tocantins: "TO",
};

const normalizar = (texto) => String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export function noBrasil({ latitude, longitude }) {
  const { sul, norte, oeste, leste } = LIMITES_BRASIL;
  return latitude >= sul && latitude <= norte && longitude >= oeste && longitude <= leste;
}

export function instanteBrasilia(texto) {
  const [data, hora = "00:00"] = String(texto ?? "").trim().split(" ");
  const instante = Date.parse(`${data}T${hora}:00Z`);
  return Number.isNaN(instante) ? NaN : instante + DESLOCAMENTO_BRASILIA_MS;
}

function dentroDoAnel(latitude, longitude, anel) {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i];
    const [xj, yj] = anel[j];
    if ((yi > latitude) !== (yj > latitude) && longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

const dentroDoPoligono = (latitude, longitude, [externo, ...buracos]) =>
  Boolean(externo) && dentroDoAnel(latitude, longitude, externo) && !buracos.some((b) => dentroDoAnel(latitude, longitude, b));

export function pontoNaArea(latitude, longitude, geometria) {
  try {
    const forma = typeof geometria === "string" ? JSON.parse(geometria) : geometria;
    if (forma?.type === "Polygon") return dentroDoPoligono(latitude, longitude, forma.coordinates);
    if (forma?.type === "MultiPolygon") return forma.coordinates.some((p) => dentroDoPoligono(latitude, longitude, p));
  } catch {}
  return false;
}

export function municipioNaLista(local, municipios) {
  const uf = UFS[normalizar(local.estado)];
  if (!uf || !local.nome || !municipios) return false;
  const lista = `,${normalizar(municipios).replace(/,\s*/g, ",")}`;
  return lista.includes(`,${normalizar(local.nome)} - ${uf.toLowerCase()} (`);
}

function nivelDoAlerta(alerta) {
  if (NIVEIS[alerta.id_severidade]) return NIVEIS[alerta.id_severidade];
  const severidade = normalizar(alerta.severidade);
  if (severidade.includes("grande")) return "perigo";
  return severidade.includes("potencial") ? "atencao" : "alerta";
}

export function alertasOficiaisPara(resposta, local, agora = Date.now()) {
  const porAviso = new Map();
  for (const alerta of [...(resposta?.hoje ?? []), ...(resposta?.futuro ?? [])]) {
    const fim = instanteBrasilia(alerta.fim);
    if (alerta.encerrado || !(fim > agora)) continue;
    if (!municipioNaLista(local, alerta.municipios) && !pontoNaArea(local.latitude, local.longitude, alerta.poligono)) continue;
    const anterior = porAviso.get(alerta.id_aviso);
    if (anterior && anterior.sequencia >= alerta.id_sequencia) continue;
    const inicio = instanteBrasilia(alerta.inicio);
    porAviso.set(alerta.id_aviso, {
      id: alerta.id_aviso,
      sequencia: alerta.id_sequencia,
      titulo: alerta.descricao,
      severidade: alerta.severidade,
      nivel: nivelDoAlerta(alerta),
      inicio,
      fim,
      vigente: inicio <= agora,
      riscos: (alerta.riscos ?? []).filter(Boolean),
      instrucoes: (alerta.instrucoes ?? []).filter(Boolean),
    });
  }
  return [...porAviso.values()].sort((a, b) => (Number(b.vigente) - Number(a.vigente))
    || (ORDEM_NIVEIS.indexOf(b.nivel) - ORDEM_NIVEIS.indexOf(a.nivel))
    || (a.inicio - b.inicio));
}

const diaBrasilia = (instante) => new Date(instante - DESLOCAMENTO_BRASILIA_MS).toISOString().slice(0, 10);
const horaBrasilia = (instante) => new Date(instante - DESLOCAMENTO_BRASILIA_MS).toISOString().slice(11, 16);

function nomeDoDia(instante, agora) {
  const dia = diaBrasilia(instante);
  if (dia === diaBrasilia(agora)) return "hoje";
  if (dia === diaBrasilia(agora + 24 * 60 * 60 * 1000)) return "amanhã";
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

const maiuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

export function periodoDoAlerta({ inicio, fim, vigente }, agora = Date.now()) {
  const quandoFim = `${nomeDoDia(fim, agora)} às ${horaBrasilia(fim)}`;
  if (vigente) return `Em vigor até ${quandoFim}`;
  if (diaBrasilia(inicio) === diaBrasilia(fim)) {
    return `${maiuscula(nomeDoDia(inicio, agora))}, das ${horaBrasilia(inicio)} às ${horaBrasilia(fim)}`;
  }
  return `De ${nomeDoDia(inicio, agora)} às ${horaBrasilia(inicio)} até ${quandoFim}`;
}

export function seloDosAlertas(alertas, agora = Date.now()) {
  if (!alertas?.length) return null;
  const [principal] = alertas;
  let quando = "em vigor";
  if (!principal.vigente) {
    quando = diaBrasilia(principal.inicio) === diaBrasilia(agora)
      ? `a partir das ${horaBrasilia(principal.inicio)}`
      : `a partir de ${nomeDoDia(principal.inicio, agora)}`;
  }
  return {
    nivel: principal.nivel,
    titulo: principal.titulo,
    severidade: principal.severidade,
    quando,
    outros: alertas.length - 1,
  };
}
