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

// 1. Transpilar, empaquetar dependencias (src/svg-symbols.ts) y minificar TypeScript a JS ES2020
const bundled = esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'src/main.ts')],
  bundle: true,
  write: false,
  target: 'es2020',
  minify: true
});

const jsSource = bundled.outputFiles[0].text;

// 2. Aplicar el mismo formato de ofuscación extrema del proyecto raíz
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

// Data URIs vectoriales para la tabla lateral (garantizan iconos perfectos en cualquier pantalla y SO)
const ICONS = {
  panda: 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2230%22%20fill%3D%22%230d182b%22%20stroke%3D%22%23ffb700%22%20stroke-width%3D%222.5%22%2F%3E%3Ccircle%20cx%3D%2216%22%20cy%3D%2217%22%20r%3D%229%22%20fill%3D%22%231e293b%22%2F%3E%3Ccircle%20cx%3D%2248%22%20cy%3D%2217%22%20r%3D%229%22%20fill%3D%22%231e293b%22%2F%3E%3Ccircle%20cx%3D%2216%22%20cy%3D%2217%22%20r%3D%225%22%20fill%3D%22%230f172a%22%2F%3E%3Ccircle%20cx%3D%2248%22%20cy%3D%2217%22%20r%3D%225%22%20fill%3D%22%230f172a%22%2F%3E%3Cellipse%20cx%3D%2232%22%20cy%3D%2236%22%20rx%3D%2220%22%20ry%3D%2217%22%20fill%3D%22%23ffffff%22%2F%3E%3Cellipse%20cx%3D%2223%22%20cy%3D%2233%22%20rx%3D%225.5%22%20ry%3D%226.5%22%20fill%3D%22%231e293b%22%20transform%3D%22rotate(-15%2023%2033)%22%2F%3E%3Cellipse%20cx%3D%2241%22%20cy%3D%2233%22%20rx%3D%225.5%22%20ry%3D%226.5%22%20fill%3D%22%231e293b%22%20transform%3D%22rotate(15%2041%2033)%22%2F%3E%3Ccircle%20cx%3D%2224%22%20cy%3D%2232%22%20r%3D%222.2%22%20fill%3D%22%23ffffff%22%2F%3E%3Ccircle%20cx%3D%2240%22%20cy%3D%2232%22%20r%3D%222.2%22%20fill%3D%22%23ffffff%22%2F%3E%3Cellipse%20cx%3D%2232%22%20cy%3D%2240%22%20rx%3D%223.5%22%20ry%3D%222.5%22%20fill%3D%22%231e293b%22%2F%3E%3Cpath%20d%3D%22M28%2044%20Q32%2048%2036%2044%22%20stroke%3D%22%231e293b%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%2F%3E%3Cpolygon%20points%3D%2225%2C14%2032%2C5%2039%2C14%22%20fill%3D%22%23ffb700%22%20stroke%3D%22%23ffa000%22%20stroke-width%3D%221.2%22%2F%3E%3Ccircle%20cx%3D%2232%22%20cy%3D%225%22%20r%3D%222%22%20fill%3D%22%23ffffff%22%2F%3E%3C%2Fsvg%3E',
  gem: 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Cpolygon%20points%3D%2218%2C16%2046%2C16%2056%2C28%2032%2C54%208%2C28%22%20fill%3D%22%2300c8e0%22%20stroke%3D%22%23ffffff%22%20stroke-width%3D%221.5%22%2F%3E%3Cpolygon%20points%3D%2224%2C16%2040%2C16%2048%2C28%2032%2C28%2016%2C28%22%20fill%3D%22%23e0fcff%22%20opacity%3D%220.6%22%2F%3E%3Cpolygon%20points%3D%2232%2C28%2048%2C28%2032%2C54%22%20fill%3D%22%23008fa8%22%20opacity%3D%220.8%22%2F%3E%3Cpolygon%20points%3D%2216%2C28%2032%2C28%2032%2C54%22%20fill%3D%22%235ce8ff%22%20opacity%3D%220.9%22%2F%3E%3Cpolygon%20points%3D%228%2C28%2016%2C28%2032%2C54%22%20fill%3D%22%23006d80%22%20opacity%3D%220.7%22%2F%3E%3Cpolygon%20points%3D%2248%2C28%2056%2C28%2032%2C54%22%20fill%3D%22%23005566%22%20opacity%3D%220.7%22%2F%3E%3Ccircle%20cx%3D%2224%22%20cy%3D%2222%22%20r%3D%221.5%22%20fill%3D%22%23ffffff%22%2F%3E%3C%2Fsvg%3E',
  crown: 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Cpath%20d%3D%22M10%2046%20L14%2022%20L24%2034%20L32%2016%20L40%2034%20L50%2022%20L54%2046%20Z%22%20fill%3D%22%23ffb700%22%20stroke%3D%22%23ffea75%22%20stroke-width%3D%221.8%22%2F%3E%3Crect%20x%3D%2210%22%20y%3D%2246%22%20width%3D%2244%22%20height%3D%228%22%20rx%3D%222%22%20fill%3D%22%23d48800%22%20stroke%3D%22%23ffea75%22%20stroke-width%3D%221.5%22%2F%3E%3Ccircle%20cx%3D%2214%22%20cy%3D%2222%22%20r%3D%223%22%20fill%3D%22%23ffffff%22%20stroke%3D%22%23ffb700%22%20stroke-width%3D%221%22%2F%3E%3Ccircle%20cx%3D%2232%22%20cy%3D%2216%22%20r%3D%223.5%22%20fill%3D%22%23ffffff%22%20stroke%3D%22%23ffb700%22%20stroke-width%3D%221%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2222%22%20r%3D%223%22%20fill%3D%22%23ffffff%22%20stroke%3D%22%23ffb700%22%20stroke-width%3D%221%22%2F%3E%3Ccircle%20cx%3D%2220%22%20cy%3D%2250%22%20r%3D%222.2%22%20fill%3D%22%23ff1744%22%2F%3E%3Ccircle%20cx%3D%2232%22%20cy%3D%2250%22%20r%3D%222.5%22%20fill%3D%22%2300f0ff%22%2F%3E%3Ccircle%20cx%3D%2244%22%20cy%3D%2250%22%20r%3D%222.2%22%20fill%3D%22%2300e701%22%2F%3E%3C%2Fsvg%3E',
  packet: 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Crect%20x%3D%2214%22%20y%3D%2210%22%20width%3D%2236%22%20height%3D%2246%22%20rx%3D%224%22%20fill%3D%22%23d90429%22%20stroke%3D%22%23ffb700%22%20stroke-width%3D%221.5%22%2F%3E%3Cpath%20d%3D%22M14%2010%20L32%2028%20L50%2010%22%20fill%3D%22%23b5001d%22%20stroke%3D%22%23ffb700%22%20stroke-width%3D%221.5%22%2F%3E%3Ccircle%20cx%3D%2232%22%20cy%3D%2228%22%20r%3D%226%22%20fill%3D%22%23ffb700%22%20stroke%3D%22%23ffffff%22%20stroke-width%3D%221%22%2F%3E%3Ccircle%20cx%3D%2232%22%20cy%3D%2228%22%20r%3D%223%22%20fill%3D%22%23b5001d%22%2F%3E%3C%2Fsvg%3E',
  coin: 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2226%22%20fill%3D%22%23ffb700%22%20stroke%3D%22%23ffe57f%22%20stroke-width%3D%222.5%22%2F%3E%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2220%22%20fill%3D%22none%22%20stroke%3D%22%23e09900%22%20stroke-width%3D%221.8%22%20stroke-dasharray%3D%223%202%22%2F%3E%3Cpolygon%20points%3D%2232%2C18%2036%2C27%2046%2C28%2038%2C35%2041%2C45%2032%2C39%2023%2C45%2026%2C35%2018%2C28%2028%2C27%22%20fill%3D%22%23ffe57f%22%20stroke%3D%22%23c47d00%22%20stroke-width%3D%221.2%22%2F%3E%3C%2Fsvg%3E',
  bamboo: 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Crect%20x%3D%2226%22%20y%3D%228%22%20width%3D%2212%22%20height%3D%2214%22%20rx%3D%222%22%20fill%3D%22%2300c853%22%2F%3E%3Cline%20x1%3D%2224%22%20y1%3D%2222%22%20x2%3D%2240%22%20y2%3D%2222%22%20stroke%3D%22%2300701a%22%20stroke-width%3D%223%22%20stroke-linecap%3D%22round%22%2F%3E%3Crect%20x%3D%2226%22%20y%3D%2223%22%20width%3D%2212%22%20height%3D%2215%22%20rx%3D%222%22%20fill%3D%22%2300c853%22%2F%3E%3Cline%20x1%3D%2224%22%20y1%3D%2238%22%20x2%3D%2240%22%20y2%3D%2238%22%20stroke%3D%22%2300701a%22%20stroke-width%3D%223%22%20stroke-linecap%3D%22round%22%2F%3E%3Crect%20x%3D%2226%22%20y%3D%2239%22%20width%3D%2212%22%20height%3D%2217%22%20rx%3D%222%22%20fill%3D%22%2300c853%22%2F%3E%3Cpath%20d%3D%22M26%2022%20Q12%2016%2010%2026%20Q18%2026%2026%2022%22%20fill%3D%22%2300e676%22%2F%3E%3Cpath%20d%3D%22M38%2038%20Q52%2032%2054%2042%20Q46%2042%2038%2038%22%20fill%3D%22%2300e676%22%2F%3E%3Crect%20x%3D%2224%22%20y%3D%2228%22%20width%3D%2216%22%20height%3D%225%22%20rx%3D%221%22%20fill%3D%22%23ff1744%22%2F%3E%3Cpath%20d%3D%22M40%2031%20L48%2037%20L44%2042%20L38%2033%20Z%22%20fill%3D%22%23d50000%22%2F%3E%3C%2Fsvg%3E',
  cherry: 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Cpath%20d%3D%22M36%2012%20Q30%2024%2022%2038%22%20stroke%3D%22%232e7d32%22%20stroke-width%3D%222.5%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%2F%3E%3Cpath%20d%3D%22M36%2012%20Q40%2024%2044%2040%22%20stroke%3D%22%232e7d32%22%20stroke-width%3D%222.5%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%2F%3E%3Cpath%20d%3D%22M36%2012%20Q46%208%2052%2014%20Q44%2018%2036%2012%22%20fill%3D%22%234caf50%22%2F%3E%3Ccircle%20cx%3D%2221%22%20cy%3D%2242%22%20r%3D%2212%22%20fill%3D%22%23d50000%22%2F%3E%3Cellipse%20cx%3D%2217%22%20cy%3D%2237%22%20rx%3D%223.5%22%20ry%3D%222%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.65%22%20transform%3D%22rotate(-30%2017%2037)%22%2F%3E%3Ccircle%20cx%3D%2243%22%20cy%3D%2244%22%20r%3D%2212%22%20fill%3D%22%23d50000%22%2F%3E%3Cellipse%20cx%3D%2239%22%20cy%3D%2239%22%20rx%3D%223.5%22%20ry%3D%222%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.65%22%20transform%3D%22rotate(-30%2039%2039)%22%2F%3E%3C%2Fsvg%3E'
};

