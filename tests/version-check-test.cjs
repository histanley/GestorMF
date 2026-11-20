const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- TEST: System Version Alignment (v7.5.0) ---');

const pkgPath = path.join(__dirname, '../package.json');
const verPath = path.join(__dirname, '../src/utils/version.js');
const swPath = path.join(__dirname, '../public/sw.js');
const vitePath = path.join(__dirname, '../vite.config.js');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const verCode = fs.readFileSync(verPath, 'utf8');
const swCode = fs.readFileSync(swPath, 'utf8');
const viteCode = fs.readFileSync(vitePath, 'utf8');

// 1. package.json version
assert.strictEqual(pkg.version, '7.5.0', 'package.json version must be 7.5.0');
console.log('✓ 1. package.json version is 7.5.0');

// 2. src/utils/version.js fallback
assert(verCode.includes("'7.5.0'"), 'src/utils/version.js fallback version must be 7.5.0');
console.log('✓ 2. src/utils/version.js SYSTEM_VERSION is aligned to 7.5.0');

// 3. public/sw.js cache name
assert(swCode.includes('gestormf-cache-v7-5-0'), 'public/sw.js cache name must be gestormf-cache-v7-5-0');
assert(swCode.includes('Versão 7.5.0'), 'public/sw.js comment must be Versão 7.5.0');
console.log('✓ 3. public/sw.js cache name and header are aligned to 7.5.0');

// 4. vite.config.js default fallback
assert(viteCode.includes("'7.5.0'"), 'vite.config.js default fallback must be 7.5.0');
console.log('✓ 4. vite.config.js default fallback is aligned to 7.5.0');

console.log('\n--- ALL VERSION ALIGNMENT TESTS PASSED (4/4) ---');
