// ====== VARIÁVEIS GLOBAIS ======
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
const recorrenteCheck = document.getElementById("recorrente-check");
const orcamentoCategoria = document.getElementById("orcamento-categoria");
const orcamentoValor = document.getElementById("orcamento-valor");
const addOrcamentoBtn = document.getElementById("add-orcamento");
const periodo1 = document.getElementById("periodo-1");
const periodo2 = document.getElementById("periodo-2");
const compararBtn = document.getElementById("comparar-btn");
const orcamentosGrid = document.getElementById("orcamentos-grid");
const comparativoResultado = document.getElementById("comparativo-resultado");
const resumoAnual = document.getElementById("resumo-anual");
const pageTitle = document.getElementById("page-title");

let transacoes = JSON.parse(localStorage.getItem("transacoes") || "[]");
let orcamentos = JSON.parse(localStorage.getItem("orcamentos") || "{}");
let filtroAtual = "all";
let filtroEspecial = null;
let busca = "";

const config = {
  categorias: ["Alimentação", "Transporte", "Moradia", "Saúde", "Lazer", "Educação", "Outros"],
  cores: ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"]
};

// ====== TABS ======
function abrirTab(tabName) {
  // Remover active de todos os botões e conteúdos
  document.querySelectorAll(".nav-link").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));

  // Adicionar active ao botão e conteúdo correto
  document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");
  const tabContent = document.querySelector(`.tab-content[data-tab="${tabName}"]`);
  if (tabContent) {
    tabContent.classList.add("active");
  }

  // Atualizar título
  const btnText = document.querySelector(`[data-tab="${tabName}"]`).textContent;
  pageTitle.textContent = btnText.substring(2).trim();

  // Renderizar conteúdo específico
  setTimeout(() => {
    if (tabName === "orcamento") renderizarOrcamentos();
    if (tabName === "relatorio") renderizarResumoAnual();
    if (tabName === "transacoes") renderizar();
    if (tabName === "dashboard") renderizar();
  }, 50);
}

document.querySelectorAll(".nav-link").forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    const tab = btn.dataset.tab;
    abrirTab(tab);
  });
});

// ====== EVENTOS PRINCIPAIS ======
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
    const tipo = btn.dataset.type;
    const especial = btn.dataset.special;
    filtroAtual = tipo || "all";
    filtroEspecial = especial || null;
    const dropdown = filterToggle.nextElementSibling;
    dropdown.classList.remove("active");
    renderizar();
  });
});

themeToggle.addEventListener("click", toggleTheme);
exportCsvBtn.addEventListener("click", exportarCSV);
monthFilter.addEventListener("change", renderizar);
searchInput.addEventListener("input", (e) => { busca = e.target.value.toLowerCase(); renderizar(); });

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

addOrcamentoBtn.addEventListener("click", adicionarOrcamento);
compararBtn.addEventListener("click", compararPeriodos);

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault();
    toggleTheme();
  }
});

// ====== TRANSAÇÕES ======
function adicionarTransacao(tipo) {
  const desc = form.querySelector('[data-field="descricao"]').value.trim();
  const valStr = form.querySelector('[data-field="valor"]').value.replace(/[R$\s]/g, '').replace(',', '.');
  const cat = form.querySelector('[data-field="categoria"]').value;
  const isRecorrente = recorrenteCheck.checked;

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
    dataISO: dataISO,
    recorrente: isRecorrente
  };

  transacoes.unshift(transacao);
  salvarLocal();
  form.reset();
  recorrenteCheck.checked = false;
  limparErros();
  renderizar();
}

function validarForm(desc, val, cat) {
  limparErros();
  let valido = true;
  if (!desc) { mostrarErro("descricao", "Descrição obrigatória"); valido = false; }
  if (!val || isNaN(val) || parseFloat(val) <= 0) { mostrarErro("valor", "Valor inválido"); valido = false; }
  if (!cat) { mostrarErro("categoria", "Selecione uma categoria"); valido = false; }
  return valido;
}

function mostrarErro(field, msg) {
  const input = form.querySelector(`[data-field="${field}"]`);
  input.classList.add("error");
  input.nextElementSibling.textContent = msg;
}

function limparErros() {
  form.querySelectorAll(".form-input").forEach(inp => inp.classList.remove("error"));
  form.querySelectorAll(".form-error").forEach(msg => msg.textContent = "");
}

function editarTransacao(idParam) {
  const id = parseInt(idParam);
  const t = transacoes.find(x => x.id === id);
  if (!t) return;
  form.querySelector('[data-field="descricao"]').value = t.descricao;
  form.querySelector('[data-field="valor"]').value = `R$ ${t.valor.toFixed(2)}`;
  form.querySelector('[data-field="categoria"]').value = t.categoria;
  transacoes = transacoes.filter(x => x.id !== id);
  salvarLocal();
  renderizar();
  form.querySelector('[data-field="descricao"]').focus();
}

