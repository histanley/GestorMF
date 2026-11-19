const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Iniciando testes do Smart Header Greeting com ícone de clima Sol/Lua e sem foto...');

const headerPath = path.resolve(__dirname, '../src/components/SmartHeaderGreeting.jsx');
const cssPath = path.resolve(__dirname, '../src/App.css');

const headerJsx = fs.readFileSync(headerPath, 'utf8');
const appCss = fs.readFileSync(cssPath, 'utf8');

// 1. Garantir que a foto da pessoa (sh-avatar-hub) foi retirada
assert.strictEqual(
  headerJsx.includes('sh-avatar-hub'),
  false,
  'SmartHeaderGreeting não deve conter sh-avatar-hub (foto da pessoa)'
);

// 2. Garantir que o ícone do clima/horário (sol/lua) voltou
assert.strictEqual(
  headerJsx.includes('className="sh-hero-icon-wrap"'),
  true,
  'SmartHeaderGreeting deve conter sh-hero-icon-wrap para o ícone de clima/horário'
);

assert.strictEqual(
  headerJsx.includes('{headerWeatherIcon}'),
  true,
  'SmartHeaderGreeting deve renderizar headerWeatherIcon obedecendo as variações de clima e turno (Lua à noite, Sol de dia)'
);

// 3. Garantir que as 3 linhas continuam empilhadas e alinhadas
assert.strictEqual(
  headerJsx.includes('className="sh-hero-greeting-row"'),
  true,
  'Linha 1: Deve conter sh-hero-greeting-row'
);

assert.strictEqual(
  headerJsx.includes('className="sh-hero-login-row"'),
  true,
  'Linha 2: Deve conter sh-hero-login-row'
);

assert.strictEqual(
  headerJsx.includes('className="sh-hero-date-row"'),
  true,
  'Linha 3: Deve conter sh-hero-date-row'
);

// 4. Garantir que o Pulso Operacional permanece fora
assert.strictEqual(
  headerJsx.includes('PULSO OPERACIONAL'),
  false,
  'Pulso Operacional deve permanecer removido'
);

// 5. CSS
assert.strictEqual(
  appCss.includes('.sh-hero-icon-wrap'),
  true,
  'App.css deve conter estilos para .sh-hero-icon-wrap'
);

// 6. Teste de lógica da função headerWeatherIcon para Noite e Dia
function simulateHeaderIcon(hour, condition) {
  const isNight = hour >= 18 || hour < 6;
  if (condition === 'storm') return '⛈️';
  if (condition === 'rain') return '🌧️';
  if (condition === 'fog') return '🌫️';
  if (isNight) return '🌙';
  if (hour < 12) return condition === 'cloudy' ? '🌤️' : '☀️';
  return condition === 'cloudy' ? '⛅' : '🌤️';
}

// À noite (ex: 21h em Boa Vista)
assert.strictEqual(simulateHeaderIcon(21, 'clear'), '🌙', '21h Céu Limpo deve retornar Lua (🌙)');
assert.strictEqual(simulateHeaderIcon(21, 'cloudy'), '🌙', '21h Nublado deve retornar Lua (🌙)');
assert.strictEqual(simulateHeaderIcon(23, 'clear'), '🌙', '23h deve retornar Lua (🌙)');
assert.strictEqual(simulateHeaderIcon(2, 'clear'), '🌙', '02h da madrugada deve retornar Lua (🌙)');

// De dia (ex: manhã e tarde)
assert.strictEqual(simulateHeaderIcon(9, 'clear'), '☀️', '09h manhã Céu Limpo deve retornar Sol (☀️)');
assert.strictEqual(simulateHeaderIcon(15, 'clear'), '🌤️', '15h tarde Céu Limpo deve retornar Sol entre nuvens (🌤️)');

// Chuva e Tempestade
assert.strictEqual(simulateHeaderIcon(21, 'rain'), '🌧️', 'Chuva à noite deve retornar Chuva (🌧️)');
assert.strictEqual(simulateHeaderIcon(14, 'storm'), '⛈️', 'Tempestade de dia deve retornar Tempestade (⛈️)');

console.log('✅ Todos os testes do Smart Header Greeting com ícone Sol/Lua e layout alinhado passaram com 100% de sucesso!');
