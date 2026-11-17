const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== TESTE: CARD UNIFICADO DE IDENTIDADE E GAMIFICAÇÃO NO MEU ESPAÇO ===\n');

// 1. Validar CollaboratorSpace.jsx
const colabSpacePath = path.resolve(__dirname, '../src/components/CollaboratorSpace.jsx');
const colabSpace = fs.readFileSync(colabSpacePath, 'utf8');

assert(colabSpace.includes('cs-unified-profile-card'), 'CollaboratorSpace.jsx deve conter a classe principal cs-unified-profile-card');
assert(!colabSpace.includes('<div className="cs-hero-xp-card">'), 'cs-hero-xp-card não deve existir como card aninhado');
assert(colabSpace.includes('cs-upc-top-grid'), 'Deve conter cs-upc-top-grid para layout de topo fluido');
assert(colabSpace.includes('cs-upc-roles-wrap'), 'Deve conter cs-upc-roles-wrap para funções oficiais');
assert(colabSpace.includes('cs-upc-pix-box'), 'Deve conter cs-upc-pix-box para gestão integrada de PIX');
assert(colabSpace.includes('cs-upc-gamification'), 'Deve conter cs-upc-gamification para carreira e gamificação integrada');
assert(colabSpace.includes('cs-upc-timeline-row'), 'Deve conter cs-upc-timeline-row para níveis superados');
assert(colabSpace.includes('cs-upc-roles-scoring'), 'Deve conter cs-upc-roles-scoring para pontuação por função');

console.log('✔ CollaboratorSpace.jsx: Card unificado implementado com hierarquia fluida e sem cards aninhados.');

// 2. Validar App.css
const cssPath = path.resolve(__dirname, '../src/App.css');
const cssCode = fs.readFileSync(cssPath, 'utf8');

assert(cssCode.includes('.cs-unified-profile-card'), 'App.css deve conter estilos para .cs-unified-profile-card');
assert(cssCode.includes('.cs-upc-ambient-glow'), 'App.css deve conter iluminação ambiente');
assert(cssCode.includes('.cs-upc-avatar'), 'App.css deve conter estilos de avatar com halo');
assert(cssCode.includes('.cs-upc-role-main'), 'App.css deve conter destaque para função principal');
assert(cssCode.includes('.cs-upc-role-sec'), 'App.css deve conter estilos para funções adicionais');
assert(cssCode.includes('.cs-upc-pix-box'), 'App.css deve conter estilos para a barra integrada de PIX');
assert(cssCode.includes('.cs-upc-progress-track'), 'App.css deve conter barra de progresso neon');
assert(cssCode.includes('body.light-theme .cs-unified-profile-card'), 'App.css deve suportar tema claro');
assert(cssCode.includes('@media (max-width: 768px)'), 'App.css deve conter suporte responsivo mobile');

console.log('✔ App.css: Estilos modernos, Dark/Light e responsivos validados.');

console.log('\nTODOS OS TESTES DO CARD UNIFICADO PASSARAM COM SUCESSO! 🎯\n');
