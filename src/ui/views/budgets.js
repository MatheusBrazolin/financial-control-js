import { el, $, render } from "../dom.js";
import { formatMoney } from "../../domain/money.js";
import { monthLabel } from "../../domain/dates.js";
import { budgetStatus } from "../../domain/stats.js";
import { EXPENSE_CATEGORIES, colorOf } from "../../domain/transactions.js";

const STATUS_TEXT = {
  ok: "dentro do limite",
  warning: "perto do limite",
  over: "limite estourado",
};

export function renderBudgets(state, handlers) {
  const list = budgetStatus(state.transactions, state.budgets, state.month);
  $("#budget-subtitle").textContent = monthLabel(state.month);

  // Orçamento é teto de gasto, então só categorias de saída entram aqui.
  // As que já têm limite continuam na lista: escolhê-las sobrescreve o valor.
  const select = $("#budget-category");
  const previous = select.value;
  render(select, [
    el("option", { value: "", text: "Selecione…" }),
    ...EXPENSE_CATEGORIES.map((c) =>
      el("option", {
        value: c,
        text: c in state.budgets ? `${c} (alterar)` : c,
      })
    ),
  ]);
  select.value = EXPENSE_CATEGORIES.includes(previous) ? previous : "";

  if (!list.length) {
    render($("#budget-grid"), [
      el("div", { class: "empty" }, [
        el("p", { class: "empty__icon", "aria-hidden": "true", text: "🎯" }),
        el("p", { class: "empty__title", text: "Nenhum orçamento definido" }),
        el("p", {
          class: "empty__text",
          text: "Defina um limite por categoria para acompanhar quanto ainda pode gastar no mês.",
        }),
      ]),
    ]);
    return;
  }

  render(
    $("#budget-grid"),
    list.map((item) => {
      const percent = Math.round(item.ratio * 100);
      return el("article", { class: `budget budget--${item.status}` }, [
        el("header", { class: "budget__header" }, [
          el("span", { class: "budget__category" }, [
            el("span", {
              class: "chip__dot",
              style: { background: colorOf(item.category) },
            }),
            item.category,
          ]),
          el("button", {
            class: "icon-btn icon-btn--danger",
            type: "button",
            "aria-label": `Remover orçamento de ${item.category}`,
            title: "Remover orçamento",
            text: "×",
            onClick: () => handlers.onRemove(item.category),
          }),
        ]),

        el("div", {
          class: "budget__bar",
          role: "progressbar",
          "aria-valuenow": String(Math.min(percent, 100)),
          "aria-valuemin": "0",
          "aria-valuemax": "100",
          "aria-label": `${item.category}: ${percent}% do limite usado`,
        }, [
          el("span", {
            class: "budget__fill",
            style: { width: `${Math.min(percent, 100)}%` },
          }),
        ]),

        el("p", { class: "budget__numbers" }, [
          el("strong", { text: formatMoney(item.used) }),
          el("span", { text: ` de ${formatMoney(item.limit)}` }),
        ]),

        el("p", { class: "budget__status" }, [
          el("span", { class: "budget__percent", text: `${percent}%` }),
          el("span", {
            text:
              item.remaining >= 0
                ? `${STATUS_TEXT[item.status]} · restam ${formatMoney(item.remaining)}`
                : `${STATUS_TEXT[item.status]} · ${formatMoney(-item.remaining)} acima`,
          }),
        ]),

        el("button", {
          class: "budget__edit",
          type: "button",
          text: "Alterar limite",
          onClick: () => handlers.onEdit(item),
        }),
      ]);
    })
  );
}
