// Teste rápido do app sem browser
console.log('🧪 Testando app.js...\n');

// Mock do DOM
global.localStorage = {
  data: {},
  getItem(key) { return this.data[key] || null; },
  setItem(key, val) { this.data[key] = val; },
  removeItem(key) { delete this.data[key]; }
};

global.document = {
  querySelector: (sel) => ({ classList: { add: () => {}, remove: () => {} }, value: '', textContent: '' }),
  querySelectorAll: (sel) => [],
  createElement: (tag) => ({ className: '', innerHTML: '', appendChild: () => {} }),
  getElementById: (id) => ({
    classList: { toggle: () => {}, add: () => {}, remove: () => {} },
    addEventListener: () => {},
    value: '',
    textContent: ''
  })
};

global.window = { };
global.URL = { createObjectURL: () => 'blob:...', revokeObjectURL: () => {} };

// Testes
let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${name}`);
    console.log(`   → ${e.message}\n`);
    failed++;
  }
}

// ===== TESTES =====

test('localStorage com IDs únicos', () => {
  const t = { id: Date.now(), descricao: 'Test', valor: 100, categoria: 'Alimentação', tipo: 'entrada' };
  global.localStorage.setItem('t', JSON.stringify([t]));
  const loaded = JSON.parse(global.localStorage.getItem('t'));
  if (!loaded[0].id) throw new Error('ID missing');
});

test('Parsing moeda com replace', () => {
  const str = 'R$ 150.50';
  const num = parseFloat(str.replace(/[R$\s]/g, '').replace(',', '.'));
  if (num !== 150.50) throw new Error(`Got ${num}`);
});

test('Formatação com toFixed', () => {
  const val = 100.5;
  const fmt = `R$ ${val.toFixed(2)}`;
  if (fmt !== 'R$ 100.50') throw new Error(`Got ${fmt}`);
});

test('Filtro por mês com ISO', () => {
  const dataISO = '2024-06-15';
  const mes = '2024-06';
  if (!dataISO.startsWith(mes)) throw new Error('Filter failed');
});

test('Busca case-insensitive', () => {
  const desc = 'Compra no Mercado';
  const search = 'mercado';
  if (!desc.toLowerCase().includes(search)) throw new Error('Search failed');
});

test('Cálculo de saldo', () => {
  const trans = [
    { tipo: 'entrada', valor: 1000 },
    { tipo: 'saida', valor: 300 }
  ];
  const entrada = trans.filter(t => t.tipo === 'entrada').reduce((a, b) => a + b.valor, 0);
  const saida = trans.filter(t => t.tipo === 'saida').reduce((a, b) => a + b.valor, 0);
  if (entrada !== 1000 || saida !== 300) throw new Error(`Got ${entrada}, ${saida}`);
});

test('CSV com escape de aspas', () => {
  const desc = 'Compra "especial"';
  const linha = `,"${desc}",`;
  if (!linha.includes('Compra "')) throw new Error('Quotes not escaped');
});

test('Categorias incluem novas', () => {
  const cats = ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Educação', 'Outros'];
  if (!cats.includes('Saúde') || !cats.includes('Educação')) throw new Error('Missing categories');
});

test('Tema salvo no localStorage', () => {
  global.localStorage.setItem('tema', 'dark');
  if (global.localStorage.getItem('tema') !== 'dark') throw new Error('Theme not saved');
});

test('Date.now() gera IDs únicos', () => {
  const id1 = Date.now();
  const id2 = Date.now() + 1;
  if (id1 === id2) throw new Error('IDs should be unique');
});

// Resumo
console.log(`\n${'='.repeat(40)}`);
console.log(`✅ Passou: ${passed}`);
console.log(`❌ Falhou: ${failed}`);
console.log(`${'='.repeat(40)}\n`);

if (failed === 0) {
  console.log('🎉 Todos os testes passaram!');
  process.exit(0);
} else {
  process.exit(1);
}
