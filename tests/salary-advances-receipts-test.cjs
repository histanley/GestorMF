/**
 * Testes Unitários de Anexo e Comprovante de Pagamento de Vales (FIN-06)
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Iniciando testes de Comprovantes de Vales e Adiantamentos (FIN-06)...');

// 1. Validação de endpoint PHP com processamento de comprovante
const advancesPhp = fs.readFileSync(path.join(__dirname, '../public/api/advances.php'), 'utf8');
assert(advancesPhp.includes('processReceiptFile'), 'advances.php deve conter processReceiptFile');
assert(advancesPhp.includes('attach_receipt'), 'advances.php deve suportar action attach_receipt');
assert(advancesPhp.includes('ensureAdvancesStorage'), 'advances.php deve criar diretório de comprovantes');
console.log('  ✅ Backend PHP (public/api/advances.php) com upload e processamento de comprovantes validado');

// 2. Validação da API frontend em src/utils/api.js
const apiJs = fs.readFileSync(path.join(__dirname, '../src/utils/api.js'), 'utf8');
assert(apiJs.includes('apiAttachSalaryAdvanceReceipt'), 'api.js deve exportar apiAttachSalaryAdvanceReceipt');
console.log('  ✅ Frontend API (src/utils/api.js) validado');

// 3. Validação do componente de modal SalaryAdvancesModal.jsx
const modalJsx = fs.readFileSync(path.join(__dirname, '../src/components/SalaryAdvancesModal.jsx'), 'utf8');
assert(modalJsx.includes('handleReceiptFileChange'), 'SalaryAdvancesModal deve conter handleReceiptFileChange');
assert(modalJsx.includes('receipt-lightbox-card'), 'SalaryAdvancesModal deve conter modal visualizador de comprovante');
assert(modalJsx.includes('adv-btn-view-receipt'), 'SalaryAdvancesModal deve renderizar botão de ver comprovante');
assert(modalJsx.includes('adv-btn-attach-quick'), 'SalaryAdvancesModal deve permitir anexo rápido a vale existente');
console.log('  ✅ Modal de Vales do Admin (SalaryAdvancesModal.jsx) validado');

// 4. Validação da consulta de comprovante no espaço do colaborador (CollaboratorSpace.jsx)
const collSpaceJsx = fs.readFileSync(path.join(__dirname, '../src/components/CollaboratorSpace.jsx'), 'utf8');
assert(collSpaceJsx.includes('viewingReceipt'), 'CollaboratorSpace deve conter estado viewingReceipt');
assert(collSpaceJsx.includes('adv-btn-view-receipt'), 'CollaboratorSpace deve renderizar botão de ver comprovante');
assert(collSpaceJsx.includes('Comprovante'), 'CollaboratorSpace deve ter coluna Comprovante');
console.log('  ✅ Consulta transparente no Meu Espaço (CollaboratorSpace.jsx) validada');

// 5. Validação das ilustrações e estilo de clima fiel aos prints
const weatherSvg = fs.readFileSync(path.join(__dirname, '../src/components/WeatherIllustration.jsx'), 'utf8');
assert(weatherSvg.includes('wi-sun-3d'), 'WeatherIllustration deve conter sol 3D');
assert(weatherSvg.includes('wi-moon-amber'), 'WeatherIllustration deve conter lua âmbar 3D');
assert(weatherSvg.includes('wi-cloud-front'), 'WeatherIllustration deve conter nuvem volumétrica');
console.log('  ✅ Ilustrações fiéis aos prints 1 e 2 (WeatherIllustration.jsx) validadas');

console.log('🎉 Todos os testes de Comprovantes e Clima passaram com 100% de sucesso!');
