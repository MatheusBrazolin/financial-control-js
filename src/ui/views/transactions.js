import { el, $, render } from "../dom.js";
import { formatMoney } from "../../domain/money.js";
import { formatDate, monthLabel } from "../../domain/dates.js";
import {
  filterTransactions,
  sortTransactions,
  colorOf,
} from "../../domain/transactions.js";

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
      onlyRecurring: state.filters.onlyRecurring,
    })
  );
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
    empty.hidden = false;
    const filtering =
      state.filters.query ||
      state.filters.type !== "all" ||
      state.filters.onlyRecurring;
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
          ? "Tente limpar a busca ou escolher outro tipo."
          : "Registre a primeira movimentação para ver os números aparecerem.",
      }),
      !filtering &&
        el("button", {
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
            (t.recurring || t.seriesId) &&
              el("span", {
                class: "chip chip--recurring",
                title: t.recurring
                  ? "Transação recorrente (modelo)"
                  : "Gerada automaticamente por uma recorrência",
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
        el("td", { class: "table__actions" }, [
          el("button", {
            class: "icon-btn",
            type: "button",
            "aria-label": `Editar ${t.description}`,
            title: "Editar",
            text: "✎",
            onClick: () => handlers.onEdit(t),
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
}
