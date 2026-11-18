const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Iniciando testes de redesign do Smart Header Greeting...');

const headerPath = path.resolve(__dirname, '../src/components/SmartHeaderGreeting.jsx');
const cssPath = path.resolve(__dirname, '../src/App.css');

const headerJsx = fs.readFileSync(headerPath, 'utf8');
const appCss = fs.readFileSync(cssPath, 'utf8');

// 1. Verificações no JSX
assert.strictEqual(
  headerJsx.includes('className="sh-avatar-hub"'),
  true,
  'SmartHeaderGreeting deve conter o sh-avatar-hub para foto/iniciais do usuário'
);

assert.strictEqual(
  headerJsx.includes('className="sh-avatar-badge"'),
  true,
  'SmartHeaderGreeting deve conter a insígnia sh-avatar-badge com o ícone de tempo'
);

assert.strictEqual(
  headerJsx.includes('className="sh-hero-center-radar"'),
  true,
  'SmartHeaderGreeting deve conter a central de comando sh-hero-center-radar'
);

assert.strictEqual(
  headerJsx.includes('PULSO OPERACIONAL'),
  true,
  'Deve conter o título PULSO OPERACIONAL'
);

assert.strictEqual(
  headerJsx.includes('AO VIVO'),
  true,
  'Deve conter a tag AO VIVO'
);

assert.strictEqual(
  headerJsx.includes('statsOverview'),
  true,
  'Deve calcular a telemetria em tempo real statsOverview'
);

assert.strictEqual(
  headerJsx.includes('className="sh-last-login-tag"'),
  true,
  'Deve exibir o chip de último login com dia e hora'
);

assert.strictEqual(
  headerJsx.includes('className="sh-date-tag"'),
  true,
  'Deve exibir o chip da data oficial com ícone'
);

// 2. Verificações no CSS
assert.strictEqual(
  appCss.includes('.sh-avatar-hub'),
  true,
  'App.css deve conter regras para .sh-avatar-hub'
);

assert.strictEqual(
  appCss.includes('.sh-hero-center-radar'),
  true,
  'App.css deve conter regras para .sh-hero-center-radar'
);

assert.strictEqual(
  appCss.includes('.sh-radar-pulse-dot'),
  true,
  'App.css deve conter animação e estilo para .sh-radar-pulse-dot'
);

assert.strictEqual(
  appCss.includes('.sh-radar-chip'),
  true,
  'App.css deve conter estilo para .sh-radar-chip'
);

assert.strictEqual(
  appCss.includes('[data-theme="light"] .sh-hero-center-radar'),
  true,
  'App.css deve conter suporte a tema claro para .sh-hero-center-radar'
);

console.log('✅ Todos os testes de redesign do Smart Header Greeting passaram com 100% de sucesso!');
