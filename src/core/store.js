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
  filters: { type: "all", query: "", onlyRecurring: false },
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

    const generated = expandRecurring(state.transactions);
    if (generated.length) {
      state.transactions.push(...generated);
      persist();
    }
    emit();
    return generated.length;
  },

  setMonth(month) {
    state.month = month;
    emit();
  },

  setFilters(patch) {
    Object.assign(state.filters, patch);
    emit();
  },

  addTransaction(data) {
    const transaction = {
      ...data,
      id: newId(),
      seriesId: null,
      createdAt: new Date().toISOString(),
    };
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
    emit();
    return state.transactions[index];
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
    emit();
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
