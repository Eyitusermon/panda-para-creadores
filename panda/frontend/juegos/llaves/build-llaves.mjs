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
  <title>Llaves y Puertas: Bóveda Panda - PANDA CASH | Multiplicador Exclusivo</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🗝️</text></svg>">
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
      <span class="game-tag-pill">🗝️ Bóveda Panda</span>
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

  <!-- CONTENEDOR PRINCIPAL DEL JUEGO (FIT SCREEN 100VH SIN SCROLL EN ESCRITORIO) -->
  <main class="doors-layout">

    <!-- COLUMNA IZQUIERDA: CONTROLES DE APUESTA Y PUERTAS -->
    <aside class="panel-card">
      <div class="panel-header">
        <h3>🗝️ Controles</h3>
        <p>Puertas (máx. 10) y cerraduras</p>
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

        <!-- Selector de Puertas Totales (2 a 10) -->
        <div class="doors-config-card">
          <div class="control-label-row">
            <span>Total de Puertas (Máx. 10)</span>
            <span style="color: var(--accent-cyan); font-weight:800;">Bóveda</span>
          </div>
          <div class="doors-stepper-row">
            <button type="button" class="doors-stepper-btn" id="btnDecTotalDoors">&minus;</button>
            <span class="doors-count-display" id="totalDoorsCountDisplay">5 Puertas</span>
            <button type="button" class="doors-stepper-btn" id="btnIncTotalDoors">&plus;</button>
          </div>
          <div class="quick-doors-pills">
            <button type="button" class="btn-door-pill btn-total-door" data-total="3">3</button>
            <button type="button" class="btn-door-pill btn-total-door active" data-total="5">5</button>
            <button type="button" class="btn-door-pill btn-total-door" data-total="8">8</button>
            <button type="button" class="btn-door-pill btn-total-door" data-total="10">10 (MÁX)</button>
          </div>
        </div>

        <!-- Selector de Puertas Bloqueadas -->
        <div class="doors-config-card">
          <div class="control-label-row">
            <span>Puertas Bloqueadas</span>
            <span style="font-weight:800;" id="doorsDifficultyBadge">Riesgo Medio</span>
          </div>
          <div class="quick-doors-pills" id="blockedDoorsPills">
            <!-- Píldoras generadas dinámicamente según Total Puertas -->
          </div>
        </div>

        <!-- Visor de Multiplicador Estimado -->
        <div class="step-preview-box">
          <div class="step-preview-row">
            <span style="color:var(--text-muted);">Multiplicador Actual:</span>
            <span class="step-val-current" id="previewCurrentMult">x1.00</span>
          </div>
          <div class="step-preview-row">
            <span style="color:var(--text-muted);">Siguiente Puerta:</span>
            <span class="step-val-next" id="previewNextMult">x1.58</span>
          </div>
          <div class="step-preview-row">
            <span style="color:var(--text-muted);">Cobro Potencial:</span>
            <span style="color:var(--accent-gold); font-weight:900; font-family:'Courier New',monospace;" id="previewPotentialPayout">+50 💎</span>
          </div>
        </div>
      </div>

      <!-- Botones de Acción Principal -->
      <div class="actions-wrap">
        <button type="button" class="btn-doors-main btn-start" id="btnDoorsAction">
          <span id="btnDoorsActionTitle">🗝️ INSERTAR LLAVE</span>
          <small id="btnDoorsActionSub" style="font-size:0.78rem; font-weight:800;">50 💎 (2/5 Bloqueadas)</small>
        </button>
        <button type="button" class="btn-autopick" id="btnDoorsAutoPick" disabled>
          ⚡ LLAVE MAESTRA AL AZAR (AUTO-PICK)
        </button>
      </div>
    </aside>

    <!-- COLUMNA CENTRAL: CÁMARA DE BÓVEDA Y PUERTAS 3D -->
    <section class="board-card">
      <!-- Encabezado de Estado de Bóveda -->
      <div class="vault-header-bar">
        <div class="stat-pill safe">
          <span>🗝️ Puertas Abiertas:</span>
          <strong id="statSafeDoorsCount">0 / 3</strong>
        </div>
        <div class="stat-pill blocked">
          <span>🚫 Bloqueadas:</span>
          <strong id="statBlockedDoorsCount">2 / 5</strong>
        </div>
      </div>

      <!-- Visor de Puertas -->
      <div class="vault-viewport">
        <div class="doors-grid" id="doorsGrid">
          <!-- Puertas generadas dinámicamente por JavaScript -->
        </div>

        <!-- Modal de Resultado Flotante -->
        <div class="game-result-modal" id="gameResultModal"></div>
      </div>

      <!-- Barra Ticker Inferior -->
      <div class="doors-ticker-bar" id="doorsTickerBar">
        <span style="color: #cbd5e1;">Ajusta tus puertas y cerraduras y presiona INSERTAR LLAVE.</span>
        <span style="font-size: 0.72rem; color: var(--accent-cyan); font-family: 'Courier New', monospace;">RTP ~97% &bull; Bóveda Blindada</span>
      </div>
    </section>

    <!-- COLUMNA DERECHA: ESCALERA DE MULTIPLICADORES E HISTORIAL -->
    <aside class="side-column">
      <div class="info-card">
        <div class="panel-header">
          <h3>📈 Escala de la Bóveda</h3>
          <p>Multiplicador por puerta abierta</p>
        </div>
        <div class="ladder-list" id="ladderList">
          <!-- Generado dinámicamente -->
        </div>
      </div>

      <div class="history-card">
        <div class="panel-header">
          <h3>📜 Historial en Vivo</h3>
          <p>Tus aperturas de bóveda recientes</p>
        </div>
        <div class="history-list" id="doorsHistoryList">
          <div class="empty-hist" style="font-size: 0.72rem; color: var(--text-muted); text-align: center; padding: 1rem 0;">
            Aún no has intentado abrir la Bóveda Panda.
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

fs.writeFileSync(path.join(__dirname, 'jugar_llaves.html'), htmlOutput, 'utf8');
console.log('✓ Juego Llaves y Puertas: Bóveda Panda compilado y ofuscado en:', path.join(__dirname, 'jugar_llaves.html'));
