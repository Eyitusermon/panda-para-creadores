// =============================================================================
// PANDA CASH - CONFIGURACIÓN CENTRALIZADA DE PRODUCCIÓN & DESARROLLO
// =============================================================================
// Esta configuración auto-detecta si estás en localhost o en producción (Vercel / Render).
// - En local (localhost / 127.0.0.1 / file://): apunta a http://localhost:8085/api/v1
// - En producción (Vercel): apunta a /api/v1 (usando el reverse-proxy de vercel.json)
//   o directamente a la URL de Render configurada en DEFAULT_RENDER_URL o en localStorage.
// =============================================================================

(function () {
  const isLocal = window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1' ||
                  window.location.hostname === '' ||
                  window.location.protocol === 'file:';

  // Si el usuario configuró una URL manual en localStorage (ej. en el Admin Panel o consola)
  const savedBackend = localStorage.getItem('PANDA_BACKEND_URL');

  // URL de tu servicio en Render (cámbiala si no usas Vercel rewrites)
  const DEFAULT_RENDER_URL = 'https://pandabet-backend.onrender.com';

  let backendUrl = 'http://localhost:8085';
  let apiBase = 'http://localhost:8085/api/v1';

  if (savedBackend) {
    backendUrl = savedBackend.replace(/\/$/, '');
    apiBase = backendUrl + '/api/v1';
  } else if (!isLocal) {
    // En Vercel: usa '/api/v1' relativo (gestionado por vercel.json)
    apiBase = '/api/v1';
    backendUrl = window.location.origin;
  }

  window.PANDA_CONFIG = {
    isLocal: isLocal,
    BACKEND_URL: backendUrl,
    API_BASE: apiBase
  };

  // Asignar en window para acceso global
  window.API_BASE = apiBase;

  // ===========================================================================
  // RUTAS LIMPIAS PROFESIONALES (Clean URLs / Pretty URLs)
  // ===========================================================================
  // Oculta las extensiones .html y sufijos _directo en la barra de direcciones del navegador
  // Convierte:
  //   /dashboard_directo.html  -> /dashboard
  //   /portal_directo.html     -> /portal
  //   /recargar.html           -> /recargar
  //   /retirar.html            -> /retirar
  //   /perfil.html             -> /perfil
  //   /misiones.html           -> /misiones
  //   /terminos.html           -> /terminos
  //   /juegos/slots/jugar_slots.html -> /juegos/slots
  // ===========================================================================
  try {
    if (window.location.protocol.startsWith('http')) {
      const path = window.location.pathname;
      if (path.endsWith('.html')) {
        let clean = path
          .replace(/\/juegos\/([a-z0-9_-]+)\/jugar_\1\.html$/i, '/juegos/$1')
          .replace(/\/juegos\/([a-z0-9_-]+)\/[^/]+\.html$/i, '/juegos/$1')
          .replace(/_directo\.html$/i, '')
          .replace(/\.html$/i, '');

        if (clean.endsWith('/index')) {
          clean = clean.replace(/\/index$/i, '') || '/';
        }

        const newUrl = clean + window.location.search + window.location.hash;
        window.history.replaceState(null, '', newUrl);
      }
    }
  } catch (_) {}
})();
