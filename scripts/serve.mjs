/**
 * Servidor estático mínimo para desenvolvimento: `npm start`.
 *
 * Existe para o projeto não precisar de nenhuma dependência nem de `npx`.
 * O app usa ES Modules, que o navegador recusa pelo protocolo file://.
 */

import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORT = Number(process.env.PORT) || 4173;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const server = createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  const decoded = decodeURIComponent(url.pathname);
  // normalize + prefixo garantem que "../" não escape da pasta do projeto.
  const target = join(ROOT, normalize(decoded).replace(/^(\.\.[/\\])+/, ""));

  if (!target.startsWith(ROOT)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  let file = target;
  try {
    if (statSync(file).isDirectory()) file = join(file, "index.html");
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Não encontrado");
    return;
  }

  response.writeHead(200, {
    "content-type": TYPES[extname(file)] || "application/octet-stream",
    // Sem cache: durante o desenvolvimento, recarregar tem que mostrar o novo.
    "cache-control": "no-store",
  });
  createReadStream(file).pipe(response);
});

server.listen(PORT, () => {
  console.log(`Controle Financeiro em http://localhost:${PORT}`);
});
