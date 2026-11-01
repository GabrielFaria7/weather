const CREDITO_GIBS = 'Satélite: <a href="https://www.earthdata.nasa.gov/gibs" target="_blank" rel="noopener">NOAA GOES · NASA GIBS</a>';
const CREDITO_EUMETSAT = 'Satélite: <a href="https://view.eumetsat.int/" target="_blank" rel="noopener">© EUMETSAT</a>';
const AVISO_INFRAVERMELHO = " Por serem infravermelhas, funcionam de dia e de noite, mas áreas muito frias, como montanhas "
  + "altas e neve, também podem aparecer claras.";
export const SATELITES = [
  {
    id: "GOES-West", fonte: "gibs", camada: "GOES-West_ABI_GeoColor", oeste: -180, leste: -110, quadros: 12,
    descricao: "do satélite <strong>GOES-West</strong> (NOAA, via NASA GIBS)", frequencia: "10 minutos",
    atraso: "cerca de 1 hora", brilho: [80, 210], credito: CREDITO_GIBS,
  },
  {
    id: "GOES-East", fonte: "gibs", camada: "GOES-East_ABI_GeoColor", oeste: -110, leste: -15, quadros: 12,
    descricao: "do satélite <strong>GOES-East</strong> (NOAA, via NASA GIBS)", frequencia: "10 minutos",
    atraso: "cerca de 1 hora", brilho: [80, 210], credito: CREDITO_GIBS,
  },
  {
    id: "MTG", fonte: "eumetsat", camada: "mtg_fd:ir105_hrfi", oeste: -15, leste: 60, quadros: 12,
    descricao: "infravermelhas do satélite <strong>Meteosat MTG</strong> (EUMETSAT)", frequencia: "10 minutos",
    atraso: "cerca de 30 minutos", brilho: [70, 190], credito: CREDITO_EUMETSAT, aviso: AVISO_INFRAVERMELHO,
  },
  {
    id: "Mosaico", fonte: "eumetsat", camada: "mumi:worldcloudmap_ir108", oeste: 60, leste: 180, quadros: 8,
    descricao: "infravermelhas do <strong>mosaico de satélites geoestacionários</strong> da EUMETSAT",
    frequencia: "3 horas", atraso: "menos de 1 hora", brilho: [95, 200], credito: CREDITO_EUMETSAT,
    aviso: AVISO_INFRAVERMELHO,
  },
];
const LATITUDE_MAXIMA_SATELITE = 65;
const OPACIDADE_NUVEM_DENSA = 195;
const LIMIAR_COR_QUENTE = 12;
const FAIXA_COR_QUENTE = 18;

export function satelitePara({ latitude, longitude }) {
  if (Math.abs(latitude) > LATITUDE_MAXIMA_SATELITE) return null;
  const lon = ((longitude + 540) % 360) - 180;
  return SATELITES.find((s) => lon >= s.oeste && lon < s.leste) ?? null;
}

export function deixarSoNuvens(d, [semNuvem, nuvemDensa]) {
  for (let i = 0; i < d.length; i += 4) {
    const brilho = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const quente = Math.min(1, Math.max(0, (d[i] - d[i + 2] - LIMIAR_COR_QUENTE) / FAIXA_COR_QUENTE));
    const forca = Math.min(1, Math.max(0, (brilho - semNuvem) / (nuvemDensa - semNuvem))) * (1 - quente);
    const tom = 175 + 80 * forca;
    d[i] = tom;
    d[i + 1] = tom;
    d[i + 2] = tom + (255 - tom) * 0.4;
    d[i + 3] = (d[i + 3] / 255) * forca * OPACIDADE_NUVEM_DENSA;
  }
  return d;
}
