/**
 * Ponto de entrada: liga o estado (store) às telas, ao roteador por hash,
 * ao tema e aos atalhos de teclado.
 */

import { store } from "./core/store.js";
import { $, $$ } from "./ui/dom.js";
import { toast, confirmDialog, promptDialog } from "./ui/feedback.js";
import { openTransactionForm } from "./ui/transaction-form.js";
import { autoRedraw } from "./ui/charts.js";
import { renderDashboard } from "./ui/views/dashboard.js";
import {
  renderTransactions,
  renderCategoryFilter,
  renderTagFilter,
  visibleTransactions,
  setSort,
} from "./ui/views/transactions.js";
import { renderGoals } from "./ui/views/goals.js";
import { duplicate, allTags } from "./domain/transactions.js";
import { todayISO } from "./domain/dates.js";
import { validateGoal } from "./domain/goals.js";
import { renderBudgets } from "./ui/views/budgets.js";
import { renderReports, renderComparison } from "./ui/views/reports.js";
import { parseAmount, formatMoney } from "./domain/money.js";
import { currentMonth, addMonths, monthLabel } from "./domain/dates.js";
import { toCsv, toBackup, parseBackup } from "./domain/export.js";

const VIEWS = {
  dashboard: "Dashboard",
  transacoes: "Transações",
  orcamentos: "Orçamentos",
  metas: "Metas",
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
  $("#month-today").hidden = state.month === currentMonth();

  switch (activeView) {
    case "dashboard":
      renderDashboard(state);
      break;
    case "transacoes":
      renderCategoryFilter(state);
      renderTagFilter(state);
      renderTransactions(state, {
        onCreate: createTransaction,
        onEdit: editTransaction,
        onDelete: deleteTransaction,
        onDuplicate: duplicateTransaction,
        onStopRecurrence: stopRecurrence,
        onClearFilters: clearFilters,
        onTagClick: filterByTag,
      });
      break;
    case "orcamentos":
      renderBudgets(state, {
        onRemove: removeBudget,
        onEdit: editBudget,
      });
      break;
    case "metas":
      renderGoals(state, {
        onRemove: removeGoal,
        onContribute: addContribution,
        onRemoveContribution: removeContribution,
      });
      break;
    case "relatorios":
      renderReports(state);
      if (comparison) renderComparison(state, comparison.a, comparison.b);
      break;
  }
}

// ──────────────────────── ações de transação ─────────────────────
function recurrenceNote(generated) {
  return generated
    ? ` ${generated} parcela${generated > 1 ? "s" : ""} da recorrência gerada${
        generated > 1 ? "s" : ""
      }.`
    : "";
}

async function createTransaction() {
  const data = await openTransactionForm(null, { tagSuggestions: tagNames() });
  if (!data) return;
  const { generated } = store.addTransaction(data);
  store.setMonth(data.date.slice(0, 7));
  toast(`Transação adicionada.${recurrenceNote(generated)}`, { type: "success" });
}

async function editTransaction(transaction) {
  const data = await openTransactionForm(transaction, { tagSuggestions: tagNames() });
  if (!data) return;
  const { generated } = store.updateTransaction(transaction.id, data);
  toast(`Transação atualizada.${recurrenceNote(generated)}`, { type: "success" });
}

function duplicateTransaction(transaction) {
  const copy = duplicate(transaction, todayISO());
  store.insertTransaction(copy);
  toast(`"${copy.description}" duplicada para hoje.`, {
    type: "success",
    action: {
      label: "Desfazer",
      onClick: () => store.removeTransaction(copy.id),
    },
  });
}

async function stopRecurrence(template) {
  const month = store.state.month;
  const ok = await confirmDialog({
    title: "Encerrar recorrência?",
    message: `"${template.description}" para de se repetir depois de ${monthLabel(
      month
    )}. Os lançamentos até lá continuam; os posteriores são removidos.`,
    confirmLabel: "Encerrar",
  });
  if (!ok) return;

  const removed = store.stopRecurrence(template.id, month);
  toast(
    removed
      ? `Recorrência encerrada e ${removed} lançamento${
          removed > 1 ? "s futuros removidos" : " futuro removido"
        }.`
      : "Recorrência encerrada.",
    { type: "info" }
  );
}

/** Clicar numa etiqueta na tabela filtra por ela, em todos os meses. */
function filterByTag(tag) {
  store.setFilters({ tag, allMonths: true });
  $("#all-months-filter").checked = true;
  toast(`Filtrando por #${tag} em todos os meses.`, { duration: 3500 });
}

function tagNames() {
  return allTags(store.state.transactions).map((t) => t.tag);
}

// ─────────────────────────── metas ───────────────────────────────
async function removeGoal(goal) {
  const ok = await confirmDialog({
    title: "Excluir meta?",
    message: `"${goal.name}" e os ${goal.contributions.length} aportes registrados nela serão removidos.`,
    confirmLabel: "Excluir",
    danger: true,
  });
  if (!ok) return;
  store.removeGoal(goal.id);
  toast("Meta excluída.", { type: "info" });
}

