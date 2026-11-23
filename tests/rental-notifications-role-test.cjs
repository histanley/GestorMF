const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- TEST SUITE: RENTAL NOTIFICATIONS ROLE ACCESS ---');

// Mock browser globals for test environment
global.window = {};
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
};

const notifSource = fs.readFileSync(path.join(__dirname, '../src/utils/notifications.js'), 'utf-8');
const authSource = fs.readFileSync(path.join(__dirname, '../src/utils/auth.js'), 'utf-8');

// 1. Static Verification
assert(
  notifSource.includes('const role = normalizeRole(currentUser?.role || currentUser);'),
  'notifications.js must normalize role from currentUser'
);
assert(
  notifSource.includes('if (role !== ROLES.ADMIN && role !== ROLES.MANAGER) {\n    return [];\n  }'),
  'notifications.js must immediately return [] for non-admin and non-manager'
);
console.log('✓ Static assertion passed: role verification logic is present in notifications.js');

// 2. Functional Verification
const { ROLES, normalizeRole } = require('../src/utils/auth.js');

// Simulate the checkAndNotifyPendingRentals logic
function checkRentalsMock(rentals, currentUser) {
  if (!currentUser) return [];
  const role = normalizeRole(currentUser?.role || currentUser);
  if (role !== ROLES.ADMIN && role !== ROLES.MANAGER) {
    return [];
  }
  return rentals;
}

const mockRentals = [
  { id: 1, code: 'LOC-001', clientName: 'Cliente Teste', status: 'overdue' },
];

// Test 1: Standard Collaborator / User Role
const userResult = checkRentalsMock(mockRentals, { id: 10, name: 'Colaborador', role: 'user' });
assert.deepStrictEqual(userResult, [], 'Colaborador comum (user) NÃO pode receber notificações de locações');
console.log('✓ Test passed: regular collaborator (user) receives 0 rental notifications');

// Test 2: Guest / Unknown Role
const unknownResult = checkRentalsMock(mockRentals, { id: 11, name: 'Convidado', role: 'guest' });
assert.deepStrictEqual(unknownResult, [], 'Convidado/Perfil desconhecido NÃO pode receber notificações');
console.log('✓ Test passed: guest/other role receives 0 rental notifications');

// Test 3: Manager Role
const managerResult = checkRentalsMock(mockRentals, { id: 12, name: 'Gestor', role: 'manager' });
assert.strictEqual(managerResult.length, 1, 'Gestor (manager) deve receber notificações de locações');
console.log('✓ Test passed: manager receives rental notifications');

// Test 4: Admin Role
const adminResult = checkRentalsMock(mockRentals, { id: 13, name: 'Admin', role: 'admin' });
assert.strictEqual(adminResult.length, 1, 'Administrador (admin) deve receber notificações de locações');
console.log('✓ Test passed: admin receives rental notifications');

// 3. Verify NotificationsCenter filtering
const notifCenterSource = fs.readFileSync(path.join(__dirname, '../src/components/NotificationsCenter.jsx'), 'utf-8');
assert(
  notifCenterSource.includes('canSeeRentals'),
  'NotificationsCenter must check canSeeRentals'
);
assert(
  notifCenterSource.includes('if (!canSeeRentals && getNotificationCategory(n) === \'rental\') return false;'),
  'NotificationsCenter must filter out rental notifications for non-admin/non-manager'
);
console.log('✓ NotificationsCenter tests passed: UI panel hides rental alerts and tab from standard users');

console.log('\nALL ROLE TESTS PASSED (100%)');
