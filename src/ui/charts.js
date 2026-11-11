/**
 * Gráficos em <canvas>, sem biblioteca externa.
 *
 * Os dois desenham na resolução do dispositivo (devicePixelRatio), então não
 * ficam borrados em tela Retina, e se redesenham quando o container muda de
 * tamanho ou o tema muda de cor.
 */

import { colorOf } from "../domain/transactions.js";
import { formatMoney, formatMoneyCompact } from "../domain/money.js";
import { monthLabelShort } from "../domain/dates.js";
import { cssVar } from "./dom.js";

function setupCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const { width, height } = canvas.getBoundingClientRect();
  if (!width || !height) return null;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

function emptyMessage(ctx, width, height, message) {
  ctx.fillStyle = cssVar("--text-muted") || "#94a3b8";
  ctx.font = "500 14px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(message, width / 2, height / 2);
}

/**
 * Rosca de gastos por categoria.
 * @param {HTMLCanvasElement} canvas
 * @param {{category: string, amount: number, share: number}[]} slices
 */
export function drawDonut(canvas, slices) {
  const setup = setupCanvas(canvas);
  if (!setup) return;
  const { ctx, width, height } = setup;

  const total = slices.reduce((sum, s) => sum + s.amount, 0);
  if (!total) {
    emptyMessage(ctx, width, height, "Sem gastos neste mês");
    return;
  }

  const cx = width / 2;
  const cy = height / 2;
  const outer = Math.min(width, height) / 2 - 8;
  const inner = outer * 0.62;

  let angle = -Math.PI / 2;
  const geometry = [];

  for (const slice of slices) {
    const sweep = (slice.amount / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, outer, angle, angle + sweep);
    ctx.arc(cx, cy, inner, angle + sweep, angle, true);
    ctx.closePath();
    ctx.fillStyle = colorOf(slice.category);
    ctx.fill();
    // Separador fino entre fatias, na cor do fundo do card.
    ctx.strokeStyle = cssVar("--surface") || "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

    geometry.push({ slice, start: angle, end: angle + sweep });
    angle += sweep;
  }

  ctx.fillStyle = cssVar("--text-muted") || "#94a3b8";
  ctx.font = "500 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Total", cx, cy - 4);

  ctx.fillStyle = cssVar("--text") || "#0f172a";
  ctx.font = "700 17px system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(formatMoneyCompact(total), cx, cy + 2);

  attachTooltip(canvas, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const distance = Math.hypot(dx, dy);
    if (distance < inner || distance > outer) return null;
    let theta = Math.atan2(dy, dx);
    if (theta < -Math.PI / 2) theta += Math.PI * 2;
    const hit = geometry.find((g) => theta >= g.start && theta < g.end);
    if (!hit) return null;
    return `${hit.slice.category}: ${formatMoney(hit.slice.amount)} (${Math.round(
      hit.slice.share * 100
    )}%)`;
  });
}

/**
 * Barras de entradas × saídas por mês.
 * @param {HTMLCanvasElement} canvas
 * @param {{month: string, income: number, expense: number}[]} series
 */
export function drawBars(canvas, series) {
  const setup = setupCanvas(canvas);
  if (!setup) return;
  const { ctx, width, height } = setup;

  const max = Math.max(...series.flatMap((s) => [s.income, s.expense]), 0);
  if (!max) {
    emptyMessage(ctx, width, height, "Sem movimentações no período");
    return;
  }

  const padding = { top: 16, right: 8, bottom: 28, left: 8 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const slot = plotWidth / series.length;
  const barWidth = Math.min(14, slot / 3);
  const baseline = padding.top + plotHeight;

  ctx.strokeStyle = cssVar("--border") || "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, baseline + 0.5);
  ctx.lineTo(width - padding.right, baseline + 0.5);
  ctx.stroke();

  const geometry = [];

  series.forEach((point, index) => {
    const center = padding.left + slot * (index + 0.5);
    const bars = [
      { value: point.income, color: cssVar("--income") || "#22c55e", offset: -barWidth * 0.55 },
      { value: point.expense, color: cssVar("--expense") || "#ef4444", offset: barWidth * 0.55 },
    ];

    for (const bar of bars) {
      const barHeight = (bar.value / max) * plotHeight;
      const x = center + bar.offset - barWidth / 2;
      const y = baseline - barHeight;
      ctx.fillStyle = bar.color;
      roundedRect(ctx, x, y, barWidth, barHeight, 3);
      ctx.fill();
    }

    ctx.fillStyle = cssVar("--text-muted") || "#94a3b8";
    ctx.font = "500 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(monthLabelShort(point.month), center, baseline + 8);

    geometry.push({ point, from: center - slot / 2, to: center + slot / 2 });
  });

  attachTooltip(canvas, (x) => {
    const hit = geometry.find((g) => x >= g.from && x < g.to);
    if (!hit) return null;
    return `${monthLabelShort(hit.point.month)} · entradas ${formatMoney(
      hit.point.income
    )} · saídas ${formatMoney(hit.point.expense)}`;
  });
}

function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, Math.max(h, 1) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, 0);
  ctx.arcTo(x, y + h, x, y, 0);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Tooltip flutuante compartilhada pelos gráficos. */
function attachTooltip(canvas, hitTest) {
  canvas.__hitTest = hitTest;
  if (canvas.__tooltipReady) return;
  canvas.__tooltipReady = true;

  const tip = document.createElement("div");
  tip.className = "chart-tooltip";
  tip.hidden = true;
  canvas.parentElement.append(tip);

  canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    const label = canvas.__hitTest(
      event.clientX - rect.left,
      event.clientY - rect.top
    );
    if (!label) {
      tip.hidden = true;
      return;
    }
    tip.textContent = label;
    tip.hidden = false;
    tip.style.left = `${event.clientX - rect.left}px`;
    tip.style.top = `${event.clientY - rect.top}px`;
  });

  canvas.addEventListener("pointerleave", () => {
    tip.hidden = true;
  });
}

/** Redesenha os gráficos quando o container ou o tema mudam. */
export function autoRedraw(callback) {
  let frame = null;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(callback);
  };
  window.addEventListener("resize", schedule);
  new MutationObserver(schedule).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return schedule;
}
