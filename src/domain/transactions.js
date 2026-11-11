/**
 * Modelo de transação e regras de negócio puras em cima da lista.
 *
 * Formato canônico:
 * {
 *   id: string,
 *   description: string,
 *   amount: number,              // centavos, sempre positivo
 *   type: "income" | "expense",
 *   category: string,
 *   date: "YYYY-MM-DD",
 *   recurring: boolean,          // é o template de uma série mensal
 *   seriesId: string | null,     // id do template que gerou esta parcela
 *   createdAt: string            // ISO completo
 * }
 */

import { monthOf, addMonths, sameDayInMonth, currentMonth } from "./dates.js";

export const CATEGORIES = [
  "Alimentação",
  "Transporte",
  "Moradia",
  "Saúde",
  "Lazer",
  "Educação",
  "Assinaturas",
  "Investimentos",
  "Salário",
  "Outros",
];

export const CATEGORY_COLORS = {
  Alimentação: "#f97316",
  Transporte: "#3b82f6",
  Moradia: "#8b5cf6",
  Saúde: "#ef4444",
  Lazer: "#ec4899",
  Educação: "#06b6d4",
  Assinaturas: "#a855f7",
  Investimentos: "#14b8a6",
  Salário: "#22c55e",
  Outros: "#94a3b8",
};

export function colorOf(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.Outros;
}

export function newId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

/** Valida os campos vindos do formulário. Retorna { valid, errors }. */
export function validate({ description, amount, category, date, type }) {
  const errors = {};
  if (!description || !description.trim()) {
    errors.description = "Informe uma descrição.";
  } else if (description.trim().length > 80) {
    errors.description = "Use no máximo 80 caracteres.";
  }
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    errors.amount = "Informe um valor válido.";
  } else if (amount <= 0) {
    errors.amount = "O valor precisa ser maior que zero.";
  } else if (amount > 100_000_000_00) {
    errors.amount = "Valor acima do limite suportado.";
  }
  if (!category) errors.category = "Escolha uma categoria.";
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.date = "Data inválida.";
  if (type !== "income" && type !== "expense") errors.type = "Tipo inválido.";
  return { valid: Object.keys(errors).length === 0, errors };
}

/** Converte um registro do formato antigo (pt-BR, reais) para o canônico. */
export function migrate(raw) {
  if (!raw || typeof raw !== "object") return null;

  // Já está no formato novo
  if (typeof raw.amount === "number" && raw.type && raw.date) {
    return {
      id: String(raw.id ?? newId()),
      description: String(raw.description ?? "").slice(0, 80),
      amount: Math.abs(Math.round(raw.amount)),
      type: raw.type === "income" ? "income" : "expense",
      category: CATEGORIES.includes(raw.category) ? raw.category : "Outros",
      date: raw.date,
      recurring: Boolean(raw.recurring),
      seriesId: raw.seriesId ?? null,
      createdAt: raw.createdAt ?? new Date().toISOString(),
    };
  }

  // Formato v1: { descricao, valor (reais), categoria, tipo, dataISO, recorrente }
  const date =
    raw.dataISO && /^\d{4}-\d{2}-\d{2}$/.test(raw.dataISO)
      ? raw.dataISO
      : isoFromBR(raw.data);
  if (!date) return null;

  const valor = Number(raw.valor);
  if (!Number.isFinite(valor)) return null;

  return {
    id: String(raw.id ?? newId()),
    description: String(raw.descricao ?? "").slice(0, 80),
    amount: Math.abs(Math.round(valor * 100)),
    type: raw.tipo === "entrada" ? "income" : "expense",
    category: CATEGORIES.includes(raw.categoria) ? raw.categoria : "Outros",
    date,
    recurring: Boolean(raw.recorrente),
    seriesId: null,
    createdAt: new Date(Number(raw.id) || Date.now()).toISOString(),
  };
}

function isoFromBR(br) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(br || ""));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * Gera as parcelas que faltam das transações recorrentes, do mês seguinte ao
 * template até o mês de referência. Função pura: devolve só as NOVAS parcelas.
 */
export function expandRecurring(transactions, upTo = currentMonth()) {
  const existing = new Set(
    transactions
      .filter((t) => t.seriesId)
      .map((t) => `${t.seriesId}@${monthOf(t.date)}`)
  );
  const created = [];

  for (const template of transactions.filter((t) => t.recurring && !t.seriesId)) {
    let month = addMonths(monthOf(template.date), 1);
    let guard = 0;
    while (month <= upTo && guard++ < 240) {
      const key = `${template.id}@${month}`;
      if (!existing.has(key)) {
        existing.add(key);
        created.push({
          ...template,
          id: newId(),
          date: sameDayInMonth(template.date, month),
          recurring: false,
          seriesId: template.id,
          createdAt: new Date().toISOString(),
        });
      }
      month = addMonths(month, 1);
    }
  }
  return created;
}

/** Aplica busca textual, tipo, mês e filtro de recorrência. */
export function filterTransactions(transactions, { month, type, query, onlyRecurring } = {}) {
  const needle = (query || "").trim().toLowerCase();
  return transactions.filter((t) => {
    if (month && monthOf(t.date) !== month) return false;
    if (type && type !== "all" && t.type !== type) return false;
    if (onlyRecurring && !t.recurring && !t.seriesId) return false;
    if (needle) {
      const haystack = `${t.description} ${t.category}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

/** Ordena por data (mais recente primeiro), desempatando pela criação. */
export function sortTransactions(transactions, direction = "desc") {
  const factor = direction === "asc" ? 1 : -1;
  return [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -factor : factor;
    return String(a.createdAt) < String(b.createdAt) ? -factor : factor;
  });
}
