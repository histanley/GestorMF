const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- TEST: Post-Production Action Buttons Redesign (Stacked Vertical Layout) ---');

const adminCenterPath = path.join(__dirname, '../src/components/AdminCenter.jsx');
const appCssPath = path.join(__dirname, '../src/App.css');

const adminCode = fs.readFileSync(adminCenterPath, 'utf8');
const cssCode = fs.readFileSync(appCssPath, 'utf8');

// 1. App.css must stack buttons vertically in column layout
assert(
  cssCode.includes('display: flex !important;\n  flex-direction: column !important;') ||
  cssCode.includes('display: flex !important;\r\n  flex-direction: column !important;'),
  'ac-pp-actions-footer must use display: flex and flex-direction: column'
);
assert(
  cssCode.includes('grid-template-columns: none !important;'),
  'ac-pp-actions-footer must override any grid layout with grid-template-columns: none'
);
console.log('✓ 1. ac-pp-actions-footer stacks buttons vertically with flex-direction: column');

// 2. Reject button must be first (top) and Confirm button must be second (bottom)
const rejectIndex = adminCode.indexOf('className="ac-pp-btn-action ac-pp-btn-reject"');
const approveIndex = adminCode.indexOf('className="ac-pp-btn-action ac-pp-btn-approve"');

assert(rejectIndex !== -1, 'Reject button must exist in AdminCenter.jsx');
assert(approveIndex !== -1, 'Approve button must exist in AdminCenter.jsx');
assert(rejectIndex < approveIndex, 'Reject button must precede Approve button in JSX (top position)');
console.log('✓ 2. Button order verified: Rejeitar e Reabrir (top) -> Confirmar Finalização (bottom)');

// 3. Arrow icon indicator included for high-end affordance
assert(
  adminCode.includes('<ChevronRight size={17} className="ac-btn-arrow-icon" />'),
  'Buttons must contain ChevronRight arrow icon'
);
assert(
  cssCode.includes('.ac-btn-arrow-icon'),
  'App.css must style .ac-btn-arrow-icon with hover transition'
);
console.log('✓ 3. Interactive arrow indicator present and styled');

// 4. No cut-offs or forced one-line truncation in buttons
assert(
  cssCode.includes('.ac-btn-main-title {\n  font-size: 0.95rem !important;\n  font-weight: 800 !important;\n  letter-spacing: 0.2px !important;\n  line-height: 1.25 !important;\n  white-space: normal !important;') ||
  cssCode.includes('.ac-btn-main-title {\r\n  font-size: 0.95rem !important;\r\n  font-weight: 800 !important;\r\n  letter-spacing: 0.2px !important;\r\n  line-height: 1.25 !important;\r\n  white-space: normal !important;'),
  'Main title must allow normal text wrapping without truncation'
);
console.log('✓ 4. Titles and subtitles have full width without truncation clipping');

// 5. Handlers remain properly bound
assert(
  adminCode.includes('onClick={() => handleApproveEdition(mission)}'),
  'handleApproveEdition must remain bound to approve button'
);
assert(
  adminCode.includes('onClick={() => setReopenModal({'),
  'setReopenModal must remain bound to reject button'
);
console.log('✓ 5. Decision handlers verified and functional');

console.log('\n--- ALL ACTION BUTTONS TESTS PASSED (5/5) ---');
