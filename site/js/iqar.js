export const CATEGORIAS_IQAR = [
  {
    codigo: "N1", nome: "Boa", minimo: 0, maximo: 40,
    efeito: "Ar dentro do padrão de qualidade. Bom momento para atividades ao ar livre.",
  },
  {
    codigo: "N2", nome: "Moderada", minimo: 41, maximo: 80,
    efeito: "Pessoas de grupos sensíveis (crianças, idosos e pessoas com doenças respiratórias e cardíacas) "
      + "podem apresentar sintomas como tosse seca e cansaço. A população em geral não é afetada.",
  },
  {
    codigo: "N3", nome: "Ruim", minimo: 81, maximo: 120,
    efeito: "Toda a população pode apresentar sintomas como tosse seca, cansaço, ardor nos olhos, nariz e garganta. "
      + "Grupos sensíveis podem apresentar efeitos mais sérios na saúde.",
  },
  {
    codigo: "N4", nome: "Muito Ruim", minimo: 121, maximo: 200,
    efeito: "Toda a população pode apresentar agravamento dos sintomas, falta de ar e respiração ofegante. "
      + "Efeitos ainda mais graves à saúde de grupos sensíveis.",
  },
  {
    codigo: "N5", nome: "Péssima", minimo: 201, maximo: 400,
    efeito: "Toda a população pode apresentar sérios riscos de doenças respiratórias e cardiovasculares. "
      + "Aumento de mortes prematuras em pessoas de grupos sensíveis.",
  },
];

export const POLUENTES_IQAR = {
  pm10: { nome: "MP10", limites: [45, 100, 150, 250, 600], casas: 0, horas: 24 },
  pm2_5: { nome: "MP2,5", limites: [15, 50, 75, 125, 300], casas: 0, horas: 24 },
  ozonio: { nome: "O₃", limites: [100, 130, 160, 200, 800], casas: 0, horas: 8 },
  monoxido_carbono: { nome: "CO", limites: [9, 11, 13, 15, 50], casas: 1, horas: 8 },
  dioxido_nitrogenio: { nome: "NO₂", limites: [200, 240, 320, 1130, 3750], casas: 0, horas: 1 },
  dioxido_enxofre: { nome: "SO₂", limites: [40, 50, 125, 800, 2620], casas: 0, horas: 24 },
};

const CAMPOS_OPEN_METEO = {
  pm10: "pm10", pm2_5: "pm2_5", ozonio: "ozone", monoxido_carbono: "carbon_monoxide",
  dioxido_nitrogenio: "nitrogen_dioxide", dioxido_enxofre: "sulphur_dioxide",
};
const UG_M3_POR_PPM_CO = (28.01 * 1000) / 24.45;
const PROPORCAO_MINIMA_DE_DADOS = 0.75;

export function arredondarPar(valor, casas = 0) {
  const fator = 10 ** casas;
  const escalado = Number((valor * fator).toFixed(8));
  const inteiro = Math.floor(escalado);
  const resto = escalado - inteiro;
  const arredondado = Math.abs(resto - 0.5) < 1e-9 ? (inteiro % 2 === 0 ? inteiro : inteiro + 1) : Math.round(escalado);
  return arredondado / fator;
}

export function indicePoluente(poluente, concentracao) {
  const regra = POLUENTES_IQAR[poluente];
  if (!regra || concentracao == null || !Number.isFinite(concentracao) || concentracao < 0) return null;
  const passo = 10 ** -regra.casas;
  const c = arredondarPar(concentracao, regra.casas);
  for (let faixa = 0; faixa < regra.limites.length; faixa++) {
    const cFinal = regra.limites[faixa];
    if (c > cFinal) continue;
    const cInicial = faixa === 0 ? 0 : arredondarPar(regra.limites[faixa - 1] + passo, regra.casas);
    const { minimo, maximo } = CATEGORIAS_IQAR[faixa];
    return arredondarPar(minimo + ((maximo - minimo) / (cFinal - cInicial)) * (c - cInicial));
  }
  return CATEGORIAS_IQAR.at(-1).maximo;
}

export function categoriaIqar(indice) {
  if (indice == null) return null;
  return CATEGORIAS_IQAR.find((c) => indice <= c.maximo) ?? CATEGORIAS_IQAR.at(-1);
}

export function calcularIqar(concentracoes) {
  const porPoluente = {};
  for (const poluente of Object.keys(POLUENTES_IQAR)) {
    const indice = indicePoluente(poluente, concentracoes?.[poluente]);
    if (indice != null) porPoluente[poluente] = indice;
  }
  const calculados = Object.entries(porPoluente);
  if (!calculados.length) return null;
  const [principal, indice] = calculados.reduce((maior, atual) => (atual[1] > maior[1] ? atual : maior));
  const categoria = categoriaIqar(indice);
  return {
    indice,
    nivel: categoria.nome,
    codigo: categoria.codigo,
    efeito: categoria.efeito,
    poluente: principal,
    nomePoluente: POLUENTES_IQAR[principal].nome,
    porPoluente,
    concentracoes: Object.fromEntries(Object.keys(porPoluente).map((p) => [p, concentracoes[p]])),
  };
}

function horaAtual(horarios, atual) {
  if (!Array.isArray(horarios) || !horarios.length) return -1;
  if (!atual) return horarios.length - 1;
  let indice = -1;
  horarios.forEach((h, i) => { if (h <= atual) indice = i; });
  return indice;
}

function media(valores, horas) {
  const validos = valores.filter((v) => v != null && Number.isFinite(v));
  if (validos.length < Math.ceil(horas * PROPORCAO_MINIMA_DE_DADOS)) return null;
  return validos.reduce((soma, v) => soma + v, 0) / validos.length;
}

export function concentracoesIqar(horario, horarioAtual) {
  const i = horaAtual(horario?.time, horarioAtual);
  if (i < 0) return null;
  const concentracoes = {};
  for (const [poluente, regra] of Object.entries(POLUENTES_IQAR)) {
    const serie = horario[CAMPOS_OPEN_METEO[poluente]];
    if (!Array.isArray(serie)) continue;
    const janela = serie.slice(Math.max(0, i - regra.horas + 1), i + 1);
    let valor = regra.horas === 1 ? janela.at(-1) ?? null : media(janela, regra.horas);
    if (valor != null && poluente === "monoxido_carbono") valor /= UG_M3_POR_PPM_CO;
    if (valor != null) concentracoes[poluente] = valor;
  }
  return concentracoes;
}

export function posicaoNaEscala(indice) {
  if (indice == null) return 0;
  const faixa = CATEGORIAS_IQAR.indexOf(categoriaIqar(indice));
  const { minimo, maximo } = CATEGORIAS_IQAR[faixa];
  const dentro = Math.min(1, Math.max(0, (indice - minimo) / (maximo - minimo)));
  return ((faixa + dentro) / CATEGORIAS_IQAR.length) * 100;
}
