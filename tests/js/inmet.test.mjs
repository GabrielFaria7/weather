import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  cidadesProximas, codigoDoResumo, combinarComObservacao, distanciaKm, fonteDoAgora, escolherMunicipio, instanteDaMedicao,
  lerObservacao, lerPrevisaoInmet, nomeDaEstacao, nomeEspecifico, textoDoVento,
} from "../../site/js/inmet.js";

const ler = (nome) => JSON.parse(readFileSync(new URL(`dados/${nome}`, import.meta.url), "utf8"));
const ESTACAO_CURITIBA = ler("inmet-estacao-curitiba-2026-11-04.json");
const ESTACAO_RIO = ler("inmet-estacao-rio-2026-11-04.json");
const ESTACAO_BARCELOS = ler("inmet-estacao-barcelos-2026-11-04.json");
const AUTOCOMPLETE = ler("inmet-autocomplete-curitiba.json");
const PREVISAO = ler("inmet-previsao-curitiba-2026-11-04.json");

const CURITIBA = { nome: "Curitiba", estado: "Paraná", pais: "Brasil", latitude: -25.42778, longitude: -49.27306 };
const RIO = { nome: "Rio de Janeiro", estado: "Rio de Janeiro", pais: "Brasil", latitude: -22.90642, longitude: -43.18223 };
const AS_8H45_DE_BRASILIA = Date.parse("2026-11-04T11:45:00Z");

const ATUAL_COM_GAROA = {
  horario: "2026-11-04T08:45", temperatura: 18.1, sensacao: 17.5, umidade: 97, ponto_orvalho: 17.6, vento: 6.1,
  direcao_vento: 40, rajada: 13, codigo: 53, descricao: "Garoa moderada", dia: true, pressao: 1016, visibilidade: 5000,
  uv: 1, precipitacao: 0.2,
};

test("distância entre dois pontos", () => {
  assert.equal(Math.round(distanciaKm(CURITIBA, { latitude: -25.4486111, longitude: -49.23055554 })), 5);
  assert.equal(distanciaKm(RIO, RIO), 0);
});

test("acha o código IBGE pelo nome e pelo estado", () => {
  assert.deepEqual(escolherMunicipio(AUTOCOMPLETE, CURITIBA), {
    geocode: "4106902", nome: "Curitiba", uf: "PR", latitude: -25.47713976061419, longitude: -49.287871877973544,
  });
  const outro = escolherMunicipio(AUTOCOMPLETE, { ...CURITIBA, nome: "Curitibanos", estado: "Santa Catarina", latitude: -27.28, longitude: -50.58 });
  assert.equal(outro.geocode, "4204806");
});

test("sem nome igual, usa o município mais perto se estiver a até 40 km", () => {
  const gps = { nome: "Sua localização", estado: "", pais: "", latitude: -25.5, longitude: -49.3 };
  assert.equal(escolherMunicipio(AUTOCOMPLETE, gps).geocode, "4106902");
  assert.equal(escolherMunicipio(AUTOCOMPLETE, { ...gps, latitude: -24.5 }), null);
  assert.equal(escolherMunicipio([], CURITIBA), null);
  assert.equal(escolherMunicipio({ erro: true }, CURITIBA), null);
});

test("nomes genéricos não servem para procurar o município", () => {
  assert.equal(nomeEspecifico({ nome: "Sua localização" }), false);
  assert.equal(nomeEspecifico({ nome: "Local compartilhado" }), false);
  assert.equal(nomeEspecifico({ nome: "Londrina" }), true);
});

test("cidades da região: as mais próximas e depois as maiores", () => {
  const cidades = [
    { nome: "Rio de Janeiro", latitude: -22.906, longitude: -43.182, populacao: 6748000 },
    { nome: "Niterói", latitude: -22.883, longitude: -43.104, populacao: 515000 },
    { nome: "Ipanema", latitude: -22.984, longitude: -43.203, populacao: 37000 },
    { nome: "Leblon", latitude: -22.984, longitude: -43.223, populacao: 38000 },
    { nome: "Botafogo", latitude: -22.951, longitude: -43.182, populacao: 83000 },
    { nome: "Petrópolis", latitude: -22.505, longitude: -43.178, populacao: 296000 },
  ];
  const copacabana = { latitude: -22.9711, longitude: -43.1822 };
  assert.deepEqual(cidadesProximas(cidades, copacabana).map((c) => c.nome), ["Botafogo", "Ipanema", "Rio de Janeiro", "Niterói"]);
  assert.deepEqual(cidadesProximas(cidades, { latitude: -22.906, longitude: -43.182 }).map((c) => c.nome), ["Rio de Janeiro", "Botafogo", "Niterói"]);
  assert.deepEqual(cidadesProximas(cidades, { latitude: -20, longitude: -49.2 }), []);
});