async function addContribution(goal) {
  const values = await promptDialog({
    title: "Registrar aporte",
    message: `Quanto você guardou para "${goal.name}"?`,
    confirmLabel: "Registrar",
    fields: [
      { name: "amount", label: "Valor", inputMode: "decimal", placeholder: "500,00" },
      { name: "date", label: "Data", type: "date", value: todayISO() },
    ],
    validate: ({ amount, date }) => {
      const cents = parseAmount(amount);
      const errors = {};
      if (cents === null || cents <= 0) errors.amount = "Informe um valor maior que zero.";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.date = "Data inválida.";
      return {
        valid: !Object.keys(errors).length,
        errors,
        values: { amount: cents, date },
      };
    },
  });
  if (!values) return;

  store.addContribution(goal.id, values);
  toast(`Aporte de ${formatMoney(values.amount)} registrado.`, { type: "success" });
}

async function removeContribution(goal, contribution) {
  const ok = await confirmDialog({
    title: "Remover aporte?",
    message: `${formatMoney(contribution.amount)} em ${contribution.date
      .split("-")
      .reverse()
      .join("/")}.`,
    confirmLabel: "Remover",
    danger: true,
  });
  if (!ok) return;
  store.removeContribution(goal.id, contribution.id);
  toast("Aporte removido.", { type: "info" });
}

function clearFilters() {
  store.clearFilters();
  $("#search-input").value = "";
  $("#recurring-filter").checked = false;
  $("#all-months-filter").checked = false;
  for (const button of $$("[data-filter-type]")) {
    const all = button.dataset.filterType === "all";
    button.classList.toggle("is-active", all);
    button.setAttribute("aria-pressed", String(all));
  }
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
  $("#budget-category").value = item.category;
  const amount = $("#budget-amount");
  amount.value = formatMoney(item.limit);
  amount.focus();
  amount.select();
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
    const count = store.replaceAll(data);
    toast(`Backup importado: ${count} transações.`, { type: "success" });
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
  $("#month-today").addEventListener("click", () => store.setMonth(currentMonth()));

  $("#help-btn").addEventListener("click", showShortcuts);

  $("#category-filter").addEventListener("change", (event) =>
    store.setFilters({ category: event.target.value })
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

  $("#all-months-filter").addEventListener("change", (event) =>
    store.setFilters({ allMonths: event.target.checked })
  );

  $("#tag-filter").addEventListener("change", (event) =>
    store.setFilters({ tag: event.target.value })
  );

  $("#goal-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = {
      name: $("#goal-name").value,
      target: parseAmount($("#goal-target").value),
      deadline: $("#goal-deadline").value || null,
    };
    const { valid, errors } = validateGoal(data);
    if (!valid) {
      toast(Object.values(errors)[0], { type: "error" });
      return;
    }
    store.addGoal(data);
    event.target.reset();
    toast(`Meta "${data.name.trim()}" criada.`, { type: "success" });
  });

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
    const category = $("#budget-category").value;
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
    } else if (event.key === "?") {
      event.preventDefault();
      showShortcuts();
    } else if (event.key === "ArrowLeft") {
      store.setMonth(addMonths(store.state.month, -1));
    } else if (event.key === "ArrowRight") {
      store.setMonth(addMonths(store.state.month, 1));
    } else if (event.key === "Escape") {
      closeSidebar();
    }
  });
}

const SHORTCUTS = [
  ["N", "Nova transação"],
  ["/", "Buscar transações"],
  ["←  →", "Mês anterior / próximo"],
  ["?", "Esta ajuda"],
  ["Ctrl / ⌘ + J", "Alternar tema"],
  ["Esc", "Fechar diálogo ou menu"],
];

function showShortcuts() {
  confirmDialog({
    title: "Atalhos de teclado",
    list: SHORTCUTS,
    confirmLabel: "Entendi",
    cancelLabel: null,
  });
}

// ──────────────────────── offline (service worker) ───────────────
function registerServiceWorker() {
  // file:// e navegadores sem suporte simplesmente seguem sem offline.
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;

  navigator.serviceWorker
    .register("sw.js")
    .then((registration) => {
      registration.addEventListener("updatefound", () => {
        const incoming = registration.installing;
        if (!incoming) return;
        incoming.addEventListener("statechange", () => {
          // Só avisa quando JÁ existia uma versão instalada: na primeira
          // visita não há nada a atualizar.
          if (incoming.state === "installed" && navigator.serviceWorker.controller) {
            toast("Nova versão disponível.", {
              duration: 20000,
              action: {
                label: "Atualizar",
                onClick: () => {
                  incoming.postMessage("skip-waiting");
                  location.reload();
                },
              },
            });
          }
        });
      });
    })
    .catch(() => {
      /* sem offline, o app continua funcionando normalmente */
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
  registerServiceWorker();
  store.subscribe(renderActiveView);
  autoRedraw(renderActiveView);

  store.onPersistFailure(() =>
    toast(
      "O navegador parou de salvar (armazenamento cheio ou bloqueado). Exporte um backup agora — o que você lançar daqui em diante pode se perder.",
      { type: "error", duration: 60000 }
    )
  );

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
