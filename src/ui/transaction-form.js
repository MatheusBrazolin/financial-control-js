/**
 * Formulário de nova transação / edição, num <dialog> modal.
 *
 * Fica num diálogo porque o formulário precisa estar disponível em qualquer
 * aba — na versão anterior ele morava só no dashboard, e o botão "Editar" da
 * aba Transações preenchia um formulário que o usuário nem estava vendo.
 */

import { el, $, $$, render } from "./dom.js";
import { parseAmount, formatMoney } from "../domain/money.js";
import { todayISO } from "../domain/dates.js";
import { categoriesFor, validate, parseTags } from "../domain/transactions.js";

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

      field("tx-category", "Categoria", el("select", {
        class: "field__input",
        id: "tx-category",
        name: "category",
        required: true,
      })),

      field("tx-tags", "Etiquetas (opcional)", el("input", {
        class: "field__input",
        id: "tx-tags",
        name: "tags",
        type: "text",
        autocomplete: "off",
        placeholder: "casa, viagem — separe por vírgula",
        list: "tx-tag-options",
      })),

      el("datalist", { id: "tx-tag-options" }),

      field("tx-note", "Observação (opcional)", el("textarea", {
        class: "field__input field__input--area",
        id: "tx-note",
        name: "note",
        rows: 2,
        maxLength: 280,
        placeholder: "Um detalhe para lembrar depois",
      })),

      el("label", { class: "checkbox" }, [
        el("input", {
          type: "checkbox",
          id: "tx-recurring",
          name: "recurring",
          onChange: syncRecurringFields,
        }),
        el("span", {}, [
          el("strong", { text: "Repetir todo mês" }),
          el("small", {
            class: "checkbox__hint",
            text: "Lança automaticamente uma cópia nos meses seguintes.",
          }),
        ]),
      ]),

      el("div", { class: "tx-form__until", id: "tx-until-wrap", hidden: true }, [
        field("tx-until", "Repetir até (opcional)", el("input", {
          class: "field__input",
          id: "tx-until",
          name: "recurringUntil",
          type: "month",
        })),
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
      onChange: () => syncCategories(),
    }),
    el("span", { text: label }),
  ]);
}

function currentType() {
  return $$('input[name="type"]').find((r) => r.checked)?.value ?? "expense";
}

/**
 * Lista só as categorias que fazem sentido para o tipo escolhido — "Salário"
 * não tem por que aparecer numa saída. Mantém a seleção quando ela continua
 * válida no novo tipo.
 */
function syncCategories(preferred) {
  const select = $("#tx-category");
  const wanted = preferred ?? select.value;
  const options = categoriesFor(currentType());

  render(select, [
    el("option", { value: "", text: "Selecione…" }),
    ...options.map((c) => el("option", { value: c, text: c })),
  ]);
  select.value = options.includes(wanted) ? wanted : "";
}

/** O campo "repetir até" só existe quando a transação é recorrente. */
function syncRecurringFields() {
  const on = $("#tx-recurring").checked;
  $("#tx-until-wrap").hidden = !on;
  if (!on) $("#tx-until").value = "";
}

function field(id, label, input) {
  return el("div", { class: "field" }, [
    el("label", { class: "field__label", htmlFor: id, text: label }),
    input,
    el("p", { class: "field__error", id: `${id}-error`, role: "alert" }),
  ]);
}

/** Cada campo do formulário e a chave de erro que o acompanha. */
const FIELDS = [
  ["tx-description", "description"],
  ["tx-amount", "amount"],
  ["tx-category", "category"],
  ["tx-date", "date"],
  ["tx-note", "note"],
  ["tx-until", "recurringUntil"],
];

function showErrors(errors) {
  for (const [id, key] of FIELDS) {
    const input = $(`#${id}`);
    const error = $(`#${id}-error`);
    const message = errors[key] || "";
    error.textContent = message;
    input.classList.toggle("field__input--invalid", Boolean(message));
    input.setAttribute("aria-invalid", message ? "true" : "false");
    input.setAttribute("aria-describedby", message ? `${id}-error` : "");
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
    type: currentType(),
    tags: parseTags($("#tx-tags").value),
    note: $("#tx-note").value.trim(),
    recurring: $("#tx-recurring").checked,
    recurringUntil: $("#tx-until").value || null,
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
export function openTransactionForm(transaction = null, { tagSuggestions = [] } = {}) {
  if (!dialog) build();

  render(
    $("#tx-tag-options"),
    tagSuggestions.map((tag) => el("option", { value: tag }))
  );

  const editing = Boolean(transaction);
  $("#tx-title").textContent = editing ? "Editar transação" : "Nova transação";
  $("#tx-submit").textContent = editing ? "Salvar alterações" : "Adicionar";

  $("#tx-description").value = transaction?.description ?? "";
  $("#tx-amount").value = transaction ? formatMoney(transaction.amount) : "";
  $("#tx-date").value = transaction?.date ?? todayISO();
  $("#tx-tags").value = (transaction?.tags ?? []).join(", ");
  $("#tx-note").value = transaction?.note ?? "";
  $("#tx-recurring").checked = transaction?.recurring ?? false;
  for (const radio of $$('input[name="type"]')) {
    radio.checked = radio.value === (transaction?.type ?? "expense");
  }
  syncCategories(transaction?.category ?? "");
  syncRecurringFields();
  $("#tx-until").value = transaction?.recurringUntil ?? "";
  showErrors({});

  dialog.showModal();
  $("#tx-description").focus();

  return new Promise((resolve) => {
    resolver = resolve;
  });
}
