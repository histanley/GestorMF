const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- TEST SUITE: CARDS SIDE-BY-SIDE & NOTIFICATIONS FOR ALL USERS ---');

// 1. Verify CSS single row flex nowrap rules
const cssContent = fs.readFileSync(path.join(__dirname, '../src/App.css'), 'utf-8');

assert(
  cssContent.includes('.cs-summary-grid {') &&
  cssContent.includes('flex-wrap: nowrap !important;'),
  'App.css must define .cs-summary-grid with flex-wrap: nowrap !important'
);
assert(
  cssContent.includes('overflow-x: auto !important;'),
  'App.css must enable overflow-x: auto !important on summary grid'
);

// Verify mobile media query in App.css does not break single line
const mobileBlockMatch = cssContent.match(/\/\* 3\. Fechamento & Resumo Financeiro no Celular[\s\S]*?\.cs-summary-card\.cs-card-total\s*\{[\s\S]*?\}/);
assert(mobileBlockMatch, 'Mobile block for summary grid must exist');
const mobileBlock = mobileBlockMatch[0];
assert(
  mobileBlock.includes('flex-wrap: nowrap !important;'),
  'Mobile summary grid must preserve flex-wrap: nowrap !important'
);
assert(
  mobileBlock.includes('order: 0 !important;'),
  'Total card must not be forced to top or separate line on mobile'
);

console.log('✓ App.css tests passed: all financial summary cards strictly aligned side-by-side');

// 2. Verify notifications.js allows all users to receive rental notifications
const notifContent = fs.readFileSync(path.join(__dirname, '../src/utils/notifications.js'), 'utf-8');

assert(
  !notifContent.match(/export function checkAndNotifyPendingRentals[\s\S]*?if \(!isAdminOrManager\) return/),
  'checkAndNotifyPendingRentals must NOT restrict to isAdminOrManager'
);
assert(
  notifContent.includes('export function checkAndNotifyPendingRentals(rentals = [], currentUser = null) {'),
  'checkAndNotifyPendingRentals must exist'
);

console.log('✓ notifications.js tests passed: all authenticated users receive rental notifications');

// 3. Verify App.jsx checkRentals and tab navigation
const appContent = fs.readFileSync(path.join(__dirname, '../src/App.jsx'), 'utf-8').replace(/\r\n/g, '\n');

assert(
  !appContent.includes('if (!currentUser || !canManageFleetAndTeams) return;\n\n    let isMounted = true;\n    const checkRentals'),
  'App.jsx checkRentals effect must NOT require canManageFleetAndTeams'
);
assert(
  !appContent.includes("activeTab === 'rentals')) {\n      setActiveTab('map');"),
  'App.jsx must not redirect non-admin users away from rentals tab'
);
assert(
  appContent.includes("{activeTab === 'rentals' && (\n          <EquipmentRentalManager currentUser={currentUser} />"),
  'App.jsx must render EquipmentRentalManager for any user on rentals tab'
);

console.log('✓ App.jsx tests passed: all users can check rentals and navigate to rentals tab');

// 4. Verify public/api/rentals.php allows GET for any authenticated user
const phpContent = fs.readFileSync(path.join(__dirname, '../public/api/rentals.php'), 'utf-8').replace(/\r\n/g, '\n');

assert(
  phpContent.includes("if ($method === 'GET') {\n    $user = requireAuth();\n} else {\n    $user = requireAuth(['ADMIN', 'MANAGER']);"),
  'public/api/rentals.php must allow requireAuth() for GET and require ADMIN/MANAGER for mutations'
);

console.log('✓ rentals.php tests passed: GET is permitted for any authenticated user');

console.log('\nALL TESTS PASSED SUCCESSFULLY! (4/4)');
