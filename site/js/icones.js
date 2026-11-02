const UI = {
  busca: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  localizacao: '<path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  lua: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  config: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  estrela: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>',
  fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
  gota: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  vento: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7"/>',
  termometro: '<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z"/>',
  olho: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  medidor: '<path d="M12 14l4-4"/><path d="M3.3 19a10 10 0 1 1 17.4 0"/>',
  nascer: '<path d="M12 2v6M8.5 5.5 12 2l3.5 3.5M4.9 10.9l1.4 1.4M2 18h2M20 18h2M17.7 12.3l1.4-1.4M22 22H2M16 18a4 4 0 0 0-8 0"/>',
  por: '<path d="M12 2v6M8.5 4.5 12 8l3.5-3.5M4.9 10.9l1.4 1.4M2 18h2M20 18h2M17.7 12.3l1.4-1.4M22 22H2M16 18a4 4 0 0 0-8 0"/>',
  folha: '<path d="M11 20A7 7 0 0 1 4 13c0-6 5-9 16-9 0 11-3 16-9 16z"/><path d="M4 20c3-4 6-7 11-10"/>',
  alerta: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  escudo: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  esquerda: '<path d="m15 18-6-6 6-6"/>',
  direita: '<path d="m9 18 6-6-6-6"/>',
  guardaChuva: '<path d="M22 12a10 10 0 0 0-20 0z"/><path d="M12 12v7a2 2 0 0 0 4 0"/>',
  mapa: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
  recarregar: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  compartilhar: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>',
  pino: '<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  nuvem: '<path d="M17.5 19H7a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 11a4 4 0 0 1-2 8z"/>',
  semSinal: '<path d="M2 2l20 20M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2-1.5M2 8.8a15 15 0 0 1 4.2-2.7M22 8.8A15 15 0 0 0 10.7 5M12 20h.01"/>',
  seta: '<path d="M12 3v18M5 10l7-7 7 7"/>',
  reproduzir: '<path d="M7 4v16l13-8z"/>',
  pausar: '<path d="M8 5v14M16 5v14"/>',
};

export function iconeUI(nome, classe = "") {
  return `<svg class="ui-icone ${classe}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${UI[nome] ?? ""}</svg>`;
}

export function preencherIcones(raiz = document) {
  raiz.querySelectorAll("[data-icone]").forEach((el) => { el.innerHTML = iconeUI(el.dataset.icone); });
}

const NUVEM = "M20 48a10 10 0 0 1 0-20 13 13 0 0 1 25-3 10 10 0 0 1 1 23z";

const partes = {
  sol: (cx = 32, cy = 32, r = 11) => `
    <g class="ic-raios" style="transform-origin:${cx}px ${cy}px">
      ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<line x1="${cx}" y1="${cy - r - 5}" x2="${cx}" y2="${cy - r - 10}"
        transform="rotate(${a} ${cx} ${cy})"/>`).join("")}
    </g>
    <circle class="ic-sol" cx="${cx}" cy="${cy}" r="${r}"/>`,
  lua: (dx = 0, dy = 0) => `<path class="ic-lua" transform="translate(${dx} ${dy})" d="M38 12a16 16 0 1 0 14 24 13 13 0 0 1-14-24z"/>`,
  nuvem: (dy = 0, classe = "ic-nuvem") => `<path class="${classe} ic-flutua" transform="translate(0 ${dy})" d="${NUVEM}"/>`,
  gotas: (qtd = 3) => [24, 32, 40].slice(0, qtd).map((x, i) =>
    `<line class="ic-gota" style="animation-delay:${i * 0.3}s" x1="${x}" y1="47" x2="${x - 2}" y2="54"/>`).join(""),
  flocos: () => [24, 32, 40].map((x, i) =>
    `<circle class="ic-floco" style="animation-delay:${i * 0.5}s" cx="${x}" cy="50" r="2.2"/>`).join(""),
  raio: () => '<path class="ic-raio" d="M34 40 27 51h5l-3 10 10-14h-5l3-7z"/>',
  nevoa: () => '<g class="ic-nevoa"><line x1="14" y1="48" x2="50" y2="48"/><line x1="18" y1="54" x2="46" y2="54"/></g>',
};

export function tipoClima(codigo) {
  if (codigo === 0) return "limpo";
  if (codigo === 1 || codigo === 2) return "parcial";
  if (codigo === 3) return "nublado";
  if (codigo === 45 || codigo === 48) return "nevoa";
  if ([51, 53, 55, 56, 57].includes(codigo)) return "garoa";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(codigo)) return "chuva";
  if ([71, 73, 75, 77, 85, 86].includes(codigo)) return "neve";
  if ([95, 96, 99].includes(codigo)) return "tempestade";
  return "nublado";
}

export function iconeClima(codigo, dia = true, { tamanho = 40, animado = false, rotulo = "" } = {}) {
  const tipo = tipoClima(codigo);
  let corpo;
  switch (tipo) {
    case "limpo": corpo = dia ? partes.sol() : partes.lua(-4, 2); break;
    case "parcial": corpo = (dia ? partes.sol(24, 24, 9) : partes.lua(-10, -6)) + partes.nuvem(6); break;
    case "nublado": corpo = partes.nuvem(-6, "ic-nuvem-fundo") + partes.nuvem(4); break;
    case "nevoa": corpo = partes.nuvem(-8) + partes.nevoa(); break;
    case "garoa": corpo = partes.nuvem(-8) + partes.gotas(2); break;
    case "chuva": corpo = partes.nuvem(-8, "ic-nuvem-escura") + partes.gotas(3); break;
    case "neve": corpo = partes.nuvem(-8) + partes.flocos(); break;
    case "tempestade": corpo = partes.nuvem(-10, "ic-nuvem-escura") + partes.raio(); break;
  }
  const acessivel = rotulo ? `role="img" aria-label="${rotulo}"` : 'aria-hidden="true"';
  return `<svg class="clima-icone ${animado ? "animado" : ""}" width="${tamanho}" height="${tamanho}"
    viewBox="0 0 64 64" ${acessivel}>${corpo}</svg>`;
}

export function classeFundo(codigo, dia) {
  const tipo = tipoClima(codigo);
  if (!dia && (tipo === "limpo" || tipo === "parcial")) return "fundo-noite";
  return {
    limpo: "fundo-sol", parcial: "fundo-sol", nublado: "fundo-nublado", nevoa: "fundo-nublado",
    garoa: "fundo-chuva", chuva: "fundo-chuva", neve: "fundo-neve", tempestade: "fundo-tempestade",
  }[tipo];
}
