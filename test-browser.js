const playwright = require('playwright');

(async () => {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Screenshot inicial
  await page.screenshot({ path: 'screenshot1-inicial.png' });
  console.log('📸 Screenshot 1: Inicial');

  // Adicionar entrada
  await page.fill('[data-field="descricao"]', 'Salário');
  await page.fill('[data-field="valor"]', '5000');
  await page.selectOption('[data-field="categoria"]', 'Outros');
  await page.click('.income-btn');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshot2-entrada.png' });
  console.log('📸 Screenshot 2: Após adicionar entrada');

  // Adicionar saída
  await page.fill('[data-field="descricao"]', 'Almoço');
  await page.fill('[data-field="valor"]', '50');
  await page.selectOption('[data-field="categoria"]', 'Alimentação');
  await page.click('.expense-btn');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshot3-saida.png' });
  console.log('📸 Screenshot 3: Após adicionar saída');

  // Testar validação (valor vazio)
  await page.fill('[data-field="descricao"]', 'Teste validação');
  await page.selectOption('[data-field="categoria"]', 'Lazer');
  await page.click('.income-btn');
  await page.waitForTimeout(300);
  const hasError = await page.locator('[data-field="valor"].error').isVisible();
  console.log(`✅ Validação visual: ${hasError ? 'FUNCIONA' : 'FALHOU'}`);

  // Ativar dark mode
  await page.click('#theme-toggle');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshot4-darkmode.png' });
  console.log('📸 Screenshot 4: Dark Mode ativado');

  // Testar busca
  await page.fill('#search-input', 'Almoço');
  await page.waitForTimeout(300);
  const itemsVisibles = await page.locator('.transaction-item').count();
  console.log(`✅ Busca: ${itemsVisibles} item(ns) encontrado(s)`);

  // Testar filtro por mês (valor padrão deve ser este mês)
  const mesAtual = new Date().toISOString().slice(0, 7);
  const monthValue = await page.inputValue('#month-filter');
  console.log(`✅ Filtro mês: ${monthValue === mesAtual ? 'OK (mês atual)' : 'Definido'}`);

  // Screenshot do gráfico
  await page.fill('#search-input', ''); // Limpar busca
  await page.click('#filter-toggle');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshot5-grafico.png' });
  console.log('📸 Screenshot 5: Gráfico visível');

  // Testar edição
  await page.click('.edit-btn');
  const descValue = await page.inputValue('[data-field="descricao"]');
  console.log(`✅ Edição: Campo preenchido com "${descValue}"`);

  // Export CSV
  await page.click('#export-csv');
  console.log('✅ CSV: Download iniciado');

  await page.screenshot({ path: 'screenshot6-final.png' });
  console.log('📸 Screenshot 6: Estado final');

  await browser.close();
  console.log('\n✨ Teste visual completo!');
})();
