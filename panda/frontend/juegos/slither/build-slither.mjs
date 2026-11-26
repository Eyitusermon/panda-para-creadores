import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../../../');
const requireRoot = createRequire(path.join(rootDir, 'package.json'));

const esbuild = requireRoot('esbuild');
const JavaScriptObfuscator = requireRoot('javascript-obfuscator');

const cssSource = fs.readFileSync(path.join(__dirname, 'src/style.css'), 'utf8');

// 1. Transpilar, empaquetar y minificar TypeScript a JS ES2020
const bundled = esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'src/main.ts')],
  bundle: true,
  write: false,
  target: 'es2020',
  minify: true
});

const jsSource = bundled.outputFiles[0].text;

// 2. Aplicar ofuscación segura del proyecto
const obfuscated = JavaScriptObfuscator.obfuscate(jsSource, {
  compact: true,
  simplify: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  stringArray: true,
  stringArrayThreshold: 1.0,
  stringArrayEncoding: ['rc4', 'base64'],
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 1.0,
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 4,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 5,
  stringArrayWrappersType: 'function',
  splitStrings: true,
  splitStringsChunkLength: 3,
  debugProtection: false,
  disableConsoleOutput: true,
  selfDefending: true,
  identifierNamesGenerator: 'hexadecimal',
  numbersToExpressions: true,
  transformObjectKeys: true,
  renameGlobals: false
});

const obfuscatedJs = obfuscated.getObfuscatedCode();

const htmlOutput = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="../../config.js"></script>
  <title>Panda Slither Arena - PANDA CASH | Multiplicador hasta x200</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🐍</text></svg>">
  <style>
${cssSource}
  </style>