function renderizar() {
  const mesFilter = monthFilter.value;
  const filtrados = transacoes.filter(t => {
    if (filtroAtual !== "all" && t.tipo !== filtroAtual) return false;
    if (mesFilter && !t.dataISO.startsWith(mesFilter)) return false;
    if (busca && !t.descricao.toLowerCase().includes(busca)) return false;
    if (filtroEspecial === "recorrentes" && !t.recorrente) return false;
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
        <span class="transaction-description">${t.descricao}${t.recorrente ? ' 🔄' : ''}</span>
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
  renderizarInsights();
}

// ====== RESUMO E INSIGHTS ======
function atualizarResumo() {
  const entradas = transacoes.filter(t => t.tipo === "entrada").reduce((a, b) => a + b.valor, 0);
  const saidas = transacoes.filter(t => t.tipo === "saida").reduce((a, b) => a + b.valor, 0);
  document.querySelector("[data-income]").textContent = `R$ ${entradas.toFixed(2)}`;
  document.querySelector("[data-expense]").textContent = `R$ ${saidas.toFixed(2)}`;
  document.querySelector("[data-balance]").textContent = `R$ ${(entradas - saidas).toFixed(2)}`;
}

function renderizarInsights() {
  const mesAtual = monthFilter.value || new Date().toISOString().slice(0, 7);
  const mesFiltrado = transacoes.filter(t => t.dataISO.startsWith(mesAtual));

  // Maior gasto
  if (mesFiltrado.length > 0) {
    const maiorGasto = mesFiltrado.reduce((max, t) => t.tipo === "saida" && t.valor > max.valor ? t : max, mesFiltrado[0]);
    document.getElementById("maior-gasto").textContent = `R$ ${maiorGasto.valor.toFixed(2)}`;
    document.getElementById("maior-gasto-cat").textContent = maiorGasto.descricao;
  }

  // Categoria top
  const categoriaCount = {};
  mesFiltrado.filter(t => t.tipo === "saida").forEach(t => {
    categoriaCount[t.categoria] = (categoriaCount[t.categoria] || 0) + t.valor;
  });
  const catTop = Object.entries(categoriaCount).sort((a, b) => b[1] - a[1])[0];
  if (catTop) {
    document.getElementById("categoria-top").textContent = catTop[0];
    document.getElementById("categoria-top-valor").textContent = `R$ ${catTop[1].toFixed(2)}`;
  }

  // Média diária
  const diasNoMes = new Date(mesAtual.split('-')[0], mesAtual.split('-')[1], 0).getDate();
  const totalSaida = mesFiltrado.filter(t => t.tipo === "saida").reduce((a, b) => a + b.valor, 0);
  const media = totalSaida / diasNoMes;
  document.getElementById("media-diaria").textContent = `R$ ${media.toFixed(2)}`;
  const diaAtual = new Date().getDate();
  document.getElementById("dias-restantes").textContent = `${diasNoMes - diaAtual} dias restantes`;

  // Comparativo com mês anterior
  const mesAnterior = new Date(mesAtual + "-01");
  mesAnterior.setMonth(mesAnterior.getMonth() - 1);
  const mesAnteriorStr = mesAnterior.toISOString().slice(0, 7);
  const saidaMesAnterior = transacoes.filter(t => t.dataISO.startsWith(mesAnteriorStr) && t.tipo === "saida").reduce((a, b) => a + b.valor, 0);
  const diferenca = totalSaida - saidaMesAnterior;
  const percentual = saidaMesAnterior > 0 ? ((diferenca / saidaMesAnterior) * 100).toFixed(0) : 0;
  document.getElementById("comparativo-anterior").textContent = diferenca >= 0 ? `+R$ ${diferenca.toFixed(2)}` : `R$ ${diferenca.toFixed(2)}`;
  document.getElementById("comparativo-percent").textContent = `${percentual > 0 ? '+' : ''}${percentual}%`;
}

// ====== GRÁFICO ======
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
  categoryChart.height = 280;

  if (total === 0) {
    ctx.font = "16px sans-serif";
    ctx.fillStyle = "#6b7280";
    ctx.textAlign = "center";
    ctx.fillText("Sem gastos", categoryChart.width / 2, categoryChart.height / 2);
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
  ctx.fillStyle = "#6b7280";
  let legendY = 20;
  labels.forEach((label, i) => {
    ctx.fillStyle = config.cores[i % config.cores.length];
    ctx.fillRect(10, legendY, 12, 12);
    ctx.fillStyle = "#6b7280";
    ctx.textAlign = "left";
    ctx.fillText(label, 28, legendY + 6);
    legendY += 18;
  });
}

// ====== ORÇAMENTOS ======
function adicionarOrcamento() {
  const cat = orcamentoCategoria.value;
  const valor = parseFloat(orcamentoValor.value);
  if (!cat || !valor || valor <= 0) return alert("Preencha categoria e valor");
  orcamentos[cat] = valor;
  localStorage.setItem("orcamentos", JSON.stringify(orcamentos));
  orcamentoCategoria.value = "";
  orcamentoValor.value = "";
  renderizarOrcamentos();
}

function renderizarOrcamentos() {
  orcamentosGrid.innerHTML = "";
  Object.entries(orcamentos).forEach(([cat, limite]) => {
    const gasto = transacoes.filter(t => t.tipo === "saida" && t.categoria === cat).reduce((a, b) => a + b.valor, 0);
    const percentual = (gasto / limite) * 100;
    const status = percentual > 100 ? "danger" : percentual > 80 ? "warning" : "";
    orcamentosGrid.innerHTML += `
      <div class="orcamento-item">
        <div class="orcamento-header">
          <span class="orcamento-categoria">${cat}</span>
          <button class="orcamento-delete" data-cat="${cat}">×</button>
        </div>
        <div class="orcamento-bar">
          <div class="orcamento-progress ${status}" style="width: ${Math.min(percentual, 100)}%"></div>
        </div>
        <div class="orcamento-info">
          <span>R$ ${gasto.toFixed(2)}</span>
          <span>R$ ${limite.toFixed(2)}</span>
        </div>
      </div>
    `;
  });

  orcamentosGrid.querySelectorAll(".orcamento-delete").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const cat = e.target.dataset.cat;
      delete orcamentos[cat];
      localStorage.setItem("orcamentos", JSON.stringify(orcamentos));
      renderizarOrcamentos();
    });
  });
}

