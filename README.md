# Controle Financeiro

[![CI](https://github.com/MatheusBrazolin/financial-control-js/actions/workflows/ci.yml/badge.svg)](https://github.com/MatheusBrazolin/financial-control-js/actions/workflows/ci.yml)

Aplicativo de finanças pessoais em **HTML, CSS e JavaScript puro** — sem framework, sem build, sem dependências. Os dados ficam no `localStorage` do próprio navegador; nada é enviado para servidor nenhum.

🔗 **Demo:** https://controlefinanceiro-rouge.vercel.app

---

## Funcionalidades

**Lançamentos**
- Entradas e saídas com descrição, valor, data e categoria — categorias separadas por tipo, para "Salário" não aparecer numa despesa
- Edição, duplicação e exclusão, as duas últimas com **desfazer**
- Transações recorrentes: o lançamento se repete sozinho nos meses seguintes, respeitando meses curtos (31/01 → 28/02), com fim opcional e botão para encerrar a série
- **Etiquetas** livres e **observação** em cada lançamento — clicar numa etiqueta filtra por ela em todos os meses
- Busca por descrição, categoria, etiqueta ou observação; filtro por tipo, categoria e etiqueta; ordenação por data ou valor
- Busca **em todos os meses**, não só no mês aberto
- Total do que está filtrado no rodapé da tabela

**Visão do mês**
- Entradas, saídas e saldo do mês selecionado, com taxa de poupança
- Maior gasto, categoria que mais pesou, média diária e projeção de fechamento
- Variação de gastos contra o mês anterior
- Rosca de gastos por categoria, desenhada em `<canvas>` com tooltip

**Orçamentos**
- Limite mensal por categoria, comparado só com o gasto **daquele mês**
- O limite vale do mês em que foi definido em diante: mudar o teto hoje **não reescreve os meses já fechados**
- Barra de progresso com alerta a partir de 80% e marcação de estouro

**Metas**
- Alvo, prazo opcional e registro dos aportes
- Mostra quanto falta por mês até o prazo, se você está no ritmo e em que mês a meta fecha mantendo a média atual

**Relatórios**
- Entradas × saídas dos últimos 12 meses em gráfico de barras
- Comparativo entre dois meses quaisquer, com variação absoluta e percentual
- Resumo mês a mês

**Dados e interface**
- Exportar CSV (separador `;` e BOM UTF-8 — abre certo no Excel em português)
- Backup e restauração em JSON
- **Instalável e offline**: service worker + manifesto, funciona sem internet e abre como app no celular e no desktop
- Tema claro/escuro, seguindo a preferência do sistema na primeira visita
- Layout responsivo: no celular a tabela vira lista de cartões
- Conjunto de ícones próprio em SVG inline (`src/ui/icons.js`), sem emoji e sem biblioteca
- Tipografia Inter hospedada no projeto — nenhuma requisição sai para terceiros, e o offline continua valendo
- Navegação por teclado, foco visível, rótulos e `aria-*` nos componentes
- Atalhos (`?` mostra a lista): `N` nova transação · `/` buscar · `←` `→` trocar de mês · `Ctrl`/`⌘ + J` alternar tema

---

## Como rodar

O projeto usa ES Modules, então precisa ser servido por HTTP (abrir o `index.html` direto pelo `file://` não funciona).

```bash
npm start          # sobe em http://localhost:4173
```

O `npm start` usa um servidor estático de ~50 linhas em `scripts/serve.mjs`, escrito com os módulos nativos do Node — não baixa nada. Qualquer outro servidor estático também serve.

## Testes

As regras de negócio ficam isoladas em módulos puros (`src/domain/`), sem DOM e sem `localStorage` — o que as torna testáveis direto no Node, sem nenhuma biblioteca:

```bash
npm test
```

São **94 testes** cobrindo conversão de moeda, datas, recorrências (inclusive o fim da série e o mês curto), filtros, etiquetas, estatísticas, orçamentos por mês, metas, duplicação e exportação.

O `store` também é testado, com um dublê de `localStorage` que sabe simular cota cheia (`tests/store.test.js`) — é onde mora o risco de perder dados, então migração, recorrência e falha de gravação têm teste próprio.

O CI roda tudo isso a cada push e pull request.

---

## Estrutura

```
index.html                 markup semântico das quatro telas
manifest.webmanifest       instalação como app
sw.js                      cache offline (nunca toca nos seus dados)
assets/css/styles.css      tokens de tema, escala tipográfica, componentes
assets/fonts/              Inter (SIL OFL 1.1), ver fonts/README.md
assets/icon*.png|svg       ícones, gerados por npm run icons
scripts/serve.mjs          servidor estático de desenvolvimento
scripts/build-icons.mjs    gera os PNGs do manifesto (PNG escrito na mão)
src/
  main.js                  entrada: roteador, atalhos, import/export
  core/store.js            estado, persistência e migração dos dados
  domain/                  regras puras (testadas)
    money.js               parse e formatação em centavos
    dates.js               mês, dias e datas ISO sem fuso
    transactions.js        modelo, validação, recorrência, filtros
    stats.js               totais, indicadores, orçamentos, séries
    export.js              CSV e backup JSON
    budgets.js             limites por mês, com herança
    goals.js               metas, aportes e projeção
  ui/
    dom.js                 criação de nós (sem innerHTML)
    icons.js               ícones SVG, na mesma grade e traço
    feedback.js            toasts e diálogos de confirmação
    charts.js              rosca e barras em canvas
    transaction-form.js    formulário modal de criar/editar
    views/                 dashboard, transações, orçamentos, metas, relatórios
tests/                     node:test sobre src/domain
```

### Decisões de projeto

- **Dinheiro em centavos.** Todo valor é um inteiro. Em ponto flutuante, `0.1 + 0.2 !== 0.3`, e num app de finanças esse centavo aparece.
- **Datas como string.** `"2026-03-07"` em vez de `Date`. `new Date().toISOString()` devolve UTC e viraria o dia para quem lança uma despesa às 22h.
- **Nada de `innerHTML` com dado do usuário.** Os nós são criados com `textContent`, então uma descrição com `<script>` entra como texto.
- **Domínio separado da interface.** As funções que calculam não conhecem o DOM — por isso dá para testá-las sem navegador.
- **Uma só fonte de verdade.** A UI nunca escreve no `localStorage`; só o `store` faz isso, e avisa quem precisa redesenhar.
- **Orçamento é histórico, não configuração.** Os limites são guardados por mês (`{ "2026-11": { … } }`), com herança do mês definido mais recente. Um único limite por categoria faria mudar o teto hoje reescrever o passado.
- **Falha de gravação é avisada.** Se o `localStorage` recusar a escrita no meio do uso, o app avisa na hora e sugere exportar um backup, em vez de deixar você lançar no vazio.

### Migração automática

Quem já usava a versão anterior não perde nada: os dados antigos (`transacoes` e `orcamentos` em reais, com campos em português) são lidos, convertidos para o formato novo e regravados na primeira abertura.

---

## Licença

MIT
