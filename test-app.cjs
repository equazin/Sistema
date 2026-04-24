const electron = require('electron');
console.log('electron type:', typeof electron);
console.log('process.type:', process.type);
console.log('process.versions.electron:', process.versions.electron);

if (process.type === 'browser') {
  electron.app.whenReady().then(() => {
    console.log('App ready');
    electron.app.quit();
  });
}
