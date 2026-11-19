const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Iniciando testes da barra de saudação (Layout Empilhado & Alinhado)...');

const headerPath = path.resolve(__dirname, '../src/components/SmartHeaderGreeting.jsx');
const cssPath = path.resolve(__dirname, '../src/App.css');

const headerJsx = fs.readFileSync(headerPath, 'utf8');
const appCss = fs.readFileSync(cssPath, 'utf8');

// 1. Garantir que "Pulso Operacional" foi completamente removido
assert.strictEqual(
  headerJsx.includes('sh-hero-center-radar'),
  false,
  'O bloco sh-hero-center-radar não deve existir no JSX'
);

assert.strictEqual(
  headerJsx.includes('PULSO OPERACIONAL'),
  false,
  'O texto "PULSO OPERACIONAL" não deve existir mais no cabeçalho'
);

assert.strictEqual(
  appCss.includes('.sh-hero-center-radar'),
  false,
  'App.css não deve mais conter regras ativas para .sh-hero-center-radar'
);

// 2. Garantir que Saudação, Último Login e Data estão empilhados em linhas dedicadas e alinhadas
assert.strictEqual(
  headerJsx.includes('className="sh-hero-greeting-row"'),
  true,
  'Deve conter a linha de saudação sh-hero-greeting-row'
);

assert.strictEqual(
  headerJsx.includes('className="sh-hero-login-row"'),
  true,
  'Deve conter a linha dedicada de último login sh-hero-login-row'
);

assert.strictEqual(
  headerJsx.includes('className="sh-hero-date-row"'),
  true,
  'Deve conter a linha dedicada da data oficial sh-hero-date-row'
);

// 3. Verificar classes de estilo no App.css
assert.strictEqual(
  appCss.includes('.sh-hero-login-row'),
  true,
  'App.css deve estilizar .sh-hero-login-row'
);

assert.strictEqual(
  appCss.includes('.sh-hero-date-row'),
  true,
  'App.css deve estilizar .sh-hero-date-row'
);

assert.strictEqual(
  appCss.includes('.sh-login-line-item'),
  true,
  'App.css deve estilizar .sh-login-line-item'
);

console.log('✅ Todos os testes de layout empilhado e alinhado da barra de saudação passaram com 100% de sucesso!');
