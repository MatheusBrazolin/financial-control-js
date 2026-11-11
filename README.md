# Controle Financeiro

Aplicativo de finanças pessoais em **HTML, CSS e JavaScript puro** — sem framework, sem build, sem dependências. Os dados ficam no `localStorage` do próprio navegador; nada é enviado para servidor nenhum.

🔗 **Demo:** https://controlefinanceiro-rouge.vercel.app

---

## Funcionalidades

**Lançamentos**
- Entradas e saídas com descrição, valor, data e categoria
- Edição e exclusão com **desfazer**
- Transações recorrentes: o lançamento se repete sozinho nos meses seguintes, respeitando meses curtos (31/01 → 28/02)
- Busca por descrição ou categoria, filtro por tipo e ordenação por data ou valor

**Visão do mês**
- Entradas, saídas e saldo do mês selecionado, com taxa de poupança
- Maior gasto, categoria que mais pesou, média diária e projeção de fechamento
- Variação de gastos contra o mês anterior
- Rosca de gastos por categoria, desenhada em `<canvas>` com tooltip

**Orçamentos**
- Limite mensal por categoria, comparado só com o gasto **daquele mês**
- Barra de progresso com alerta a partir de 80% e marcação de estouro

**Relatórios**
- Entradas × saídas dos últimos 12 meses em gráfico de barras
- Comparativo entre dois meses quaisquer, com variação absoluta e percentual
- Resumo mês a mês

**Dados e interface**
- Exportar CSV (separador `;` e BOM UTF-8 — abre certo no Excel em português)
- Backup e restauração em JSON
- Tema claro/escuro, seguindo a preferência do sistema na primeira visita
- Layout responsivo: no celular a tabela vira lista de cartões
- Navegação por teclado, foco visível, rótulos e `aria-*` nos componentes
- Atalhos: `N` nova transação · `/` buscar · `Ctrl`/`⌘ + J` alternar tema

---

## Como rodar

O projeto usa ES Modules, então precisa ser servido por HTTP (abrir o `index.html` direto pelo `file://` não funciona).

```bash
npm start          # sobe em http://localhost:4173
```

Ou qualquer servidor estático:

```bash
python3 -m http.server 4173
```

## Testes

As regras de negócio ficam isoladas em módulos puros (`src/domain/`), sem DOM e sem `localStorage` — o que as torna testáveis direto no Node, sem nenhuma biblioteca:

```bash
npm test
```

São 46 testes cobrindo conversão de moeda, datas, recorrências, filtros, estatísticas, orçamentos e exportação.

---

## Estrutura

```
index.html                 markup semântico das quatro telas
assets/css/styles.css      tokens de tema, componentes e responsivo
src/
  main.js                  entrada: roteador, atalhos, import/export
  core/store.js            estado, persistência e migração dos dados
  domain/                  regras puras (testadas)
    money.js               parse e formatação em centavos
    dates.js               mês, dias e datas ISO sem fuso
    transactions.js        modelo, validação, recorrência, filtros
    stats.js               totais, indicadores, orçamentos, séries
    export.js              CSV e backup JSON
  ui/
    dom.js                 criação de nós (sem innerHTML)
    feedback.js            toasts e diálogos de confirmação
    charts.js              rosca e barras em canvas
    transaction-form.js    formulário modal de criar/editar
    views/                 dashboard, transações, orçamentos, relatórios
tests/                     node:test sobre src/domain
```

### Decisões de projeto

- **Dinheiro em centavos.** Todo valor é um inteiro. Em ponto flutuante, `0.1 + 0.2 !== 0.3`, e num app de finanças esse centavo aparece.
- **Datas como string.** `"2026-03-07"` em vez de `Date`. `new Date().toISOString()` devolve UTC e viraria o dia para quem lança uma despesa às 22h.
- **Nada de `innerHTML` com dado do usuário.** Os nós são criados com `textContent`, então uma descrição com `<script>` entra como texto.
- **Domínio separado da interface.** As funções que calculam não conhecem o DOM — por isso dá para testá-las sem navegador.
- **Uma só fonte de verdade.** A UI nunca escreve no `localStorage`; só o `store` faz isso, e avisa quem precisa redesenhar.

### Migração automática

Quem já usava a versão anterior não perde nada: os dados antigos (`transacoes` e `orcamentos` em reais, com campos em português) são lidos, convertidos para o formato novo e regravados na primeira abertura.

---

## Licença

MIT