test("nome da estação com letras minúsculas", () => {
  assert.equal(nomeDaEstacao("RIO DE JANEIRO - JACAREPAGUÁ"), "Rio de Janeiro - Jacarepaguá");
  assert.equal(nomeDaEstacao("CURITIBA"), "Curitiba");
  assert.equal(nomeDaEstacao("SAO PAULO - INTERLAGOS"), "Sao Paulo - Interlagos");
});

test("horário da medição vem em UTC", () => {
  assert.equal(instanteDaMedicao("2026-11-04", "1100"), Date.parse("2026-11-04T11:00:00Z"));
  assert.equal(instanteDaMedicao("2026-11-04", "0"), Date.parse("2026-11-04T00:00:00Z"));
  assert.ok(Number.isNaN(instanteDaMedicao("04/11/2026", "1100")));
});

test("lê a observação real da estação de Curitiba", () => {
  const observacao = lerObservacao(ESTACAO_CURITIBA, CURITIBA, AS_8H45_DE_BRASILIA);
  assert.deepEqual({ ...observacao, vento: +observacao.vento.toFixed(2), rajada: +observacao.rajada.toFixed(2) }, {
    codigo: "A807", nome: "Curitiba", distancia_km: 5, instante: Date.parse("2026-11-04T11:00:00Z"),
    temperatura: 19.2, sensacao: 20.8, umidade: 92, ponto_orvalho: 17.8, chuva_mm: 0,
    vento: 3.24, rajada: 14.76, direcao_vento: 57,
  });
});

test("estação longe demais ou medição velha não é usada", () => {
  const barcelos = { nome: "Barcelos", estado: "Amazonas", pais: "Brasil", latitude: -0.9748, longitude: -62.9243 };
  assert.ok(lerObservacao(ESTACAO_BARCELOS, barcelos, AS_8H45_DE_BRASILIA));
  assert.equal(lerObservacao(ESTACAO_BARCELOS, { ...barcelos, latitude: -0.4653, longitude: -63.435 }, AS_8H45_DE_BRASILIA), null);
  assert.equal(lerObservacao(ESTACAO_CURITIBA, CURITIBA, Date.parse("2026-11-04T14:30:00Z")), null);
  assert.equal(lerObservacao(ESTACAO_CURITIBA, CURITIBA, Date.parse("2026-11-04T10:00:00Z")), null);
  assert.equal(lerObservacao({}, CURITIBA), null);
  assert.equal(lerObservacao(null, CURITIBA), null);
});

test("sensor sem dado fica nulo, sem inventar valor", () => {
  const barcelos = { latitude: -0.9748, longitude: -62.9243 };
  const observacao = lerObservacao(ESTACAO_BARCELOS, barcelos, AS_8H45_DE_BRASILIA);
  assert.equal(observacao.chuva_mm, null);
  assert.equal(observacao.direcao_vento, null);
  const combinado = combinarComObservacao(ATUAL_COM_GAROA, observacao);
  assert.equal(combinado.codigo, 53);
  assert.equal(combinado.direcao_vento, 40);
  assert.equal(combinado.temperatura, 25);
});

test("estação sem chuva tira a garoa que o modelo inventou", () => {
  const observacao = lerObservacao(ESTACAO_CURITIBA, CURITIBA, AS_8H45_DE_BRASILIA);
  const combinado = combinarComObservacao(ATUAL_COM_GAROA, observacao);
  assert.equal(combinado.codigo, 3);
  assert.equal(combinado.descricao, "Nublado");
  assert.equal(combinado.temperatura, 19.2);
  assert.equal(combinado.umidade, 92);
  assert.equal(combinado.precipitacao, 0);
  assert.equal(combinado.pressao, 1016);
  assert.equal(combinado.dia, true);
});

test("estação com chuva medida e modelo sem chuva", () => {
  const base = lerObservacao(ESTACAO_RIO, RIO, AS_8H45_DE_BRASILIA);
  const limpo = { ...ATUAL_COM_GAROA, codigo: 1, descricao: "Predominantemente limpo" };
  assert.equal(combinarComObservacao(limpo, base).codigo, 1);
  assert.equal(combinarComObservacao(limpo, { ...base, chuva_mm: 0.4 }).descricao, "Chuva leve");
  assert.equal(combinarComObservacao(limpo, { ...base, chuva_mm: 3 }).codigo, 63);
  assert.equal(combinarComObservacao(limpo, { ...base, chuva_mm: 12 }).codigo, 65);
  assert.equal(combinarComObservacao({ ...limpo, codigo: 95 }, { ...base, chuva_mm: 3 }).codigo, 95);
  assert.equal(combinarComObservacao({ ...limpo, codigo: 95 }, base).codigo, 95);
  assert.equal(combinarComObservacao(limpo, null), limpo);
});

