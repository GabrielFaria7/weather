export function quadroVento({ grade, horas, pontos }, indice) {
  const u = [];
  const v = [];
  pontos.forEach((ponto) => {
    const ms = (ponto.velocidade[indice] ?? 0) / 3.6;
    const radianos = ((ponto.direcao[indice] ?? 0) * Math.PI) / 180;
    u.push(-ms * Math.sin(radianos));
    v.push(-ms * Math.cos(radianos));
  });
  const cabecalho = {
    parameterCategory: 2,
    lo1: grade.oeste,
    la1: grade.norte,
    lo2: grade.oeste + (grade.colunas - 1) * grade.passo,
    la2: grade.norte - (grade.linhas - 1) * grade.passo,
    dx: grade.passo,
    dy: grade.passo,
    nx: grade.colunas,
    ny: grade.linhas,
    refTime: new Date(horas[indice] * 1000).toISOString(),
    forecastTime: 0,
  };
  return [
    { header: { ...cabecalho, parameterNumber: 2 }, data: u },
    { header: { ...cabecalho, parameterNumber: 3 }, data: v },
  ];
}

export function indiceNaGrade(grade, latitude, longitude) {
  const linha = Math.round((grade.norte - latitude) / grade.passo);
  const coluna = Math.round((((longitude - grade.oeste) % 360) + 360) % 360 / grade.passo);
  if (linha < 0 || linha >= grade.linhas || coluna < 0 || coluna >= grade.colunas) return -1;
  return linha * grade.colunas + coluna;
}