const htmlOutput = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Golden Panda Slots - PANDA CASH | Multiplicador hasta x1,000</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎰</text></svg>">
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
      <span class="game-tag-pill">🎰 Golden Panda Slots</span>
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
  <main class="slots-main-layout">

    <!-- COLUMNA IZQUIERDA: GABINETE DE RODILLOS Y PANEL DE INVERSIÓN -->
    <section class="slot-cabinet-card">
      <div class="cabinet-header">
        <div class="cabinet-title-wrap">
          <h1>🎰 GOLDEN PANDA SLOTS</h1>
          <p>5 Líneas de Pago &bull; Diamante Scatter &bull; Hasta x1,000</p>
        </div>

        <div class="multiplier-status-banner">
          <span style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 800;">Multiplicador:</span>
          <span class="mult-value-big" id="currentMultiplierDisplay">x0.0</span>
        </div>
      </div>

      <!-- RODILLOS 5x3 EN CANVAS ESCALABLE -->
      <div class="reels-viewport">
        <canvas id="slotCanvas" width="760" height="390"></canvas>
      </div>

      <!-- TICKER DE ESTADO Y PREMIO DE LA RONDA -->
      <div class="win-ticker-bar" id="winTickerBar">
        <span style="color: #d1d5db;">Selecciona el monto en 💎 Diamantes y presiona <strong>GIRAR AHORA</strong> (o barra espaciadora).</span>
        <span style="font-size: 0.74rem; color: #ffb700; font-family: 'Courier New', monospace;">5 Líneas Activas</span>
      </div>

      <!-- PANEL DE CONTROLES DE GIRO COMPACTOS -->
      <div class="controls-panel">
        <div class="bet-config-area">
          <div class="bet-label-row">
            <span>Monto por Giro (💎)</span>
            <span id="maxPotentialWinLabel" style="color: var(--accent-gold);">Premio Máx (x1,000): 50,000 💎</span>
          </div>

          <div class="bet-input-group">
            <input type="number" id="betAmountInput" class="bet-input" value="50" min="10" step="10" />
            <button type="button" class="btn-bet-mod" id="btnBetHalf">÷2</button>
            <button type="button" class="btn-bet-mod" id="btnBetDouble">x2</button>
            <button type="button" class="btn-bet-mod" id="btnBetMax" style="color: var(--accent-gold);">MÁX</button>
          </div>

          <div class="quick-bets-row">
            <button type="button" class="btn-quick-bet" data-bet="10">10 💎</button>
            <button type="button" class="btn-quick-bet" data-bet="25">25 💎</button>
            <button type="button" class="btn-quick-bet active" data-bet="50">50 💎</button>
            <button type="button" class="btn-quick-bet" data-bet="100">100 💎</button>
            <button type="button" class="btn-quick-bet" data-bet="250">250 💎</button>
            <button type="button" class="btn-quick-bet" data-bet="500">500 💎</button>
          </div>
        </div>

        <div class="spin-actions-area">
          <button type="button" class="btn-spin-main" id="btnSpinSlots">
            🎰 GIRAR AHORA
          </button>
          <div class="spin-sub-buttons">
            <button type="button" class="btn-sub-mode" id="btnToggleTurbo">⚡ Modo Turbo</button>
            <button type="button" class="btn-sub-mode" id="btnToggleAuto">🔄 Auto-Giro</button>
          </div>
        </div>
      </div>

      <div class="security-footer-badge">
        <span style="color: var(--accent-green);">●</span>
        <span>Motor Protegido: Control Flow Flattening &bull; RC4 String Encryption &bull; Iconos Vectoriales HD</span>
      </div>
    </section>

    <!-- COLUMNA DERECHA: TABLA DE MULTIPLICADORES E HISTORIAL -->
    <aside class="side-panel">
      <div class="side-card">
        <h3>📊 Tabla de Multiplicadores</h3>
        <div class="paytable-list">
          <div class="paytable-item" style="border-color: rgba(255, 183, 0, 0.35);">
            <div class="pay-sym"><span class="ico"><img src="${ICONS.panda}" alt="Panda Wild" /></span> <span>Panda Wild</span></div>
            <div class="pay-mults">3x: x10 | 4x: x50 | 5x: x1000</div>
          </div>
          <div class="paytable-item">
            <div class="pay-sym"><span class="ico"><img src="${ICONS.gem}" alt="Scatter" /></span> <span>Scatter</span></div>
            <div class="pay-mults">3x: x3 | 4x: x15 | 5x: x100</div>
          </div>
          <div class="paytable-item">
            <div class="pay-sym"><span class="ico"><img src="${ICONS.crown}" alt="Corona" /></span> <span>Corona</span></div>
            <div class="pay-mults">3x: x5 | 4x: x20 | 5x: x80</div>
          </div>
          <div class="paytable-item">
            <div class="pay-sym"><span class="ico"><img src="${ICONS.packet}" alt="Sobre" /></span> <span>Sobre</span></div>
            <div class="pay-mults">3x: x3 | 4x: x10 | 5x: x35</div>
          </div>
          <div class="paytable-item">
            <div class="pay-sym"><span class="ico"><img src="${ICONS.coin}" alt="Moneda" /></span> <span>Moneda</span></div>
            <div class="pay-mults">3x: x2 | 4x: x6 | 5x: x18</div>
          </div>
          <div class="paytable-item">
            <div class="pay-sym"><span class="ico"><img src="${ICONS.bamboo}" alt="Bambú" /></span> <span>Bambú</span></div>
            <div class="pay-mults">3x: x0.8 | 4x: x2.5 | 5x: x8</div>
          </div>
          <div class="paytable-item">
            <div class="pay-sym"><span class="ico"><img src="${ICONS.cherry}" alt="Cereza" /></span> <span>Cereza</span></div>
            <div class="pay-mults">3x: x0.4 | 4x: x1.2 | 5x: x4</div>
          </div>
        </div>
      </div>

      <div class="side-card history-card">
        <h3>📜 Historial de Giros</h3>
        <div class="history-list" id="spinHistoryList">
          <div class="empty-hist" style="font-size: 0.72rem; color: var(--text-muted); text-align: center; padding: 1rem 0;">
            Aún no has realizado giros en esta sesión.
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

fs.writeFileSync(path.join(__dirname, 'jugar_slots.html'), htmlOutput, 'utf8');
console.log('✓ Juego Golden Panda Slots compilado y ofuscado en:', path.join(__dirname, 'jugar_slots.html'));
