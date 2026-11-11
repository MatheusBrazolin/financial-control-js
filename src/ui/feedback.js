/** Toasts e diálogos — substituem `alert()` e `confirm()` do navegador. */

import { el } from "./dom.js";
import { icon } from "./icons.js";

const container = el("div", {
  class: "toast-stack",
  role: "status",
  "aria-live": "polite",
});
document.body.append(container);

/**
 * @param {string} message
 * @param {{type?: "info"|"success"|"error", action?: {label: string, onClick: () => void}, duration?: number}} options
 */
export function toast(message, options = {}) {
  const { type = "info", action, duration = 5000 } = options;

  const node = el("div", { class: `toast toast--${type}` }, [
    el("span", { class: "toast__text", text: message }),
    action &&
      el("button", {
        class: "toast__action",
        type: "button",
        text: action.label,
        onClick: () => {
          action.onClick();
          dismiss();
        },
      }),
    el("button", {
      class: "toast__close",
      type: "button",
      "aria-label": "Fechar aviso",
      onClick: () => dismiss(),
    }, [icon("x", { size: 15 })]),
  ]);

  let timer = setTimeout(dismiss, duration);
  node.addEventListener("mouseenter", () => clearTimeout(timer));
  node.addEventListener("mouseleave", () => {
    timer = setTimeout(dismiss, 2000);
  });

  function dismiss() {
    clearTimeout(timer);
    node.classList.add("toast--leaving");
    node.addEventListener("animationend", () => node.remove(), { once: true });
  }

  container.append(node);
  return dismiss;
}

/**
 * Confirmação acessível com <dialog>: foco preso, Esc fecha, devolve Promise.
 * @returns {Promise<boolean>}
 */
export function confirmDialog({
  title,
  message,
  list,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
}) {
  return new Promise((resolve) => {
    const dialog = el("dialog", { class: "dialog" }, [
      el("form", { method: "dialog", class: "dialog__body" }, [
        el("h2", { class: "dialog__title", text: title }),
        message && el("p", { class: "dialog__message", text: message }),
        list &&
          el(
            "dl",
            { class: "shortcut-list" },
            list.flatMap(([keys, description]) => [
              el("dt", {}, [el("kbd", { text: keys })]),
              el("dd", { text: description }),
            ])
          ),
        el("div", { class: "dialog__actions" }, [
          cancelLabel &&
            el("button", {
              class: "btn btn--ghost",
              value: "cancel",
              text: cancelLabel,
            }),
          el("button", {
            class: `btn ${danger ? "btn--danger" : "btn--primary"}`,
            value: "confirm",
            text: confirmLabel,
          }),
        ]),
      ]),
    ]);

    dialog.addEventListener("close", () => {
      resolve(dialog.returnValue === "confirm");
      dialog.remove();
    });

    document.body.append(dialog);
    dialog.showModal();
  });
}

/**
 * Diálogo com campos, para perguntas curtas (um aporte, por exemplo).
 * `fields` é [{ name, label, type, value, placeholder, inputMode }].
 * `validate` recebe os valores e devolve { valid, errors }.
 *
 * @returns {Promise<object|null>} valores preenchidos, ou null se cancelou
 */
export function promptDialog({ title, message, fields, confirmLabel = "Salvar", validate }) {
  return new Promise((resolve) => {
    let settled = false;

    const inputs = new Map();
    const errors = new Map();

    const body = fields.map((field) => {
      const id = `prompt-${field.name}`;
      const input = el("input", {
        class: "field__input",
        id,
        type: field.type || "text",
        value: field.value ?? "",
        placeholder: field.placeholder ?? "",
        inputMode: field.inputMode,
        autocomplete: "off",
      });
      const error = el("p", { class: "field__error", role: "alert" });
      inputs.set(field.name, input);
      errors.set(field.name, error);

      return el("div", { class: "field" }, [
        el("label", { class: "field__label", htmlFor: id, text: field.label }),
        input,
        error,
      ]);
    });

    const form = el("form", { class: "tx-form", noValidate: true }, [
      message && el("p", { class: "dialog__message", text: message }),
      ...body,
      el("div", { class: "dialog__actions" }, [
        el("button", {
          type: "button",
          class: "btn btn--ghost",
          text: "Cancelar",
          onClick: () => finish(null),
        }),
        el("button", { type: "submit", class: "btn btn--primary", text: confirmLabel }),
      ]),
    ]);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = Object.fromEntries(
        [...inputs].map(([name, input]) => [name, input.value])
      );

      const result = validate ? validate(values) : { valid: true, errors: {} };
      for (const [name, error] of errors) {
        const message = result.errors?.[name] || "";
        error.textContent = message;
        inputs.get(name).classList.toggle("field__input--invalid", Boolean(message));
      }
      if (!result.valid) return;
      finish(result.values ?? values);
    });

    const dialog = el("dialog", { class: "dialog dialog--form" }, [
      el("div", { class: "dialog__body" }, [
        el("div", { class: "dialog__header" }, [
          el("h2", { class: "dialog__title", text: title }),
          el("button", {
            type: "button",
            class: "icon-btn",
            "aria-label": "Fechar",
            onClick: () => finish(null),
          }, [icon("x", { size: 17 })]),
        ]),
        form,
      ]),
    ]);

    function finish(value) {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      resolve(value);
    }

    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish(null);
    });

    document.body.append(dialog);
    dialog.showModal();
    inputs.values().next().value?.focus();
  });
}
