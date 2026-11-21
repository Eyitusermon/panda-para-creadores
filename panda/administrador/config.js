// =============================================================================
// PANDA CASH - CONFIGURACIÓN CENTRALIZADA ADMIN PANEL (RENDER / LOCAL)
// =============================================================================
(function () {
  const isLocal = window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1' ||
                  window.location.hostname === '' ||
                  window.location.protocol === 'file:';

  const savedBackend = localStorage.getItem('PANDA_BACKEND_URL');

  let backendUrl = 'http://localhost:8085';
  let apiBase = 'http://localhost:8085/api/v1';

  if (savedBackend) {
    backendUrl = savedBackend.replace(/\/$/, '');
    apiBase = backendUrl + '/api/v1';
  } else if (!isLocal) {
    // Si el panel de admin corre en el mismo backend de Render:
    apiBase = window.location.origin + '/api/v1';
    backendUrl = window.location.origin;
  }

  window.PANDA_CONFIG = {
    isLocal: isLocal,
    BACKEND_URL: backendUrl,
    API_BASE: apiBase
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
