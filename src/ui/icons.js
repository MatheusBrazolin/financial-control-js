/**
 * Conjunto de ícones próprio, em SVG inline.
 *
 * Antes a interface usava glifos Unicode (◧ ≡ ◎ ◆, 🗑, ✎) e um emoji de
 * logo. Cada um vinha de uma fonte diferente, com peso e tamanho
 * próprios, e mudava de desenho conforme o sistema — era o detalhe que
 * mais entregava que a tela não tinha sido desenhada.
 *
 * Todos aqui compartilham a mesma grade de 24, o mesmo traço de 1.75 e
 * herdam a cor do texto, então se comportam como tipografia: mudam de
 * tamanho e de cor junto com o que está em volta.
 */

const PATHS = {
  // navegação
  dashboard:
    '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/>',
  list:
    '<line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><line x1="4.5" y1="6" x2="4.51" y2="6"/><line x1="4.5" y1="12" x2="4.51" y2="12"/><line x1="4.5" y1="18" x2="4.51" y2="18"/>',
  target:
    '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><line x1="12" y1="12" x2="12.01" y2="12"/>',
  flag: '<line x1="5" y1="21" x2="5" y2="3.5"/><path d="M5 4h12.5l-2.4 4L17.5 12H5"/>',
  chart:
    '<line x1="3.5" y1="20.5" x2="20.5" y2="20.5"/><rect x="5" y="11" width="3.6" height="6" rx="1.2"/><rect x="10.2" y="6" width="3.6" height="11" rx="1.2"/><rect x="15.4" y="13.5" width="3.6" height="3.5" rx="1.2"/>',

  // ações
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  pencil: '<path d="M16.3 3.7a2.1 2.1 0 0 1 3 3L7.2 18.8 3 20l1.2-4.2Z"/>',
  copy:
    '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5.5 15H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v.5"/>',
  trash:
    '<line x1="3.5" y1="6" x2="20.5" y2="6"/><path d="M8.5 6V4.2A1.2 1.2 0 0 1 9.7 3h4.6a1.2 1.2 0 0 1 1.2 1.2V6"/><path d="M6.3 6.5 7.2 20a1 1 0 0 0 1 1h7.6a1 1 0 0 0 1-1l.9-13.5"/><line x1="10.5" y1="10" x2="10.5" y2="17"/><line x1="13.5" y1="10" x2="13.5" y2="17"/>',
  download:
    '<line x1="12" y1="3.5" x2="12" y2="15.5"/><polyline points="7.2 11 12 15.8 16.8 11"/><path d="M4 20.5h16"/>',
  upload:
    '<line x1="12" y1="16" x2="12" y2="4"/><polyline points="7.2 8.8 12 4 16.8 8.8"/><path d="M4 20.5h16"/>',
  x: '<line x1="6.5" y1="6.5" x2="17.5" y2="17.5"/><line x1="17.5" y1="6.5" x2="6.5" y2="17.5"/>',
  check: '<polyline points="4.5 12.5 9.5 17.5 19.5 6.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="16.2" y1="16.2" x2="21" y2="21"/>',
  menu:
    '<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>',
  chevronLeft: '<polyline points="14.5 18 8.5 12 14.5 6"/>',
  chevronRight: '<polyline points="9.5 18 15.5 12 9.5 6"/>',
  help:
    '<circle cx="12" cy="12" r="8.5"/><path d="M9.7 9.4a2.4 2.4 0 1 1 3.4 2.2c-.7.4-1.1 1-1.1 1.8v.3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  moon: '<path d="M20 14.3A8.5 8.5 0 1 1 9.7 4a7 7 0 0 0 10.3 10.3Z"/>',

  // indicadores
  trendingUp:
    '<polyline points="21 7.5 13.5 15 9.5 11 3 17.5"/><polyline points="15.5 7.5 21 7.5 21 13"/>',
  trendingDown:
    '<polyline points="21 16.5 13.5 9 9.5 13 3 6.5"/><polyline points="15.5 16.5 21 16.5 21 11"/>',
  coins:
    '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.2v9.6"/><path d="M14.6 9.6a2.4 2.4 0 0 0-2.2-1.3h-1.1a1.9 1.9 0 0 0 0 3.8h1.4a1.9 1.9 0 0 1 0 3.8h-1.2a2.4 2.4 0 0 1-2.2-1.3"/>',
  repeat:
    '<polyline points="16.5 2.5 20.5 6.5 16.5 10.5"/><path d="M3.5 11.5v-1a4 4 0 0 1 4-4h13"/><polyline points="7.5 21.5 3.5 17.5 7.5 13.5"/><path d="M20.5 12.5v1a4 4 0 0 1-4 4h-13"/>',
  note:
    '<path d="M5.5 3.5h8L19 9v11.5a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z"/><polyline points="13.5 3.5 13.5 9 19 9"/>',
  tag:
    '<path d="M11 3.5H4.5a1 1 0 0 0-1 1V11a2 2 0 0 0 .6 1.4l7.5 7.5a1.6 1.6 0 0 0 2.3 0l6.1-6.1a1.6 1.6 0 0 0 0-2.3L12.4 4a2 2 0 0 0-1.4-.5Z"/><line x1="7.5" y1="7.5" x2="7.51" y2="7.5"/>',
  wallet:
    '<path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h11"/><rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><line x1="16" y1="13.5" x2="16.01" y2="13.5"/>',
  inbox:
    '<path d="M3.5 13.5H8l1.6 3h4.8l1.6-3h4.5"/><path d="M6.2 4.5h11.6l2.7 9v5a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2v-5Z"/>',
  calendar:
    '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><line x1="3.5" y1="10" x2="20.5" y2="10"/><line x1="8.5" y1="3" x2="8.5" y2="7"/><line x1="15.5" y1="3" x2="15.5" y2="7"/>',
};

/**
 * Devolve o SVG do ícone como texto.
 * @param {keyof PATHS} name
 * @param {{size?: number, className?: string}} options
 */
export function iconSvg(name, { size = 20, className = "" } = {}) {
  const paths = PATHS[name];
  if (!paths) return "";
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

/** Devolve o ícone já como nó, pronto para entrar numa lista de filhos. */
export function icon(name, options) {
  const wrapper = document.createElement("span");
  wrapper.className = "icon-wrap";
  // Conteúdo fixo deste módulo — nunca recebe texto do usuário.
  wrapper.innerHTML = iconSvg(name, options);
  return wrapper.firstElementChild ?? wrapper;
}

/**
 * Troca os marcadores `data-icon="nome"` do HTML pelos SVGs.
 * O HTML guarda só o nome do ícone; o desenho mora aqui.
 */
export function hydrateIcons(root = document) {
  for (const node of root.querySelectorAll("[data-icon]")) {
    const { icon: name, iconSize } = node.dataset;
    const svg = iconSvg(name, { size: Number(iconSize) || 20 });
    if (!svg) continue;
    node.innerHTML = svg;
    delete node.dataset.icon;
  }
}

export const ICON_NAMES = Object.keys(PATHS);
