// 添加设置存储和获取函数
async function getSettings() {
  const defaultSettings = {
    position: 'left', // 'left' 或 'right'
    theme: 'light',   // 'light' 或 'dark'
    showLogo: true    // 是否在二维码中显示 logo
  };
  
  try {
    const result = await chrome.storage.sync.get('qrSettings');
    return result.qrSettings || defaultSettings;
  } catch (err) {
    return defaultSettings;
  }
}

// 添加设置保存函数
async function saveSettings(settings) {
  try {
    await chrome.storage.sync.set({ qrSettings: settings });
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

// 修改 getFaviconUrl 函数
async function getFaviconUrl() {
  // 尝试获取网站的各种图标
  const iconSelectors = [
    'link[rel*="icon"][href]',
    'link[rel="shortcut icon"][href]',
    'link[rel="apple-touch-icon"][href]',
    'link[rel="apple-touch-icon-precomposed"][href]',
    'link[rel="mask-icon"][href]',
    'link[rel="fluid-icon"][href]'
  ];

  // 尝试获取图标
  for (const selector of iconSelectors) {
    const icon = document.querySelector(selector);
    if (icon?.href) {
      // 如果是 data URL，直接返回
      if (icon.href.startsWith('data:')) {
        return icon.href;
      }

      // 尝试获取图标
      try {
        const response = await fetch(icon.href, {
          mode: 'no-cors',
          cache: 'force-cache'
        });
        if (response.type !== 'error') {
          return icon.href;
        }
      } catch (err) {
        console.warn('Failed to fetch icon:', err);
      }
    }
  }

  // 尝试使用网站根目录的 favicon.ico
  try {
    const rootFavicon = new URL('/favicon.ico', window.location.origin).href;
    const response = await fetch(rootFavicon, {
      mode: 'no-cors',
      cache: 'force-cache'
    });
    if (response.type !== 'error') {
      return rootFavicon;
    }
  } catch (err) {
    console.warn('Failed to fetch root favicon:', err);
  }

  // 如果都失败了，返回默认图标
  return getDefaultIcon();
}

// 创建浮动 logo 按钮
async function createFloatingLogo() {
  const settings = await getSettings();
  const safeArea = document.createElement('div');
  safeArea.id = 'qr-safe-area';
  
  // 根据设置调整位置
  if (settings.position === 'right') {
    safeArea.classList.add('position-right');
  }
  
  // 根据设置应用主题
  if (settings.theme === 'dark') {
    safeArea.classList.add('theme-dark');
  }
  
  document.body.appendChild(safeArea);

  const button = document.createElement('div');
  button.id = 'floating-logo';
  safeArea.appendChild(button); // 将 logo 添加到安全区域中
  
  // 获取网站 favicon
  const favicon = await getFaviconUrl();
  
  // 创建 logo 图片
  const img = document.createElement('img');
  img.src = favicon;
  img.alt = document.domain;
  
  button.appendChild(img);
  
  let hoverTimer = null;
  let isHovering = false;
  
  // 鼠标进入时
  button.addEventListener('mouseenter', () => {
    isHovering = true;
    safeArea.classList.add('active');
    if (hoverTimer) clearTimeout(hoverTimer);
    
    hoverTimer = setTimeout(() => {
      if (!isHovering) return;
      button.classList.add('expanded');
      const container = document.getElementById('qr-container');
      if (container) {
        container.classList.add('visible');
        copyQRUrl();
      } else {
        generateQR();
        setTimeout(() => {
          const newContainer = document.getElementById('qr-container');
          if (newContainer) {
            newContainer.classList.add('visible');
            copyQRUrl();
          }
        }, 50);
      }
    }, 300);
  });
  
  // 将 mouseleave 事件监听器移到安全区域上
  safeArea.addEventListener('mouseleave', () => {
    isHovering = false;
    safeArea.classList.remove('active');
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    button.classList.remove('expanded');
    const container = document.getElementById('qr-container');
    if (container) {
      container.classList.remove('visible');
    }
  });
  
  return button;
}

// 创建二维码容器
function createQRContainer() {
  const container = document.createElement('div');
  container.id = 'qr-container';
  
  const qrCode = document.createElement('div');
  qrCode.id = 'qr-code';
  
  // 添加控制按钮容器
  const controlsContainer = document.createElement('div');
  controlsContainer.id = 'controls-container';
  
  // 添加 logo 切换按钮
  const toggleLogoBtn = document.createElement('button');
  toggleLogoBtn.id = 'toggle-logo-btn';
  toggleLogoBtn.className = 'control-btn';
  
  // 立即获取设置并设置初始状态
  getSettings().then(settings => {
    toggleLogoBtn.classList.toggle('active', settings.showLogo);
    toggleLogoBtn.title = settings.showLogo ? '隐藏Logo' : '显示Logo';
  });

  // 修改点击事件处理
  toggleLogoBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    
    const settings = await getSettings();
    settings.showLogo = !settings.showLogo;
    await saveSettings(settings);
    
    toggleLogoBtn.classList.toggle('active', settings.showLogo);
    toggleLogoBtn.title = settings.showLogo ? '隐藏Logo' : '显示Logo';
    
    // 重新生成二维码，不使用缓存
    generateQR();
  });

  controlsContainer.appendChild(toggleLogoBtn);
  
  const titleContainer = document.createElement('div');
  titleContainer.id = 'title-container';
  
  const siteName = document.createElement('div');
  siteName.id = 'site-name';
  siteName.textContent = document.domain;
  
  const pageTitle = document.createElement('div');
  pageTitle.id = 'page-title';
  // 限制标题长度，但保持完整单词
  const maxLength = 50;
  let title = document.title;
  if (title.length > maxLength) {
    title = title.substr(0, maxLength).split(' ').slice(0, -1).join(' ') + '...';
  }
  pageTitle.textContent = title;
  
  titleContainer.appendChild(siteName);
  titleContainer.appendChild(pageTitle);
  container.appendChild(qrCode);
  container.appendChild(controlsContainer);
  container.appendChild(titleContainer);
  
  // 将容器添加到安全区域中
  const safeArea = document.getElementById('qr-safe-area');
  if (safeArea) {
    safeArea.appendChild(container);
  }
  
  return qrCode;
}

