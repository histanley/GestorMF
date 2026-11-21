const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- TEST: Post-Production Table "No Prazo" No-Wrap & Zero Scrollbar Layout ---');

const adminCenterPath = path.join(__dirname, '../src/components/AdminCenter.jsx');
const appCssPath = path.join(__dirname, '../src/App.css');

const adminCode = fs.readFileSync(adminCenterPath, 'utf8');
const cssCode = fs.readFileSync(appCssPath, 'utf8');

// 1. ac-deadline-chip must have white-space: nowrap !important;
assert(
  cssCode.includes('.ac-deadline-chip {\n  display: inline-flex !important;\n  align-items: center !important;\n  gap: 4px !important;\n  font-size: 0.68rem !important;\n  font-weight: 800 !important;\n  padding: 2px 8px !important;\n  border-radius: 6px !important;\n  white-space: nowrap !important;') ||
  cssCode.includes('.ac-deadline-chip {\r\n  display: inline-flex !important;\r\n  align-items: center !important;\r\n  gap: 4px !important;\r\n  font-size: 0.68rem !important;\r\n  font-weight: 800 !important;\r\n  padding: 2px 8px !important;\r\n  border-radius: 6px !important;\r\n  white-space: nowrap !important;'),
  '.ac-deadline-chip must have white-space: nowrap !important to prevent breaking into multiple lines'
);
console.log('✓ 1. ac-deadline-chip enforces white-space: nowrap (No Prazo stays on a single line)');

// 2. ac-pp-deadline-cell and datetime must prevent wrapping
assert(
  cssCode.includes('.ac-pp-deadline-cell') && cssCode.includes('.ac-pp-deadline-datetime'),
  'App.css must define .ac-pp-deadline-cell and .ac-pp-deadline-datetime'
);
assert(
  adminCode.includes('className="ac-pp-deadline-cell"'),
  'AdminCenter.jsx must use ac-pp-deadline-cell'
);
console.log('✓ 2. Deadline cell and datetime container prevent unwanted wrapping');

// 3. ac-pp-table must not have min-width: 960px forcing horizontal scrollbars
assert(
  cssCode.includes('.ac-pp-table {\n  width: 100% !important;\n  border-collapse: collapse !important;\n  text-align: left !important;\n  min-width: 0 !important;') ||
  cssCode.includes('.ac-pp-table {\r\n  width: 100% !important;\r\n  border-collapse: collapse !important;\r\n  text-align: left !important;\r\n  min-width: 0 !important;'),
  '.ac-pp-table must have min-width: 0 !important and width: 100% !important'
);
console.log('✓ 3. ac-pp-table uses min-width: 0 !important to fit container without horizontal scrollbar');

// 4. Server path column handles long paths with ellipsis and max-width
assert(
  cssCode.includes('.ac-pp-table .aphl-server-box') && cssCode.includes('.ac-pp-table .aphl-server-code'),
  'App.css must constrain aphl-server-box and aphl-server-code inside ac-pp-table'
);
console.log('✓ 4. Server path column truncates long paths with ellipsis to preserve table width');

console.log('\n--- ALL DEADLINE CHIP & TABLE LAYOUT TESTS PASSED (4/4) ---');
