export const BIBLIOTECAS = {
  graficos: [
    {
      tipo: "script",
      url: "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.6.1/chart.umd.min.js",
      integridade: "sha384-Emf5ZVIUiarAdhkgtqK+5/Z5qIvM6QoVrS+qAVtfyZVuD5lIHrac0me485+Antp0",
    },
  ],
  mapa: [
    {
      tipo: "estilo",
      url: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
      integridade: "sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H",
    },
    {
      tipo: "script",
      url: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
      integridade: "sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH",
    },
  ],
  vento: [
    {
      tipo: "script",
      url: "https://unpkg.com/leaflet-velocity@1.9.2/dist/leaflet-velocity.min.js",
      integridade: "sha384-LtMJygfR9jrlPTx7rf4xhs89fU1QqQ9cMCQn7x6uQ7d4rWtV0WTme0Hw9Y5iK504",
    },
  ],
};

const DEPENDE_DE = { vento: "mapa" };
const carregando = new Map();

function carregarArquivo({ tipo, url, integridade }) {
  return new Promise((resolver, recusar) => {
    const elemento = document.createElement(tipo === "estilo" ? "link" : "script");
    if (tipo === "estilo") {
      elemento.rel = "stylesheet";
      elemento.href = url;
    } else {
      elemento.src = url;
      elemento.async = false;
    }
    elemento.integrity = integridade;
    elemento.crossOrigin = "anonymous";
    elemento.onload = () => resolver();
    elemento.onerror = () => {
      elemento.remove();
      recusar(new Error(`Não foi possível carregar ${url}.`));
    };
    if (tipo === "estilo") document.head.insertBefore(elemento, document.querySelector('link[rel="stylesheet"]'));
    else document.head.append(elemento);
  });
}

export function carregarBiblioteca(nome) {
  if (!carregando.has(nome)) {
    const antes = DEPENDE_DE[nome] ? carregarBiblioteca(DEPENDE_DE[nome]) : Promise.resolve();
    const promessa = antes
      .then(() => Promise.all(BIBLIOTECAS[nome].map(carregarArquivo)))
      .then(() => undefined)
      .catch((erro) => {
        carregando.delete(nome);
        throw erro;
      });
    carregando.set(nome, promessa);
  }
  return carregando.get(nome);
}
