const botaoEntrada = document.querySelector(".btn.income-btn");
const botaoSaida = document.querySelector(".btn.expense-btn");
const formulario = document.querySelector(".transaction-form");
const lista = document.querySelector(".transaction-list");
const saldoDisplay = document.querySelector(".summary");

const filterToggle = document.getElementById("filter-toggle");
const filterMenu = document.querySelector(".filter-menu");
const filterButtons = document.querySelectorAll(".filter-btn");

const themeToggle = document.getElementById("theme-toggle");
const exportCsvBtn = document.getElementById("export-csv");

let transacoes = JSON.parse(localStorage.getItem("transacoes") || "[]");

// --- EVENTOS ---
botaoEntrada.addEventListener("click", () => adicionarTransacao("entrada"));
botaoSaida.addEventListener("click", () => adicionarTransacao("saida"));
filterToggle.addEventListener("click", () => filterMenu.classList.toggle("hidden"));
themeToggle.addEventListener("click", toggleTheme);
exportCsvBtn.addEventListener("click", exportarCSV);

filterButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const tipo = btn.dataset.type;
    renderizarTransacoes(tipo);
    filterMenu.classList.add("hidden");
  });
});

// --- FORMATAR MOEDA ---
const valorInput = document.getElementById("valor-input");
valorInput.addEventListener("input", (e) => {
  let val = e.target.value.replace(/\D/g,'');
  val = (val/100).toFixed(2);
  e.target.value = val ? `R$ ${val}` : '';
});

// --- FUNÇÕES ---
function adicionarTransacao(tipo){
  const nova = dadosFormulario(tipo);
  if(!nova) return;

  transacoes.push(nova);
  salvarLocal();
  renderizarTransacoes();
}

function dadosFormulario(tipo){
  const desc = formulario.querySelector('input[type="text"]').value.trim();
  const valInput = formulario.querySelector('#valor-input').value.replace(/[R$\s]/g,'').replace(',', '.');
  const cat = formulario.querySelector('select').value;

  if(!desc || !valInput || !cat) return alert("Preencha todos os campos");

  const transacao = {
    descricao: desc,
    valor: parseFloat(valInput),
    categoria: cat,
    tipo: tipo,
    data: new Date().toLocaleDateString()
  };

  formulario.reset();
  return transacao;
}

function renderizarTransacoes(filtro="all"){
  lista.innerHTML = "";

  transacoes.forEach((t,index) => {
    if(filtro !== "all" && t.tipo !== filtro) return;

    const li = document.createElement("li");
    li.classList.add(t.tipo === "entrada" ? "income-item" : "expense-item");
    li.innerHTML = `
      <span>${t.data}</span>
      <span>${t.categoria}</span>
      <span>${t.descricao}</span>
      <span>R$ ${t.valor.toFixed(2)}</span>
      <button class="delete-btn" onclick="deletarTransacao(${index})">Excluir</button>
    `;
    lista.appendChild(li);
  });

  atualizarResumo();
}

function deletarTransacao(index){
  if(confirm("Deseja realmente excluir esta transação?")){
    transacoes.splice(index,1);
    salvarLocal();
    renderizarTransacoes();
  }
}

function atualizarResumo(){
  const entradas = transacoes.filter(t => t.tipo==="entrada").reduce((a,b)=>a+b.valor,0);
  const saidas = transacoes.filter(t => t.tipo==="saida").reduce((a,b)=>a+b.valor,0);
  saldoDisplay.querySelector(".income .value").textContent = `R$ ${entradas.toFixed(2)}`;
  saldoDisplay.querySelector(".expense .value").textContent = `R$ ${saidas.toFixed(2)}`;
  saldoDisplay.querySelector(".total .value").textContent = `R$ ${(entradas - saidas).toFixed(2)}`;
}

function salvarLocal(){
  localStorage.setItem("transacoes", JSON.stringify(transacoes));
}

// --- EXPORT CSV ---
function exportarCSV(){
  if(transacoes.length===0) return alert("Nenhuma transação para exportar");
  const cabecalho = ["Data","Categoria","Descrição","Tipo","Valor"];
  const linhas = transacoes.map(t=>[t.data,t.categoria,t.descricao,t.tipo,t.valor.toFixed(2)]);
  let csv = [cabecalho,...linhas].map(e=>e.join(";")).join("\n"); // ponto e vírgula

  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'transacoes.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// --- TEMA CLARO/ESCUR0 ---
function toggleTheme(){
  document.body.classList.toggle("dark");
}

// --- CARREGAR HISTÓRICO AO ABRIR ---
renderizarTransacoes();
