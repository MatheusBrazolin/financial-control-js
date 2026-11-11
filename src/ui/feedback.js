/** Toasts e diálogos — substituem `alert()` e `confirm()` do navegador. */

import { el } from "./dom.js";

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
      text: "×",
      onClick: () => dismiss(),
    }),
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
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
}) {
  return new Promise((resolve) => {
    const dialog = el("dialog", { class: "dialog" }, [
      el("form", { method: "dialog", class: "dialog__body" }, [
        el("h2", { class: "dialog__title", text: title }),
        message && el("p", { class: "dialog__message", text: message }),
        el("div", { class: "dialog__actions" }, [
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
