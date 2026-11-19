const fs = require('fs');
const assert = require('assert');

console.log('🧪 Iniciando testes da Folha Consolidada Oficial (Termo Timbrado A4 / PDF / WhatsApp)...');

// 1. Verificar PayrollOfficialStatementModal.jsx
const modalCode = fs.readFileSync('src/components/PayrollOfficialStatementModal.jsx', 'utf8');

assert.ok(modalCode.includes('rc-modal-topbar'), 'Deve conter a barra superior rc-modal-topbar');
assert.ok(modalCode.includes('rc-action-whatsapp'), 'Deve conter botão WhatsApp na barra superior');
assert.ok(modalCode.includes('rc-action-download'), 'Deve conter botão Baixar PDF na barra superior');
assert.ok(modalCode.includes('rc-action-print'), 'Deve conter botão Imprimir na barra superior');
assert.ok(modalCode.includes('handleDownloadPdf'), 'Deve conter exportação para PDF via html2canvas e jsPDF');
assert.ok(modalCode.includes('handleShareWhatsApp'), 'Deve conter resumo executivo para WhatsApp');
assert.ok(modalCode.includes('QRCode.toDataURL'), 'Deve conter geração de QR Code sistêmico');
assert.ok(modalCode.includes('rc-doc-header-official'), 'Deve conter cabeçalho timbrado oficial MegaFilmes');
assert.ok(modalCode.includes('RELATÓRIO CONSOLIDADO DE FECHAMENTO FINANCEIRO'), 'Deve conter título oficial da folha');
assert.ok(modalCode.includes('rc-items-table'), 'Deve conter tabela de discriminação dos colaboradores da folha');
assert.ok(modalCode.includes('TOTAL GERAL DA FOLHA'), 'Deve conter linha de rodapé com somatório geral consolidado');
assert.ok(modalCode.includes('DIRETRIZES CORPORATIVAS DE FECHAMENTO'), 'Deve conter cláusulas e regras de homologação da folha');
assert.ok(modalCode.includes('AUTENTICAÇÃO DIGITAL SISTÊMICA'), 'Deve conter autenticação sistêmica com hash e Lei 14.063/20');
console.log('  ✅ Componente PayrollOfficialStatementModal.jsx validado com sucesso');

// 2. Verificar TeamPayoutsDashboard.jsx
const tpdCode = fs.readFileSync('src/components/TeamPayoutsDashboard.jsx', 'utf8');

assert.ok(tpdCode.includes('PayrollOfficialStatementModal'), 'TeamPayoutsDashboard deve importar PayrollOfficialStatementModal');
assert.ok(tpdCode.includes('isPayrollOfficialModalOpen'), 'TeamPayoutsDashboard deve gerenciar estado isPayrollOfficialModalOpen');
assert.ok(tpdCode.includes('setIsPayrollOfficialModalOpen(true)'), 'Botão "Imprimir Folha" deve abrir o modal oficial');
assert.ok(tpdCode.includes('<PayrollOfficialStatementModal'), 'TeamPayoutsDashboard deve renderizar PayrollOfficialStatementModal');
console.log('  ✅ TeamPayoutsDashboard.jsx validado com abertura do documento oficial no botão Imprimir Folha');

console.log('🎉 Todos os testes da Folha Consolidada Oficial passaram com 100% de sucesso!');
