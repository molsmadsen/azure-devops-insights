const f = require('fs');
const r = f.readFileSync('README.md', 'utf8');
const c = f.readFileSync('CHANGELOG.md', 'utf8');
console.assert(r.includes('plugin marketplace add'), 'README must use marketplace install');
console.assert(!r.includes('claude plugin add github'), 'README must NOT use wrong install command');
console.assert(r.includes('/adi:setup'), 'README must document /adi:setup');
console.assert(r.includes('/adi:help'), 'README must document /adi:help');
console.assert(c.includes('1.0.0'), 'CHANGELOG must have version 1.0.0');
console.log('OK');
