import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PASTA_DO_SITE = fileURLToPath(new URL("../../site/", import.meta.url));
const PREFIXO = "/weather/";
const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

async function arquivoDoPedido(caminho) {
  let arquivo = normalize(join(PASTA_DO_SITE, caminho.slice(PREFIXO.length)));
  if (!arquivo.startsWith(PASTA_DO_SITE.replace(/[\\/]$/, "") + sep) && arquivo !== PASTA_DO_SITE) return null;
  try {
    if ((await stat(arquivo)).isDirectory()) arquivo = join(arquivo, "index.html");
    await stat(arquivo);
    return arquivo;
  } catch {
    return null;
  }
}

export function iniciarServidor() {
  const servidor = createServer(async (pedido, resposta) => {
    const caminho = decodeURIComponent(new URL(pedido.url, "http://localhost").pathname);
    if (!caminho.startsWith(PREFIXO)) {
      resposta.writeHead(302, { location: PREFIXO }).end();
      return;
    }
    const arquivo = await arquivoDoPedido(caminho);
    if (!arquivo) {
      resposta.writeHead(404).end();
      return;
    }
    resposta.writeHead(200, { "content-type": TIPOS[extname(arquivo)] ?? "application/octet-stream" });
    createReadStream(arquivo).pipe(resposta);
  });
  return new Promise((resolver) => {
    servidor.listen(0, "127.0.0.1", () => resolver({
      endereco: `http://127.0.0.1:${servidor.address().port}${PREFIXO}`,
      fechar: () => new Promise((fechado) => servidor.close(fechado)),
    }));
  });
}