// 修改复制函数
function copyQRUrl() {
  const qrImg = document.querySelector('#qr-code img');
  if (!qrImg) return;

  // 创建 canvas 来处理图片
  const canvas = document.createElement('canvas');
  canvas.width = qrImg.width;
  canvas.height = qrImg.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(qrImg, 0, 0);

  // 将 canvas 转换为 blob
  canvas.toBlob((blob) => {
    // 创建剪贴板项目
    const item = new ClipboardItem({ 'image/png': blob });
    navigator.clipboard.write([item])
      .then(() => {
        showTooltip('二维码已复制');
      })
      .catch(err => {
        console.error('Failed to copy QR code:', err);
        showTooltip('复制失败，请重试');
      });
  }, 'image/png');
}

// 分离提示框逻辑
function showTooltip(message) {
  let tooltip = document.getElementById('copy-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'copy-tooltip';
    document.body.appendChild(tooltip);
  }
  
  tooltip.textContent = message;
  tooltip.classList.add('show');
  
  // 清除之前的定时器
  if (tooltip.hideTimer) {
    clearTimeout(tooltip.hideTimer);
  }
  
  // 设置新的定时器
  tooltip.hideTimer = setTimeout(() => {
    tooltip.classList.remove('show');
  }, 2000);
}

// 添加缓存管理
const qrCache = new Map();

// 修改短链接服务选择
const SHORTENERS = {
  tinyurl: 'https://tinyurl.com/api-create.php',
  isgd: 'https://is.gd/create.php',
  vgd: 'https://v.gd/create.php'
};

// 优化短链接生成
const shortUrlCache = new Map();

async function createShortUrl(longUrl, service = 'tinyurl') {
  // 检查缓存
  if (shortUrlCache.has(longUrl)) {
    return shortUrlCache.get(longUrl);
  }

  // 验证目标 URL 安全性
  if (!isSecure(longUrl)) {
    console.warn('Warning: Target URL is not secure');
  }
  
  try {
    const response = await fetch('https://tinyurl.com/api-create.php?url=' + encodeURIComponent(longUrl));
    if (response.ok) {
      const shortUrl = await response.text();
      // 保存到缓存
      shortUrlCache.set(longUrl, shortUrl);
      return shortUrl;
    }
  } catch (err) {
    console.error('Failed to create short URL:', err);
  }
  return longUrl;
}

