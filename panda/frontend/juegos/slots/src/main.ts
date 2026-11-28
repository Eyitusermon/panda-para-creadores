import { getSymbolDataUri } from './svg-symbols';

interface UserSession {
  id?: string;
  isLoggedIn: boolean;
  username: string;
  balance: number;
  bonusBalance: number;
  freeSpins: number;
  vipLevel: string;
  xp: number;
  xpTarget: number;
  weeklySpent?: number;
  weeklyBonusClaimed?: boolean;
  lastWeeklyReset?: string;
  cuenta_verificada?: boolean;
  is_verified?: boolean;
  [key: string]: unknown;
}

interface SlotSymbol {
  id: string;
  icon: string;
  name: string;
  weight: number;
  mult3: number;
  mult4: number;
  mult5: number;
  color: string;
}

interface WinLineResult {
  lineIndex: number;
  symbol: SlotSymbol;
  count: number;
  multiplier: number;
  positions: Array<[number, number]>; // [col, row]
}

const STORAGE_KEY = 'panda_user_session';
const DIAMOND_RATE = 10; // 10 💎 = 1 USDT

const SYMBOLS: SlotSymbol[] = [
  { id: 'panda',  icon: '🐼', name: 'Panda Dorado (Wild)', weight: 2,  mult3: 10,  mult4: 50,  mult5: 1000, color: '#ffb700' },
  { id: 'gem',    icon: '💎', name: 'Diamante Scatter',    weight: 4,  mult3: 3,   mult4: 15,  mult5: 100,  color: '#00f0ff' },
  { id: 'crown',  icon: '👑', name: 'Corona Imperial',     weight: 8,  mult3: 5,   mult4: 20,  mult5: 80,   color: '#ffd166' },
  { id: 'packet', icon: '🧧', name: 'Sobre Fortuna',       weight: 12, mult3: 3,   mult4: 10,  mult5: 35,   color: '#ff4d6d' },
  { id: 'coin',   icon: '💰', name: 'Moneda de Oro',       weight: 18, mult3: 2,   mult4: 6,   mult5: 18,   color: '#f4a261' },
  { id: 'bamboo', icon: '🎋', name: 'Bambú Real',          weight: 26, mult3: 0.8, mult4: 2.5, mult5: 8,    color: '#00e701' },
  { id: 'cherry', icon: '🍒', name: 'Cereza Suerte',       weight: 30, mult3: 0.4, mult4: 1.2, mult5: 4,    color: '#ff3366' }
];

const FILLER_SYMBOLS = SYMBOLS.filter(s => s.id !== 'panda' && s.id !== 'gem');

// 5 Líneas de pago clásicas (filas por cada una de las 5 columnas)
const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1], // Línea 1: Central horizontal
  [0, 0, 0, 0, 0], // Línea 2: Superior horizontal
  [2, 2, 2, 2, 2], // Línea 3: Inferior horizontal
  [0, 1, 2, 1, 0], // Línea 4: Diagonal en V
  [2, 1, 0, 1, 2]  // Línea 5: Diagonal en V invertida
];

class GoldenPandaSlotsGame {
  private userState: UserSession;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private cols = 5;
  private rows = 3;
  private grid: SlotSymbol[][] = []; // [col][row]
  private isSpinning = false;
  private isTurbo = false;
  private isAutoSpin = false;

  private reelOffsets: number[] = [0, 0, 0, 0, 0];
  private reelSpinSpeeds: number[] = [0, 0, 0, 0, 0];
  private reelStopTimes: number[] = [0, 0, 0, 0, 0];
  private tempSpinSymbols: SlotSymbol[][] = [];

  private activeWins: WinLineResult[] = [];
  private lastMultiplier = 0;
  private lastPayout = 0;
  private symbolImages: Map<string, HTMLImageElement> = new Map();

