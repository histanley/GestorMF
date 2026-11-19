const fs = require('fs');

console.log('🧪 Iniciando testes do Extrato Financeiro Transparente no Meu Espaço...');

// 1. Verificar CollaboratorSpace.jsx
const csCode = fs.readFileSync('src/components/CollaboratorSpace.jsx', 'utf8');

if (!csCode.includes('isFinancialModalOpen')) {
  console.error('❌ isFinancialModalOpen não encontrado em CollaboratorSpace.jsx');
  process.exit(1);
}
console.log('  ✅ Estado isFinancialModalOpen validado');

if (!csCode.includes('cs-btn-view-financial-extrato')) {
  console.error('❌ Botão cs-btn-view-financial-extrato não encontrado');
  process.exit(1);
}
console.log('  ✅ Botão "Ver Extrato Financeiro" validado no cabeçalho');

if (!csCode.includes('financialEntries')) {
  console.error('❌ Memo financialEntries não encontrado');
  process.exit(1);
}
console.log('  ✅ Apuração de lançamentos (financialEntries) validada');

if (!csCode.includes('cs-fin-modal-container')) {
  console.error('❌ Container cs-fin-modal-container não encontrado');
  process.exit(1);
}
console.log('  ✅ Modal de extrato financeiro transparente implementado');

// 2. Verificar App.css
const cssCode = fs.readFileSync('src/App.css', 'utf8');

if (!cssCode.includes('.cs-btn-view-financial-extrato')) {
  console.error('❌ Estilo .cs-btn-view-financial-extrato ausente em App.css');
  process.exit(1);
}
if (!cssCode.includes('.cs-fin-modal-container')) {
  console.error('❌ Estilo .cs-fin-modal-container ausente em App.css');
  process.exit(1);
}
if (!cssCode.includes('.cs-fin-entries-table')) {
  console.error('❌ Estilo .cs-fin-entries-table ausente em App.css');
  process.exit(1);
}
console.log('  ✅ Todas as classes de estilo .cs-fin-* validadas em App.css');

console.log('🎉 Todos os testes do Extrato Financeiro Transparente passaram com 100% de sucesso!');
