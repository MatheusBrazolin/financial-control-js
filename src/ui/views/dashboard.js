import { el, $, render } from "../dom.js";
import { formatMoney, formatSigned } from "../../domain/money.js";
import { monthLabel, formatDate } from "../../domain/dates.js";
import { insights, byCategory, inMonth } from "../../domain/stats.js";
import { sortTransactions, colorOf } from "../../domain/transactions.js";
import { drawDonut } from "../charts.js";
import { icon } from "../icons.js";

function statCard({ label, value, tone, footer, iconName, hero = false }) {
  return el("article", { class: `stat stat--${tone} ${hero ? "stat--hero" : ""}` }, [
    el("header", { class: "stat__top" }, [
      el("span", { class: "stat__label", text: label }),
      el("span", { class: "stat__icon" }, [icon(iconName, { size: 16 })]),
    ]),
    el("p", { class: "stat__value", text: value }),
    el("p", { class: "stat__footer", text: footer }),
  ]);
}

function insightCard({ label, value, detail, tone = "", iconName }) {
  return el("article", { class: "insight" }, [
    el("span", { class: "insight__icon" }, [icon(iconName, { size: 16 })]),
    el("div", { class: "insight__body" }, [
      el("p", { class: "insight__label", text: label }),
      el("p", { class: `insight__value ${tone}`, text: value }),
      el("p", { class: "insight__detail", text: detail }),
    ]),
  ]);
}

/** Legenda do saldo: guardar X% só faz sentido quando sobrou dinheiro. */
function balanceFooter(data) {
  if (!data.income && !data.expense) return "Nada lançado neste mês";
  if (data.balance < 0) return `${formatMoney(-data.balance)} a mais do que entrou`;
  if (!data.income) return "Sem entradas registradas";
  return `Sobraram ${Math.round(data.savingsRate * 100)}% do que entrou`;
}

export function renderDashboard(state) {
  const { transactions, month } = state;
  const data = insights(transactions, month);
  const monthTransactions = inMonth(transactions, month);

  // ── Cartões de total ──────────────────────────────────────────────
  render($("#stat-grid"), [
    statCard({
      label: "Entradas",
      value: formatMoney(data.income),
      tone: "income",
      iconName: "trendingUp",
      footer: monthLabel(month),
    }),
    statCard({
      label: "Saídas",
      value: formatMoney(data.expense),
      tone: "expense",
      iconName: "trendingDown",
      footer: monthLabel(month),
    }),
    statCard({
      label: "Saldo do mês",
      value: formatMoney(data.balance),
      tone: data.balance < 0 ? "negative" : "balance",
      iconName: "coins",
      hero: true,
      footer: balanceFooter(data),
    }),
  ]);

  // ── Indicadores ───────────────────────────────────────────────────
  const delta = data.expenseDelta;
  const deltaPercent =
    data.expenseDeltaPercent === null
      ? "sem base de comparação"
      : `${data.expenseDeltaPercent > 0 ? "+" : ""}${Math.round(
          data.expenseDeltaPercent
        )}% vs. mês anterior`;

  render($("#insight-grid"), [
    insightCard({
      iconName: "trendingDown",
      label: "Maior gasto",
      value: data.biggestExpense
        ? formatMoney(data.biggestExpense.amount)
        : "—",
      detail: data.biggestExpense
        ? `${data.biggestExpense.description} · ${formatDate(
            data.biggestExpense.date
          )}`
        : "Nenhuma saída no mês",
    }),
    insightCard({
      iconName: "target",
      label: "Categoria que mais pesou",
      value: data.topCategory ? data.topCategory.category : "—",
      detail: data.topCategory
        ? `${formatMoney(data.topCategory.amount)} · ${Math.round(
            data.topCategory.share * 100
          )}% das saídas`
        : "Nenhuma saída no mês",
    }),
    insightCard({
      iconName: "calendar",
      label: "Média diária",
      value: formatMoney(data.dailyAverage),
      detail: data.daysRemaining
        ? `Projeção do mês: ${formatMoney(data.projection)}`
        : `Em ${data.daysElapsed} dias`,
    }),
    insightCard({
      iconName: "repeat",
      label: "Variação de gastos",
      value: formatSigned(delta),
      detail: deltaPercent,
      tone: delta > 0 ? "is-bad" : delta < 0 ? "is-good" : "",
    }),
  ]);

  // ── Rosca por categoria ───────────────────────────────────────────
  const slices = byCategory(monthTransactions);
  // O mês já está no topo da tela: repeti-lo aqui só fazia o subtítulo
  // quebrar em duas linhas ao lado do título.
  $("#donut-subtitle").textContent = slices.length
    ? `${slices.length} categoria${slices.length > 1 ? "s" : ""}`
    : "";

  drawDonut($("#category-chart"), slices);

  const biggest = slices[0]?.amount || 1;
  render(
    $("#category-legend"),
    slices.map((slice) =>
      el("li", { class: "legend__row" }, [
        el("span", {
          class: "legend__dot",
          style: { background: colorOf(slice.category) },
        }),
        el("span", { class: "legend__label", text: slice.category }),
        el("span", { class: "legend__track" }, [
          el("span", {
            class: "legend__bar",
            style: {
              width: `${(slice.amount / biggest) * 100}%`,
              background: colorOf(slice.category),
            },
          }),
        ]),
        el("span", { class: "legend__pct", text: `${Math.round(slice.share * 100)}%` }),
        el("span", { class: "legend__value", text: formatMoney(slice.amount) }),
      ])
    )
  );

  // ── Últimas transações ────────────────────────────────────────────
  const recent = sortTransactions(monthTransactions).slice(0, 6);
  render(
    $("#recent-list"),
    recent.length
      ? recent.map((t) =>
          el("li", { class: "mini-list__item" }, [
            el("span", {
              class: "mini-list__dot",
              style: { background: colorOf(t.category) },
            }),
            el("span", { class: "mini-list__text" }, [
              el("strong", { text: t.description }),
              el("small", { text: `${formatDate(t.date)} · ${t.category}` }),
            ]),
            el("span", {
              class: `mini-list__value ${t.type === "income" ? "is-income" : "is-expense"}`,
              text: `${t.type === "income" ? "+" : "−"} ${formatMoney(t.amount)}`,
            }),
          ])
        )
      : el("li", {
          class: "mini-list__empty",
          text: "Nenhuma transação neste mês ainda.",
        })
  );
}
