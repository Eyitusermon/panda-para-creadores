// =============================================================================
// PANDA CREADORES - CONFIGURACIÓN CENTRALIZADA ADMIN PANEL (RENDER / LOCAL)
// =============================================================================
(function () {
  const APP_NAME = 'PANDA CREADORES';
  const DEFAULT_RENDER_URL = 'https://panda-creadores-api.onrender.com';
  const LOCAL_URL = 'http://localhost:8085';
  const PROD_URL = DEFAULT_RENDER_URL.replace(/\/$/, '');
  const STORAGE_MODE_KEY = 'PANDA_CREADORES_ADMIN_API_MODE';

  const hostname = window.location.hostname || '';
  const port = window.location.port || '';
  const isServedByLocalGo = (hostname === 'localhost' || hostname === '127.0.0.1') && port === '8085';

  let savedMode = '';
  let customRemoteUrl = '';
  try {
    savedMode = localStorage.getItem(STORAGE_MODE_KEY) || '';
    const rawCustom = (localStorage.getItem('PANDA_ADMIN_CUSTOM_URL') || '').trim();
    if (/^https:\/\/[^/]+/i.test(rawCustom) && !/localhost|127\.0\.0\.1/i.test(rawCustom)) {
      customRemoteUrl = rawCustom.replace(/\/$/, '');
    }
  } catch (_) {}

  let queryBackend = '';
  try {
    const params = new URLSearchParams(window.location.search || '');
    const rawParam = (params.get('backend') || '').trim();
    if (/^https?:\/\/[^/]+/i.test(rawParam)) {
      queryBackend = rawParam.replace(/\/$/, '');
    }
  } catch (_) {}

  let mode = 'prod';
  if (savedMode === 'prod' || savedMode === 'local') {
    mode = savedMode;
  } else if (isServedByLocalGo) {
    mode = 'local';
  }

  let backendUrl = mode === 'local' ? LOCAL_URL : (customRemoteUrl || PROD_URL);
  if (queryBackend) {
    backendUrl = queryBackend;
    mode = /localhost|127\.0\.0\.1/i.test(queryBackend) ? 'local' : 'prod';
  }

  const apiBase = backendUrl + '/api/v1';

  window.PANDA_CONFIG = {
    APP_NAME: APP_NAME,
    MODE: mode,
    PROD_URL: PROD_URL,
    LOCAL_URL: LOCAL_URL,
    BACKEND_URL: backendUrl,
    API_BASE: apiBase,
    STORAGE_MODE_KEY: STORAGE_MODE_KEY,
    isLocal: mode === 'local',
    setMode: function (nextMode) {
      const normalized = nextMode === 'local' ? 'local' : 'prod';
      try {
        localStorage.setItem(STORAGE_MODE_KEY, normalized);
      } catch (_) {}
      const nextBackend = normalized === 'local' ? LOCAL_URL : (customRemoteUrl || PROD_URL);
      window.PANDA_CONFIG.MODE = normalized;
      window.PANDA_CONFIG.isLocal = normalized === 'local';
      window.PANDA_CONFIG.BACKEND_URL = nextBackend;
      window.PANDA_CONFIG.API_BASE = nextBackend + '/api/v1';
      window.API_BASE = window.PANDA_CONFIG.API_BASE;
      return window.PANDA_CONFIG;
    }
  };

  window.API_BASE = apiBase;

  // Clean URLs para el panel de administración
  try {
    if (window.location.protocol.startsWith('http') && window.location.pathname.endsWith('.html')) {
      let clean = window.location.pathname.replace(/\/index\.html$/i, '').replace(/\.html$/i, '');
      if (!clean || clean.endsWith('/admin')) clean = clean || '/admin';
      window.history.replaceState(null, '', clean + window.location.search + window.location.hash);
    }
  } catch (_) {}
})();
