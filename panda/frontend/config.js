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
  const DEFAULT_RENDER_URL = 'https://pandacash-api.onrender.com';

  let backendUrl = 'http://localhost:8085';
  let apiBase = 'http://localhost:8085/api/v1';

  if (savedBackend) {
    backendUrl = savedBackend.replace(/\/$/, '');
    apiBase = backendUrl + '/api/v1';
  } else if (!isLocal) {
    // En producción (Render Static Site / Vercel): apunta directamente a la API de Render
    backendUrl = DEFAULT_RENDER_URL.replace(/\/$/, '');
    apiBase = backendUrl + '/api/v1';
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

  // ===========================================================================
  // INTERCEPTOR Y ALERTA VISUAL DE SALDO INSUFICIENTE EN TODOS LOS JUEGOS
  // ===========================================================================
  function getRecargarLink() {
    return window.location.pathname.includes('/juegos/') ? '../../recargar.html' : '/recargar';
  }

  window.showInsufficientBalanceAlert = function (bet, balance) {
    let existing = document.getElementById('pandaInsufficientModal');
    if (existing) existing.remove();

    const recargarHref = getRecargarLink();
    const modal = document.createElement('div');
    modal.id = 'pandaInsufficientModal';
    modal.style.cssText = `
      position: fixed; inset: 0; z-index: 999999;
      background: rgba(5, 10, 20, 0.85); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      padding: 1rem; animation: pandaModalFadeIn 0.2s ease-out;
    `;

    modal.innerHTML = `
      <style>
        @keyframes pandaModalFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      </style>
      <div style="background: linear-gradient(135deg, #131c31 0%, #0c1222 100%); border: 1px solid rgba(255, 51, 102, 0.5); box-shadow: 0 25px 60px rgba(0,0,0,0.9), 0 0 35px rgba(255, 51, 102, 0.2); border-radius: 16px; padding: 2rem 1.75rem; max-width: 440px; width: 100%; text-align: center; color: #fff; font-family: system-ui, -apple-system, sans-serif; position: relative;">
        <div style="width: 64px; height: 64px; margin: 0 auto 1rem; border-radius: 50%; background: rgba(255, 51, 102, 0.15); border: 2px solid #ff3366; display: flex; align-items: center; justify-content: center; font-size: 2.2rem;">
          ⚠️
        </div>
        <h3 style="font-size: 1.4rem; font-weight: 900; margin: 0 0 0.5rem; color: #ff3366; letter-spacing: -0.3px;">
          Saldo Insuficiente
        </h3>
        <p style="font-size: 0.88rem; color: #94a3b8; line-height: 1.5; margin: 0 0 1.35rem;">
          No tienes suficientes diamantes para realizar esta apuesta. Por favor recarga para continuar disfrutando los juegos de Panda Cash.
        </p>

        <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 0.9rem; margin-bottom: 1.5rem; display: flex; justify-content: space-around; text-align: center;">
          <div>
            <div style="font-size: 0.72rem; color: #64748b; text-transform: uppercase; font-weight: 700;">Tu Saldo Actual</div>
            <div style="font-size: 1.25rem; font-weight: 900; color: #ffb700; margin-top: 2px;">${Number(balance || 0).toLocaleString('en-US')} 💎</div>
          </div>
          <div style="width: 1px; background: rgba(255,255,255,0.08);"></div>
          <div>
            <div style="font-size: 0.72rem; color: #64748b; text-transform: uppercase; font-weight: 700;">Apuesta Requerida</div>
            <div style="font-size: 1.25rem; font-weight: 900; color: #ff3366; margin-top: 2px;">${Number(bet || 0).toLocaleString('en-US')} 💎</div>
          </div>
        </div>

        <div style="display: flex; gap: 0.75rem;">
          <button id="btnPandaModalClose" type="button" style="flex: 1; padding: 0.85rem; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #e2e8f0; font-weight: 700; cursor: pointer; font-size: 0.86rem; transition: background 0.15s;">
            Cerrar
          </button>
          <a href="${recargarHref}" style="flex: 1.4; padding: 0.85rem; background: linear-gradient(135deg, #00e701, #00b001); border: none; border-radius: 8px; color: #000; font-weight: 900; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 0.4rem; font-size: 0.86rem; box-shadow: 0 4px 15px rgba(0, 231, 1, 0.4);">
            💎 Recargar Saldo
          </a>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('#btnPandaModalClose');
    if (closeBtn) {
      closeBtn.onclick = function () { modal.remove(); };
    }
    modal.onclick = function (e) {
      if (e.target === modal) modal.remove();
    };
  };

  // Interceptar clicks de apuesta en fase de captura para todos los juegos
  document.addEventListener('click', function (e) {
    const playBtn = e.target.closest('#btnSpinSlots, #btnDropBall, #btnRocketAction, #btnMinesAction, #btnDoorsAction, #btnToggleAutoDrop, #btnToggleAuto');
    if (!playBtn) return;

    const betInput = document.getElementById('betAmountInput');
    const bet = betInput ? parseFloat(betInput.value) || 0 : 0;

    let balance = 0;
    try {
      const sess = JSON.parse(localStorage.getItem('panda_user_session') || '{}');
      balance = typeof sess.balance === 'number' ? sess.balance : 0;
    } catch (_) {}

    if (bet > balance) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      window.showInsufficientBalanceAlert(bet, balance);
    }
  }, true);
})();
