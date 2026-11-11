/**
 * Helpers mínimos de DOM.
 *
 * `el()` cria nós definindo texto via textContent — nunca innerHTML — então
 * uma descrição como `<img onerror=...>` entra na tela como texto, e não
 * como HTML executável. Era essa a brecha de XSS da versão anterior.
 */

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value; // só para ícones internos
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key === "style") Object.assign(node.style, value);
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in node && key !== "list") {
      node[key] = value;
    } else {
      node.setAttribute(key, value === true ? "" : value);
    }
  }

  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return node;
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [
  ...root.querySelectorAll(selector),
];

export function clear(node) {
  while (node.firstChild) node.firstChild.remove();
  return node;
}

export function render(node, children) {
  clear(node).append(...[].concat(children).filter(Boolean));
  return node;
}

/** Observa o tema para redesenhar os gráficos quando as cores mudam. */
export function cssVar(name, root = document.documentElement) {
  return getComputedStyle(root).getPropertyValue(name).trim();
}
