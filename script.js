const form = document.getElementById("transaction-form");
const lista = document.querySelector(".transaction-list");
const emptyState = document.getElementById("empty-state");
const themeToggle = document.querySelector(".theme-btn");
const exportCsvBtn = document.getElementById("export-csv");
const filterToggle = document.getElementById("filter-toggle");
const filterButtons = document.querySelectorAll(".filter-btn");
const monthFilter = document.getElementById("month-filter");
const searchInput = document.getElementById("search-input");
const valorInput = document.getElementById("valor-input");
const categoryChart = document.getElementById("category-chart");

let transacoes = JSON.parse(localStorage.getItem("transacoes") || "[]");
let filtroAtual = "all";
let busca = "";

const config = {
  categorias: ["Alimentação", "Transporte", "Moradia", "Saúde", "Lazer", "Educação", "Outros"],
  cores: ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"]
};

document.querySelectorAll(".btn-success, .btn-danger").forEach(btn => {
  btn.addEventListener("click", () => adicionarTransacao(btn.dataset.type));
});

document.addEventListener("click", (e) => {
  const dropdown = document.querySelector(".filter-dropdown");
  if (!e.target.closest(".section-controls")) {
    dropdown.classList.remove("active");
  }
});

filterToggle.addEventListener("click", () => {
  const dropdown = filterToggle.nextElementSibling;
  dropdown.classList.toggle("active");
});

filterButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    filtroAtual = btn.dataset.type;
    const dropdown = filterToggle.nextElementSibling;
    dropdown.classList.remove("active");
    renderizar();
  });
});

themeToggle.addEventListener("click", toggleTheme);
exportCsvBtn.addEventListener("click", exportarCSV);
monthFilter.addEventListener("change", renderizar);
searchInput.addEventListener("input", (e) => { busca = e.target.value.toLowerCase(); renderizar(); });

// Atalho de teclado para dark mode
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault();
    toggleTheme();
  }
});

valorInput.addEventListener("blur", (e) => {
  let val = e.target.value.replace(/\D/g, '');
  if (val) {
    val = (parseInt(val) / 100).toFixed(2);
    e.target.value = `R$ ${val}`;
  }
});

lista.addEventListener("click", (e) => {
  const deleteBtn = e.target.closest(".btn-delete");
  const editBtn = e.target.closest(".btn-edit");

  if (deleteBtn) {
    const id = parseInt(deleteBtn.dataset.id);
    if (confirm("Excluir esta transação?")) {
      transacoes = transacoes.filter(t => t.id !== id);
      salvarLocal();
      renderizar();
    }
  } else if (editBtn) {
    const id = parseInt(editBtn.dataset.id);
    editarTransacao(id);
  }
});

function adicionarTransacao(tipo) {
  const desc = form.querySelector('[data-field="descricao"]').value.trim();
  const valStr = form.querySelector('[data-field="valor"]').value.replace(/[R$\s]/g, '').replace(',', '.');
  const cat = form.querySelector('[data-field="categoria"]').value;

  const valido = validarForm(desc, valStr, cat);
  if (!valido) return;

  const val = parseFloat(valStr);
  const agora = new Date();
  const data = agora.toLocaleDateString("pt-BR");
  const dataISO = agora.toISOString().split("T")[0];

  const transacao = {
    id: Date.now(),
    descricao: desc,
    valor: val,
    categoria: cat,
    tipo: tipo,
    data: data,
    dataISO: dataISO
  };

  transacoes.unshift(transacao);
  salvarLocal();
  form.reset();
  limparErros();
  renderizar();
}

function validarForm(desc, val, cat) {
  limparErros();
  let valido = true;

  if (!desc) {
    mostrarErro("descricao", "Descrição obrigatória");
    valido = false;
  }
  if (!val || isNaN(val) || parseFloat(val) <= 0) {
    mostrarErro("valor", "Valor inválido");
    valido = false;
  }
  if (!cat) {
    mostrarErro("categoria", "Selecione uma categoria");
    valido = false;
  }
  return valido;
}

function mostrarErro(field, msg) {
  const input = form.querySelector(`[data-field="${field}"]`);
  input.classList.add("error");
  input.nextElementSibling.textContent = msg;
}

function limparErros() {
  form.querySelectorAll(".form-input").forEach(inp => inp.classList.remove("error"));
  form.querySelectorAll(".error-msg").forEach(msg => msg.textContent = "");
}

function editarTransacao(idParam) {
  const id = parseInt(idParam);
  const t = transacoes.find(x => x.id === id);
  if (!t) return;

  const descInput = form.querySelector('[data-field="descricao"]');
  const valInput = form.querySelector('[data-field="valor"]');
  const catInput = form.querySelector('[data-field="categoria"]');

  descInput.value = t.descricao;
  valInput.value = `R$ ${t.valor.toFixed(2)}`;
  catInput.value = t.categoria;

  transacoes = transacoes.filter(x => x.id !== id);
  salvarLocal();
  renderizar();
  descInput.focus();
}

