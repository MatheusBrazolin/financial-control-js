import { el, $, render } from "../dom.js";
import { formatMoney, formatSigned } from "../../domain/money.js";
import { monthLabel } from "../../domain/dates.js";
import { monthlySeries, compareMonths } from "../../domain/stats.js";
import { drawBars } from "../charts.js";

export function renderReports(state) {
  const series = monthlySeries(state.transactions, state.month, 12);
  drawBars($("#series-chart"), series);

  const rows = [...series].reverse().filter((m) => m.income || m.expense);
  render(
    $("#summary-tbody"),
    rows.length
      ? rows.map((m) =>
          el("tr", {}, [
            el("td", { text: monthLabel(m.month) }),
            el("td", { class: "num is-income", text: formatMoney(m.income) }),
            el("td", { class: "num is-expense", text: formatMoney(m.expense) }),
            el("td", {
              class: `num ${m.balance < 0 ? "is-expense" : "is-income"}`,
              text: formatMoney(m.balance),
            }),
          ])
        )
      : el("tr", {}, [
          el("td", {
            colSpan: 4,
            class: "table__empty",
            text: "Nenhuma movimentação nos últimos 12 meses.",
          }),
        ])
  );
}

export function renderComparison(state, monthA, monthB) {
  const result = compareMonths(state.transactions, monthA, monthB);
  const target = $("#compare-result");

  const line = (label, valueA, valueB, delta, percent, lowerIsBetter) => {
    const good = lowerIsBetter ? delta < 0 : delta > 0;
    const neutral = delta === 0;
    return el("article", { class: "compare-card" }, [
      el("p", { class: "compare-card__label", text: label }),
      el("div", { class: "compare-card__values" }, [
        el("span", {}, [
          el("small", { text: monthLabel(monthA) }),
          el("strong", { text: formatMoney(valueA) }),
        ]),
        el("span", { class: "compare-card__arrow", "aria-hidden": "true", text: "→" }),
        el("span", {}, [
          el("small", { text: monthLabel(monthB) }),
          el("strong", { text: formatMoney(valueB) }),
        ]),
      ]),
      el("p", {
        class: `compare-card__delta ${neutral ? "" : good ? "is-good" : "is-bad"}`,
        text: `${formatSigned(delta)}${
          percent === null ? "" : ` (${percent > 0 ? "+" : ""}${Math.round(percent)}%)`
        }`,
      }),
    ]);
  };

  render(target, [
    line("Entradas", result.a.income, result.b.income, result.delta.income, result.percent.income, false),
    line("Saídas", result.a.expense, result.b.expense, result.delta.expense, result.percent.expense, true),
    line("Saldo", result.a.balance, result.b.balance, result.delta.balance, result.percent.balance, false),
  ]);
}
