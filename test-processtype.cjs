console.log('process.type:', process.type);
console.log('electron version:', process.versions.electron);
if (process.type === 'browser') {
  const { app } = require('electron');
  app.whenReady().then(() => { app.quit(); });
} else {
  console.log('WARNING: Not browser process!');
}
