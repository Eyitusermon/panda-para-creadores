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
  <title>Cyber Mines 3D - PANDA CASH | Multiplicador Progresivo</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💣</text></svg>">
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
      <span class="game-tag-pill">💣 Cyber Mines 3D</span>
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
  <main class="mines-layout">

    <!-- COLUMNA IZQUIERDA: CONTROLES DE APUESTA Y MINAS -->
    <aside class="panel-card">
      <div class="panel-header">
        <h3>💣 Controles</h3>
        <p>Multiplicador por acierto</p>
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

        <!-- Selector de Minas Ocultas -->
        <div class="mines-selector-box">
          <div class="control-label-row">
            <span>Minas Ocultas (3 - 7)</span>
            <span style="color: #ff3377; font-weight:800;" id="minesDifficultyBadge">3 Minas (Bajo)</span>
          </div>
          <select id="minesSelectDropdown" class="mines-select-dropdown">
            <option value="3" selected>3 Minas (Riesgo Bajo &bull; x532 max)</option>
            <option value="4">4 Minas (Riesgo Medio &bull; x1,480 max)</option>
            <option value="5">5 Minas (Riesgo Balanceado &bull; x4,149 max)</option>
            <option value="6">6 Minas (Riesgo Alto &bull; x12,870 max)</option>
            <option value="7">7 Minas (Riesgo Extremo &bull; x48,048 max)</option>
          </select>
          <div class="mines-quick-grid">
            <button type="button" class="btn-qmine active" data-mines="3">3</button>
            <button type="button" class="btn-qmine" data-mines="4">4</button>
            <button type="button" class="btn-qmine" data-mines="5">5</button>
            <button type="button" class="btn-qmine" data-mines="6">6</button>
            <button type="button" class="btn-qmine" data-mines="7">7</button>
          </div>
        </div>

        <!-- Visor de Próximo Acierto -->
        <div class="step-preview-box">
          <div class="step-preview-row">
            <span style="color:var(--text-muted);">Multiplicador Actual:</span>
            <span class="step-val-current" id="previewCurrentMult">x1.00</span>
          </div>
          <div class="step-preview-row">
            <span style="color:var(--text-muted);">Siguiente Gema:</span>
            <span class="step-val-next" id="previewNextMult">x1.07</span>
          </div>
          <div class="step-preview-row">
            <span style="color:var(--text-muted);">Cobro Potencial:</span>
            <span style="color:var(--accent-gold); font-weight:900; font-family:'Courier New',monospace;" id="previewPotentialPayout">+50 💎</span>
          </div>
        </div>
      </div>

      <!-- Botones de Acción -->
      <div class="actions-wrap">
        <button type="button" class="btn-mines-main btn-start" id="btnMinesAction">
          <span id="btnMinesActionTitle">💣 INICIAR MISIÓN</span>
          <small id="btnMinesActionSub" style="font-size:0.78rem; font-weight:800;">50 💎 (3 Minas)</small>
        </button>
        <button type="button" class="btn-autopick" id="btnMinesAutoPick" disabled>
          ⚡ ELECCIÓN ALEATORIA (AUTO-PICK)
        </button>
      </div>
    </aside>

    <!-- COLUMNA CENTRAL: TABLERO 3D CYBER GRID -->
    <section class="board-card">
      <!-- Encabezado de Estado de Gemas y Minas -->
      <div class="grid-header-bar">
        <div class="stat-pill gems">
          <span>💎 Gemas:</span>
          <strong id="statGemsCount">0 / 13</strong>
        </div>
        <div class="stat-pill mines">
          <span>💣 Minas Activas:</span>
          <strong id="statMinesCount">3</strong>
        </div>
      </div>

      <!-- Rejilla 4x4 -->
      <div class="grid-viewport">
        <div class="mines-grid-4x4" id="minesGrid">
          <!-- 16 casillas generadas por JavaScript -->
        </div>

        <!-- Modal de Resultado Flotante -->
        <div class="game-result-modal" id="gameResultModal"></div>
      </div>

      <!-- Barra Ticker Inferior -->
      <div class="mines-ticker-bar" id="minesTickerBar">
        <span style="color: #cbd5e1;">Configura el monto y número de minas para comenzar.</span>
        <span style="font-size: 0.72rem; color: var(--accent-gold); font-family: 'Courier New', monospace;">RTP ~97% &bull; Provably Fair</span>
      </div>
    </section>

    <!-- COLUMNA DERECHA: ESCALERA DE MULTIPLICADORES E HISTORIAL -->
    <aside class="side-column">
      <div class="info-card">
        <div class="panel-header">
          <h3>📈 Progresión de Ganancias</h3>
          <p>Multiplicadores según aciertos</p>
        </div>
        <div class="ladder-list" id="ladderList">
          <!-- Generado dinámicamente -->
        </div>
      </div>

      <div class="history-card">
        <div class="panel-header">
          <h3>📜 Historial en Vivo</h3>
          <p>Tus partidas en esta sesión</p>
        </div>
        <div class="history-list" id="minesHistoryList">
          <div class="empty-hist" style="font-size: 0.72rem; color: var(--text-muted); text-align: center; padding: 1rem 0;">
            Aún no has jugado partidas de Cyber Mines.
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

fs.writeFileSync(path.join(__dirname, 'jugar_minas.html'), htmlOutput, 'utf8');
console.log('✓ Juego Cyber Mines 3D compilado y ofuscado en:', path.join(__dirname, 'jugar_minas.html'));