</head>
<body>

  <!-- BARRA SUPERIOR COMPACTA -->
  <header class="topbar">
    <div class="topbar-left">
      <a href="../../dashboard_directo.html" class="brand-logo">
        <span>🐼</span> PANDA<span class="gold"> CASH</span>
      </a>
      <span class="game-tag-pill">🐍 Panda Slither Arena</span>
    </div>

    <div class="topbar-right">
      <button type="button" class="btn-sound-toggle" id="btnSoundToggle" title="Silenciar / Activar Sonido">🔊</button>
      <span style="font-size: 0.74rem; color: var(--text-muted); font-weight: 700;" id="topUsernameLabel">PandaMaster_99</span>
      <div class="wallet-box">
        <div>
          <div class="wallet-diamonds" id="topBalanceDiamonds">15,000 💎</div>
          <div class="wallet-usdt" id="topBalanceUsdt">≈ 1,500.00 USDT</div>
        </div>
      </div>
      <a href="../../recargar.html" class="btn-top-action" style="border-color: var(--accent-gold); color: var(--accent-gold);"><span class="desktop-only">+ Recargar 💎</span><span class="mobile-only">+💎</span></a>
      <a href="../../dashboard_directo.html" class="btn-top-action"><span class="desktop-only">&larr; Volver al Lobby</span><span class="mobile-only">&larr; Salir</span></a>
    </div>
  </header>

  <!-- CONTENEDOR PRINCIPAL -->
  <main class="slither-layout">

    <!-- COLUMNA IZQUIERDA: APUESTA, ARENA Y AUTO-RETIRO -->
    <aside class="panel-card">
      <div class="panel-header">
        <h3>🐍 Controles</h3>
        <p>Arena Slither &bull; Hasta x200</p>
      </div>

      <div class="controls-body">
        <div class="control-group">
          <div class="control-label-row">
            <span>Monto (💎)</span>
            <span style="color: var(--accent-gold);">Mín: 10 💎</span>
          </div>
          <div class="bet-input-wrap">
            <input type="number" id="betAmountInput" class="bet-input" value="50" min="10" step="10" />
            <button type="button" class="btn-mod" id="btnBetHalf">÷2</button>
            <button type="button" class="btn-mod" id="btnBetDouble">x2</button>
            <button type="button" class="btn-mod" id="btnBetMax" style="color: var(--accent-gold);">MÁX</button>
          </div>
          <div class="quick-bets-grid">
            <button type="button" class="btn-qbet" data-bet="10">10 💎</button>
            <button type="button" class="btn-qbet" data-bet="25">25 💎</button>
            <button type="button" class="btn-qbet active" data-bet="50">50 💎</button>
            <button type="button" class="btn-qbet" data-bet="100">100 💎</button>
            <button type="button" class="btn-qbet" data-bet="250">250 💎</button>
            <button type="button" class="btn-qbet" data-bet="500">500 💎</button>
          </div>
        </div>

        <div class="control-group">
          <div class="control-label-row">
            <span>Nivel de Arena</span>
            <span style="color: var(--accent-cyan);">Riesgo / Multiplicador</span>
          </div>
          <div class="difficulty-grid">
            <button type="button" class="btn-diff" data-diff="classic">
              <strong>Clásica</strong>
              <span>7 Bots • x50</span>
            </button>
            <button type="button" class="btn-diff active" data-diff="pro">
              <strong>Pro</strong>
              <span>10 Bots • x100</span>
            </button>
            <button type="button" class="btn-diff" data-diff="vip">
              <strong>VIP</strong>
              <span>13 Bots • x200</span>
            </button>
          </div>
        </div>

        <!-- Auto-Retiro -->
        <div class="auto-cashout-box" id="autoCashoutBox">
          <div class="auto-toggle-row">
            <div class="auto-toggle-left">
              <span class="auto-title">🎯 Auto-Retiro</span>
              <button type="button" class="toggle-switch-btn" id="btnToggleAutoCashout" aria-pressed="false" title="Encender / Apagar Auto-Retiro">
                <span class="toggle-slider"></span>
              </button>
            </div>
            <span class="toggle-status-badge badge-off" id="autoCashoutStatusBadge">APAGADO</span>
          </div>

          <div class="auto-input-container disabled" id="autoInputContainer">
            <div class="auto-input-row">
              <span class="auto-target-label">Retirar en:</span>
              <div class="auto-mult-input-wrap">
                <span class="auto-prefix">x</span>
                <input type="number" id="autoCashoutMultInput" class="auto-mult-input" value="2.00" min="1.10" max="200.00" step="0.10" disabled />
              </div>
            </div>
            <div class="auto-presets-row">
              <button type="button" class="btn-autopreset" data-mult="1.50">x1.5</button>
              <button type="button" class="btn-autopreset active" data-mult="2.00">x2.0</button>
              <button type="button" class="btn-autopreset" data-mult="3.00">x3.0</button>
              <button type="button" class="btn-autopreset" data-mult="5.00">x5.0</button>
              <button type="button" class="btn-autopreset" data-mult="10.00">x10</button>
            </div>
          </div>
        </div>

        <div class="stats-box">
          <span style="color: var(--text-muted);">Partidas Jugadas:</span>
          <strong id="statTotalRounds" style="color: #fff;">0</strong>
        </div>
        <div class="stats-box">
          <span style="color: var(--text-muted);">Bajas Logradas:</span>
          <strong id="statTotalKills" style="color: var(--accent-cyan);">0</strong>
        </div>
        <div class="stats-box">
          <span style="color: var(--text-muted);">Premios Cobrados:</span>
          <strong id="statTotalWon" style="color: var(--accent-green);">+0 💎</strong>
        </div>
        <div class="stats-box">
          <span style="color: var(--text-muted);">Mejor Multiplicador:</span>
          <strong id="statBestMult" style="color: var(--accent-gold);">x0.00</strong>
        </div>
      </div>

      <div class="actions-wrap">
        <button type="button" class="btn-slither-main btn-bet" id="btnSlitherAction">
          <span id="btnSlitherMainTitle">🐍 ENTRAR A LA ARENA</span>
          <small id="btnSlitherSubTitle" style="display: none; font-size: 0.78rem; font-weight: 800;"></small>
        </button>
      </div>
    </aside>

    <!-- COLUMNA CENTRAL: HUD + CANVAS + BOTONERA TÁCTIL -->
    <section class="board-card">
      <div class="hud-strip">
        <div class="hud-pill-group">
          <span class="hud-pill cyan" id="hudArenaLabel">Arena: Pro</span>
          <span class="hud-pill" id="hudAliveCount">Serpientes: 12</span>
          <span class="hud-pill gold" id="hudPlayerKills">Bajas: 0</span>
        </div>
        <span class="hud-pill green" id="hudMultiplier">x1.00 (Máx x100)</span>
      </div>

      <div class="canvas-viewport">
        <canvas id="slitherCanvas" width="780" height="540"></canvas>
        <div class="canvas-overlay" id="slitherCanvasOverlay"></div>
      </div>

      <div class="arena-controls-bar" id="mobileArenaControls">
        <button type="button" class="btn-boost-hold" id="btnSlitherBoost" disabled>⚡ TURBO (Mantener)</button>
        <button type="button" class="btn-cashout-quick" id="btnSlitherCashoutQuick" disabled>💰 COBRAR (1.6s)</button>
      </div>

      <div class="slither-ticker-bar" id="slitherTickerBar">
        <span style="color: #cbd5e1;">Ajusta tu entrada y pulsa <strong>ENTRAR A LA ARENA</strong> para competir.</span>
        <span style="font-size: 0.72rem; color: var(--accent-gold); font-family: 'Courier New', monospace;">Panda Slither &bull; Pro</span>
      </div>
    </section>

    <!-- COLUMNA DERECHA: REGLAS E HISTORIAL -->
    <aside class="side-column">
      <div class="info-card">
        <div class="panel-header">
          <h3>ℹ️ Cómo Jugar</h3>
          <p>Panda Slither Arena</p>
        </div>
        <div class="info-bullet-list">
          <div class="info-bullet">
            <span style="color:#d1d5db;">1. Mover:</span>
            <span style="color:var(--accent-cyan); font-weight:800;">Ratón / Táctil</span>
          </div>
          <div class="info-bullet">
            <span style="color:#d1d5db;">2. Turbo Boost:</span>
            <span style="color:var(--accent-gold); font-weight:800;">Clic / Espacio</span>
          </div>
          <div class="info-bullet">
            <span style="color:#d1d5db;">3. Botín Extra:</span>
            <span style="color:var(--accent-green); font-weight:800;">Corta Rivales</span>
          </div>
          <div class="info-bullet">
            <span style="color:#d1d5db;">4. Extraer Premio:</span>
            <span style="color:#ffb700; font-weight:800;">Mantén Q (1.6s)</span>
          </div>
        </div>
      </div>

      <div class="history-card">
        <div class="panel-header">
          <h3>📜 Historial en Vivo</h3>
          <p>Tus últimas partidas</p>
        </div>
        <div class="history-list" id="slitherHistoryList">
          <div class="empty-hist" style="font-size: 0.72rem; color: var(--text-muted); text-align: center; padding: 1rem 0;">
            Aún no has jugado en la arena esta sesión.
          </div>
        </div>
      </div>
    </aside>

  </main>

  <script>
${obfuscatedJs}
  </script>
</body>
</html>`;

const jugarPath = path.join(__dirname, 'jugar_slither.html');
fs.writeFileSync(jugarPath, htmlOutput, 'utf8');
const indexOutput = htmlOutput.replace('<head>', '<head>\n  <base href="/">');
fs.writeFileSync(path.join(__dirname, 'index.html'), indexOutput, 'utf8');
console.log('✓ Juego Panda Slither Arena compilado en:', jugarPath);
