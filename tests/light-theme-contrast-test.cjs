// tests/light-theme-contrast-test.cjs
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- TESTE: Verificação de Contraste e Tipografia no Modo Claro ---');

const appCssPath = path.resolve(__dirname, '../src/App.css');
const cssContent = fs.readFileSync(appCssPath, 'utf8');

// 1. Selector typo fix: .cs-ach-name must have light theme override with dark color
assert.ok(
  cssContent.includes("body.light-theme .cs-ach-name") &&
  cssContent.includes("[data-theme='light'] .cs-ach-name"),
  'App.css deve conter seletores body.light-theme e [data-theme=light] para .cs-ach-name'
);

// 2. Unlocked and locked badge text colors
assert.ok(
  cssContent.includes("body.light-theme .cs-upc-ach-badge.is-locked .cs-ach-name") &&
  cssContent.includes("#334155 !important"),
  'Badges bloqueadas devem ter texto escuro (#334155) legível no modo claro'
);

assert.ok(
  cssContent.includes("body.light-theme .cs-upc-ach-badge.is-unlocked .cs-ach-name") &&
  cssContent.includes("#0f172a !important"),
  'Badges desbloqueadas devem ter texto escuro (#0f172a) nítido no modo claro'
);

// 3. Status labels contrast
assert.ok(
  cssContent.includes("body.light-theme .ach-unlocked-lbl") &&
  cssContent.includes("#059669 !important"),
  'ach-unlocked-lbl deve ter verde escuro contrastante no modo claro'
);

assert.ok(
  cssContent.includes("body.light-theme .ach-locked-lbl") &&
  cssContent.includes("#64748b !important"),
  'ach-locked-lbl deve ter cor slate com alto contraste no modo claro'
);

// 4. Timeline label and remaining progress
assert.ok(
  cssContent.includes("body.light-theme .cs-upc-timeline-label") &&
  cssContent.includes("#166534 !important"),
  'Timeline label deve usar verde escuro (#166534) legível em fundo claro'
);

assert.ok(
  cssContent.includes("body.light-theme .cs-upc-progress-rem") &&
  cssContent.includes("#475569 !important"),
  'Texto de XP restante deve usar cor contrastante #475569'
);

// 5. XP modal badges support in light mode
assert.ok(
  cssContent.includes("body.light-theme .cs-xp-badge-card-title") &&
  cssContent.includes("#0f172a !important"),
  'Modal de XP deve ter títulos escuros #0f172a no modo claro'
);

console.log('✅ Todos os testes de contraste do modo claro passaram com sucesso!');
