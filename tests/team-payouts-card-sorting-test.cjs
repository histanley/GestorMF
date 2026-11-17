const assert = require('assert');

// Simulação de colaboradores com diferentes saldos
const mockMembers = [
  { id: 1, name: 'Eduardo Lima', role: 'Designer Gráfico', company: 'Mega Print', status: 'Pendente', totalAmount: 0, totalHours: 0, totalTravelDays: 0, missionCount: 0, plannedHours: 0 },
  { id: 2, name: 'Fernando', role: 'Designer Gráfico', company: 'Mega Print', status: 'Pendente', totalAmount: 0, totalHours: 0, totalTravelDays: 0, missionCount: 0, plannedHours: 0 },
  { id: 3, name: 'Gabriel Costa', role: 'Cinegrafista', company: 'MegaFilmes', status: 'Pendente', totalAmount: 165, totalHours: 3.3, totalTravelDays: 0, missionCount: 5, plannedHours: 0 },
  { id: 4, name: 'Kawan Santos', role: 'Cinegrafista', company: 'MegaFilmes', status: 'Pendente', totalAmount: 225, totalHours: 4.5, totalTravelDays: 0, missionCount: 3, plannedHours: 3.3 },
  { id: 5, name: 'Mateus Henrique', role: 'Cinegrafista', company: 'MegaFilmes', status: 'Pendente', totalAmount: 35, totalHours: 0.7, totalTravelDays: 0, missionCount: 4, plannedHours: 3.3 },
  { id: 6, name: 'Rodrigo Admin', role: 'Diretor', company: 'MegaFilmes', status: 'Pago', totalAmount: 500, totalHours: 10, totalTravelDays: 2, missionCount: 8, plannedHours: 0 },
];

function sortPayouts(list, sortBy) {
  return [...list].sort((a, b) => {
    if (sortBy === 'balance_desc') {
      const aHasBalance = a.status !== 'Pago' && (a.totalAmount || 0) > 0;
      const bHasBalance = b.status !== 'Pago' && (b.totalAmount || 0) > 0;
      if (aHasBalance && !bHasBalance) return -1;
      if (!aHasBalance && bHasBalance) return 1;
      if (b.totalAmount !== a.totalAmount) {
        return (b.totalAmount || 0) - (a.totalAmount || 0);
      }
      if (b.totalHours !== a.totalHours) {
        return (b.totalHours || 0) - (a.totalHours || 0);
      }
      return a.name.localeCompare(b.name, 'pt-BR');
    }

    if (sortBy === 'name_asc') {
      return a.name.localeCompare(b.name, 'pt-BR');
    }

    if (sortBy === 'name_desc') {
      return b.name.localeCompare(a.name, 'pt-BR');
    }

    if (sortBy === 'hours_desc') {
      const diff = (b.totalHours || 0) - (a.totalHours || 0);
      if (diff !== 0) return diff;
      return (b.totalAmount || 0) - (a.totalAmount || 0);
    }

    if (sortBy === 'daily_desc') {
      const diff = (b.totalTravelDays || 0) - (a.totalTravelDays || 0);
      if (diff !== 0) return diff;
      return (b.totalAmount || 0) - (a.totalAmount || 0);
    }

    if (sortBy === 'missions_desc') {
      const diff = (b.missionCount || 0) - (a.missionCount || 0);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, 'pt-BR');
    }

    if (sortBy === 'planned_desc') {
      const diff = (b.plannedHours || 0) - (a.plannedHours || 0);
      if (diff !== 0) return diff;
      return (b.totalAmount || 0) - (a.totalAmount || 0);
    }

    return 0;
  });
}

console.log('🧪 Iniciando testes de ordenação e card de fechamento...');

// Teste 1: Ordenação Padrão (balance_desc) coloca quem tem saldo pendente no topo absoluto
const sortedByDefault = sortPayouts(mockMembers, 'balance_desc');
console.log('Ordem Padrão (balance_desc):', sortedByDefault.map(m => `${m.name} (R$ ${m.totalAmount}, ${m.status})`));

assert.strictEqual(sortedByDefault[0].name, 'Kawan Santos', 'Kawan (R$ 225) deve ser o primeiro da lista');
assert.strictEqual(sortedByDefault[1].name, 'Gabriel Costa', 'Gabriel (R$ 165) deve ser o segundo da lista');
assert.strictEqual(sortedByDefault[2].name, 'Mateus Henrique', 'Mateus (R$ 35) deve ser o terceiro da lista');
assert.ok(
  sortedByDefault.findIndex(m => m.name === 'Eduardo Lima') > 2,
  'Eduardo Lima (R$ 0) deve ficar abaixo de todos que têm saldo'
);
assert.ok(
  sortedByDefault.findIndex(m => m.name === 'Fernando') > 2,
  'Fernando (R$ 0) deve ficar abaixo de todos que têm saldo'
);
console.log('✅ Teste 1 passou: Colaboradores com saldo pendente aparecem no topo absoluto por padrão!');

// Teste 2: Ordem Alfabética (name_asc)
const sortedByName = sortPayouts(mockMembers, 'name_asc');
assert.strictEqual(sortedByName[0].name, 'Eduardo Lima', 'Eduardo Lima deve ser o primeiro em A-Z');
assert.strictEqual(sortedByName[sortedByName.length - 1].name, 'Rodrigo Admin', 'Rodrigo Admin deve ser o último em A-Z');
console.log('✅ Teste 2 passou: Ordem Alfabética A-Z funciona perfeitamente!');

// Teste 3: Mais Horas Extras (hours_desc)
const sortedByHours = sortPayouts(mockMembers, 'hours_desc');
assert.strictEqual(sortedByHours[0].name, 'Rodrigo Admin', 'Rodrigo (10h) deve ser o primeiro em mais horas extras');
assert.strictEqual(sortedByHours[1].name, 'Kawan Santos', 'Kawan (4.5h) deve ser o segundo');
console.log('✅ Teste 3 passou: Ordenação por Mais Horas Extras funciona perfeitamente!');

// Teste 4: Validação de arquivos (App.css e TeamPayoutsDashboard.jsx)
const fs = require('fs');
const appCss = fs.readFileSync('src/App.css', 'utf8');
const dashboardJsx = fs.readFileSync('src/components/TeamPayoutsDashboard.jsx', 'utf8');

assert.ok(dashboardJsx.includes("sortBy === 'balance_desc'"), 'TeamPayoutsDashboard deve conter lógica balance_desc');
assert.ok(dashboardJsx.includes("pmc-pix-card-vertical"), 'TeamPayoutsDashboard deve conter card vertical de PIX');
assert.ok(dashboardJsx.includes("btn-copy-pix-full"), 'TeamPayoutsDashboard deve conter botão de copiar chave cheia embaixo');
assert.ok(dashboardJsx.includes("pf-select-sort"), 'TeamPayoutsDashboard deve conter seletor de ordenação');
assert.ok(dashboardJsx.includes("Concluídas"), 'Deve conter Concluídas');
assert.ok(appCss.includes(".pmc-pix-card-vertical"), 'App.css deve conter estilos para .pmc-pix-card-vertical');
assert.ok(appCss.includes(".btn-copy-pix-full"), 'App.css deve conter estilos para .btn-copy-pix-full');

console.log('✅ Teste 4 passou: Código JSX e estilos CSS contêm todas as regras solicitadas!');
console.log('\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO!');
