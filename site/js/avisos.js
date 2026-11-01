const NIVEIS = ["atencao", "alerta", "perigo"];
const DIAS_ANALISADOS = 3;

function rotuloDia(indice, data) {
  if (indice === 0) return "hoje";
  if (indice === 1) return "amanhã";
  const [, mes, dia] = data.split("-");
  return `em ${dia}/${mes}`;
}

const inteiro = (valor) => Math.round(valor);

function avisosDoDia(indice, dia) {
  const quando = rotuloDia(indice, dia.data);
  const chuva = dia.chuva_mm || 0;
  const chance = dia.chance_chuva || 0;
  const rajada = dia.rajada_max || 0;
  const avisos = [];

  if (chuva >= 50) avisos.push(["chuva", "perigo", "Chuva muito intensa", `${inteiro(chuva)} mm previstos ${quando}.`]);
  else if (chuva >= 30) avisos.push(["chuva", "alerta", "Chuva intensa", `${inteiro(chuva)} mm previstos ${quando}.`]);
  else if (chuva >= 15 && chance >= 70) {
    avisos.push(["chuva", "atencao", "Chuva forte", `${inteiro(chuva)} mm e ${chance}% de chance ${quando}.`]);
  }

  if ([95, 96, 99].includes(dia.codigo)) {
    avisos.push(["tempestade", "alerta", "Tempestade", `${dia.descricao} prevista ${quando}.`]);
  }

  if (rajada >= 100) avisos.push(["vento", "perigo", "Ventos muito fortes", `Rajadas de até ${inteiro(rajada)} km/h ${quando}.`]);
  else if (rajada >= 80) avisos.push(["vento", "alerta", "Ventos fortes", `Rajadas de até ${inteiro(rajada)} km/h ${quando}.`]);
  else if (rajada >= 60) avisos.push(["vento", "atencao", "Ventania", `Rajadas de até ${inteiro(rajada)} km/h ${quando}.`]);

  if (dia.max != null && dia.max >= 38) avisos.push(["calor", "alerta", "Calor extremo", `Máxima de ${inteiro(dia.max)} °C ${quando}.`]);
  else if (dia.max != null && dia.max >= 35) avisos.push(["calor", "atencao", "Calor intenso", `Máxima de ${inteiro(dia.max)} °C ${quando}.`]);

  if (dia.min != null && dia.min <= 0) avisos.push(["frio", "alerta", "Frio extremo", `Mínima de ${inteiro(dia.min)} °C ${quando}.`]);
  else if (dia.min != null && dia.min <= 3) avisos.push(["frio", "atencao", "Frio intenso", `Mínima de ${inteiro(dia.min)} °C ${quando}.`]);

  return avisos.map(([tipo, nivel, titulo, detalhe]) => ({ tipo, nivel, titulo, detalhe, data: dia.data }));
}

export function gerarAvisos(dias) {
  return dias
    .slice(0, DIAS_ANALISADOS)
    .flatMap((dia, indice) => avisosDoDia(indice, dia))
    .sort((a, b) => NIVEIS.indexOf(b.nivel) - NIVEIS.indexOf(a.nivel));
}
