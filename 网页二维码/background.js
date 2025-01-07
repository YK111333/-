// 预先请求剪贴板权限
chrome.runtime.onInstalled.addListener(() => {
  navigator.permissions.query({ name: 'clipboard-write' }).then(result => {
    if (result.state === 'granted') {
      console.log('Clipboard permission granted');
    } else {
      // 自动请求权限
      navigator.clipboard.writeText('').catch(() => {});
    }
  });
}); 