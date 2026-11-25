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
  <script src="../../config.js"></script>
  <title>Neon Plinko Gravity - PANDA CASH | Multiplicador hasta x250</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚪</text></svg>">
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
      <span class="game-tag-pill">⚪ Neon Plinko Gravity</span>
    </div>

    <div class="topbar-right">
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

  <!-- CONTENEDOR PRINCIPAL DEL JUEGO (FIT SCREEN 100VH SIN SCROLL EN ESCRITORIO) -->
  <main class="plinko-layout">

    <!-- COLUMNA IZQUIERDA: CONTROLES DE INVERSIÓN Y PARÁMETROS -->
    <aside class="panel-card">
      <div class="panel-header">
        <h3>⚙️ Controles</h3>
        <p>Multiplicador hasta x250</p>
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

        <!-- Selector de Riesgo -->
        <div class="control-group">
          <div class="control-label-row">
            <span>Nivel de Riesgo</span>
          </div>
          <div class="toggle-options-row">
            <button type="button" class="btn-opt" data-risk="low">Bajo</button>
            <button type="button" class="btn-opt active" data-risk="medium">Medio</button>
            <button type="button" class="btn-opt" data-risk="high">Alto (x250)</button>
          </div>
        </div>

        <!-- Selector de Filas de Pines -->
        <div class="control-group">
          <div class="control-label-row">
            <span>Filas de Pines</span>
          </div>
          <div class="toggle-options-row">
            <button type="button" class="btn-opt" data-rows="10">10 Filas</button>
            <button type="button" class="btn-opt active" data-rows="12">12 Filas</button>
            <button type="button" class="btn-opt" data-rows="14">14 Filas</button>
          </div>
        </div>

        <!-- Resumen de Estadísticas Rápidas -->
        <div class="stats-box">
          <span style="color: var(--text-muted);">Bolas Soltadas:</span>
          <strong id="statTotalBalls" style="color: #fff;">0</strong>
        </div>
        <div class="stats-box">
          <span style="color: var(--text-muted);">Premios Totales:</span>
          <strong id="statTotalWon" style="color: var(--accent-neon-green);">+0 💎</strong>
        </div>
        <div class="stats-box">
          <span style="color: var(--text-muted);">Mejor Récord:</span>
          <strong id="statBestMult" style="color: #d866ff;">x0.0</strong>
        </div>
      </div>

      <div class="actions-wrap">
        <button type="button" class="btn-drop-main" id="btnDropBall">
          ⚪ SOLTAR BOLA
        </button>
        <button type="button" class="btn-drop-auto" id="btnToggleAutoDrop">
          🔄 Auto-Drop
        </button>
      </div>
    </aside>

    <!-- COLUMNA CENTRAL: TABLERO DE GRAVEDAD NEON PLINKO -->
    <section class="board-card">
      <!-- Chips de multiplicadores recientes -->
      <div class="recent-chips-strip" id="recentChipsStrip">
        <!-- Los chips se añaden dinámicamente -->
      </div>

      <!-- Lienzo Canvas de Física Neón -->
      <div class="canvas-viewport">
        <canvas id="plinkoCanvas" width="760" height="580"></canvas>
      </div>

      <!-- Ticker de estado inferior -->
      <div class="plinko-ticker-bar" id="plinkoTickerBar">
        <span style="color: #cbd5e1;">Presiona <strong>SOLTAR BOLA</strong> (o espacio) para iniciar la gravedad.</span>
        <span style="font-size: 0.72rem; color: var(--accent-neon-cyan); font-family: 'Courier New', monospace;">Neon Gravity</span>
      </div>
    </section>

    <!-- COLUMNA DERECHA: TABLA DE PREMIOS E HISTORIAL DE JUEGO -->
    <aside class="side-column">
      <div class="multipliers-card">
        <div class="panel-header">
          <h3>📊 Multiplicadores</h3>
          <p>Retornos según el riesgo activo</p>
        </div>
        <div class="mult-list-wrap" id="multipliersBreakdown">
          <!-- Desglose generado automáticamente -->
        </div>
      </div>

      <div class="history-card">
        <div class="panel-header">
          <h3>📜 Historial en Vivo</h3>
          <p>Tus últimas bolas aterrizadas</p>
        </div>
        <div class="history-list" id="plinkoHistoryList">
          <div class="empty-hist" style="font-size: 0.72rem; color: var(--text-muted); text-align: center; padding: 1rem 0;">
            Aún no has soltado bolas en esta sesión.
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

fs.writeFileSync(path.join(__dirname, 'jugar_plinko.html'), htmlOutput, 'utf8');
console.log('✓ Juego Neon Plinko Gravity compilado y ofuscado en:', path.join(__dirname, 'jugar_plinko.html'));
