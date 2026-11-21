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

// 2. Aplicar el mismo formato de ofuscación extrema del proyecto
const obfuscated = JavaScriptObfuscator.obfuscate(jsSource, {
  compact: true,
  simplify: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 1.0,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.8,
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
  <title>Panda Crash Rocket - PANDA CASH | Multiplicador hasta x500</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🚀</text></svg>">
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
      <span class="game-tag-pill">🚀 Panda Crash Rocket</span>
    </div>

    <div class="topbar-right">
      <span style="font-size: 0.74rem; color: var(--text-muted); font-weight: 700;" id="topUsernameLabel">PandaMaster_99</span>
      <div class="wallet-box">
        <div>
          <div class="wallet-diamonds" id="topBalanceDiamonds">15,000 💎</div>
          <div class="wallet-usdt" id="topBalanceUsdt">≈ 1,500.00 USDT</div>
        </div>
      </div>
      <a href="../../recargar.html" class="btn-top-action" style="border-color: var(--accent-gold); color: var(--accent-gold);">+ Recargar 💎</a>
      <a href="../../dashboard_directo.html" class="btn-top-action">&larr; Volver al Lobby</a>
    </div>
  </header>

  <!-- CONTENEDOR PRINCIPAL DEL JUEGO (FIT SCREEN 100VH SIN SCROLL EN ESCRITORIO) -->
  <main class="rocket-layout">

    <!-- COLUMNA IZQUIERDA: CONTROLES DE INVERSIÓN Y CASHOUT -->
    <aside class="panel-card">
      <div class="panel-header">
        <h3>🚀 Controles</h3>
        <p>Multiplicador hasta x500</p>
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

        <!-- Auto-Retiro (Auto-Cashout) Interactivo -->
        <div class="auto-cashout-box" id="autoCashoutBox">
          <div class="auto-toggle-row">
            <div class="auto-toggle-left">
              <span class="auto-title">🎯 Auto-Retiro</span>
              <button type="button" class="toggle-switch-btn" id="btnToggleAutoCashout" aria-pressed="false" title="Encender / Apagar Auto-Retiro">
                <span class="toggle-slider"></span>
              </button>
            </div>
            <span class="toggle-status-badge badge-off" id="autoCashoutStatusBadge" title="Click para alternar">APAGADO</span>
          </div>
          
          <div class="auto-input-container disabled" id="autoInputContainer">
            <div class="auto-input-row">
              <span class="auto-target-label">Retirar en:</span>
              <div class="auto-mult-input-wrap">
                <span class="auto-prefix">x</span>
                <input type="number" id="autoCashoutMultInput" class="auto-mult-input" value="2.00" min="1.05" max="500.00" step="0.10" disabled />
              </div>
            </div>
            <div class="auto-presets-row">
              <button type="button" class="btn-autopreset" data-mult="1.20">x1.2</button>
              <button type="button" class="btn-autopreset" data-mult="1.50">x1.5</button>
              <button type="button" class="btn-autopreset active" data-mult="2.00">x2.0</button>
              <button type="button" class="btn-autopreset" data-mult="5.00">x5.0</button>
              <button type="button" class="btn-autopreset" data-mult="10.00">x10</button>
            </div>
          </div>
        </div>

        <!-- Estadísticas Rápidas -->
        <div class="stats-box">
          <span style="color: var(--text-muted);">Vuelos Realizados:</span>
          <strong id="statTotalRounds" style="color: #fff;">0</strong>
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
        <button type="button" class="btn-rocket-main btn-bet" id="btnRocketAction">
          <span id="btnRocketMainTitle">🚀 PARTICIPAR EN VUELO</span>
          <small id="btnRocketSubTitle" style="display: none; font-size: 0.78rem; font-weight: 800;"></small>
        </button>
      </div>
    </aside>

    <!-- COLUMNA CENTRAL: TABLERO DE TRAYECTORIA Y RADAR -->
    <section class="board-card">
      <!-- Tira de multiplicadores recientes -->
      <div class="recent-chips-strip" id="recentChipsStrip">
        <!-- Los chips se añaden dinámicamente -->
      </div>

      <!-- Lienzo Canvas Espacial -->
      <div class="canvas-viewport">
        <canvas id="rocketCanvas" width="760" height="580"></canvas>
      </div>

      <!-- Ticker de estado inferior -->
      <div class="rocket-ticker-bar" id="rocketTickerBar">
        <span style="color: #cbd5e1;">Esperando al próximo lanzamiento...</span>
        <span style="font-size: 0.72rem; color: var(--accent-cyan); font-family: 'Courier New', monospace;">RTP ~97% &bull; Motor Seguro</span>
      </div>
    </section>

    <!-- COLUMNA DERECHA: REGLAS E HISTORIAL DE PARTIDAS -->
    <aside class="side-column">
      <div class="info-card">
        <div class="panel-header">
          <h3>ℹ️ Dinámica Crash</h3>
          <p>Cómo jugar Panda Crash Rocket</p>
        </div>
        <div class="info-bullet-list">
          <div class="info-bullet">
            <span style="color:#d1d5db;">1. Apuesta:</span>
            <span style="color:var(--accent-gold); font-weight:800;">Libre en 💎</span>
          </div>
          <div class="info-bullet">
            <span style="color:#d1d5db;">2. Despegue:</span>
            <span style="color:var(--accent-cyan); font-weight:800;">Multiplicador sube</span>
          </div>
          <div class="info-bullet">
            <span style="color:#d1d5db;">3. Retiro:</span>
            <span style="color:var(--accent-green); font-weight:800;">Antes del Crash</span>
          </div>
          <div class="info-bullet">
            <span style="color:#d1d5db;">4. Techo Máximo:</span>
            <span style="color:#ff3377; font-weight:800;">Hasta x500.00</span>
          </div>
        </div>
      </div>

      <div class="history-card">
        <div class="panel-header">
          <h3>📜 Historial en Vivo</h3>
          <p>Tus últimos vuelos jugados</p>
        </div>
        <div class="history-list" id="rocketHistoryList">
          <div class="empty-hist" style="font-size: 0.72rem; color: var(--text-muted); text-align: center; padding: 1rem 0;">
            Aún no has participado en vuelos de esta sesión.
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

fs.writeFileSync(path.join(__dirname, 'jugar_rocket.html'), htmlOutput, 'utf8');
console.log('✓ Juego Panda Crash Rocket compilado y ofuscado en:', path.join(__dirname, 'jugar_rocket.html'));