// ====== RELATÓRIOS ======
function compararPeriodos() {
  const mes1 = periodo1.value;
  const mes2 = periodo2.value;
  if (!mes1 || !mes2) return alert("Selecione dois períodos");

  const trans1 = transacoes.filter(t => t.dataISO.startsWith(mes1));
  const trans2 = transacoes.filter(t => t.dataISO.startsWith(mes2));

  const entrada1 = trans1.filter(t => t.tipo === "entrada").reduce((a, b) => a + b.valor, 0);
  const saida1 = trans1.filter(t => t.tipo === "saida").reduce((a, b) => a + b.valor, 0);
  const entrada2 = trans2.filter(t => t.tipo === "entrada").reduce((a, b) => a + b.valor, 0);
  const saida2 = trans2.filter(t => t.tipo === "saida").reduce((a, b) => a + b.valor, 0);

  const changeEntrada = entrada2 - entrada1;
  const changeSaida = saida2 - saida1;

  comparativoResultado.innerHTML = `
    <div class="comparativo-card">
      <div class="comparativo-label">Entradas ${mes1}</div>
      <div class="comparativo-value" style="color: #10b981;">R$ ${entrada1.toFixed(2)}</div>
    </div>
    <div class="comparativo-card">
      <div class="comparativo-label">Entradas ${mes2}</div>
      <div class="comparativo-value" style="color: #10b981;">R$ ${entrada2.toFixed(2)}</div>
      <div class="comparativo-change ${changeEntrada >= 0 ? 'positive' : 'negative'}">${changeEntrada >= 0 ? '+' : ''}${changeEntrada.toFixed(2)}</div>
    </div>
    <div class="comparativo-card">
      <div class="comparativo-label">Saídas ${mes1}</div>
      <div class="comparativo-value" style="color: #ef4444;">R$ ${saida1.toFixed(2)}</div>
    </div>
    <div class="comparativo-card">
      <div class="comparativo-label">Saídas ${mes2}</div>
      <div class="comparativo-value" style="color: #ef4444;">R$ ${saida2.toFixed(2)}</div>
      <div class="comparativo-change ${changeSaida <= 0 ? 'positive' : 'negative'}">${changeSaida >= 0 ? '+' : ''}${changeSaida.toFixed(2)}</div>
    </div>
  `;
  comparativoResultado.style.display = "grid";
}

function renderizarResumoAnual() {
  const meses = {};
  transacoes.forEach(t => {
    const mes = t.dataISO.slice(0, 7);
    if (!meses[mes]) meses[mes] = { entrada: 0, saida: 0 };
    if (t.tipo === "entrada") meses[mes].entrada += t.valor;
    else meses[mes].saida += t.valor;
  });

  resumoAnual.innerHTML = "";
  Object.entries(meses).sort().forEach(([mes, dados]) => {
    const saldo = dados.entrada - dados.saida;
    resumoAnual.innerHTML += `
      <div class="resumo-mes">
        <div class="resumo-label">${mes}</div>
        <div class="resumo-valor" style="color: #10b981;">↑ ${dados.entrada.toFixed(0)}</div>
        <div class="resumo-valor" style="color: #ef4444; margin: 4px 0;">↓ ${dados.saida.toFixed(0)}</div>
        <div class="resumo-valor">${saldo.toFixed(0)}</div>
      </div>
    `;
  });
}

// ====== UTILIDADES ======
function salvarLocal() {
  localStorage.setItem("transacoes", JSON.stringify(transacoes));
}

function exportarCSV() {
  if (transacoes.length === 0) { alert("Nenhuma transação para exportar"); return; }
  const csv = "Data,Descrição,Categoria,Tipo,Valor\n" +
    transacoes.map(t => `${t.data},"${t.descricao}",${t.categoria},${t.tipo},${t.valor.toFixed(2)}`).join("\n");
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
// Inicializar primeiro tab
abrirTab("dashboard");
renderizar();