test("código do ícone a partir do texto do INMET", () => {
  assert.equal(codigoDoResumo("Muitas nuvens com pancadas de chuva e trovoadas"), 95);
  assert.equal(codigoDoResumo("Encoberto com chuvisco"), 51);
  assert.equal(codigoDoResumo("Encoberto com pancadas de chuva isoladas"), 80);
  assert.equal(codigoDoResumo("Muitas nuvens com possibilidade de chuva isolada"), 80);
  assert.equal(codigoDoResumo("Nublado com chuva"), 61);
  assert.equal(codigoDoResumo("Encoberto"), 3);
  assert.equal(codigoDoResumo("Parcialmente nublado"), 2);
  assert.equal(codigoDoResumo("Muitas nuvens"), 2);
  assert.equal(codigoDoResumo("Poucas nuvens"), 1);
  assert.equal(codigoDoResumo("Céu claro"), 0);
  assert.equal(codigoDoResumo("Nevoeiro"), 45);
  assert.equal(codigoDoResumo(""), null);
});

test("vento do INMET em português", () => {
  assert.equal(textoDoVento("Fracos", "NW-N"), "Vento fraco, NO-N");
  assert.equal(textoDoVento("Fraco/Moderado", "SW-E"), "Vento fraco a moderado, SO-L");
  assert.equal(textoDoVento("Moderados", ""), "Vento moderado");
  assert.equal(textoDoVento("", ""), "");
});

test("lê a previsão oficial real de Curitiba", () => {
  const previsao = lerPrevisaoInmet(PREVISAO, "4106902", "2026-11-04");
  assert.equal(previsao.municipio, "Curitiba (PR)");
  assert.deepEqual(previsao.dias.map((d) => d.data), ["2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
  const [hoje, amanha, sexta] = previsao.dias;
  assert.deepEqual([hoje.max, hoje.min, hoje.umidade_min, hoje.umidade_max], [28, 18, 60, 100]);
  assert.deepEqual(hoje.periodos.map((p) => p.nome), ["Manhã", "Tarde", "Noite"]);
  assert.deepEqual(hoje.periodos[0], {
    nome: "Manhã", resumo: "Muitas nuvens com pancadas de chuva e trovoadas", codigo: 95, noite: false, vento: "Vento fraco, NO-N",
  });
  assert.equal(hoje.periodos[2].noite, true);
  assert.equal(amanha.periodos[1].resumo, "Encoberto com chuvisco");
  assert.deepEqual(sexta.periodos.map((p) => p.nome), ["Dia"]);
  assert.equal(sexta.periodos[0].codigo, 80);
  assert.deepEqual([sexta.max, sexta.min], [20, 15]);
});

test("previsão oficial deixa de fora os dias que já passaram", () => {
  const previsao = lerPrevisaoInmet(PREVISAO, "4106902", "2026-11-06", 2);
  assert.deepEqual(previsao.dias.map((d) => d.data), ["2026-11-06", "2026-11-07"]);
  assert.equal(lerPrevisaoInmet(PREVISAO, "4106902", "2026-12-01"), null);
  assert.equal(lerPrevisaoInmet(PREVISAO, "3304557", "2026-11-04"), null);
  assert.equal(lerPrevisaoInmet(null, "4106902"), null);
});

test("de onde vem o tempo de agora", () => {
  const estacao = lerObservacao(ESTACAO_CURITIBA, CURITIBA, AS_8H45_DE_BRASILIA);
  assert.equal(fonteDoAgora({ estacao, deslocamento: -10800 }), "Medido às 08:00 na estação Curitiba do INMET, a 5 km");
  assert.equal(fonteDoAgora({ estacao: { ...estacao, distancia_km: 0 }, deslocamento: -10800 }, "12"),
    "Medido às 8 AM na estação Curitiba do INMET, a menos de 1 km");
  assert.equal(fonteDoAgora({ pendente: true, local: CURITIBA }), "Consultando a estação do INMET mais próxima…");
  assert.equal(fonteDoAgora({ pendente: true, local: { latitude: 38.7, longitude: -9.1 } }), "Agora: estimativa do modelo da Open-Meteo");
  assert.equal(fonteDoAgora({ estacao: null, local: CURITIBA }), "Agora: estimativa do modelo da Open-Meteo");
});
