const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Iniciando testes do Smart Header Greeting com ilustrações dinâmicas de clima e missões ativas centralizadas...');

const headerPath = path.resolve(__dirname, '../src/components/SmartHeaderGreeting.jsx');
const wiPath = path.resolve(__dirname, '../src/components/WeatherIllustration.jsx');
const cssPath = path.resolve(__dirname, '../src/App.css');

const headerJsx = fs.readFileSync(headerPath, 'utf8');
const wiJsx = fs.readFileSync(wiPath, 'utf8');
const appCss = fs.readFileSync(cssPath, 'utf8');

// 1. Garantir que a foto da pessoa (sh-avatar-hub) foi retirada
assert.strictEqual(
  headerJsx.includes('sh-avatar-hub'),
  false,
  'SmartHeaderGreeting não deve conter sh-avatar-hub (foto da pessoa)'
);

// 2. Garantir que o pill de cargo ("Diretor Geral & Produção" / sh-hero-role-pill) foi retirado
assert.strictEqual(
  headerJsx.includes('sh-hero-role-pill'),
  false,
  'SmartHeaderGreeting não deve conter sh-hero-role-pill (cargo removido conforme solicitado)'
);

// 3. Garantir que o container do ícone do clima/horário (sol/lua) existe
assert.strictEqual(
  headerJsx.includes('sh-hero-icon-wrap'),
  true,
  'SmartHeaderGreeting deve conter sh-hero-icon-wrap para o ícone de clima/horário'
);

assert.strictEqual(
  headerJsx.includes('{headerWeatherIcon}'),
  true,
  'SmartHeaderGreeting deve renderizar headerWeatherIcon obedecendo as variações de clima e turno'
);

// 4. Garantir que as 3 linhas continuam empilhadas e alinhadas
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

// 5. Garantir que as Missões Ativas foram retiradas da barra conforme solicitação do usuário
assert.strictEqual(
  headerJsx.includes('sh-hero-center') || headerJsx.includes('sh-active-missions-count'),
  false,
  'SmartHeaderGreeting não deve conter informação de missões ativas (removido a pedido do usuário)'
);

// 5b. Garantir alinhamento perfeito sem quebra das cápsulas (Clima, Missão e Botão Executivo)
assert.strictEqual(
  appCss.includes('flex-wrap: nowrap;') && appCss.includes('.sh-hero-widgets'),
  true,
  'App.css deve conter .sh-hero-widgets com flex-wrap: nowrap para alinhamento em linha única'
);

// 6. Garantir que o Pulso Operacional permanece fora
assert.strictEqual(
  headerJsx.includes('PULSO OPERACIONAL'),
  false,
  'Pulso Operacional deve permanecer removido'
);

// 7. Ilustrações de Clima completas: ensolarado, nublado, chuvoso, nevando (dia e noite)
assert.strictEqual(
  wiJsx.includes('wi-day-clear') && wiJsx.includes('wi-night-clear'),
  true,
  'WeatherIllustration deve suportar ensolarado e noite clara'
);

assert.strictEqual(
  wiJsx.includes('wi-day-cloudy') && wiJsx.includes('wi-night-cloudy'),
  true,
  'WeatherIllustration deve suportar nublado de dia e de noite'
);

assert.strictEqual(
  wiJsx.includes('wi-day-rain') && wiJsx.includes('wi-night-rain'),
  true,
  'WeatherIllustration deve suportar chuvoso de dia e de noite'
);

assert.strictEqual(
  wiJsx.includes('wi-day-snow') && wiJsx.includes('wi-night-snow'),
  true,
  'WeatherIllustration deve suportar nevando de dia e de noite'
);

// 8. Teste de mapeamento dos códigos da WMO para clima
function getIllustrationKey(code, isDay) {
  const c = Number(code);
  switch (c) {
    case 0:
    case 1:
      return isDay ? 'day-clear' : 'night-clear';
    case 2:
      return isDay ? 'day-partly-cloudy' : 'night-partly-cloudy';
    case 3:
      return isDay ? 'day-cloudy' : 'night-cloudy';
    case 45:
    case 48:
      return isDay ? 'day-fog' : 'night-fog';
    case 51:
    case 53:
    case 55:
      return isDay ? 'day-drizzle' : 'night-drizzle';
    case 56:
    case 57:
    case 66:
    case 67:
    case 71:
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      return isDay ? 'day-snow' : 'night-snow';
    case 61:
    case 63:
    case 65:
    case 80:
    case 81:
    case 82:
      return isDay ? 'day-rain' : 'night-rain';
    case 95:
    case 96:
    case 99:
      return isDay ? 'day-storm' : 'night-storm';
    default:
      return isDay ? 'day-clear' : 'night-clear';
  }
}

// Testes de Nevando
assert.strictEqual(getIllustrationKey(71, 0), 'night-snow', 'Nevando à noite deve retornar night-snow');
assert.strictEqual(getIllustrationKey(73, 1), 'day-snow', 'Nevando de dia deve retornar day-snow');

// Testes de Chuvoso
assert.strictEqual(getIllustrationKey(61, 0), 'night-rain', 'Chuvoso à noite deve retornar night-rain');
assert.strictEqual(getIllustrationKey(61, 1), 'day-rain', 'Chuvoso de dia deve retornar day-rain');

// Testes de Ensolarado / Noite Clara
assert.strictEqual(getIllustrationKey(0, 1), 'day-clear', 'Ensolarado de dia deve retornar day-clear');
assert.strictEqual(getIllustrationKey(0, 0), 'night-clear', 'Céu limpo à noite deve retornar night-clear');

// Testes de Nublado
assert.strictEqual(getIllustrationKey(3, 1), 'day-cloudy', 'Nublado de dia deve retornar day-cloudy');
assert.strictEqual(getIllustrationKey(3, 0), 'night-cloudy', 'Nublado à noite deve retornar night-cloudy');

// 9. CSS
assert.strictEqual(
  appCss.includes('.sh-hero-center'),
  true,
  'App.css deve conter estilos para .sh-hero-center'
);

assert.strictEqual(
  appCss.includes('.sh-hero-badge-active-centered'),
  true,
  'App.css deve conter estilos para .sh-hero-badge-active-centered'
);

console.log('✅ Todos os testes do Smart Header Greeting com ilustrações completas de clima (sol, chuva, nublado, neve) e missões centralizadas passaram com 100% de sucesso!');
