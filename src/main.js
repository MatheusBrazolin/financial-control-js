/**
 * Ponto de entrada: liga o estado (store) às telas, ao roteador por hash,
 * ao tema e aos atalhos de teclado.
 */

import { store } from "./core/store.js";
import { $, $$ } from "./ui/dom.js";
import { toast, confirmDialog } from "./ui/feedback.js";
import { openTransactionForm } from "./ui/transaction-form.js";
import { autoRedraw } from "./ui/charts.js";
import { renderDashboard } from "./ui/views/dashboard.js";
import {
  renderTransactions,
  visibleTransactions,
  setSort,
} from "./ui/views/transactions.js";
import { renderBudgets } from "./ui/views/budgets.js";
import { renderReports, renderComparison } from "./ui/views/reports.js";
import { parseAmount, formatMoney } from "./domain/money.js";
import { currentMonth, addMonths, monthLabel } from "./domain/dates.js";
import { toCsv, toBackup, parseBackup } from "./domain/export.js";

const VIEWS = {
  dashboard: "Dashboard",
  transacoes: "Transações",
  orcamentos: "Orçamentos",
  relatorios: "Relatórios",
};

let activeView = "dashboard";
let comparison = null;

// ───────────────────────────── tema ──────────────────────────────
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  store.setTheme(theme);
  $("#theme-btn").setAttribute(
    "aria-label",
    theme === "dark" ? "Usar tema claro" : "Usar tema escuro"
  );
}

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
}

// ──────────────────────────── roteador ───────────────────────────
function viewFromHash() {
  const name = location.hash.replace(/^#\/?/, "");
  return name in VIEWS ? name : "dashboard";
}

function showView(name) {
  activeView = name;
  for (const section of $$(".view")) {
    const match = section.dataset.view === name;
    section.hidden = !match;
    section.classList.toggle("is-active", match);
  }
  for (const link of $$(".nav__link")) {
    const match = link.dataset.view === name;
    link.classList.toggle("is-active", match);
    link.setAttribute("aria-current", match ? "page" : "false");
  }
  $("#view-title").textContent = VIEWS[name];
  document.title = `${VIEWS[name]} · Controle Financeiro`;
  closeSidebar();
  renderActiveView();
}

// ──────────────────────────── renderização ───────────────────────
function renderActiveView() {
  const state = store.state;
  $("#month-input").value = state.month;

  switch (activeView) {
    case "dashboard":
      renderDashboard(state);
      break;
    case "transacoes":
      renderTransactions(state, {
        onCreate: createTransaction,
        onEdit: editTransaction,
        onDelete: deleteTransaction,
      });
      break;
    case "orcamentos":
      renderBudgets(state, {
        onRemove: removeBudget,
        onEdit: editBudget,
      });
      break;
    case "relatorios":
      renderReports(state);
      if (comparison) renderComparison(state, comparison.a, comparison.b);
      break;
  }
}

// ──────────────────────── ações de transação ─────────────────────
async function createTransaction() {
  const data = await openTransactionForm();
  if (!data) return;
  store.addTransaction(data);
  store.init(); // regenera as parcelas se a nova transação for recorrente
  toast("Transação adicionada.", { type: "success" });
}

async function editTransaction(transaction) {
  const data = await openTransactionForm(transaction);
  if (!data) return;
  store.updateTransaction(transaction.id, data);
  toast("Transação atualizada.", { type: "success" });
}

async function deleteTransaction(transaction) {
  const isTemplate = transaction.recurring;
  const ok = await confirmDialog({
    title: "Excluir transação?",
    message: isTemplate
      ? `"${transaction.description}" é uma recorrência. Todas as parcelas geradas por ela também serão removidas.`
      : `"${transaction.description}" — ${formatMoney(transaction.amount)}.`,
    confirmLabel: "Excluir",
    danger: true,
  });
  if (!ok) return;

  const removed = store.removeTransaction(transaction.id, {
    withSeries: isTemplate,
  });
  toast(
    removed.length > 1
      ? `${removed.length} lançamentos excluídos.`
      : "Transação excluída.",
    {
      type: "info",
      action: {
        label: "Desfazer",
        onClick: () => {
          store.undoDelete();
          toast("Exclusão desfeita.", { type: "success", duration: 2500 });
        },
      },
    }
  );
}

// ───────────────────────── ações de orçamento ────────────────────
function removeBudget(category) {
  store.removeBudget(category);
  toast(`Orçamento de ${category} removido.`, { type: "info" });
}

function editBudget(item) {
  $("#budget-category").value = "";
  $("#budget-amount").value = formatMoney(item.limit);
  $("#budget-amount").dataset.editing = item.category;
  $("#budget-amount").focus();
  toast(`Informe o novo limite para ${item.category}.`, { duration: 3500 });
}

// ────────────────────────── import/export ────────────────────────
function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), {
    href: url,
    download: filename,
  });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportCsv() {
  const rows = visibleTransactions(store.state);
  if (!rows.length) {
    toast("Não há transações para exportar com os filtros atuais.", {
      type: "error",
    });
    return;
  }
  // O "﻿" é o BOM de UTF-8: sem ele o Excel abre "Alimentação" como "AlimentaÃ§Ã£o".
  download(
    `transacoes-${store.state.month}.csv`,
    "﻿" + toCsv(rows),
    "text/csv;charset=utf-8;"
  );
  toast(`${rows.length} transações exportadas.`, { type: "success" });
}

function exportBackup() {
  download(
    `controle-financeiro-${new Date().toISOString().slice(0, 10)}.json`,
    toBackup(store.state),
    "application/json"
  );
  toast("Backup salvo.", { type: "success" });
}

