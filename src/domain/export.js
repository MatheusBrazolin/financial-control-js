/** Serialização de dados para CSV e JSON. Funções puras. */

import { formatDate } from "./dates.js";

const COLUMNS = [
  ["Data", (t) => formatDate(t.date)],
  ["Descrição", (t) => t.description],
  ["Categoria", (t) => t.category],
  ["Tipo", (t) => (t.type === "income" ? "Entrada" : "Saída")],
  ["Valor", (t) => (t.amount / 100).toFixed(2).replace(".", ",")],
  ["Etiquetas", (t) => (t.tags || []).join(", ")],
  ["Observação", (t) => t.note || ""],
  ["Recorrente", (t) => (t.recurring || t.seriesId ? "Sim" : "Não")],
];

/** Escapa um campo conforme o RFC 4180. */
export function escapeCsv(value) {
  const text = String(value ?? "");
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Gera o CSV. Usa ";" como separador e CRLF porque é o que o Excel
 * em português espera — com "," ele joga a linha toda numa célula só.
 */
export function toCsv(transactions) {
  const header = COLUMNS.map(([name]) => escapeCsv(name)).join(";");
  const rows = transactions.map((t) =>
    COLUMNS.map(([, get]) => escapeCsv(get(t))).join(";")
  );
  return [header, ...rows].join("\r\n");
}

/** Backup completo, pronto para ser relido por `parseBackup`. */
export function toBackup({ transactions, budgets, goals }) {
  return JSON.stringify(
    {
      app: "financial-control-js",
      version: 3,
      exportedAt: new Date().toISOString(),
      transactions,
      budgets,
      goals,
    },
    null,
    2
  );
}

/** Lê um backup. Lança Error com mensagem amigável se o arquivo não servir. */
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("O arquivo não é um JSON válido.");
  }
  if (!data || !Array.isArray(data.transactions)) {
    throw new Error("O arquivo não parece um backup do Controle Financeiro.");
  }
  return {
    transactions: data.transactions,
    budgets:
      data.budgets && typeof data.budgets === "object" ? data.budgets : {},
    goals: Array.isArray(data.goals) ? data.goals : [],
  };
}
