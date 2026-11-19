const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('Running View Modes in Post-Production Approvals Tests...');

const adminCenterPath = path.join(__dirname, '..', 'src', 'components', 'AdminCenter.jsx');
const appCssPath = path.join(__dirname, '..', 'src', 'App.css');

const adminCode = fs.readFileSync(adminCenterPath, 'utf8');
const cssCode = fs.readFileSync(appCssPath, 'utf8');

// 1. Check imports of view icons
assert.ok(adminCode.includes('LayoutGrid'), 'AdminCenter must import LayoutGrid');
assert.ok(adminCode.includes('List'), 'AdminCenter must import List');
assert.ok(adminCode.includes('Kanban'), 'AdminCenter must import Kanban');

// 2. Check state & localStorage key
assert.ok(adminCode.includes("localStorage.getItem('gestormf_admin_pp_view_mode')"), 'Must use localStorage for ppViewMode');
assert.ok(adminCode.includes("localStorage.setItem('gestormf_admin_pp_view_mode'"), 'Must save ppViewMode to localStorage');

// 3. Check Toggle buttons in toolbar
assert.ok(adminCode.includes('className="ac-view-mode-toggle"'), 'Must have ac-view-mode-toggle');
assert.ok(adminCode.includes("handleSetPpViewMode('cards')"), 'Must have cards button');
assert.ok(adminCode.includes("handleSetPpViewMode('list')"), 'Must have list button');
assert.ok(adminCode.includes("handleSetPpViewMode('kanban')"), 'Must have kanban button');

// 4. Check Kanban board & columns
assert.ok(adminCode.includes('className="ac-pp-kanban-board"'), 'Must have ac-pp-kanban-board');
assert.ok(adminCode.includes('1. Em Edição'), 'Kanban must have 1. Em Edição column');
assert.ok(adminCode.includes('2. Aguardando Decisão'), 'Kanban must have 2. Aguardando Decisão column');
assert.ok(adminCode.includes('3. Ajustes Solicitados'), 'Kanban must have 3. Ajustes Solicitados column');
assert.ok(adminCode.includes('4. Aprovadas'), 'Kanban must have 4. Aprovadas column');

// 5. Check Table view
assert.ok(adminCode.includes('className="ac-pp-table-wrap"'), 'Must have ac-pp-table-wrap');
assert.ok(adminCode.includes('className="ac-pp-table"'), 'Must have ac-pp-table');
assert.ok(adminCode.includes('Código &amp; Status'), 'Table must have Código & Status header');
assert.ok(adminCode.includes('Pauta &amp; Local'), 'Table must have Pauta & Local header');
assert.ok(adminCode.includes('Editores &amp; Entregas'), 'Table must have Editores & Entregas header');
assert.ok(adminCode.includes('Prazo de Entrega'), 'Table must have Prazo de Entrega header');
assert.ok(adminCode.includes('Servidor / Pasta'), 'Table must have Servidor / Pasta header');
assert.ok(adminCode.includes('Ações de Decisão'), 'Table must have Ações de Decisão header');

// 6. Check Cards grid view
assert.ok(adminCode.includes('className="ac-requests-grid ac-pp-grid"'), 'Must retain cards grid view');

// 7. Check App.css styles
assert.ok(cssCode.includes('.ac-view-mode-toggle'), 'CSS must include .ac-view-mode-toggle');
assert.ok(cssCode.includes('.ac-vm-btn'), 'CSS must include .ac-vm-btn');
assert.ok(cssCode.includes('.ac-pp-table-wrap'), 'CSS must include .ac-pp-table-wrap');
assert.ok(cssCode.includes('.ac-pp-table'), 'CSS must include .ac-pp-table');
assert.ok(cssCode.includes('.ac-pp-kanban-board'), 'CSS must include .ac-pp-kanban-board');
assert.ok(cssCode.includes('.ac-pp-kanban-col'), 'CSS must include .ac-pp-kanban-col');
assert.ok(cssCode.includes('.ac-pp-kcard'), 'CSS must include .ac-pp-kcard');

console.log('All View Modes Post-Production tests passed successfully!');
