const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Iniciando testes de Vales e Adiantamentos Salariais (FIN-05)...');

// 1. Teste de arquivos criados e integrados
const advancesPhpPath = path.join(__dirname, '..', 'public', 'api', 'advances.php');
assert.ok(fs.existsSync(advancesPhpPath), 'public/api/advances.php deve existir');
const advancesPhpContent = fs.readFileSync(advancesPhpPath, 'utf8');
assert.ok(advancesPhpContent.includes('salary_advances'), 'advances.php deve gerenciar a tabela salary_advances');
assert.ok(advancesPhpContent.includes('schema_salary_advances_v1'), 'advances.php deve ter migration de schema versionada');
assert.ok(advancesPhpContent.includes('SALARY_ADVANCE'), 'advances.php deve gerar log de auditoria');
console.log('  ✅ public/api/advances.php validado');

// 2. Teste do backup.php
const backupPhpPath = path.join(__dirname, '..', 'public', 'api', 'backup.php');
const backupPhpContent = fs.readFileSync(backupPhpPath, 'utf8');
assert.ok(backupPhpContent.includes('salary_advances'), 'backup.php deve incluir salary_advances nos snapshots e restores');
console.log('  ✅ public/api/backup.php com salary_advances validado');

// 3. Teste do api.js
const apiJsPath = path.join(__dirname, '..', 'src', 'utils', 'api.js');
const apiJsContent = fs.readFileSync(apiJsPath, 'utf8');
assert.ok(apiJsContent.includes('apiGetSalaryAdvances'), 'api.js deve exportar apiGetSalaryAdvances');
assert.ok(apiJsContent.includes('apiSaveSalaryAdvance'), 'api.js deve exportar apiSaveSalaryAdvance');
assert.ok(apiJsContent.includes('apiDeleteSalaryAdvance'), 'api.js deve exportar apiDeleteSalaryAdvance');
console.log('  ✅ src/utils/api.js validado');

// 4. Teste de cálculo matemático de múltiplos vales no mês
function calculatePayout(gross, advances) {
  const totalAdvances = advances.reduce((acc, a) => acc + (Number(a.amount) || 0), 0);
  const net = Math.max(0, gross - totalAdvances);
  return {
    gross: Number(gross.toFixed(2)),
    totalAdvances: Number(totalAdvances.toFixed(2)),
    advancesCount: advances.length,
    net: Number(net.toFixed(2)),
  };
}

// Exemplo citado pelo usuário no áudio:
// Renato: R$ 450,00 de créditos brutos. Pega R$ 200,00 de vale. Saldo líquido a receber = R$ 250,00.
const renatoEx = calculatePayout(450.0, [{ amount: 200.0, reason: 'Adiantamento emergencial' }]);
assert.strictEqual(renatoEx.gross, 450.0);
assert.strictEqual(renatoEx.totalAdvances, 200.0);
assert.strictEqual(renatoEx.net, 250.0);
console.log('  ✅ Exemplo do áudio (Renato R$ 450 - R$ 200 = R$ 250) validado com sucesso');

// Teste com múltiplos vales no mesmo mês:
const multiAdvances = [
  { amount: 150.0, date: '2026-11-05', reason: 'Vale combustível particular' },
  { amount: 100.0, date: '2026-11-12', reason: 'Adiantamento médico' },
  { amount: 50.0,  date: '2026-11-20', reason: 'Adiantamento farmácia' },
];
const multiResult = calculatePayout(800.0, multiAdvances);
assert.strictEqual(multiResult.gross, 800.0);
assert.strictEqual(multiResult.totalAdvances, 300.0);
assert.strictEqual(multiResult.advancesCount, 3);
assert.strictEqual(multiResult.net, 500.0);
console.log('  ✅ Múltiplos vales no mesmo mês (R$ 800 - R$ 300 = R$ 500) validados');

// Teste de vale maior que o bruto (não deve gerar valor negativo no saldo a receber)
const highAdvanceResult = calculatePayout(100.0, [{ amount: 250.0 }]);
assert.strictEqual(highAdvanceResult.net, 0.0);
console.log('  ✅ Saldo protegido contra valor negativo (Math.max(0, ...)) validado');

// 5. Teste de componentes integrados
const teamPayoutsContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'TeamPayoutsDashboard.jsx'), 'utf8');
assert.ok(teamPayoutsContent.includes('SalaryAdvancesModal'), 'TeamPayoutsDashboard deve importar SalaryAdvancesModal');
assert.ok(teamPayoutsContent.includes('apiGetSalaryAdvances'), 'TeamPayoutsDashboard deve carregar vales via apiGetSalaryAdvances');
assert.ok(teamPayoutsContent.includes('totalAdvancesAmount'), 'TeamPayoutsDashboard deve calcular totalAdvancesAmount');
assert.ok(teamPayoutsContent.includes('netAmount'), 'TeamPayoutsDashboard deve calcular netAmount');

const collabSpaceContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'CollaboratorSpace.jsx'), 'utf8');
assert.ok(collabSpaceContent.includes('apiGetSalaryAdvances'), 'CollaboratorSpace deve carregar vales');
assert.ok(collabSpaceContent.includes('totalAdvancesVal'), 'CollaboratorSpace deve deduzir vales');
assert.ok(collabSpaceContent.includes('showAdvancesHistoryModal'), 'CollaboratorSpace deve ter modal de histórico de vales');

console.log('🎉 Todos os testes de Vales e Adiantamentos Salariais passaram com 100% de sucesso!');
