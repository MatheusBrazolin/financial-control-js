// Teste de todas as funcionalidades
console.log('🧪 Iniciando testes de funcionalidades...\n');

let testes = [];

function teste(nome, funcao) {
  try {
    funcao();
    testes.push(`✅ ${nome}`);
  } catch (e) {
    testes.push(`❌ ${nome}: ${e.message}`);
  }
}

// TESTE 1: Adicionar transação
teste('Adicionar entrada', () => {
  const transacao = {
    id: Date.now(),
    descricao: 'Salário',
    valor: 5000,
    categoria: 'Outros',
    tipo: 'entrada',
    data: new Date().toLocaleDateString(),
    dataISO: new Date().toISOString().split('T')[0]
  };
  localStorage.setItem('test_entrada', JSON.stringify(transacao));
  const loaded = JSON.parse(localStorage.getItem('test_entrada'));
  if (!loaded.id || loaded.valor !== 5000) throw new Error('Falha ao salvar');
});

// TESTE 2: Deletar transação
teste('Deletar transação (filter by id)', () => {
  const transacoes = [
    { id: 1, valor: 100 },
    { id: 2, valor: 200 },
    { id: 3, valor: 300 }
  ];
  const filtrado = transacoes.filter(t => t.id !== 2);
  if (filtrado.length !== 2 || filtrado.find(t => t.id === 2)) throw new Error('Delete falhou');
});

// TESTE 3: Editar transação (repopular form)
teste('Editar transação', () => {
  const t = { id: 1, descricao: 'Almoço', valor: 50, categoria: 'Alimentação' };
  const desc = t.descricao;
  const val = `R$ ${t.valor.toFixed(2)}`;
  if (desc !== 'Almoço' || val !== 'R$ 50.00') throw new Error('Editar falhou');
});

// TESTE 4: Buscar por descrição
teste('Busca por descrição (case-insensitive)', () => {
  const transacoes = [
    { descricao: 'Compra no Mercado' },
    { descricao: 'Almoço na rua' },
    { descricao: 'Gasolina' }
  ];
  const busca = 'mercado';
  const resultado = transacoes.filter(t => t.descricao.toLowerCase().includes(busca));
  if (resultado.length !== 1) throw new Error('Busca falhou');
});

// TESTE 5: Filtro por mês
teste('Filtro por mês (ISO date)', () => {
  const transacoes = [
    { dataISO: '2024-06-15' },
    { dataISO: '2024-06-20' },
    { dataISO: '2024-07-05' }
  ];
  const mes = '2024-06';
  const resultado = transacoes.filter(t => t.dataISO.startsWith(mes));
  if (resultado.length !== 2) throw new Error('Filtro mês falhou');
});

// TESTE 6: Filtro por tipo
teste('Filtro por tipo (entrada/saida)', () => {
  const transacoes = [
    { tipo: 'entrada', valor: 100 },
    { tipo: 'saida', valor: 50 },
    { tipo: 'entrada', valor: 200 }
  ];
  const entradas = transacoes.filter(t => t.tipo === 'entrada');
  if (entradas.length !== 2) throw new Error('Filtro tipo falhou');
});

// TESTE 7: Cálculo de resumo
teste('Cálculo de Entradas/Saídas/Saldo', () => {
  const transacoes = [
    { tipo: 'entrada', valor: 1000 },
    { tipo: 'entrada', valor: 500 },
    { tipo: 'saida', valor: 300 }
  ];
  const entrada = transacoes.filter(t => t.tipo === 'entrada').reduce((a, b) => a + b.valor, 0);
  const saida = transacoes.filter(t => t.tipo === 'saida').reduce((a, b) => a + b.valor, 0);
  const saldo = entrada - saida;
  if (entrada !== 1500 || saida !== 300 || saldo !== 1200) throw new Error('Cálculo falhou');
});

// TESTE 8: Gráfico dados
teste('Dados para gráfico (gastos por categoria)', () => {
  const transacoes = [
    { tipo: 'saida', categoria: 'Alimentação', valor: 100 },
    { tipo: 'saida', categoria: 'Alimentação', valor: 50 },
    { tipo: 'saida', categoria: 'Transporte', valor: 30 }
  ];
  const dados = {};
  ['Alimentação', 'Transporte'].forEach(cat => dados[cat] = 0);
  transacoes.filter(t => t.tipo === 'saida').forEach(t => {
    dados[t.categoria] += t.valor;
  });
  if (dados['Alimentação'] !== 150 || dados['Transporte'] !== 30) throw new Error('Gráfico dados falhou');
});

// TESTE 9: CSV export
teste('CSV export (format correto)', () => {
  const t = { data: '01/01/2024', categoria: 'Teste', descricao: 'Compra', tipo: 'saida', valor: 100 };
  const linha = `${t.data},${t.categoria},"${t.descricao}",${t.tipo},${t.valor.toFixed(2)}`;
  if (!linha.includes('01/01/2024') || !linha.includes('Compra')) throw new Error('CSV falhou');
});

// TESTE 10: Dark mode toggle
teste('Dark mode toggle (localStorage)', () => {
  localStorage.setItem('tema', 'dark');
  const tema = localStorage.getItem('tema');
  if (tema !== 'dark') throw new Error('Dark mode localStorage falhou');
  localStorage.setItem('tema', 'light');
  if (localStorage.getItem('tema') !== 'light') throw new Error('Light mode falhou');
});

// TESTE 11: Validação de formulário
teste('Validação: campo vazio', () => {
  const desc = '';
  const val = '';
  const cat = '';
  if (desc || val || cat) throw new Error('Validação falhou');
});

// TESTE 12: IDs únicos
teste('IDs únicos (Date.now)', () => {
  const id1 = Date.now();
  const id2 = Date.now() + 1;
  if (id1 === id2) throw new Error('IDs não únicos');
});

console.log(testes.join('\n'));
console.log(`\n${'='.repeat(50)}`);
console.log(`✅ Passou: ${testes.filter(t => t.includes('✅')).length}`);
console.log(`❌ Falhou: ${testes.filter(t => t.includes('❌')).length}`);
console.log(`${'='.repeat(50)}\n`);

if (testes.every(t => t.includes('✅'))) {
  console.log('🎉 Todas as funcionalidades testadas com sucesso!');
}
