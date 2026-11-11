/**
 * Service worker: deixa o app abrir sem internet.
 *
 * Estratégia por tipo de pedido:
 * - navegação (abrir o app): rede primeiro, cache como rede de segurança;
 *   assim uma versão nova chega assim que estiver online.
 * - demais arquivos: cache primeiro, atualizando em segundo plano.
 *
 * Os dados do usuário NÃO passam por aqui — ficam no localStorage.
 */

const VERSION = "v3.0.0";
const CACHE = `controle-financeiro-${VERSION}`;

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/css/styles.css",
  "./src/main.js",
  "./src/core/store.js",
  "./src/domain/money.js",
  "./src/domain/dates.js",
  "./src/domain/transactions.js",
  "./src/domain/stats.js",
  "./src/domain/budgets.js",
  "./src/domain/goals.js",
  "./src/domain/export.js",
  "./src/ui/dom.js",
  "./src/ui/feedback.js",
  "./src/ui/charts.js",
  "./src/ui/transaction-form.js",
  "./src/ui/views/dashboard.js",
  "./src/ui/views/transactions.js",
  "./src/ui/views/budgets.js",
  "./src/ui/views/goals.js",
  "./src/ui/views/reports.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // addAll falha inteiro se um arquivo falhar; aqui cada um é opcional.
      .then((cache) =>
        Promise.all(ASSETS.map((url) => cache.add(url).catch(() => null)))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});