function renderizar() {
  const mesFilter = monthFilter.value;
  const filtrados = transacoes.filter(t => {
    if (filtroAtual !== "all" && t.tipo !== filtroAtual) return false;
    if (mesFilter && !t.dataISO.startsWith(mesFilter)) return false;
    if (busca && !t.descricao.toLowerCase().includes(busca)) return false;
    return true;
  });

  lista.innerHTML = "";

  if (filtrados.length === 0) {
    emptyState.style.display = "block";
  } else {
    emptyState.style.display = "none";
    filtrados.forEach(t => {
      const li = document.createElement("li");
      li.className = `transaction-item ${t.tipo}`;
      li.innerHTML = `
        <span class="transaction-date">${t.data}</span>
        <span class="transaction-description">${t.descricao}</span>
        <span class="transaction-category">${t.categoria}</span>
        <span class="transaction-value">R$ ${t.valor.toFixed(2)}</span>
        <div class="transaction-actions">
          <button class="btn-small btn-edit" data-id="${t.id}">Editar</button>
          <button class="btn-small btn-delete" data-id="${t.id}">Excluir</button>
        </div>
      `;
      lista.appendChild(li);
    });
  }

  atualizarResumo();
  desenharGrafico();
}

function atualizarResumo() {
  const entradas = transacoes.filter(t => t.tipo === "entrada").reduce((a, b) => a + b.valor, 0);
  const saidas = transacoes.filter(t => t.tipo === "saida").reduce((a, b) => a + b.valor, 0);

  document.querySelector("[data-income]").textContent = `R$ ${entradas.toFixed(2)}`;
  document.querySelector("[data-expense]").textContent = `R$ ${saidas.toFixed(2)}`;
  document.querySelector("[data-balance]").textContent = `R$ ${(entradas - saidas).toFixed(2)}`;
}

function desenharGrafico() {
  const ctx = categoryChart.getContext("2d");
  const dados = {};
  config.categorias.forEach(cat => dados[cat] = 0);

  transacoes.filter(t => t.tipo === "saida").forEach(t => {
    if (dados.hasOwnProperty(t.categoria)) dados[t.categoria] += t.valor;
  });

  const labels = Object.keys(dados);
  const values = Object.values(dados);
  const total = values.reduce((a, b) => a + b, 0);

  categoryChart.width = categoryChart.offsetWidth;
  categoryChart.height = 250;

  if (total === 0) {
    ctx.font = "16px sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText("Sem gastos registrados", categoryChart.width / 2, categoryChart.height / 2);
    return;
  }

  const centerX = categoryChart.width / 2;
  const centerY = categoryChart.height / 2;
  const radius = 80;
  let angle = -Math.PI / 2;

  labels.forEach((label, i) => {
    const sliceAngle = (values[i] / total) * 2 * Math.PI;

    ctx.fillStyle = config.cores[i % config.cores.length];
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, angle, angle + sliceAngle);
    ctx.lineTo(centerX, centerY);
    ctx.fill();

    const labelAngle = angle + sliceAngle / 2;
    const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
    const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);

    const pct = ((values[i] / total) * 100).toFixed(0);
    ctx.font = "bold 12px sans-serif";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(pct + "%", labelX, labelY);

    angle += sliceAngle;
  });

  ctx.font = "12px sans-serif";
  ctx.fillStyle = "#64748b";
  let legendY = 20;
  labels.forEach((label, i) => {
    ctx.fillStyle = config.cores[i % config.cores.length];
    ctx.fillRect(10, legendY, 12, 12);
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "left";
    ctx.fillText(`${label}`, 28, legendY + 6);
    legendY += 18;
  });
}

function salvarLocal() {
  localStorage.setItem("transacoes", JSON.stringify(transacoes));
}

function exportarCSV() {
  if (transacoes.length === 0) {
    alert("Nenhuma transação para exportar");
    return;
  }

  const csv = "Data,Categoria,Descrição,Tipo,Valor\n" +
    transacoes.map(t => `${t.data},${t.categoria},"${t.descricao}",${t.tipo},${t.valor.toFixed(2)}`).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `transacoes-${new Date().toLocaleDateString("pt-BR")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function toggleTheme() {
  document.body.classList.toggle("dark");
  localStorage.setItem("tema", document.body.classList.contains("dark") ? "dark" : "light");
}

if (localStorage.getItem("tema") === "dark") {
  document.body.classList.add("dark");
}

monthFilter.valueAsDate = new Date();
renderizar();
