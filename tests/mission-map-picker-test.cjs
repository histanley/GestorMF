const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Iniciando testes de Busca no Mapa, Personalização de Coordenadas e Endereço com GPS...');

const {
  parseCoordinatesFromText,
  formatAddressWithCoordinates,
} = require('../src/utils/geo.js');

// 1. Testes de parseCoordinatesFromText
const c1 = parseCoordinatesFromText('2.825358, -60.731062');
assert(c1 !== null, 'Deve identificar coordenadas separadas por vírgula');
assert.strictEqual(c1.lat, 2.825358);
assert.strictEqual(c1.lon, -60.731062);

const c2 = parseCoordinatesFromText('-2.825358 -60.731062');
assert(c2 !== null, 'Deve identificar coordenadas separadas por espaço');
assert.strictEqual(c2.lat, -2.825358);
assert.strictEqual(c2.lon, -60.731062);

const c3 = parseCoordinatesFromText('https://www.google.com/maps?q=@2.825358,-60.731062,15z');
assert(c3 !== null, 'Deve identificar coordenadas em link do Google Maps');
assert.strictEqual(c3.lat, 2.825358);
assert.strictEqual(c3.lon, -60.731062);

const c4 = parseCoordinatesFromText('Rua Alfredo Cruz, 450 - Centro');
assert.strictEqual(c4, null, 'Não deve confundir texto de endereço comum com coordenadas');

// 2. Testes de formatAddressWithCoordinates
const formatted1 = formatAddressWithCoordinates('Espaço Jardim, Caçari', 2.825358, -60.731062);
assert(formatted1.includes('(GPS: 2.825358, -60.731062)'), 'Deve anexar coordenadas GPS ao endereço');

const formatted2 = formatAddressWithCoordinates('Espaço Jardim (GPS: 1.000000, 1.000000)', 2.825358, -60.731062);
assert(formatted2.includes('(GPS: 2.825358, -60.731062)'), 'Deve substituir coordenadas anteriores sem duplicar');
assert(!formatted2.includes('(GPS: 1.000000'), 'Coordenada antiga deve ser substituída');

// 3. Teste do componente MissionMapPickerModal.jsx
const pickerPath = path.resolve(__dirname, '../src/components/MissionMapPickerModal.jsx');
assert(fs.existsSync(pickerPath), 'MissionMapPickerModal.jsx deve existir');
const pickerSource = fs.readFileSync(pickerPath, 'utf8');
assert(pickerSource.includes('leaflet'), 'Deve utilizar leaflet no picker');
assert(pickerSource.includes('mmp-modal-container'), 'Deve possuir container do modal');
assert(pickerSource.includes('mmp-leaflet-container'), 'Deve renderizar container do mapa');
assert(pickerSource.includes('handleLocateMe'), 'Deve permitir localizar pelo GPS do usuário');
assert(pickerSource.includes('handleConfirm'), 'Deve permitir confirmar coordenadas');
assert(pickerSource.includes('reverseGeocodeNominatim'), 'Deve realizar geocodificação reversa');

// 4. Teste de integração em MissionModal.jsx
const modalPath = path.resolve(__dirname, '../src/components/MissionModal.jsx');
const modalSource = fs.readFileSync(modalPath, 'utf8');
assert(modalSource.includes('MissionMapPickerModal'), 'MissionModal deve importar MissionMapPickerModal');
assert(modalSource.includes('btn-map-picker'), 'MissionModal deve ter botão Marcar no Mapa');
assert(modalSource.includes('isMapPickerOpen'), 'MissionModal deve gerenciar abertura do picker');
assert(modalSource.includes('searchNoResultsPrompt'), 'MissionModal deve exibir aviso caso busca textual não encontre');
assert(modalSource.includes('formatAddressWithCoordinates'), 'MissionModal deve utilizar formatAddressWithCoordinates');

// 5. Teste da Ilustração do Sol e da Lua em CelestialShiftIllustration.jsx
const celestialPath = path.resolve(__dirname, '../src/components/CelestialShiftIllustration.jsx');
const celestialSource = fs.readFileSync(celestialPath, 'utf8');
assert(celestialSource.includes('csi-sun-body-3d'), 'Sol deve usar gradiente esférico 3D');
assert(celestialSource.includes('csi-ray-prim-grad'), 'Sol deve usar raios primários elegantes');
assert(celestialSource.includes('csi-moon-body'), 'Lua deve usar gradiente 3D');
assert(!celestialSource.includes('width="31" height="31"'), 'Sol não deve conter blocos retangulares anteriores');

console.log('✅ Todos os testes de busca no mapa, coordenadas no endereço e sol/lua passaram com 100% de sucesso!');
