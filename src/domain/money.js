/**
 * Funções puras para trabalhar com dinheiro.
 *
 * Internamente os valores são guardados em CENTAVOS (inteiros) para evitar
 * os erros de arredondamento do ponto flutuante (0.1 + 0.2 !== 0.3).
 */

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

/**
 * Converte o texto digitado pelo usuário em centavos.
 * Aceita "1.234,56", "1234.56", "R$ 1.234,56", "1234".
 * @returns {number|null} centavos, ou null se não for um valor válido
 */
export function parseAmount(input) {
  if (typeof input === "number") {
    return Number.isFinite(input) ? Math.round(input * 100) : null;
  }
  if (typeof input !== "string") return null;

  let text = input.trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!text) return null;

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");

  if (hasComma && hasDot) {
    // O último separador é o decimal: "1.234,56" ou "1,234.56"
    text =
      text.lastIndexOf(",") > text.lastIndexOf(".")
        ? text.replace(/\./g, "").replace(",", ".")
        : text.replace(/,/g, "");
  } else if (hasComma) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (hasDot) {
    // "1.234" é separador de milhar; "1.23" é decimal
    const decimals = text.length - text.lastIndexOf(".") - 1;
    if (decimals === 3) text = text.replace(/\./g, "");
  }

  if (!/^-?\d*\.?\d*$/.test(text) || text === "." || text === "-") return null;

  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** Formata centavos como moeda brasileira: 123456 -> "R$ 1.234,56" */
export function formatMoney(cents) {
  return brl.format((cents || 0) / 100);
}

/** Versão curta para rótulos apertados: 123456789 -> "R$ 1,2 mi" */
export function formatMoneyCompact(cents) {
  return brlCompact.format((cents || 0) / 100);
}

/** Formata centavos com sinal explícito: 500 -> "+R$ 5,00" */
export function formatSigned(cents) {
  const sign = cents > 0 ? "+" : "";
  return sign + formatMoney(cents);
}

/** Variação percentual entre dois valores. Retorna null quando não faz sentido. */
export function percentChange(from, to) {
  if (!from) return to ? null : 0;
  return ((to - from) / Math.abs(from)) * 100;
}
