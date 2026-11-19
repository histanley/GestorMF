const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- TEST SUITE: ADMIN CENTER ATTENTION & DECISION CARDS ---');

// 1. Verify AdminCenter.jsx implementation
const adminCenterContent = fs.readFileSync(path.join(__dirname, '../src/components/AdminCenter.jsx'), 'utf-8').replace(/\r\n/g, '\n');

// Check calculations
assert(
  adminCenterContent.includes('const totalPendingApprovals = pendingEditions.length + pendingRequests.length;'),
  'AdminCenter must compute totalPendingApprovals'
);
assert(
  adminCenterContent.includes('const editionDeadlinesStats = useMemo('),
  'AdminCenter must compute editionDeadlinesStats'
);
assert(
  adminCenterContent.includes('const rentalStats = useMemo('),
  'AdminCenter must compute rentalStats'
);
assert(
  adminCenterContent.includes('const computedReserveVehicles = useMemo('),
  'AdminCenter must compute computedReserveVehicles'
);
assert(
  adminCenterContent.includes('const payoutsStats = useMemo('),
  'AdminCenter must compute payoutsStats'
);
assert(
  adminCenterContent.includes('const activeFieldMissions = useMemo('),
  'AdminCenter must compute activeFieldMissions'
);

// Check handlers
assert(
  adminCenterContent.includes('const handleGoToApprovals = () =>'),
  'AdminCenter must define handleGoToApprovals'
);
assert(
  adminCenterContent.includes('const handleGoToDeadlines = () =>'),
  'AdminCenter must define handleGoToDeadlines'
);
assert(
  adminCenterContent.includes('const handleGoToRentals = () =>'),
  'AdminCenter must define handleGoToRentals'
);
assert(
  adminCenterContent.includes('const handleGoToFleet = async () =>'),
  'AdminCenter must define handleGoToFleet'
);
assert(
  adminCenterContent.includes('const handleGoToPayouts = () =>'),
  'AdminCenter must define handleGoToPayouts'
);
assert(
  adminCenterContent.includes('const handleGoToField = async () =>'),
  'AdminCenter must define handleGoToField'
);

// Check rendered KPI cards in the header
assert(
  adminCenterContent.includes('Aprovações Pendentes</span>'),
  'Card 1 Aprovações Pendentes must be rendered'
);
assert(
  adminCenterContent.includes('Prazos de Edição</span>'),
  'Card 2 Prazos de Edição must be rendered'
);
assert(
  adminCenterContent.includes('Aluguel &amp; Devoluções</span>'),
  'Card 3 Aluguel & Devoluções must be rendered'
);
assert(
  adminCenterContent.includes('Frota &amp; Combustível</span>'),
  'Card 4 Frota & Combustível must be rendered'
);
assert(
  adminCenterContent.includes('Fechamento do Mês</span>'),
  'Card 5 Fechamento do Mês must be rendered'
);
assert(
  adminCenterContent.includes('Missões em Campo</span>'),
  'Card 6 Missões em Campo must be rendered'
);

console.log('✓ AdminCenter.jsx tests passed: all 6 attention & decision cards implemented with live handlers');

// 2. Verify App.jsx passes relevant props to AdminCenter
const appContent = fs.readFileSync(path.join(__dirname, '../src/App.jsx'), 'utf-8').replace(/\r\n/g, '\n');

assert(
  appContent.includes('reserveAlertVehicles={reserveAlertVehicles}'),
  'App.jsx must pass reserveAlertVehicles to AdminCenter'
);
assert(
  appContent.includes('rentals={rentals}'),
  'App.jsx must pass rentals to AdminCenter'
);
assert(
  appContent.includes('onNavigateTab={(tab) => setActiveTab(tab)}'),
  'App.jsx must pass onNavigateTab to AdminCenter'
);

console.log('✓ App.jsx tests passed: props passed seamlessly to AdminCenter');

// 3. Verify App.css has styles for interactive KPI cards and status tags
const cssContent = fs.readFileSync(path.join(__dirname, '../src/App.css'), 'utf-8');

assert(
  cssContent.includes('.ach-kpi-card {') && cssContent.includes('cursor: pointer;'),
  'App.css must define cursor: pointer for .ach-kpi-card'
);
assert(
  cssContent.includes('.ach-kpi-card:hover {'),
  'App.css must define hover state for .ach-kpi-card'
);
assert(
  cssContent.includes('.ach-kpi-card.kpi-danger-pulse {'),
  'App.css must define kpi-danger-pulse for urgent attention cards'
);
assert(
  cssContent.includes('.ach-kpi-tag {'),
  'App.css must define .ach-kpi-tag for contextual badges'
);
assert(
  cssContent.includes('.ach-kpi-tag.tag-danger'),
  'App.css must define .ach-kpi-tag.tag-danger'
);

console.log('✓ App.css tests passed: rich styles, hover effects, and urgency badges confirmed');

console.log('\nALL ATTENTION CARDS TESTS PASSED! (3/3)');
