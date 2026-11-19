const fs = require('fs');
const assert = require('assert');

console.log('🧪 Iniciando testes do Detalhamento Financeiro Oficial (Termo Timbrado A4 / PDF / WhatsApp)...');

// 1. Verificar FinancialOfficialStatementModal.jsx
const modalCode = fs.readFileSync('src/components/FinancialOfficialStatementModal.jsx', 'utf8');

assert.ok(modalCode.includes('rc-modal-topbar'), 'Deve conter a barra superior rc-modal-topbar');
assert.ok(modalCode.includes('rc-action-whatsapp'), 'Deve conter botão WhatsApp na barra superior');
assert.ok(modalCode.includes('rc-action-download'), 'Deve conter botão Baixar PDF na barra superior');
assert.ok(modalCode.includes('rc-action-print'), 'Deve conter botão Imprimir na barra superior');
assert.ok(modalCode.includes('handleDownloadPdf'), 'Deve conter handler de download com jsPDF e html2canvas');
assert.ok(modalCode.includes('handleShareWhatsApp'), 'Deve conter handler de envio e cópia para WhatsApp');
assert.ok(modalCode.includes('QRCode.toDataURL'), 'Deve conter geração de QR Code de validação pública');
assert.ok(modalCode.includes('AUTENTICAÇÃO DIGITAL SISTÊMICA'), 'Deve conter selo de autenticação sistêmica com hash');
assert.ok(modalCode.includes('rc-doc-header-official'), 'Deve conter cabeçalho oficial timbrado MegaFilmes');
assert.ok(modalCode.includes('COMPROVANTE OFICIAL DE FECHAMENTO FINANCEIRO'), 'Deve conter título oficial do comprovante');
assert.ok(modalCode.includes('rc-items-table'), 'Deve conter tabela de discriminação dos lançamentos operacionais');
assert.ok(modalCode.includes('CONDIÇÕES GERAIS DE FECHAMENTO FINANCEIRO'), 'Deve conter cláusulas e regras financeiras da empresa');
console.log('  ✅ Componente FinancialOfficialStatementModal.jsx validado com sucesso');

// 2. Verificar CollaboratorSpace.jsx
const csCode = fs.readFileSync('src/components/CollaboratorSpace.jsx', 'utf8');

assert.ok(csCode.includes('FinancialOfficialStatementModal'), 'CollaboratorSpace deve importar FinancialOfficialStatementModal');
assert.ok(csCode.includes('isOfficialStatementModalOpen'), 'CollaboratorSpace deve gerenciar estado isOfficialStatementModalOpen');
assert.ok(csCode.includes('cs-btn-detalhes-fin'), 'CollaboratorSpace deve ter botão cs-btn-detalhes-fin');
assert.ok(csCode.includes('Detalhamento Financeiro'), 'Texto "Detalhamento Financeiro" deve estar presente no botão');
assert.ok(csCode.includes('<FinancialOfficialStatementModal'), 'CollaboratorSpace deve renderizar FinancialOfficialStatementModal');
console.log('  ✅ CollaboratorSpace.jsx validado com o botão Detalhamento Financeiro e abertura do modal oficial');

// 3. Verificar TeamPayoutsDashboard.jsx
const tpdCode = fs.readFileSync('src/components/TeamPayoutsDashboard.jsx', 'utf8');

assert.ok(tpdCode.includes('FinancialOfficialStatementModal'), 'TeamPayoutsDashboard deve importar FinancialOfficialStatementModal');
assert.ok(tpdCode.includes('officialStatementMember'), 'TeamPayoutsDashboard deve gerenciar officialStatementMember');
assert.ok(tpdCode.includes('cs-btn-detalhes-fin'), 'TeamPayoutsDashboard deve incluir botão Detalhamento Financeiro');
assert.ok(tpdCode.includes('<FinancialOfficialStatementModal'), 'TeamPayoutsDashboard deve renderizar FinancialOfficialStatementModal');
console.log('  ✅ TeamPayoutsDashboard.jsx validado com acesso ao extrato oficial no Raio-X do Admin');

// 4. Verificar App.css
const cssCode = fs.readFileSync('src/App.css', 'utf8');

assert.ok(cssCode.includes('.cs-btn-detalhes-fin'), 'App.css deve conter estilos para .cs-btn-detalhes-fin');
assert.ok(cssCode.includes('body.light-theme .cs-btn-detalhes-fin'), 'App.css deve conter estilo do botão para modo claro');
assert.ok(cssCode.includes('body.printing-official-statement'), 'App.css deve conter regras de impressão isolada para o extrato oficial');
console.log('  ✅ App.css validado com estilos e regras @media print');

console.log('🎉 Todos os testes do Detalhamento Financeiro Oficial passaram com 100% de sucesso!');
