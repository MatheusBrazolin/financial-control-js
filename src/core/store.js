/**
 * Estado da aplicação: fonte única de verdade, persistência em localStorage
 * e notificação dos assinantes. A UI nunca escreve no localStorage direto.
 */

import {
  migrate,
  expandRecurring,
  newId,
  CATEGORIES,
} from "../domain/transactions.js";
import { currentMonth } from "../domain/dates.js";

const KEYS = {
  transactions: "fc:transactions",
  budgets: "fc:budgets",
  theme: "fc:theme",
  legacyTransactions: "transacoes",
  legacyBudgets: "orcamentos",
};

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Cota estourada ou modo privativo: o app segue funcionando em memória.
    return false;
  }
}

function loadTransactions() {
  const current = readJson(KEYS.transactions, null);
  const source = Array.isArray(current)
    ? current
    : readJson(KEYS.legacyTransactions, []);
  return (Array.isArray(source) ? source : [])
    .map(migrate)
    .filter(Boolean);
}

function loadBudgets() {
  const current = readJson(KEYS.budgets, null);
  const source =
    current && typeof current === "object"
      ? current
      : readJson(KEYS.legacyBudgets, {});
  const out = {};
  for (const [category, value] of Object.entries(source || {})) {
    if (!CATEGORIES.includes(category)) continue;
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) continue;
    // O formato antigo guardava reais; o novo, centavos.
    out[category] = Number.isInteger(value) && value > 10000 ? value : Math.round(number * 100);
  }
  return out;
}

const listeners = new Set();

const state = {
  transactions: [],
  budgets: {},
  month: currentMonth(),
  filters: { type: "all", query: "", category: "all", onlyRecurring: false },
  persistent: true,
};

let lastDeleted = null;

function emit() {
  for (const fn of listeners) fn(state);
}

function persist() {
  const ok =
    writeJson(KEYS.transactions, state.transactions) &&
    writeJson(KEYS.budgets, state.budgets);
  state.persistent = ok;
  return ok;
}

/**
 * Gera as parcelas que faltam das recorrências sobre o estado em memória.
 * Trabalhar em memória (e não relendo o localStorage) é o que garante que
 * nada se perca quando a gravação falha — modo privativo, cota cheia.
 * @returns {number} quantas parcelas foram criadas
 */
function applyRecurring() {
  const generated = expandRecurring(state.transactions);
  if (generated.length) {
    state.transactions.push(...generated);
    persist();
  }
  return generated.length;
}

export const store = {
  get state() {
    return state;
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  init() {
    state.transactions = loadTransactions();
    state.budgets = loadBudgets();
    const generated = applyRecurring();
    emit();
    return generated;
  },

  setMonth(month) {
    state.month = month;
    emit();
  },

  setFilters(patch) {
    Object.assign(state.filters, patch);
    emit();
  },

  clearFilters() {
    state.filters = { type: "all", query: "", category: "all", onlyRecurring: false };
    emit();
  },

  /** @returns {{transaction: object, generated: number}} */
  addTransaction(data) {
    const transaction = {
      recurringUntil: null,
      ...data,
      id: newId(),
      seriesId: null,
      createdAt: new Date().toISOString(),
    };
    state.transactions.push(transaction);
    persist();
    const generated = applyRecurring();
    emit();
    return { transaction, generated };
  },

  /** Insere uma transação já pronta (duplicar, desfazer). */
  insertTransaction(transaction) {
    state.transactions.push(transaction);
    persist();
    emit();
    return transaction;
  },

  updateTransaction(id, patch) {
    const index = state.transactions.findIndex((t) => t.id === id);
    if (index === -1) return null;
    state.transactions[index] = { ...state.transactions[index], ...patch, id };
    persist();
    // Virar recorrente (ou esticar o fim da série) precisa gerar as parcelas.
    const generated = applyRecurring();
    emit();
    return { transaction: state.transactions[index], generated };
  },

  /**
   * Encerra uma recorrência no mês informado: o template continua existindo,
   * mas para de gerar parcelas daí em diante. As parcelas já lançadas depois
   * desse mês são removidas.
   */
  stopRecurrence(id, month) {
    const template = state.transactions.find((t) => t.id === id);
    if (!template || !template.recurring) return 0;
    template.recurringUntil = month;
    const before = state.transactions.length;
    state.transactions = state.transactions.filter(
      (t) => !(t.seriesId === id && t.date.slice(0, 7) > month)
    );
    persist();
    emit();
    return before - state.transactions.length;
  },

  /** Remove uma transação (e as parcelas da série, se for um template). */
  removeTransaction(id, { withSeries = false } = {}) {
    const target = state.transactions.find((t) => t.id === id);
    if (!target) return null;
    const removed = state.transactions.filter(
      (t) => t.id === id || (withSeries && t.seriesId === id)
    );
    state.transactions = state.transactions.filter((t) => !removed.includes(t));
    lastDeleted = removed;
    persist();
    emit();
    return removed;
  },

  /** Desfaz a última exclusão. */
  undoDelete() {
    if (!lastDeleted) return false;
    state.transactions.push(...lastDeleted);
    lastDeleted = null;
    persist();
    emit();
    return true;
  },

  setBudget(category, limitCents) {
    state.budgets[category] = limitCents;
    persist();
    emit();
  },

  removeBudget(category) {
    delete state.budgets[category];
    persist();
    emit();
  },

  /** @returns {number} quantas transações entraram */
  replaceAll({ transactions, budgets }) {
    state.transactions = transactions.map(migrate).filter(Boolean);
    state.budgets = {};
    for (const [category, value] of Object.entries(budgets || {})) {
      const number = Number(value);
      if (CATEGORIES.includes(category) && Number.isFinite(number) && number > 0) {
        state.budgets[category] = Math.round(number);
      }
    }
    persist();
    applyRecurring();
    emit();
    return state.transactions.length;
  },

  clearAll() {
    state.transactions = [];
    state.budgets = {};
    persist();
    emit();
  },

  getTheme() {
    return localStorage.getItem(KEYS.theme);
  },

  setTheme(theme) {
    try {
      localStorage.setItem(KEYS.theme, theme);
    } catch {
      /* ignora */
    }
  },
};
