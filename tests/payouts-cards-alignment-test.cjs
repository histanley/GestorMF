const fs = require('fs');
const assert = require('assert');
const path = require('path');

console.log('🧪 Iniciando testes de Alinhamento e Altura dos Cards de Resumo (FIN-07)...');

// 1. Validar TeamPayoutsDashboard.jsx
const tpdJsx = fs.readFileSync(path.join(__dirname, '../src/components/TeamPayoutsDashboard.jsx'), 'utf8');

assert(tpdJsx.includes('psc-status-stacked'), 'TeamPayoutsDashboard deve conter container psc-status-stacked');
assert(tpdJsx.includes('psc-status-row is-paid'), 'TeamPayoutsDashboard deve renderizar linha de Pagos');
assert(tpdJsx.includes('psc-status-row is-pending'), 'TeamPayoutsDashboard deve renderizar linha de Pendentes');
assert(!tpdJsx.includes('psc-add-badge'), 'TeamPayoutsDashboard não deve conter o botão duplicado psc-add-badge no card');

// Garantir ordem: Pagos em cima, Pendentes embaixo
const paidIndex = tpdJsx.indexOf('psc-status-row is-paid');
const pendingIndex = tpdJsx.indexOf('psc-status-row is-pending');
assert(paidIndex < pendingIndex, 'A informação de Pagos deve estar acima da informação de Pendentes');
console.log('  ✅ Estrutura JSX validada: Pagos em cima, Pendentes embaixo com alinhamento');

// 2. Validar App.css
const css = fs.readFileSync(path.join(__dirname, '../src/App.css'), 'utf8');

assert(css.includes('.payouts-summary-grid'), 'App.css deve conter .payouts-summary-grid');
assert(css.includes('min-height: 104px'), 'App.css deve padronizar a altura mínima dos cards (.payout-summary-card)');
assert(css.includes('.psc-status-stacked'), 'App.css deve conter estilos para .psc-status-stacked');
assert(css.includes('.psc-status-row'), 'App.css deve conter estilos para .psc-status-row');
assert(css.includes('.psc-status-dot'), 'App.css deve conter indicadores .psc-status-dot');
assert(css.includes('.psc-status-num'), 'App.css deve conter alinhamento numérico .psc-status-num');
assert(css.includes('.psc-status-text'), 'App.css deve conter alinhamento de texto .psc-status-text');
console.log('  ✅ Estilos CSS validados: Mesma altura uniforme e alinhamento vertical/horizontal');

console.log('🎉 Todos os testes de Alinhamento e Altura dos Cards passaram com 100% de sucesso!');
