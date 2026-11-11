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
 *   tags: string[],              // etiquetas livres, minúsculas
 *   note: string,                // observação livre
 *   recurring: boolean,          // é o template de uma série mensal
 *   recurringUntil: string|null, // "YYYY-MM": último mês a gerar (null = sem fim)
 *   seriesId: string | null,     // id do template que gerou esta parcela
 *   createdAt: string            // ISO completo
 * }
 */

import { monthOf, addMonths, sameDayInMonth, currentMonth } from "./dates.js";

/** Categorias de saída — as únicas que aparecem em orçamentos e no gráfico. */
export const EXPENSE_CATEGORIES = [
  "Alimentação",
  "Transporte",
  "Moradia",
  "Saúde",
  "Lazer",
  "Educação",
  "Assinaturas",
  "Outros",
];

/** Categorias de entrada. */
export const INCOME_CATEGORIES = [
  "Salário",
  "Freelance",
  "Investimentos",
  "Presente",
  "Outros",
];

export const CATEGORIES = [
  ...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]),
];

/** Categorias oferecidas no formulário para cada tipo de transação. */
export function categoriesFor(type) {
  return type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

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
  Freelance: "#0ea5e9",
  Presente: "#f43f5e",
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
export function validate({
  description,
  amount,
  category,
  date,
  type,
  note,
  recurring,
  recurringUntil,
}) {
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
  if (note && String(note).length > 280) errors.note = "Observação muito longa.";
  if (!category) errors.category = "Escolha uma categoria.";
  else if (!CATEGORIES.includes(category)) errors.category = "Categoria desconhecida.";
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.date = "Data inválida.";
  if (type !== "income" && type !== "expense") errors.type = "Tipo inválido.";

  if (recurringUntil) {
    if (!/^\d{4}-\d{2}$/.test(recurringUntil)) {
      errors.recurringUntil = "Mês inválido.";
    } else if (!recurring) {
      errors.recurringUntil = "Marque “Repetir todo mês” para usar um fim.";
    } else if (date && recurringUntil < monthOf(date)) {
      errors.recurringUntil = "O fim não pode ser antes da data da transação.";
    }
  }

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
      tags: parseTags(raw.tags),
      note: String(raw.note ?? "").slice(0, 280),
      recurring: Boolean(raw.recurring),
      recurringUntil: /^\d{4}-\d{2}$/.test(raw.recurringUntil ?? "")
        ? raw.recurringUntil
        : null,
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
    tags: [],
    note: "",
    recurring: Boolean(raw.recorrente),
    recurringUntil: null,
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
    // A série para no mês que o usuário definiu, ou no mês de referência.
    const last =
      template.recurringUntil && template.recurringUntil < upTo
        ? template.recurringUntil
        : upTo;
    let month = addMonths(monthOf(template.date), 1);
    let guard = 0;
    while (month <= last && guard++ < 240) {
      const key = `${template.id}@${month}`;
      if (!existing.has(key)) {
        existing.add(key);
        created.push({
          ...template,
          id: newId(),
          date: sameDayInMonth(template.date, month),
          recurring: false,
          recurringUntil: null,
          seriesId: template.id,
          createdAt: new Date().toISOString(),
        });
      }
      month = addMonths(month, 1);
    }
  }
  return created;
}

/**
 * Normaliza etiquetas digitadas: "Casa, viagem ,CASA" → ["casa", "viagem"].
 * Minúsculas para "Casa" e "casa" não virarem duas etiquetas diferentes.
 */
export function parseTags(input) {
  if (Array.isArray(input)) input = input.join(",");
  return [
    ...new Set(
      String(input ?? "")
        .split(/[,;]/)
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .map((tag) => tag.slice(0, 24))
    ),
  ].slice(0, 8);
}

/** Todas as etiquetas em uso, da mais frequente para a menos. */
export function allTags(transactions) {
  const counts = new Map();
  for (const t of transactions) {
    for (const tag of t.tags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .map(([tag, count]) => ({ tag, count }));
}

/** Aplica busca textual, tipo, mês, categoria, etiqueta e recorrência. */
export function filterTransactions(
  transactions,
  { month, type, query, category, tag, onlyRecurring } = {}
) {
  const needle = (query || "").trim().toLowerCase();
  return transactions.filter((t) => {
    if (month && monthOf(t.date) !== month) return false;
    if (type && type !== "all" && t.type !== type) return false;
    if (category && category !== "all" && t.category !== category) return false;
    if (tag && tag !== "all" && !(t.tags || []).includes(tag)) return false;
    if (onlyRecurring && !t.recurring && !t.seriesId) return false;
    if (needle) {
      // A busca cobre também etiquetas e observação — é onde costuma estar
      // o detalhe que a pessoa lembra ("nota fiscal", "presente da Ana").
      const haystack = [
        t.description,
        t.category,
        t.note || "",
        ...(t.tags || []),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

/**
 * Cópia de uma transação para hoje: mesmo valor e categoria, id novo e sem
 * vínculo nenhum com a série original.
 */
export function duplicate(transaction, date) {
  return {
    ...transaction,
    id: newId(),
    date: date || transaction.date,
    recurring: false,
    recurringUntil: null,
    seriesId: null,
    createdAt: new Date().toISOString(),
  };
}

/** Ordena por data (mais recente primeiro), desempatando pela criação. */
export function sortTransactions(transactions, direction = "desc") {
  const factor = direction === "asc" ? 1 : -1;
  return [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -factor : factor;
    return String(a.createdAt) < String(b.createdAt) ? -factor : factor;
  });
}
