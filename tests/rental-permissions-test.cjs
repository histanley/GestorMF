const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- TEST: Rental Permissions & Access Control ---');

const appPath = path.join(__dirname, '../src/App.jsx');
const ermPath = path.join(__dirname, '../src/components/EquipmentRentalManager.jsx');

const appSource = fs.readFileSync(appPath, 'utf8');
const ermSource = fs.readFileSync(ermPath, 'utf8');

// 1. App.jsx defines canManageRentals
assert(
  appSource.includes('const canManageRentals = userRole === ROLES.ADMIN || userRole === ROLES.MANAGER;'),
  'App.jsx must define canManageRentals checking ROLES.ADMIN and ROLES.MANAGER'
);
console.log('✓ 1. canManageRentals defined correctly in App.jsx');

// 2. App.jsx redirects unauthorized activeTab === 'rentals'
assert(
  appSource.includes('!canManageRentals && activeTab === \'rentals\''),
  'App.jsx must guard activeTab rentals in useEffect'
);
assert(
  appSource.includes('setActiveTab(isAdminUser ? \'admin\' : \'me\')'),
  'App.jsx must redirect unauthorized rentals tab to admin or me'
);
console.log('✓ 2. Navigation guard redirects unauthorized users away from rentals tab');

// 3. Desktop tab button is conditional on canManageRentals
assert(
  appSource.includes('{canManageRentals && (\n            <button\n              className={`tab-btn tab-btn-rentals ${activeTab === \'rentals\' ? \'active\' : \'\'}') ||
  appSource.includes('{canManageRentals && (\r\n            <button\r\n              className={`tab-btn tab-btn-rentals ${activeTab === \'rentals\' ? \'active\' : \'\'}'),
  'Desktop rentals tab button must be wrapped in canManageRentals condition'
);
console.log('✓ 3. Desktop navbar rentals button is conditionally rendered for managers & admins only');

// 4. Mobile drawer button is conditional on canManageRentals
assert(
  appSource.includes('{canManageRentals && (\n                <button\n                  className={`md-nav-item ${activeTab === \'rentals\' ? \'active\' : \'\'}') ||
  appSource.includes('{canManageRentals && (\r\n                <button\r\n                  className={`md-nav-item ${activeTab === \'rentals\' ? \'active\' : \'\'}'),
  'Mobile drawer rentals button must be wrapped in canManageRentals condition'
);
console.log('✓ 4. Mobile drawer rentals item is conditionally rendered for managers & admins only');

// 5. Main content view is guarded
assert(
  appSource.includes("activeTab === 'rentals' && canManageRentals"),
  'Main content EquipmentRentalManager must require canManageRentals'
);
console.log('✓ 5. Main view EquipmentRentalManager requires canManageRentals');

// 6. Notification click is guarded
assert(
  appSource.includes('if (canManageRentals) {\n        setActiveTab(\'rentals\');\n      }') ||
  appSource.includes('if (canManageRentals) {\r\n        setActiveTab(\'rentals\');\r\n      }'),
  'Notification click handler must verify canManageRentals before navigating'
);
console.log('✓ 6. Notification click handler verifies canManageRentals before navigating');

// 7. EquipmentRentalManager.jsx internal guard
assert(
  ermSource.includes('const isManager = Boolean(') &&
  ermSource.includes('const canAccess = isAdmin || isManager;') &&
  ermSource.includes('if (!canAccess) {'),
  'EquipmentRentalManager.jsx must have internal defense guard for canAccess'
);
console.log('✓ 7. EquipmentRentalManager has internal defense guard for unauthorized access');

console.log('\n--- ALL RENTAL PERMISSION TESTS PASSED (7/7) ---');
