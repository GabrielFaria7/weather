const TAMANHO_DO_BLOCO = 10;
const MAXIMO_DE_BLOCOS = 40;
const FOLGA_PX = 6;

const base = (valor) => Math.floor(valor / TAMANHO_DO_BLOCO) * TAMANHO_DO_BLOCO;
const normalizarLongitude = (longitude) => ((((longitude + 180) % 360) + 360) % 360) - 180;

export function blocosDaArea({ sul, oeste, norte, leste }) {
  const chaves = new Set();
  const primeiraLatitude = base(Math.max(-90, sul));
  const ultimaLatitude = base(Math.min(89.999, norte));
  const ultimaLongitude = Math.min(base(leste), base(oeste) + 350);
  for (let latitude = primeiraLatitude; latitude <= ultimaLatitude; latitude += TAMANHO_DO_BLOCO) {
    for (let longitude = base(oeste); longitude <= ultimaLongitude; longitude += TAMANHO_DO_BLOCO) {
      chaves.add(`${latitude}_${base(normalizarLongitude(longitude))}`);
      if (chaves.size >= MAXIMO_DE_BLOCOS) return [...chaves];
    }
  }
  return [...chaves];
}

export const cidadeDoBloco = ([nome, latitude, longitude, populacaoMil, altitude]) =>
  ({ nome, latitude, longitude, populacao: populacaoMil * 1000, altitude });

const sobrepoe = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

export function escolherRotulos(candidatos, { largura, altura, maximo = 24, reservados = [] }) {
  const ocupados = [...reservados];
  const escolhidos = [];
  const gruposColocados = new Set();
  const ordenados = [...candidatos].sort((a, b) => b.prioridade - a.prioridade);
  for (const rotulo of ordenados) {
    if (rotulo.grupo && gruposColocados.has(rotulo.grupo)) continue;
    const caixa = {
      x0: rotulo.x - rotulo.largura / 2 - FOLGA_PX,
      x1: rotulo.x + rotulo.largura / 2 + FOLGA_PX,
      y0: rotulo.y - rotulo.altura / 2 - FOLGA_PX,
      y1: rotulo.y + rotulo.altura / 2 + FOLGA_PX,
    };
    const dentro = caixa.x0 >= 0 && caixa.y0 >= 0 && caixa.x1 <= largura && caixa.y1 <= altura;
    if (!dentro || ocupados.some((ocupado) => sobrepoe(ocupado, caixa))) continue;
    ocupados.push(caixa);
    escolhidos.push(rotulo);
    if (rotulo.grupo) gruposColocados.add(rotulo.grupo);
    if (escolhidos.length >= maximo) break;
  }
  return escolhidos;
}
