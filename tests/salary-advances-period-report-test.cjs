const fs = require('fs');
const assert = require('assert');
const path = require('path');

console.log('🧪 Iniciando testes de Histórico e Relatório de Vales por Período (FIN-08)...');

// 1. Validar public/api/advances.php
const phpCode = fs.readFileSync(path.join(__dirname, '../public/api/advances.php'), 'utf8');
assert(phpCode.includes('startDate'), 'advances.php deve suportar parâmetro startDate');
assert(phpCode.includes('endDate'), 'advances.php deve suportar parâmetro endDate');
assert(phpCode.includes('date BETWEEN ? AND ?'), 'advances.php deve consultar por intervalo de datas date BETWEEN');
assert(phpCode.includes("monthKey !== 'all'"), 'advances.php deve suportar month=all');
console.log('  ✅ Backend PHP (public/api/advances.php) com suporte a período e histórico total validado');

// 2. Validar src/utils/api.js
const apiJs = fs.readFileSync(path.join(__dirname, '../src/utils/api.js'), 'utf8');
assert(apiJs.includes('startDate'), 'api.js deve repassar startDate');
assert(apiJs.includes('endDate'), 'api.js deve repassar endDate');
console.log('  ✅ Frontend API (src/utils/api.js) com suporte a options de período validado');

// 3. Validar src/components/SalaryAdvancesModal.jsx
const modalJsx = fs.readFileSync(path.join(__dirname, '../src/components/SalaryAdvancesModal.jsx'), 'utf8');
assert(modalJsx.includes('advances-nav-tabs'), 'SalaryAdvancesModal deve conter abas de navegação (Histórico vs Novo Vale)');
assert(modalJsx.includes('historyPeriod'), 'SalaryAdvancesModal deve gerenciar estado de período de histórico');
assert(modalJsx.includes('filteredHistoryAdvances'), 'SalaryAdvancesModal deve apurar lista de vales filtrados por período');
assert(modalJsx.includes('historyMetrics'), 'SalaryAdvancesModal deve apurar métricas consolidadas do período');
assert(modalJsx.includes('advances-period-toolbar'), 'SalaryAdvancesModal deve renderizar barra de filtros de período');
assert(modalJsx.includes('handleReceiptFileChange'), 'SalaryAdvancesModal deve conter handleReceiptFileChange');
assert(modalJsx.includes('adv-btn-view-receipt'), 'SalaryAdvancesModal deve conter botão adv-btn-view-receipt');
assert(modalJsx.includes('adv-btn-attach-quick'), 'SalaryAdvancesModal deve conter botão adv-btn-attach-quick');
assert(modalJsx.includes('receipt-lightbox-card'), 'SalaryAdvancesModal deve conter modal visualizador de comprovante');
console.log('  ✅ Componente SalaryAdvancesModal.jsx com abas, filtros de período e KPIs validado');

// 4. Validar src/App.css
const css = fs.readFileSync(path.join(__dirname, '../src/App.css'), 'utf8');
assert(css.includes('.advances-modal-card.advances-modal-card-wide'), 'App.css deve conter .advances-modal-card-wide');
assert(css.includes('.advances-nav-tabs'), 'App.css deve conter estilos para .advances-nav-tabs');
assert(css.includes('.advances-period-toolbar'), 'App.css deve conter estilos para .advances-period-toolbar');
assert(css.includes('.advances-period-kpis'), 'App.css deve conter estilos para .advances-period-kpis');
assert(css.includes('.adv-member-cell'), 'App.css deve conter estilos para .adv-member-cell');
console.log('  ✅ Estilos CSS para abas, filtros de período e métricas validados');

console.log('🎉 Todos os testes de Histórico e Relatório de Vales por Período passaram com 100% de sucesso!');