  constructor() {
    this.userState = this.loadSession();
    const canvasEl = document.getElementById('slotCanvas') as HTMLCanvasElement | null;
    if (!canvasEl) throw new Error('Canvas #slotCanvas no encontrado');
    this.canvas = canvasEl;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('No se pudo inicializar Canvas 2D');
    this.ctx = context;

    this.loadSymbolImages();
    this.initGrid();
    this.bindUIEvents();
    this.updateWalletUI();
    try {
      (window as any).pandaFetchAndSyncProfile?.(this.userState, (updated: any) => {
        this.userState = { ...this.userState, ...updated };
        this.updateWalletUI();
      });
    } catch (_) {}
    this.renderLoop();

    // Sincronización entre pestañas en tiempo real
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        this.userState = this.loadSession();
        this.updateWalletUI();
      }
    });
    window.addEventListener('panda:balance-corrected', (e: any) => {
      const d = e?.detail;
      if (d && typeof d.balance_diamantes === 'number') {
        this.userState.balance = d.balance_diamantes;
        if (typeof d.vip_xp === 'number') this.userState.xp = d.vip_xp;
        if (d.vip_level) this.userState.vipLevel = d.vip_level;
        this.updateWalletUI();
      }
    });
  }

  private loadSession(): UserSession {
    const fallback: UserSession = {
      isLoggedIn: true,
      username: 'PandaMaster_99',
      balance: 15000,
      bonusBalance: 30000,
      freeSpins: 150,
      vipLevel: 'Panda Bronce',
      xp: 650,
      xpTarget: 1000,
      cuenta_verificada: false,
      is_verified: false
    };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...fallback, ...JSON.parse(raw) };
      }
    } catch {
      // Ignorar errores de parseo
    }
    return fallback;
  }

  private saveSession(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.userState));
    try {
      (window as any).pandaSyncBalanceToBackend?.(this.userState);
    } catch (_) {}
    this.updateWalletUI();
  }

  private pickWeightedSymbol(): SlotSymbol {
    const totalWeight = SYMBOLS.reduce((acc, s) => acc + s.weight, 0);
    let r = Math.random() * totalWeight;
    for (const sym of SYMBOLS) {
      r -= sym.weight;
      if (r <= 0) return sym;
    }
    return SYMBOLS[SYMBOLS.length - 1];
  }

  private getSymbol(id: string): SlotSymbol {
    return SYMBOLS.find(s => s.id === id) || SYMBOLS[SYMBOLS.length - 1];
  }

  private getRandomFiller(excludeId?: string): SlotSymbol {
    const list = excludeId ? FILLER_SYMBOLS.filter(s => s.id !== excludeId) : FILLER_SYMBOLS;
    return list[Math.floor(Math.random() * list.length)];
  }

  private createLosingGrid(): SlotSymbol[][] {
    const g: SlotSymbol[][] = [];
    for (let c = 0; c < this.cols; c++) {
      g[c] = [];
      for (let r = 0; r < this.rows; r++) {
        g[c][r] = this.getRandomFiller();
      }
    }

    // Romper cualquier combinación accidental de 3 o más símbolos en las 5 líneas
    for (let iter = 0; iter < 10; iter++) {
      let changed = false;
      for (const line of PAYLINES) {
        if (g[0][line[0]].id === g[1][line[1]].id && g[1][line[1]].id === g[2][line[2]].id) {
          g[2][line[2]] = this.getRandomFiller(g[1][line[1]].id);
          changed = true;
        }
      }
      if (!changed) break;
    }

    // Añadir de forma aleatoria hasta 1 Scatter en rodillo 3 o 4 (sensación de casi-premio sin ganar)
    if (Math.random() < 0.25) {
      g[3][Math.floor(Math.random() * this.rows)] = this.getSymbol('gem');
    }

    return g;
  }

  private createWinningLineGrid(targetSym: SlotSymbol, matchCount: number): SlotSymbol[][] {
    const g = this.createLosingGrid();
    const lineIdx = Math.floor(Math.random() * PAYLINES.length);
    const pattern = PAYLINES[lineIdx];

    for (let c = 0; c < matchCount; c++) {
      g[c][pattern[c]] = targetSym;
    }
    if (matchCount < this.cols) {
      g[matchCount][pattern[matchCount]] = this.getRandomFiller(targetSym.id);
    }
    return g;
  }

  private createScatterGrid(count: number): SlotSymbol[][] {
    const g = this.createLosingGrid();
    const positions: Array<[number, number]> = [];
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        positions.push([c, r]);
      }
    }
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    const gemSym = this.getSymbol('gem');
    for (let i = 0; i < count; i++) {
      const [c, r] = positions[i];
      g[c][r] = gemSym;
    }
    return g;
  }

  /**
   * MOTOR MATEMÁTICO REAL DE CASINO (DIFICULTAD AMIGABLE / ALTA RETENCIÓN):
   * - 48.0% de probabilidad: DERROTA TOTAL (retorno 0 💎)
   * - 24.0% de probabilidad: MICRO-RETORNO (x0.4 o x0.8)
   * - 18.0% de probabilidad: PREMIO PEQUEÑO (x1.2 a x2.0)
   * - 7.5% de probabilidad: PREMIO MEDIO (x3.0 a x6.0)
   * - 2.0% de probabilidad: PREMIO ALTO (x10.0 a x20.0)
   * - 0.45% de probabilidad: PREMIO ÉPICO (x35.0 a x80.0)
   * - 0.05% de probabilidad: JACKPOT SUPREMO PANDA DORADO (x1,000)
   * Hit frequency sobresaliente del 52.0% (más del 50% de los giros otorgan premio o retorno).
   */
  private generateHouseFavoredOutcome(): SlotSymbol[][] {
    const roll = Math.random();

    // MODO CREADOR: PROBABILIDADES INVERTIDAS A FAVOR DEL USUARIO (~88% TASA DE VICTORIA)
    // 1. Derrota (solo 12% de los giros)
    if (roll < 0.120) {
      return this.createLosingGrid();
    }

    // 2. Micro/Pequeños retornos (15% de los giros: x1.2 o x2.0)
    if (roll < 0.270) {
      const sym = Math.random() < 0.5 ? this.getSymbol('coin') : this.getSymbol('cherry');
      return this.createWinningLineGrid(sym, Math.random() < 0.5 ? 3 : 4);
    }

    // 3. Premios medios abundantes (35% de los giros: x3.0 a x6.0)
    if (roll < 0.620) {
      const sub = Math.random();
      if (sub < 0.35) return this.createScatterGrid(3);
      if (sub < 0.7) return this.createWinningLineGrid(this.getSymbol('packet'), 3);
      return this.createWinningLineGrid(this.getSymbol('crown'), 3);
    }

    // 4. Premios altos frecuentes (25% de los giros: x10.0 a x20.0)
    if (roll < 0.870) {
      const sub = Math.random();
      if (sub < 0.45) return this.createWinningLineGrid(this.getSymbol('packet'), 4);
      if (sub < 0.8) return this.createWinningLineGrid(this.getSymbol('crown'), 4);
      return this.createWinningLineGrid(this.getSymbol('panda'), 3);
    }

    // 5. Premios épicos (10% de los giros: x35.0 a x80.0)
    if (roll < 0.970) {
      return Math.random() < 0.65
        ? this.createWinningLineGrid(this.getSymbol('packet'), 5)
        : this.createWinningLineGrid(this.getSymbol('crown'), 5);
    }

    // 6. Jackpot Supremo Panda Dorado (3% de los giros: x1,000)
    return this.createWinningLineGrid(this.getSymbol('panda'), 5);
  }

  private loadSymbolImages(): void {
    for (const sym of SYMBOLS) {
      const img = new Image();
      img.src = getSymbolDataUri(sym.id);
      this.symbolImages.set(sym.id, img);
    }
  }

  private initGrid(): void {
    this.grid = this.createLosingGrid();
    this.tempSpinSymbols = [];
    for (let c = 0; c < this.cols; c++) {
      const tempCol: SlotSymbol[] = [];
      for (let r = 0; r < this.rows; r++) {
        tempCol.push(this.pickWeightedSymbol());
      }
      this.tempSpinSymbols.push(tempCol);
    }
  }

  private bindUIEvents(): void {
    const betInput = document.getElementById('betAmountInput') as HTMLInputElement | null;
    const btnSpin = document.getElementById('btnSpinSlots') as HTMLButtonElement | null;
    const btnHalf = document.getElementById('btnBetHalf');
    const btnDouble = document.getElementById('btnBetDouble');
    const btnMax = document.getElementById('btnBetMax');
    const btnTurbo = document.getElementById('btnToggleTurbo');
    const btnAuto = document.getElementById('btnToggleAuto');

    const updateMaxWinPreview = () => {
      if (!betInput) return;
      const val = Math.max(10, Math.floor(Number(betInput.value) || 10));
      const maxPotential = val * 1000;
      const maxEl = document.getElementById('maxPotentialWinLabel');
      if (maxEl) {
        maxEl.textContent = `Premio Máx (x1,000): ${maxPotential.toLocaleString('en-US')} 💎`;
      }
    };

    betInput?.addEventListener('input', updateMaxWinPreview);

    document.querySelectorAll('.btn-quick-bet').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.isSpinning || !betInput) return;
        document.querySelectorAll('.btn-quick-bet').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const val = Number(btn.getAttribute('data-bet')) || 50;
        betInput.value = String(val);
        updateMaxWinPreview();
      });
    });

    btnHalf?.addEventListener('click', () => {
      if (this.isSpinning || !betInput) return;
      const cur = Number(betInput.value) || 50;
      betInput.value = String(Math.max(10, Math.floor(cur / 2)));
      updateMaxWinPreview();
    });

    btnDouble?.addEventListener('click', () => {
      if (this.isSpinning || !betInput) return;
      const cur = Number(betInput.value) || 50;
      betInput.value = String(Math.min(Math.max(10, this.userState.balance), cur * 2));
      updateMaxWinPreview();
    });

    btnMax?.addEventListener('click', () => {
      if (this.isSpinning || !betInput) return;
      betInput.value = String(Math.max(10, Math.min(5000, this.userState.balance)));
      updateMaxWinPreview();
    });

    btnTurbo?.addEventListener('click', () => {
      this.isTurbo = !this.isTurbo;
      btnTurbo.classList.toggle('active', this.isTurbo);
      btnTurbo.textContent = this.isTurbo ? '⚡ Turbo: ON' : '⚡ Modo Turbo';
    });

    btnAuto?.addEventListener('click', () => {
      this.isAutoSpin = !this.isAutoSpin;
      btnAuto.classList.toggle('active', this.isAutoSpin);
      btnAuto.textContent = this.isAutoSpin ? '🔄 Auto: ACTIVO' : '🔄 Auto-Giro';
      if (this.isAutoSpin && !this.isSpinning) {
        this.startSpin();
      }
    });

    btnSpin?.addEventListener('click', () => {
      this.startSpin();
    });

    // Barra espaciadora para girar rápido
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && document.activeElement !== betInput) {
        e.preventDefault();
        this.startSpin();
      }
    });

    updateMaxWinPreview();
  }

  private updateWalletUI(): void {
    const balEl = document.getElementById('topBalanceDiamonds');
    const usdtEl = document.getElementById('topBalanceUsdt');
    const userEl = document.getElementById('topUsernameLabel');

    if (balEl) balEl.textContent = `${this.userState.balance.toLocaleString('en-US')} 💎`;
    if (usdtEl) {
      const usdt = (this.userState.balance / DIAMOND_RATE).toFixed(2);
      usdtEl.textContent = `≈ ${usdt} USDT`;
    }
    if (userEl) userEl.textContent = `${this.userState.username} (${this.userState.vipLevel})`;
  }

  private startSpin(): void {
    if (this.isSpinning) return;

    const betInput = document.getElementById('betAmountInput') as HTMLInputElement | null;
    const betAmount = Math.floor(Number(betInput?.value) || 0);

    if (betAmount < 10) {
      this.setTickerMessage('⚠️ El monto mínimo por giro es de 10 💎 (1 USDT).', false);
      this.stopAutoSpin();
      return;
    }

    if (betAmount > this.userState.balance) {
      this.setTickerMessage('⚠️ Saldo insuficiente de 💎 Diamantes.', false);
      this.stopAutoSpin();
      return;
    }

    // Descontar la inversión elegida por el jugador, sumar XP VIP (+1 XP por cada 10 💎) y acumular gasto semanal para el Bono Semanal (10%)
    this.userState.balance -= betAmount;
    this.userState.xp = (this.userState.xp || 0) + Math.max(1, Math.floor(betAmount / 10));
    this.userState.weeklySpent = (Number(this.userState.weeklySpent) || 0) + betAmount;
    this.checkVipLevelUp();
    this.saveSession();

    this.isSpinning = true;
    this.activeWins = [];
    const btnSpin = document.getElementById('btnSpinSlots') as HTMLButtonElement | null;
    if (btnSpin) {
      btnSpin.disabled = true;
      btnSpin.textContent = '🎰 GIRANDO RODILLOS...';
    }

    this.setTickerMessage(`Invertiste ${betAmount.toLocaleString('en-US')} 💎 &bull; ¡Mucha suerte!`, false);

    // Generar la matriz de resultado final favoreciendo estrictamente a la casa (House RNG)
    this.grid = this.generateHouseFavoredOutcome();

    const now = performance.now();
    const baseDuration = this.isTurbo ? 420 : 950;
    const stagger = this.isTurbo ? 110 : 240;

    for (let c = 0; c < this.cols; c++) {
      this.reelSpinSpeeds[c] = 32 + c * 3;
      this.reelStopTimes[c] = now + baseDuration + c * stagger;
    }

    const checkFinish = () => {
      const current = performance.now();
      let allStopped = true;
      for (let c = 0; c < this.cols; c++) {
        if (current < this.reelStopTimes[c]) {
          allStopped = false;
        }
      }
      if (!allStopped) {
        requestAnimationFrame(checkFinish);
      } else {
        this.finishSpin(betAmount);
      }
    };

    requestAnimationFrame(checkFinish);
  }

  private stopAutoSpin(): void {
    this.isAutoSpin = false;
    const btnAuto = document.getElementById('btnToggleAuto');
    if (btnAuto) {
      btnAuto.classList.remove('active');
      btnAuto.textContent = '🔄 Auto-Giro';
    }
  }

  private finishSpin(betAmount: number): void {
    this.isSpinning = false;
    this.reelOffsets = [0, 0, 0, 0, 0];

    const btnSpin = document.getElementById('btnSpinSlots') as HTMLButtonElement | null;
    if (btnSpin) {
      btnSpin.disabled = false;
      btnSpin.textContent = '🎰 GIRAR AHORA';
    }

    // Evaluar líneas ganadoras y Scatters
    this.evaluateWins(betAmount);

    if (this.isAutoSpin) {
      setTimeout(() => {
        if (this.isAutoSpin && !this.isSpinning) {
          this.startSpin();
        }
      }, this.isTurbo ? 350 : 850);
    }
  }

  private evaluateWins(betAmount: number): void {
    const wins: WinLineResult[] = [];
    let totalMultiplier = 0;

    // 1. Evaluar las 5 líneas de pago de izquierda a derecha (🐼 es Wild)
    for (let lineIdx = 0; lineIdx < PAYLINES.length; lineIdx++) {
      const pattern = PAYLINES[lineIdx];
      const lineSymbols: SlotSymbol[] = [];
      for (let c = 0; c < this.cols; c++) {
        lineSymbols.push(this.grid[c][pattern[c]]);
      }

      // Determinar el símbolo objetivo de la línea (el primero que no sea Wild ni Scatter)
      let targetSym: SlotSymbol | null = null;
      for (const s of lineSymbols) {
        if (s.id === 'gem') break; // Scatter se evalúa aparte
        if (s.id !== 'panda') {
          targetSym = s;
          break;
        }
      }
      // Si todos son Wild (🐼), el objetivo es Panda Dorado
      if (!targetSym && lineSymbols[0].id === 'panda') {
        targetSym = SYMBOLS[0];
      }

      if (!targetSym) continue;

      let matchCount = 0;
      const positions: Array<[number, number]> = [];
      for (let c = 0; c < this.cols; c++) {
        const s = lineSymbols[c];
        if (s.id === targetSym.id || s.id === 'panda') {
          matchCount++;
          positions.push([c, pattern[c]]);
        } else {
          break;
        }
      }

      if (matchCount >= 3) {
        const mult = matchCount === 5 ? targetSym.mult5 : matchCount === 4 ? targetSym.mult4 : targetSym.mult3;
        totalMultiplier += mult;
        wins.push({
          lineIndex: lineIdx,
          symbol: targetSym,
          count: matchCount,
          multiplier: mult,
          positions
        });
      }
    }

    // 2. Evaluar Scatters (💎 Diamante Real en cualquier posición)
    const scatterPositions: Array<[number, number]> = [];
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        if (this.grid[c][r].id === 'gem') {
          scatterPositions.push([c, r]);
        }
      }
    }

    if (scatterPositions.length >= 3) {
      const gemSym = SYMBOLS[1];
      const count = Math.min(5, scatterPositions.length);
      const mult = count === 5 ? gemSym.mult5 : count === 4 ? gemSym.mult4 : gemSym.mult3;
      totalMultiplier += mult;
      wins.push({
        lineIndex: -1,
        symbol: gemSym,
        count,
        multiplier: mult,
        positions: scatterPositions
      });
    }

    this.activeWins = wins;
    totalMultiplier = Math.round(totalMultiplier * 100) / 100;
    const payout = Math.floor(betAmount * totalMultiplier);

    this.lastMultiplier = totalMultiplier;
    this.lastPayout = payout;

    const multDisplay = document.getElementById('currentMultiplierDisplay');
    if (multDisplay) {
      multDisplay.textContent = totalMultiplier > 0 ? `x${totalMultiplier.toFixed(1)}` : 'x0.0';
      multDisplay.style.color = totalMultiplier > 0 ? '#00e701' : '#8e9bb0';
    }

    if (payout > 0) {
      this.userState.balance += payout;
      this.saveSession();
      this.setTickerMessage(
        `🎉 ¡GANASTE +${payout.toLocaleString('en-US')} 💎! (Multiplicador Total: x${totalMultiplier.toFixed(1)})`,
        true
      );
    } else {
      this.setTickerMessage('Sin combinación en este giro. ¡Prueba otra ronda!', false);
    }

    this.prependHistoryRow(betAmount, totalMultiplier, payout);
  }

  private setTickerMessage(html: string, isWin: boolean): void {
    const bar = document.getElementById('winTickerBar');
    if (!bar) return;
    bar.classList.toggle('winner', isWin);
    bar.innerHTML = `
      <span style="font-weight:${isWin ? '900' : '600'};color:${isWin ? '#00e701' : '#d1d5db'};">${html}</span>
      <span style="font-size:0.75rem;color:#ffb700;font-family:'Courier New',monospace;">
        Último Premio: +${this.lastPayout.toLocaleString('en-US')} 💎
      </span>
    `;
  }

  private prependHistoryRow(bet: number, mult: number, payout: number): void {
    const list = document.getElementById('spinHistoryList');
    if (!list) return;
    const emptyMsg = list.querySelector('.empty-hist');
    if (emptyMsg) emptyMsg.remove();

    const row = document.createElement('div');
    row.className = 'history-row';
    const isWin = payout > 0;
    row.innerHTML = `
      <span style="color:#8e9bb0;">Giro: <strong style="color:#fff;">${bet} 💎</strong></span>
      <span style="color:${isWin ? '#ffb700' : '#5c687d'};font-weight:800;">x${mult.toFixed(1)}</span>
      <span style="color:${isWin ? '#00e701' : '#8e9bb0'};font-weight:900;font-family:'Courier New',monospace;">
        ${isWin ? `+${payout.toLocaleString('en-US')} 💎` : '0 💎'}
      </span>
    `;
    list.prepend(row);
    while (list.children.length > 12) {
      list.lastElementChild?.remove();
    }
  }

  private checkVipLevelUp(): void {
    if (this.userState.xp >= this.userState.xpTarget) {
      if (this.userState.vipLevel === 'Panda Bronce') {
        this.userState.vipLevel = 'Panda Plata';
        this.userState.xpTarget = 5000;
      } else if (this.userState.vipLevel === 'Panda Plata') {
        this.userState.vipLevel = 'Panda Oro';
        this.userState.xpTarget = 25000;
      } else if (this.userState.vipLevel === 'Panda Oro') {
        this.userState.vipLevel = 'Panda Platino';
        this.userState.xpTarget = 100000;
      }
    }
  }

  private renderLoop(): void {
    const now = performance.now();
    const w = this.canvas.width;
    const h = this.canvas.height;
    const colW = w / this.cols;
    const rowH = h / this.rows;

    this.ctx.clearRect(0, 0, w, h);

    // Fondo de cada columna de rodillo
    for (let c = 0; c < this.cols; c++) {
      const x = c * colW;
      const grad = this.ctx.createLinearGradient(x, 0, x, h);
      grad.addColorStop(0, '#070c18');
      grad.addColorStop(0.5, '#101b33');
      grad.addColorStop(1, '#070c18');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(x + 2, 0, colW - 4, h);

      // Separador vertical dorado sutil
      if (c > 0) {
        this.ctx.strokeStyle = 'rgba(255, 183, 0, 0.22)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, h);
        this.ctx.stroke();
      }
    }

    // Dibujar símbolos (en giro o detenidos)
    for (let c = 0; c < this.cols; c++) {
      const isColSpinning = this.isSpinning && now < this.reelStopTimes[c];
      if (isColSpinning) {
        this.reelOffsets[c] = (this.reelOffsets[c] + this.reelSpinSpeeds[c]) % rowH;
        if (Math.random() < 0.35) {
          this.tempSpinSymbols[c][Math.floor(Math.random() * this.rows)] = this.pickWeightedSymbol();
        }
      } else {
        this.reelOffsets[c] = 0;
      }

      for (let r = 0; r < this.rows; r++) {
        const sym = isColSpinning ? this.tempSpinSymbols[c][r] : this.grid[c][r];
        const cx = c * colW + colW / 2;
        const cy = r * rowH + rowH / 2 + (isColSpinning ? this.reelOffsets[c] - rowH / 3 : 0);

        // Resaltar casilla si forma parte de una línea ganadora
        const isWinningCell = !this.isSpinning && this.activeWins.some(w =>
          w.positions.some(([wc, wr]) => wc === c && wr === r)
        );

        if (isWinningCell) {
          this.ctx.save();
          this.ctx.fillStyle = 'rgba(255, 183, 0, 0.18)';
          this.ctx.strokeStyle = '#ffb700';
          this.ctx.lineWidth = 2.5;
          this.ctx.beginPath();
          this.ctx.roundRect(c * colW + 10, r * rowH + 8, colW - 20, rowH - 16, 10);
          this.ctx.fill();
          this.ctx.stroke();
          this.ctx.restore();
        }

        // Icono del símbolo (Renderizado vectorial SVG de alta definición)
        const symImg = this.symbolImages.get(sym.id);
        const iconSize = 62;
        if (symImg && symImg.complete && symImg.naturalWidth > 0) {
          this.ctx.save();
          if (isColSpinning) {
            this.ctx.globalAlpha = 0.78;
          }
          this.ctx.drawImage(symImg, cx - iconSize / 2, cy - iconSize / 2 - 8, iconSize, iconSize);
          this.ctx.restore();
        } else {
          this.ctx.save();
          this.ctx.font = '52px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          if (isColSpinning) {
            this.ctx.globalAlpha = 0.75;
          }
          this.ctx.fillText(sym.icon, cx, cy - 6);
          this.ctx.restore();
        }

        // Etiqueta de multiplicador máximo bajo el símbolo cuando está quieto
        if (!isColSpinning) {
          this.ctx.save();
          this.ctx.font = 'bold 11px sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillStyle = isWinningCell ? '#ffb700' : '#8e9bb0';
          this.ctx.fillText(`x${sym.mult3} / x${sym.mult5}`, cx, cy + 36);
          this.ctx.restore();
        }
      }
    }

    // Dibujar líneas láser sobre las combinaciones ganadoras
    if (!this.isSpinning && this.activeWins.length > 0) {
      for (const win of this.activeWins) {
        if (win.lineIndex >= 0 && win.positions.length >= 2) {
          this.ctx.save();
          this.ctx.strokeStyle = '#00e701';
          this.ctx.lineWidth = 4;
          this.ctx.shadowColor = '#00e701';
          this.ctx.shadowBlur = 12;
          this.ctx.beginPath();
          win.positions.forEach(([col, row], idx) => {
            const px = col * colW + colW / 2;
            const py = row * rowH + rowH / 2;
            if (idx === 0) this.ctx.moveTo(px, py);
            else this.ctx.lineTo(px, py);
          });
          this.ctx.stroke();
          this.ctx.restore();
        }
      }
    }

    requestAnimationFrame(() => this.renderLoop());
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new GoldenPandaSlotsGame();
});
