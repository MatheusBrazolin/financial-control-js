/**
 * Formulário de nova transação / edição, num <dialog> modal.
 *
 * Fica num diálogo porque o formulário precisa estar disponível em qualquer
 * aba — na versão anterior ele morava só no dashboard, e o botão "Editar" da
 * aba Transações preenchia um formulário que o usuário nem estava vendo.
 */

import { el, $, $$ } from "./dom.js";
import { parseAmount, formatMoney } from "../domain/money.js";
import { todayISO } from "../domain/dates.js";
import { CATEGORIES, validate } from "../domain/transactions.js";

let dialog = null;
let resolver = null;

function build() {
  const amountInput = el("input", {
    class: "field__input",
    id: "tx-amount",
    name: "amount",
    type: "text",
    inputMode: "decimal",
    autocomplete: "off",
    placeholder: "0,00",
    required: true,
  });

  // Normaliza o que foi digitado quando o campo perde o foco:
  // "50" -> "R$ 50,00", "1234,5" -> "R$ 1.234,50".
  amountInput.addEventListener("blur", () => {
    const cents = parseAmount(amountInput.value);
    if (cents !== null && cents > 0) amountInput.value = formatMoney(cents);
  });

  const form = el(
    "form",
    { class: "tx-form", id: "tx-form", noValidate: true },
    [
      el("div", { class: "tx-form__types", role: "radiogroup", "aria-label": "Tipo da transação" }, [
        typeOption("expense", "Saída", true),
        typeOption("income", "Entrada", false),
      ]),

      field("tx-description", "Descrição", el("input", {
        class: "field__input",
        id: "tx-description",
        name: "description",
        type: "text",
        maxLength: 80,
        autocomplete: "off",
        placeholder: "Mercado, salário, aluguel…",
        required: true,
      })),

      el("div", { class: "tx-form__row" }, [
        field("tx-amount", "Valor", amountInput),
        field("tx-date", "Data", el("input", {
          class: "field__input",
          id: "tx-date",
          name: "date",
          type: "date",
          required: true,
        })),
      ]),

      field("tx-category", "Categoria", el(
        "select",
        { class: "field__input", id: "tx-category", name: "category", required: true },
        [
          el("option", { value: "", text: "Selecione…" }),
          ...CATEGORIES.map((c) => el("option", { value: c, text: c })),
        ]
      )),

      el("label", { class: "checkbox" }, [
        el("input", { type: "checkbox", id: "tx-recurring", name: "recurring" }),
        el("span", {}, [
          el("strong", { text: "Repetir todo mês" }),
          el("small", {
            class: "checkbox__hint",
            text: "Lança automaticamente uma cópia nos meses seguintes.",
          }),
        ]),
      ]),

      el("div", { class: "dialog__actions" }, [
        el("button", {
          type: "button",
          class: "btn btn--ghost",
          text: "Cancelar",
          onClick: () => close(null),
        }),
        el("button", {
          type: "submit",
          class: "btn btn--primary",
          id: "tx-submit",
          text: "Salvar",
        }),
      ]),
    ]
  );

  form.addEventListener("submit", onSubmit);

  dialog = el("dialog", { class: "dialog dialog--form" }, [
    el("div", { class: "dialog__body" }, [
      el("div", { class: "dialog__header" }, [
        el("h2", { class: "dialog__title", id: "tx-title", text: "Nova transação" }),
        el("button", {
          type: "button",
          class: "icon-btn",
          "aria-label": "Fechar",
          text: "×",
          onClick: () => close(null),
        }),
      ]),
      form,
    ]),
  ]);

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close(null);
  });

  document.body.append(dialog);
}

function typeOption(value, label, checked) {
  return el("label", { class: "type-option", dataset: { type: value } }, [
    el("input", {
      type: "radio",
      name: "type",
      value,
      checked,
      class: "sr-only",
    }),
    el("span", { text: label }),
  ]);
}

function field(id, label, input) {
  return el("div", { class: "field" }, [
    el("label", { class: "field__label", htmlFor: id, text: label }),
    input,
    el("p", { class: "field__error", id: `${id}-error`, role: "alert" }),
  ]);
}

function showErrors(errors) {
  for (const id of ["description", "amount", "category", "date"]) {
    const input = $(`#tx-${id}`);
    const error = $(`#tx-${id}-error`);
    const message = errors[id] || "";
    error.textContent = message;
    input.classList.toggle("field__input--invalid", Boolean(message));
    input.setAttribute("aria-invalid", message ? "true" : "false");
    input.setAttribute("aria-describedby", message ? `tx-${id}-error` : "");
  }
  const first = $(".field__input--invalid");
  if (first) first.focus();
}

function onSubmit(event) {
  event.preventDefault();
  const data = {
    description: $("#tx-description").value.trim(),
    amount: parseAmount($("#tx-amount").value),
    category: $("#tx-category").value,
    date: $("#tx-date").value,
    type: $$('input[name="type"]').find((r) => r.checked)?.value,
    recurring: $("#tx-recurring").checked,
  };

  const { valid, errors } = validate(data);
  if (!valid) {
    showErrors(errors);
    return;
  }
  close(data);
}

function close(result) {
  const resolve = resolver;
  resolver = null;
  dialog.close();
  if (resolve) resolve(result);
}

/**
 * Abre o formulário.
 * @param {object|null} transaction  transação para editar, ou null para criar
 * @returns {Promise<object|null>} dados validados, ou null se cancelou
 */
export function openTransactionForm(transaction = null) {
  if (!dialog) build();

  const editing = Boolean(transaction);
  $("#tx-title").textContent = editing ? "Editar transação" : "Nova transação";
  $("#tx-submit").textContent = editing ? "Salvar alterações" : "Adicionar";

  $("#tx-description").value = transaction?.description ?? "";
  $("#tx-amount").value = transaction ? formatMoney(transaction.amount) : "";
  $("#tx-category").value = transaction?.category ?? "";
  $("#tx-date").value = transaction?.date ?? todayISO();
  $("#tx-recurring").checked = transaction?.recurring ?? false;
  for (const radio of $$('input[name="type"]')) {
    radio.checked = radio.value === (transaction?.type ?? "expense");
  }
  showErrors({});

  dialog.showModal();
  $("#tx-description").focus();

  return new Promise((resolve) => {
    resolver = resolve;
  });
}