async function importBackup(file) {
  try {
    const data = parseBackup(await file.text());
    const ok = await confirmDialog({
      title: "Importar backup?",
      message: `Isso substitui os dados atuais por ${data.transactions.length} transações do arquivo. Exporte um backup antes se quiser manter o que já existe.`,
      confirmLabel: "Importar",
      danger: true,
    });
    if (!ok) return;
    store.replaceAll(data);
    store.init();
    toast("Backup importado.", { type: "success" });
  } catch (error) {
    toast(error.message || "Não foi possível ler o arquivo.", { type: "error" });
  }
}

async function resetAll() {
  const ok = await confirmDialog({
    title: "Apagar todos os dados?",
    message:
      "Transações e orçamentos deste navegador serão removidos. Não dá para desfazer.",
    confirmLabel: "Apagar tudo",
    danger: true,
  });
  if (!ok) return;
  store.clearAll();
  toast("Tudo apagado.", { type: "info" });
}

// ─────────────────────────── menu mobile ─────────────────────────
function openSidebar() {
  document.body.classList.add("is-menu-open");
  $("#menu-btn").setAttribute("aria-expanded", "true");
  $("#scrim").hidden = false;
}

function closeSidebar() {
  document.body.classList.remove("is-menu-open");
  $("#menu-btn").setAttribute("aria-expanded", "false");
  $("#scrim").hidden = true;
}

// ───────────────────────────── eventos ───────────────────────────
function bindEvents() {
  window.addEventListener("hashchange", () => showView(viewFromHash()));

  $("#new-tx-btn").addEventListener("click", createTransaction);
  $("#theme-btn").addEventListener("click", toggleTheme);
  $("#export-csv-btn").addEventListener("click", exportCsv);
  $("#export-json-btn").addEventListener("click", exportBackup);
  $("#reset-btn").addEventListener("click", resetAll);

  $("#import-btn").addEventListener("click", () => $("#import-input").click());
  $("#import-input").addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) importBackup(file);
    event.target.value = "";
  });

  $("#menu-btn").addEventListener("click", () =>
    document.body.classList.contains("is-menu-open") ? closeSidebar() : openSidebar()
  );
  $("#scrim").addEventListener("click", closeSidebar);

  // Mês de referência
  $("#month-input").addEventListener("change", (event) => {
    if (event.target.value) store.setMonth(event.target.value);
  });
  $("#month-prev").addEventListener("click", () =>
    store.setMonth(addMonths(store.state.month, -1))
  );
  $("#month-next").addEventListener("click", () =>
    store.setMonth(addMonths(store.state.month, 1))
  );

  // Filtros da aba Transações
  let searchTimer;
  $("#search-input").addEventListener("input", (event) => {
    clearTimeout(searchTimer);
    const value = event.target.value;
    searchTimer = setTimeout(() => store.setFilters({ query: value }), 180);
  });

  for (const button of $$("[data-filter-type]")) {
    button.addEventListener("click", () => {
      for (const other of $$("[data-filter-type]")) {
        other.classList.toggle("is-active", other === button);
        other.setAttribute("aria-pressed", String(other === button));
      }
      store.setFilters({ type: button.dataset.filterType });
    });
  }

  $("#recurring-filter").addEventListener("change", (event) =>
    store.setFilters({ onlyRecurring: event.target.checked })
  );

  for (const button of $$(".table__sort")) {
    button.addEventListener("click", () => {
      setSort(button.dataset.sort);
      renderActiveView();
    });
  }

  // Orçamentos
  $("#budget-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const amountInput = $("#budget-amount");
    const category = amountInput.dataset.editing || $("#budget-category").value;
    const cents = parseAmount(amountInput.value);

    if (!category) {
      toast("Escolha uma categoria.", { type: "error" });
      return;
    }
    if (cents === null || cents <= 0) {
      toast("Informe um limite maior que zero.", { type: "error" });
      amountInput.focus();
      return;
    }

    store.setBudget(category, cents);
    delete amountInput.dataset.editing;
    event.target.reset();
    toast(`Limite de ${category} definido em ${formatMoney(cents)}.`, {
      type: "success",
    });
  });

  // Comparativo
  $("#compare-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const a = $("#compare-a").value;
    const b = $("#compare-b").value;
    if (!a || !b) {
      toast("Escolha os dois meses.", { type: "error" });
      return;
    }
    if (a === b) {
      toast("Escolha meses diferentes.", { type: "error" });
      return;
    }
    comparison = { a, b };
    renderComparison(store.state, a, b);
  });

  // Atalhos
  document.addEventListener("keydown", (event) => {
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName);
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "j") {
      event.preventDefault();
      toggleTheme();
      return;
    }
    if (typing || event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key === "n") {
      event.preventDefault();
      createTransaction();
    } else if (event.key === "/") {
      event.preventDefault();
      location.hash = "#/transacoes";
      $("#search-input").focus();
    } else if (event.key === "Escape") {
      closeSidebar();
    }
  });
}

// ───────────────────────────── bootstrap ─────────────────────────
function start() {
  applyTheme(document.documentElement.dataset.theme || "light");

  const now = currentMonth();
  $("#month-input").value = now;
  $("#compare-a").value = addMonths(now, -1);
  $("#compare-b").value = now;

  bindEvents();
  store.subscribe(renderActiveView);
  autoRedraw(renderActiveView);

  const generated = store.init();
  showView(viewFromHash());

  if (generated) {
    toast(
      `${generated} lançamento${generated > 1 ? "s" : ""} recorrente${
        generated > 1 ? "s" : ""
      } gerado${generated > 1 ? "s" : ""} até ${monthLabel(now)}.`,
      { duration: 7000 }
    );
  }
  if (!store.state.persistent) {
    toast(
      "Não foi possível salvar no navegador — os dados somem ao fechar a aba.",
      { type: "error", duration: 10000 }
    );
  }
}

start();