// 修改 generateQR 函数中的二维码生成部分
async function generateQR() {
  const url = window.location.href;
  const settings = await getSettings();
  
  try {
    const qrContainer = document.getElementById('qr-code') || createQRContainer();
    qrContainer.innerHTML = '';
    
    if (typeof QRCode === 'undefined') {
      console.error('QRCode is not defined');
      return;
    }

    // 获取当前 URL 并尝试生成短链接
    const urlToUse = await createShortUrl(url);
    
    // 创建二维码
    new QRCode(qrContainer, {
      text: urlToUse,
      width: 256,
      height: 256,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.L
    });

    // 获取网站 favicon
    const currentFavicon = await getFaviconUrl();
    
    // 等待二维码图片生成完成
    setTimeout(() => {
      const img = qrContainer.querySelector('img');
      if (!img) return;
      
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      
      // 绘制二维码
      ctx.drawImage(img, 0, 0, 256, 256);
      
      // 只在设置为显示 logo 时添加 logo
      if (settings.showLogo) {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        
        // 修改图片加载错误处理
        const handleImageError = () => {
          console.log('Failed to load favicon, using default icon');
          logoImg.src = getDefaultIcon();
        };

        logoImg.onerror = handleImageError;
        
        logoImg.onload = () => {
          const logoSize = 48;
          const logoX = (256 - logoSize) / 2;
          const logoY = (256 - logoSize) / 2;
          
          // 绘制白色背景和阴影
          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
          ctx.shadowBlur = 4;
          ctx.fillStyle = 'white';
          ctx.beginPath();
          ctx.arc(logoX + logoSize/2, logoY + logoSize/2, logoSize/2 + 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          
          // 创建圆形裁剪区域
          ctx.save();
          ctx.beginPath();
          ctx.arc(logoX + logoSize/2, logoY + logoSize/2, logoSize/2, 0, Math.PI * 2);
          ctx.clip();
          
          // 绘制 logo
          ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
          ctx.restore();
          
          try {
            // 更新二维码图片
            img.src = canvas.toDataURL('image/png');
          } catch (err) {
            console.error('Failed to export canvas:', err);
            // 如果导出失败，至少保留原始的二维码
          }
        };

        // 设置图片源
        if (currentFavicon.startsWith('data:')) {
          logoImg.src = currentFavicon;
        } else {
          // 尝试直接加载
          logoImg.src = currentFavicon;
        }
      } else {
        // 直接使用原始二维码
        try {
          img.src = canvas.toDataURL('image/png');
        } catch (err) {
          console.error('Failed to export canvas:', err);
        }
      }
    }, 100);

  } catch (error) {
    console.error('Error generating QR code:', error);
    qrContainer.innerHTML = '<div>二维码生成失败<br>正在尝试使用短链接...</div>';
    // 强制使用短链接重试
    setTimeout(async () => {
      try {
        const shortUrl = await createShortUrl(window.location.href);
        if (shortUrl !== window.location.href) {
          generateQR(); // 使用短链接重试
        } else {
          qrContainer.innerHTML = '<div>二维码生成失败<br>请尝试使用短链接服务</div>';
        }
      } catch (err) {
        qrContainer.innerHTML = '<div>二维码生成失败<br>请尝试使用短链接服务</div>';
      }
    }, 1000);
  }
}

// 添加默认图标生成函数
function getDefaultIcon() {
  return `data:image/svg+xml;base64,${btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" rx="20" fill="#f0f0f0"/>
      <text x="50" y="50" font-family="Arial" font-size="40" 
        fill="#666" text-anchor="middle" dominant-baseline="central">
        ${document.domain.charAt(0).toUpperCase()}
      </text>
    </svg>
  `)}`;
}

// 页面加载完成后生成二维码
window.addEventListener('load', () => {
  createFloatingLogo();
  generateQR();
});

// 添加链接预览功能
function createPreviewTooltip(url) {
  const tooltip = document.createElement('div');
  tooltip.id = 'preview-tooltip';
  tooltip.innerHTML = `
    <div class="preview-header">
      <span class="preview-icon ${isSecure(url) ? 'secure' : 'insecure'}"></span>
      <span class="preview-domain">${new URL(url).hostname}</span>
    </div>
    <div class="preview-url">${url}</div>
  `;
  return tooltip;
}

// 检查网站安全性
function isSecure(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'https:';
  } catch {
    return false;
  }
} 