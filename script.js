let botaoEntrada = document.querySelector(".btn.income-btn");
let transacoes = [];

// Atualiza a tela
renderizarTransacoes();

botaoEntrada.addEventListener("click", () => {
    let novaTransacao = dadosFormulario();

    if (!novaTransacao) {
        return;
    }

    // Adiciona a nova transação ao array
    transacoes.push(novaTransacao);

    // Atualiza a tela
    renderizarTransacoes();
    console.log(transacoes);
    
});


function dadosFormulario() {
    let formulario = document.querySelector(".transaction-form");

    let inputDescricao = formulario.querySelector('input[type="text"]');
    let inputValor = formulario.querySelector('input[type="number"]');
    let selectorCategoria = formulario.querySelector('select');

    // Validação do valor
    if (inputValor.value === "" || isNaN(inputValor.value)) {
        alert("Por favor, insira um valor numérico válido.");
        return;
    }

    // Validação da categoria
    if (selectorCategoria.value === "") {
        alert("Por favor, selecione uma categoria.");
        return;
    }

    // Objeto da transação
    let novaTransacao = {
        descricao: inputDescricao.value,
        valor: parseFloat(inputValor.value),
        categoria: selectorCategoria.value
    };

    // Reseta o formulário 
    formulario.reset();

    return novaTransacao;
}


function renderizarTransacoes() {
    let lista = document.querySelector(".transaction-list");
    lista.innerHTML = "";

    transacoes.forEach((transacao) => {
        let li = document.createElement("li");
        li.classList.add("income-item");

        li.innerHTML = `
      <span>${transacao.categoria}</span>
      <span>${transacao.descricao}</span>
      <span>R$ ${transacao.valor.toFixed(2)}</span>
    `;

        lista.appendChild(li);
    });
}
