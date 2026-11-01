export function esc(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

export function converterTemperatura(celsius, unidade) {
  if (celsius == null) return null;
  return unidade === "F" ? celsius * 9 / 5 + 32 : celsius;
}

export function temperatura(celsius, unidade) {
  const valor = converterTemperatura(celsius, unidade);
  return valor == null ? "—" : `${Math.round(valor)}°`;
}

const VENTO = {
  kmh: { fator: 1, sufixo: "km/h", casas: 0 },
  ms: { fator: 1 / 3.6, sufixo: "m/s", casas: 1 },
  mph: { fator: 1 / 1.609, sufixo: "mph", casas: 0 },
};

export function vento(kmh, unidade = "kmh") {
  if (kmh == null) return "—";
  const u = VENTO[unidade] ?? VENTO.kmh;
  return `${(kmh * u.fator).toFixed(u.casas)} ${u.sufixo}`;
}

const DIRECOES = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];
const DIRECOES_LONGAS = ["norte", "nordeste", "leste", "sudeste", "sul", "sudoeste", "oeste", "noroeste"];

export function direcao(graus, longa = false) {
  if (graus == null) return "";
  const i = Math.round(graus / 45) % 8;
  return longa ? DIRECOES_LONGAS[i] : DIRECOES[i];
}

export function porcentagem(valor) {
  return valor == null ? "—" : `${Math.round(valor)}%`;
}

export function hora(iso, formato = "24") {
  const [h, m] = iso.slice(11, 16).split(":").map(Number);
  if (formato === "12") return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""} ${h < 12 ? "AM" : "PM"}`;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function minutosDoDia(iso) {
  const [h, m] = iso.slice(11, 16).split(":").map(Number);
  return h * 60 + m;
}

function dataUTC(dataIso) {
  const [a, m, d] = dataIso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

const capitalizar = (t) => t.charAt(0).toUpperCase() + t.slice(1);

export function diaSemana(dataIso, estilo = "short") {
  const nome = dataUTC(dataIso).toLocaleDateString("pt-BR", { weekday: estilo, timeZone: "UTC" });
  return capitalizar(nome.replace(".", ""));
}

export function dataCurta(dataIso) {
  return dataUTC(dataIso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

export function dataLonga(dataIso) {
  return dataUTC(dataIso).toLocaleDateString("pt-BR", { day: "numeric", month: "long", timeZone: "UTC" });
}

export function agoraNaCidade(fuso, formato = "24") {
  const agora = new Date();
  try {
    const data = agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: fuso });
    const horario = agora.toLocaleTimeString("pt-BR", {
      hour: "numeric", minute: "2-digit", hour12: formato === "12", timeZone: fuso,
    });
    return `${capitalizar(data)} · ${horario}`;
  } catch {
    return "";
  }
}

export function minutosAgoraNaCidade(fuso) {
  try {
    const partes = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: fuso,
    }).formatToParts(new Date());
    const valor = (tipo) => Number(partes.find((p) => p.type === tipo).value);
    return valor("hour") * 60 + valor("minute");
  } catch {
    return null;
  }
}

export function horaNaCidade(data, fuso, formato = "24") {
  try {
    const horario = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: fuso,
    }).format(data);
    return hora(`0000-00-00T${horario}`, formato);
  } catch {
    return "—";
  }
}

export function dataHoraLocal(instante) {
  const data = new Date(instante);
  const dia = data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const horario = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dia} às ${horario}`;
}

export function duracao(minutos) {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}min`;
}

export function nomeCompleto(local) {
  return [local.estado, local.pais].filter(Boolean).join(", ");
}
