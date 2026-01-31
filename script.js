const botaoEntrada = document.querySelector(".btn.income-btn");
const botaoSaida = document.querySelector(".btn.expense-btn");
const formulario = document.querySelector(".transaction-form");
const lista = document.querySelector(".transaction-list");
const saldoDisplay = document.querySelector(".summary");

let transacoes = [];

renderizarTransacoes();

botaoEntrada.addEventListener("click", () => {
    adicionarTransacao("entrada");
});

botaoSaida.addEventListener("click", () => {
    adicionarTransacao("saida");
});

function adicionarTransacao(tipo) {
    const novaTransacao = dadosFormulario(tipo);
    if (!novaTransacao) return;

    transacoes.push(novaTransacao);

    renderizarTransacoes();

    console.log(transacoes);
}

function dadosFormulario(tipo) {
    const inputDescricao = formulario.querySelector('input[type="text"]');
    const inputValor = formulario.querySelector('input[type="number"]');
    const selectorCategoria = formulario.querySelector('select');
    if (inputValor.value === "" || isNaN(inputValor.value)) {
        alert("Por favor, insira um valor numérico válido.");
        return;
    }


    if (selectorCategoria.value === "") {
        alert("Por favor, selecione uma categoria.");
        return;
    }

    const transacao = {
        descricao: inputDescricao.value,
        valor: parseFloat(inputValor.value),
        categoria: selectorCategoria.value,
        tipo: tipo // "entrada" ou "saida"
    };

    formulario.reset();
    return transacao;
}


function renderizarTransacoes() {
    lista.innerHTML = "";

    transacoes.forEach((transacao) => {
        const li = document.createElement("li");

        li.classList.add(
            transacao.tipo === "entrada" ? "income-item" : "expense-item"
        );


        li.innerHTML = `
            <span>${transacao.categoria}</span>
            <span>${transacao.descricao}</span>
            <span>R$ ${transacao.valor.toFixed(2)}</span>
        `;
        lista.appendChild(li);
    });

    //Atualizar display saldo
    calcularEntrada();
    atualizarEntradaDisplay();

    //Attualizar display saída
    calcularSaida();
    atualizarSaidaDisplay();

    //Atualizar display saldo total
    saldoTotal();
    atualizarSaldoTotalDisplay();
}

function calcularEntrada() {
    let saldo = 0;
    transacoes.forEach((transacao) => {
        if (transacao.tipo === "entrada") {
            saldo += transacao.valor;
        }
    });
    return saldo;
}

function atualizarEntradaDisplay() {
    const entrada = calcularEntrada();
    saldoDisplay.querySelector(".income .value").textContent = `R$ ${entrada.toFixed(2)}`;
}

function calcularSaida() {
    let saida = 0;
    transacoes.forEach((transacao) => {
        if (transacao.tipo === "saida") {
            saida += transacao.valor;
        }
    });
    return saida;
}

function atualizarSaidaDisplay() {
    const saida = calcularSaida();
    saldoDisplay.querySelector(".expense .value").textContent = `R$ ${saida.toFixed(2)}`;
}

function saldoTotal() {
    return calcularEntrada() - calcularSaida();
}

function atualizarSaldoTotalDisplay() {
    const total = saldoTotal();
    saldoDisplay.querySelector(".total .value").textContent = `R$ ${total.toFixed(2)}`;
}

