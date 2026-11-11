import { el, $, render } from "../dom.js";
import { formatMoney } from "../../domain/money.js";
import { formatDate, monthLabel, monthLabelShort } from "../../domain/dates.js";
import {
  filterTransactions,
  sortTransactions,
  colorOf,
} from "../../domain/transactions.js";
import { totals } from "../../domain/stats.js";

let sort = { key: "date", direction: "desc" };

export function setSort(key) {
  sort =
    sort.key === key
      ? { key, direction: sort.direction === "asc" ? "desc" : "asc" }
      : { key, direction: key === "amount" ? "desc" : "desc" };
  return sort;
}

export function getSort() {
  return sort;
}

function applySort(list) {
  if (sort.key === "amount") {
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...list].sort((a, b) => (a.amount - b.amount) * factor);
  }
  return sortTransactions(list, sort.direction);
}

export function visibleTransactions(state) {
  return applySort(
    filterTransactions(state.transactions, {
      month: state.month,
      type: state.filters.type,
      query: state.filters.query,
      category: state.filters.category,
      onlyRecurring: state.filters.onlyRecurring,
    })
  );
}

function isFiltering(filters) {
  return Boolean(
    filters.query ||
      filters.type !== "all" ||
      filters.category !== "all" ||
      filters.onlyRecurring
  );
}

/** Rodapé com o total do que está em tela — não do mês inteiro. */
function renderTotals(rows) {
  const { income, expense, balance } = totals(rows);
  render($("#tx-tfoot"), [
    el("tr", {}, [
      el("td", { class: "table__total-label", colSpan: 3, text: "Total filtrado" }),
      el("td", { class: "num" }, [
        el("span", { class: "is-income", text: `+ ${formatMoney(income)}` }),
        el("br"),
        el("span", { class: "is-expense", text: `− ${formatMoney(expense)}` }),
        el("br"),
        el("strong", {
          class: balance < 0 ? "is-expense" : "",
          text: formatMoney(balance),
        }),
      ]),
      el("td", {}),
    ]),
  ]);
}

export function renderTransactions(state, handlers) {
  const rows = visibleTransactions(state);
  const tbody = $("#tx-tbody");
  const empty = $("#tx-empty");

  $("#result-count").textContent = rows.length
    ? `${rows.length} ${rows.length > 1 ? "transações" : "transação"} em ${monthLabel(state.month)}`
    : "";

  for (const button of document.querySelectorAll(".table__sort")) {
    const active = button.dataset.sort === sort.key;
    button.classList.toggle("is-active", active);
    button.setAttribute(
      "aria-sort",
      active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"
    );
  }

  if (!rows.length) {
    render(tbody, []);
    render($("#tx-tfoot"), []);
    empty.hidden = false;
    const filtering = isFiltering(state.filters);
    render(empty, [
      el("p", { class: "empty__icon", "aria-hidden": "true", text: "🗂️" }),
      el("p", {
        class: "empty__title",
        text: filtering
          ? "Nada encontrado com esses filtros"
          : `Nenhuma transação em ${monthLabel(state.month)}`,
      }),
      el("p", {
        class: "empty__text",
        text: filtering
          ? "Tente limpar os filtros ou escolher outro mês."
          : "Registre a primeira movimentação para ver os números aparecerem.",
      }),
      filtering
        ? el("button", {
            class: "btn btn--ghost",
            type: "button",
            text: "Limpar filtros",
            onClick: handlers.onClearFilters,
          })
        : el("button", {
            class: "btn btn--primary",
            type: "button",
            text: "Adicionar transação",
            onClick: handlers.onCreate,
          }),
    ]);
    return;
  }

  empty.hidden = true;
  render(
    tbody,
    rows.map((t) =>
      el("tr", { class: "table__row", dataset: { id: t.id } }, [
        el("td", { class: "table__date", text: formatDate(t.date) }),
        el("td", {}, [
          el("span", { class: "table__desc" }, [
            el("span", { text: t.description }),
            t.recurring &&
              el("button", {
                class: "chip chip--recurring chip--action",
                type: "button",
                title: "Recorrência ativa — clique para encerrar",
                text: t.recurringUntil
                  ? `até ${monthLabelShort(t.recurringUntil)}`
                  : "mensal",
                onClick: () => handlers.onStopRecurrence(t),
              }),
            !t.recurring &&
              t.seriesId &&
              el("span", {
                class: "chip chip--recurring",
                title: "Gerada automaticamente por uma recorrência",
                text: "mensal",
              }),
          ]),
        ]),
        el("td", {}, [
          el("span", { class: "chip" }, [
            el("span", {
              class: "chip__dot",
              style: { background: colorOf(t.category) },
            }),
            t.category,
          ]),
        ]),
        el("td", {
          class: `num ${t.type === "income" ? "is-income" : "is-expense"}`,
          text: `${t.type === "income" ? "+" : "−"} ${formatMoney(t.amount)}`,
        }),
        el("td", { class: "table__actions", "data-label": "Ações" }, [
          el("button", {
            class: "icon-btn",
            type: "button",
            "aria-label": `Editar ${t.description}`,
            title: "Editar",
            text: "✎",
            onClick: () => handlers.onEdit(t),
          }),
          el("button", {
            class: "icon-btn",
            type: "button",
            "aria-label": `Duplicar ${t.description}`,
            title: "Duplicar",
            text: "⧉",
            onClick: () => handlers.onDuplicate(t),
          }),
          el("button", {
            class: "icon-btn icon-btn--danger",
            type: "button",
            "aria-label": `Excluir ${t.description}`,
            title: "Excluir",
            text: "🗑",
            onClick: () => handlers.onDelete(t),
          }),
        ]),
      ])
    )
  );

  renderTotals(rows);
}

/** Preenche o seletor de categoria com o que existe no mês. */
export function renderCategoryFilter(state) {
  const select = $("#category-filter");
  const used = [
    ...new Set(
      state.transactions
        .filter((t) => t.date.slice(0, 7) === state.month)
        .map((t) => t.category)
    ),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  render(select, [
    el("option", { value: "all", text: "Todas as categorias" }),
    ...used.map((c) => el("option", { value: c, text: c })),
  ]);

  // A categoria filtrada pode não existir no mês para onde o usuário navegou;
  // nesse caso o filtro cai para "todas" em vez de esconder o mês inteiro.
  if (!used.includes(state.filters.category)) state.filters.category = "all";
  select.value = state.filters.category;
}
