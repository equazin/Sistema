const e = require('electron');
console.log('type of e:', typeof e);
if (typeof e === 'object') {
  console.log('keys:', Object.keys(e).slice(0, 20));
  console.log('has app:', 'app' in e);
  console.log('app:', e.app);
}
