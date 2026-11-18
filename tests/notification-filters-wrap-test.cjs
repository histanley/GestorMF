const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Iniciando testes de filtros da Central de Notificações...');

const notifJsx = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'NotificationsCenter.jsx'), 'utf8');
const appCss = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.css'), 'utf8');

// 1. Abas e referências em NotificationsCenter.jsx
assert(notifJsx.includes('handleTabsWheel'), 'NotificationsCenter deve ter handleTabsWheel para rolagem com a rodinha do mouse');
assert(notifJsx.includes('tabsRef'), 'NotificationsCenter deve ter tabsRef');
assert(notifJsx.includes('filter === \'mission\''), 'Filtro de missões deve estar presente');
assert(notifJsx.includes('filter === \'messages\''), 'Filtro de avisos/mensagens deve estar presente');
assert(notifJsx.includes('filter === \'fuel\''), 'Filtro de frota/combustível deve estar presente');
assert(notifJsx.includes('filter === \'rental\''), 'Filtro de aluguéis deve estar presente');

// 2. CSS em App.css
assert(appCss.includes('flex-wrap: wrap;'), 'notif-segmented-bar deve permitir wrap para que todas as opções fiquem visíveis');
assert(appCss.includes('.notif-segmented-bar::-webkit-scrollbar'), 'App.css deve conter scrollbar estilizada para a barra segmentada');
assert(appCss.includes('width: 500px;'), 'Modal de notificações deve ter largura expandida');

console.log('✅ TODOS OS TESTES DOS FILTROS DA CENTRAL DE NOTIFICAÇÕES PASSARAM COM SUCESSO!');
