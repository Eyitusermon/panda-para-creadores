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

type GameState = 'COUNTDOWN' | 'FLYING' | 'CRASHED';

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
  radius: number;
}

const STORAGE_KEY = 'panda_user_session';
const DIAMOND_RATE = 10; // 10 💎 = 1 USDT

class PandaCrashRocketGame {
  private userState: UserSession;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private state: GameState = 'COUNTDOWN';
  private countdownRemaining = 3.5; // segundos (rápido y fluido)
  private flightTime = 0; // segundos en vuelo
  private currentMultiplier = 1.00;
  private targetCrashMultiplier = 1.00;

  // Estado de Auto-Retiro
  private isAutoCashoutEnabled = false;
  private autoCashoutTarget = 2.00;

  // Estado de la apuesta del jugador en la ronda actual
  private hasActiveBet = false;
  private currentBetAmount = 0;
  private hasCashedOut = false;
  private cashoutMultiplier = 0;
  private cashoutPayout = 0;

  // Partículas y estrellas del fondo espacial
  private stars: Star[] = [];
  private particles: Particle[] = [];
  private screenShake = 0;

  // Estadísticas de sesión
  private totalRounds = 0;
  private totalDiamondsWon = 0;
  private bestMultiplier = 0;

  private lastFrameTime = performance.now();

  constructor() {
    this.userState = this.loadSession();
    const canvasEl = document.getElementById('rocketCanvas') as HTMLCanvasElement | null;
    if (!canvasEl) throw new Error('Canvas #rocketCanvas no encontrado');
    this.canvas = canvasEl;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('No se pudo inicializar Canvas 2D');
    this.ctx = context;

    this.initStars();
    this.bindEvents();
    this.updateWalletUI();
    try {
      (window as any).pandaFetchAndSyncProfile?.(this.userState, (updated: any) => {
        this.userState = { ...this.userState, ...updated };
        this.updateWalletUI();
      });
    } catch (_) {}

    // Sincronización de saldo en tiempo real entre pestañas
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          this.userState = { ...this.userState, ...JSON.parse(e.newValue) };
          this.updateWalletUI();
        } catch (_) {}
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

    this.startCountdown();
    requestAnimationFrame((t) => this.loop(t));
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
      if (raw) return { ...fallback, ...JSON.parse(raw) };
    } catch (_) {}
    return fallback;
  }

  private saveSession(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.userState));
    try {
      (window as any).pandaSyncBalanceToBackend?.(this.userState);
    } catch (_) {}
    this.updateWalletUI();
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

  private initStars(): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.stars = [];
    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: 0.8 + Math.random() * 2.2,
        speed: 0.3 + Math.random() * 1.5,
        alpha: 0.3 + Math.random() * 0.7
      });
    }
  }

  /**
   * Generador de punto de colapso balanceado
   * Probabilidad mínima de crash instantáneo en x1.00 (~2.5%).
   */
  private generateCrashPoint(): number {
    // MODO CREADOR: Distribución invertida para vuelos altos y espectaculares en stream
    const roll = Math.random();
    // 5% crash temprano (entre 1.30 y 1.95)
    if (roll < 0.05) return Math.floor((1.30 + Math.random() * 0.65) * 100) / 100;
    // 35% vuelo medio (entre 2.00 y 4.80)
    if (roll < 0.40) return Math.floor((2.00 + Math.random() * 2.80) * 100) / 100;
    // 35% vuelo alto (entre 4.80 y 14.00)
    if (roll < 0.75) return Math.floor((4.80 + Math.random() * 9.20) * 100) / 100;
    // 20% vuelo súper alto (entre 14.00 y 45.00)
    if (roll < 0.95) return Math.floor((14.00 + Math.random() * 31.00) * 100) / 100;
    // 5% vuelo legendario (entre 45.00 y 500.00)
    return Math.floor((45.00 + Math.random() * 455.00) * 100) / 100;
  }

  private startCountdown(): void {
    this.state = 'COUNTDOWN';
    this.countdownRemaining = 3.5;
    this.flightTime = 0;
    this.currentMultiplier = 1.00;
    this.targetCrashMultiplier = this.generateCrashPoint();
    this.hasCashedOut = false;
    this.cashoutMultiplier = 0;
    this.cashoutPayout = 0;

    this.updateActionButtons();
    this.setTicker('Preparando combustible... Elige tu monto antes del despegue.', false);
  }

  private launchRocket(): void {
    this.state = 'FLYING';
    this.flightTime = 0;
    this.currentMultiplier = 1.00;
    this.totalRounds++;
    this.updateStatsUI();

    this.updateActionButtons();
    this.setTicker('¡COHETE EN EL AIRE! Retira a tiempo antes del colapso.', false);
  }

  private crashRocket(): void {
    this.state = 'CRASHED';
    this.screenShake = 16;

    // Crear partículas de explosión
    const rx = this.getRocketX();
    const ry = this.getRocketY();
    for (let i = 0; i < 45; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 3 + Math.random() * 8;
      this.particles.push({
        x: rx,
        y: ry,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        alpha: 1.0,
        color: Math.random() < 0.5 ? '#ff0055' : Math.random() < 0.8 ? '#ffb700' : '#ffffff',
        radius: 2 + Math.random() * 3.5
      });
    }

    // Registrar chip en el strip superior
    this.addRecentChip(this.targetCrashMultiplier);

    // Si el usuario tenía apuesta y no se retiró, perdió
    if (this.hasActiveBet && !this.hasCashedOut) {
      this.setTicker(`💥 ¡CRASH EN x${this.targetCrashMultiplier.toFixed(2)}! Perdiste ${this.currentBetAmount} 💎.`, false, true);
      this.addHistoryRow(this.currentBetAmount, this.targetCrashMultiplier, 0, false);
    } else if (this.hasActiveBet && this.hasCashedOut) {
      this.setTicker(`💥 ¡CRASH EN x${this.targetCrashMultiplier.toFixed(2)}! Ya habías retirado a tiempo.`, true);
    } else {
      this.setTicker(`💥 ¡CRASH EN x${this.targetCrashMultiplier.toFixed(2)}!`, false, true);
    }

    this.hasActiveBet = false;
    this.updateActionButtons();

    // Esperar 1.8 segundos para el siguiente lanzamiento (ritmo ágil)
    setTimeout(() => {
      this.startCountdown();
    }, 1800);
  }

  private cashOut(isAuto = false): void {
    if (this.state !== 'FLYING' || !this.hasActiveBet || this.hasCashedOut) return;

    this.hasCashedOut = true;
    this.cashoutMultiplier = this.currentMultiplier;
    this.cashoutPayout = Math.floor(this.currentBetAmount * this.cashoutMultiplier);

    // Acreditar saldo
    this.userState.balance += this.cashoutPayout;
    this.totalDiamondsWon += this.cashoutPayout;
    this.saveSession();

    if (this.cashoutMultiplier > this.bestMultiplier) {
      this.bestMultiplier = this.cashoutMultiplier;
    }
    this.updateStatsUI();

    const actionTag = isAuto ? '🎯 ¡AUTO-RETIRO EXITOSO' : '🎉 ¡RETIRASTE A TIEMPO';
    this.setTicker(
      `${actionTag} A x${this.cashoutMultiplier.toFixed(2)}! Ganaste +${this.cashoutPayout.toLocaleString('en-US')} 💎`,
      true
    );

    this.addHistoryRow(this.currentBetAmount, this.cashoutMultiplier, this.cashoutPayout, true);
    this.updateActionButtons();

    // Partículas doradas de éxito
    const rx = this.getRocketX();
    const ry = this.getRocketY();
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 5;
      this.particles.push({
        x: rx,
        y: ry,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 2,
        alpha: 1.0,
        color: '#00e701',
        radius: 2 + Math.random() * 2
      });
    }
  }

  private handleMainButtonClick(): void {
    const betInput = document.getElementById('betAmountInput') as HTMLInputElement | null;
    const bet = Math.floor(Number(betInput?.value) || 0);

    if (this.state === 'COUNTDOWN') {
      if (this.hasActiveBet) {
        // Cancelar apuesta
        this.userState.balance += this.currentBetAmount;
        this.saveSession();
        this.hasActiveBet = false;
        this.currentBetAmount = 0;
        this.updateActionButtons();
        this.setTicker('Apuesta cancelada. Saldo devuelto.', false);
      } else {
        // Ingresar a la ronda
        if (bet < 10) {
          this.setTicker('⚠️ El monto mínimo es de 10 💎 (1 USDT).', false);
          return;
        }
        if (bet > this.userState.balance) {
          this.setTicker('⚠️ Saldo insuficiente de 💎 Diamantes.', false);
          return;
        }

        this.userState.balance -= bet;
        this.userState.xp = (this.userState.xp || 0) + Math.max(1, Math.floor(bet / 10));
        this.userState.weeklySpent = (Number(this.userState.weeklySpent) || 0) + bet;
        this.checkVip();
        this.saveSession();

        this.hasActiveBet = true;
        this.currentBetAmount = bet;
        this.updateActionButtons();
        this.setTicker(`Apostaste ${bet.toLocaleString('en-US')} 💎 para este vuelo. ¡Mucha suerte!`, false);
      }
    } else if (this.state === 'FLYING') {
      if (this.hasActiveBet && !this.hasCashedOut) {
        this.cashOut();
      }
    }
  }

  private updateActionButtons(): void {
    const btn = document.getElementById('btnRocketAction') as HTMLButtonElement | null;
    const titleEl = document.getElementById('btnRocketMainTitle');
    const subEl = document.getElementById('btnRocketSubTitle');
    if (!btn || !titleEl || !subEl) return;

    btn.className = 'btn-rocket-main';

    if (this.state === 'COUNTDOWN') {
      btn.disabled = false;
      if (this.hasActiveBet) {
        btn.classList.add('btn-bet-cancel');
        titleEl.textContent = 'CANCELAR APUESTA';
        subEl.textContent = `(${this.currentBetAmount} 💎)`;
        subEl.style.display = 'block';
      } else {
        btn.classList.add('btn-bet');
        titleEl.textContent = '🚀 PARTICIPAR EN VUELO';
        subEl.textContent = '';
        subEl.style.display = 'none';
      }
    } else if (this.state === 'FLYING') {
      if (this.hasActiveBet && !this.hasCashedOut) {
        btn.disabled = false;
        btn.classList.add('btn-cashout');
        titleEl.textContent = '💰 RETIRAR (CASHOUT)';
        const potential = Math.floor(this.currentBetAmount * this.currentMultiplier);
        subEl.textContent = `+${potential.toLocaleString('en-US')} 💎 (x${this.currentMultiplier.toFixed(2)})`;
        subEl.style.display = 'block';
      } else if (this.hasActiveBet && this.hasCashedOut) {
        btn.disabled = true;
        btn.classList.add('btn-cashed-out');
        titleEl.textContent = '✅ RETIRADO';
        subEl.textContent = `(+${this.cashoutPayout.toLocaleString('en-US')} 💎)`;
        subEl.style.display = 'block';
      } else {
        btn.disabled = true;
        titleEl.textContent = '🛰️ COHETE EN VUELO...';
        subEl.textContent = 'Espera a la siguiente ronda';
        subEl.style.display = 'block';
      }
    } else if (this.state === 'CRASHED') {
      btn.disabled = true;
      if (this.hasActiveBet && this.hasCashedOut) {
        btn.classList.add('btn-cashed-out');
        titleEl.textContent = '✅ RETIRO EXITOSO';
        subEl.textContent = `+${this.cashoutPayout.toLocaleString('en-US')} 💎 (x${this.cashoutMultiplier.toFixed(2)})`;
        subEl.style.display = 'block';
      } else {
        btn.classList.add('btn-crashed');
        titleEl.textContent = `💥 ¡EXPLOTÓ EN x${this.targetCrashMultiplier.toFixed(2)}!`;
        subEl.textContent = this.hasActiveBet ? `Perdiste ${this.currentBetAmount} 💎` : 'Ronda terminada';
        subEl.style.display = 'block';
      }
    }
  }

  /**
   * Actualización ligera del texto de retiro potencial (sin tocar el árbol DOM ni clases)
   */
  private updateCashoutDynamicLabel(): void {
    const subEl = document.getElementById('btnRocketSubTitle');
    if (!subEl) return;
    const potential = Math.floor(this.currentBetAmount * this.currentMultiplier);
    subEl.textContent = `+${potential.toLocaleString('en-US')} 💎 (x${this.currentMultiplier.toFixed(2)})`;
  }

  private checkVip(): void {
    if (this.userState.xp >= this.userState.xpTarget) {
      if (this.userState.vipLevel === 'Panda Bronce') {
        this.userState.vipLevel = 'Panda Plata';
        this.userState.xpTarget = 5000;
      } else if (this.userState.vipLevel === 'Panda Plata') {
        this.userState.vipLevel = 'Panda Oro';
        this.userState.xpTarget = 25000;
      }
    }
  }

  private updateStatsUI(): void {
    const rEl = document.getElementById('statTotalRounds');
    const wEl = document.getElementById('statTotalWon');
    const mEl = document.getElementById('statBestMult');

    if (rEl) rEl.textContent = this.totalRounds.toLocaleString('en-US');
    if (wEl) wEl.textContent = `+${this.totalDiamondsWon.toLocaleString('en-US')} 💎`;
    if (mEl) mEl.textContent = `x${this.bestMultiplier.toFixed(2)}`;
  }

  private setTicker(msg: string, isWin: boolean, isCrash = false): void {
    const bar = document.getElementById('rocketTickerBar');
    if (!bar) return;
    bar.className = 'rocket-ticker-bar';
    if (isWin) bar.classList.add('winner');
    if (isCrash) bar.classList.add('crashed');

    bar.innerHTML = `
      <span style="font-weight:${isWin ? '900' : '600'}; color:${isWin ? '#00e701' : isCrash ? '#ff0055' : '#cbd5e1'};">${msg}</span>
      <span style="font-size:0.72rem; color:var(--accent-gold); font-family:'Courier New',monospace;">Panda Crash</span>
    `;
  }

  private addRecentChip(mult: number): void {
    const strip = document.getElementById('recentChipsStrip');
    if (!strip) return;
    const chip = document.createElement('div');
    chip.className = 'chip-mult';
    if (mult < 1.2) chip.classList.add('chip-crash');
    else if (mult < 2.0) chip.classList.add('chip-low');
    else if (mult < 10.0) chip.classList.add('chip-mid');
    else if (mult < 50.0) chip.classList.add('chip-high');
    else chip.classList.add('chip-epic');

    chip.textContent = `x${mult.toFixed(2)}`;
    strip.prepend(chip);

    while (strip.children.length > 15) {
      strip.lastElementChild?.remove();
    }
  }

  private addHistoryRow(bet: number, mult: number, payout: number, isWin: boolean): void {
    const list = document.getElementById('rocketHistoryList');
    if (!list) return;
    const emptyMsg = list.querySelector('.empty-hist');
    if (emptyMsg) emptyMsg.remove();

    const row = document.createElement('div');
    row.className = 'history-item';
    row.innerHTML = `
      <span style="color:#8e9bb0;">${bet} 💎</span>
      <span style="color:${isWin ? '#00e701' : '#ff0055'}; font-weight:800;">x${mult.toFixed(2)}</span>
      <span style="color:${isWin ? '#00e701' : '#8e9bb0'}; font-weight:900; font-family:'Courier New',monospace;">
        ${payout > 0 ? `+${payout} 💎` : '0 💎'}
      </span>
    `;
    list.prepend(row);

    while (list.children.length > 15) {
      list.lastElementChild?.remove();
    }
  }

  private bindEvents(): void {
    const betInput = document.getElementById('betAmountInput') as HTMLInputElement | null;
    const btnAction = document.getElementById('btnRocketAction');
    const btnHalf = document.getElementById('btnBetHalf');
    const btnDouble = document.getElementById('btnBetDouble');
    const btnMax = document.getElementById('btnBetMax');

    // Auto-Cashout toggle y controles interactivos
    const btnToggle = document.getElementById('btnToggleAutoCashout');
    const badgeStatus = document.getElementById('autoCashoutStatusBadge');
    const autoBox = document.getElementById('autoCashoutBox');
    const autoContainer = document.getElementById('autoInputContainer');
    const autoInput = document.getElementById('autoCashoutMultInput') as HTMLInputElement | null;

    const toggleAutoCashout = (forceState?: boolean): void => {
      this.isAutoCashoutEnabled = typeof forceState === 'boolean' ? forceState : !this.isAutoCashoutEnabled;

      if (btnToggle) {
        btnToggle.setAttribute('aria-pressed', String(this.isAutoCashoutEnabled));
        btnToggle.classList.toggle('active', this.isAutoCashoutEnabled);
      }
      if (autoBox) {
        autoBox.classList.toggle('active', this.isAutoCashoutEnabled);
      }
      if (autoContainer) {
        autoContainer.classList.toggle('disabled', !this.isAutoCashoutEnabled);
      }
      if (autoInput) {
        autoInput.disabled = !this.isAutoCashoutEnabled;
      }
      if (badgeStatus) {
        if (this.isAutoCashoutEnabled) {
          badgeStatus.textContent = 'ENCENDIDO';
          badgeStatus.className = 'toggle-status-badge badge-on';
        } else {
          badgeStatus.textContent = 'APAGADO';
          badgeStatus.className = 'toggle-status-badge badge-off';
        }
      }
    };

    btnToggle?.addEventListener('click', () => toggleAutoCashout());
    badgeStatus?.addEventListener('click', () => toggleAutoCashout());

    // Presets rápidos de auto-cashout (x1.2, x1.5, x2.0, x5.0, x10.0)
    document.querySelectorAll('.btn-autopreset').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = Number(btn.getAttribute('data-mult')) || 2.0;
        this.autoCashoutTarget = val;
        if (autoInput) autoInput.value = val.toFixed(2);
        document.querySelectorAll('.btn-autopreset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Si estaba apagado, encenderlo automáticamente
        if (!this.isAutoCashoutEnabled) {
          toggleAutoCashout(true);
        }
      });
    });

    autoInput?.addEventListener('input', () => {
      let val = parseFloat(autoInput.value);
      if (isNaN(val) || val < 1.05) val = 1.05;
      if (val > 500) val = 500;
      this.autoCashoutTarget = Math.floor(val * 100) / 100;

      // Actualizar highlight de presets
      document.querySelectorAll('.btn-autopreset').forEach(b => {
        const pVal = Number(b.getAttribute('data-mult'));
        b.classList.toggle('active', Math.abs(pVal - this.autoCashoutTarget) < 0.01);
      });
    });

    // Botones rápidos de apuesta
    document.querySelectorAll('.btn-qbet').forEach(b => {
      b.addEventListener('click', () => {
        if (!betInput) return;
        document.querySelectorAll('.btn-qbet').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        const v = Number(b.getAttribute('data-bet')) || 50;
        betInput.value = String(v);
      });
    });

    btnHalf?.addEventListener('click', () => {
      if (!betInput) return;
      const cur = Number(betInput.value) || 50;
      betInput.value = String(Math.max(10, Math.floor(cur / 2)));
    });

    btnDouble?.addEventListener('click', () => {
      if (!betInput) return;
      const cur = Number(betInput.value) || 50;
      betInput.value = String(Math.min(this.userState.balance, cur * 2));
    });

    btnMax?.addEventListener('click', () => {
      if (!betInput) return;
      betInput.value = String(Math.max(10, Math.min(5000, this.userState.balance)));
    });

    const triggerActionInstant = (e?: Event): void => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      this.handleMainButtonClick();
    };

    // Disparo inmediato por pointerdown (en cuanto se presiona el botón, 0ms latencia)
    btnAction?.addEventListener('pointerdown', (e) => {
      if (this.state === 'FLYING' && this.hasActiveBet && !this.hasCashedOut) {
        triggerActionInstant(e);
      }
    });

    btnAction?.addEventListener('touchstart', (e) => {
      if (this.state === 'FLYING' && this.hasActiveBet && !this.hasCashedOut) {
        triggerActionInstant(e);
      }
    }, { passive: false });

    btnAction?.addEventListener('click', (e) => {
      triggerActionInstant(e);
    });

    // Barra espaciadora para participar o retirar rápido
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement !== betInput && document.activeElement !== autoInput) {
        e.preventDefault();
        this.handleMainButtonClick();
      }
    });
  }

  private getRocketX(): number {
    const w = this.canvas.width;
    if (this.state === 'COUNTDOWN') return 115;
    const baseProgress = Math.min(1.0, this.flightTime / 16);
    const extra = this.flightTime > 16 ? Math.sin((this.flightTime - 16) * 3) * 5 : 0;
    return 115 + baseProgress * (w - 240) + extra;
  }

  private getRocketY(): number {
    const h = this.canvas.height;
    if (this.state === 'COUNTDOWN') return h - 80;
    const baseProgress = Math.min(1.0, this.flightTime / 16);
    const extra = this.flightTime > 16 ? Math.cos((this.flightTime - 16) * 2.5) * 4 : 0;
    return (h - 80) - Math.pow(baseProgress, 0.78) * (h - 170) + extra;
  }

  private loop(currentTime: number): void {
    const dt = Math.min(0.04, (currentTime - this.lastFrameTime) / 1000);
    this.lastFrameTime = currentTime;

    this.updateLogic(dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  private updateLogic(dt: number): void {
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }

    // Actualizar estrellas de fondo
    const starSpeedMultiplier = this.state === 'FLYING' ? 1 + Math.min(6, this.flightTime * 0.4) : 1;
    for (const s of this.stars) {
      s.x -= s.speed * starSpeedMultiplier * 0.8;
      s.y += s.speed * starSpeedMultiplier * 0.4;
      if (s.x < 0) s.x = this.canvas.width;
      if (s.y > this.canvas.height) s.y = 0;
    }

    // Actualizar partículas
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= dt * 2.2;
      if (p.alpha <= 0) this.particles.splice(i, 1);
    }

    if (this.state === 'COUNTDOWN') {
      this.countdownRemaining -= dt;
      if (this.countdownRemaining <= 0) {
        this.launchRocket();
      }
    } else if (this.state === 'FLYING') {
      this.flightTime += dt;

      // Crecimiento continuo del multiplicador: curva exponencial ágil y emocionante (estilo Crash / Aviator)
      const mult = 1.00 * Math.exp(0.155 * this.flightTime);
      this.currentMultiplier = Math.floor(mult * 100) / 100;

      // Añadir partículas de propulsión de fuego tras el cohete (hacia atrás y abajo)
      const rx = this.getRocketX();
      const ry = this.getRocketY();
      for (let i = 0; i < 3; i++) {
        this.particles.push({
          x: rx - 24 + (Math.random() - 0.5) * 6,
          y: ry + 24 + (Math.random() - 0.5) * 6,
          vx: -(3 + Math.random() * 4),
          vy: 2 + Math.random() * 3,
          alpha: 0.9,
          color: Math.random() < 0.6 ? '#ff0055' : Math.random() < 0.85 ? '#ffb700' : '#00f0ff',
          radius: 2 + Math.random() * 2.5
        });
      }

      // Comprobar Auto-Cashout si el jugador tiene apuesta activa y está encendido
      if (this.isAutoCashoutEnabled && this.hasActiveBet && !this.hasCashedOut) {
        if (this.currentMultiplier >= this.autoCashoutTarget) {
          this.cashOut(true);
        }
      }

      // Actualizar monto potencial de retiro de forma ultraligera sin tocar clases ni destruir el DOM
      if (this.hasActiveBet && !this.hasCashedOut) {
        this.updateCashoutDynamicLabel();
      }

      // Comprobar si se alcanzó el punto de explosión
      if (this.currentMultiplier >= this.targetCrashMultiplier) {
        this.currentMultiplier = this.targetCrashMultiplier;
        this.crashRocket();
      }
    }
  }

  private render(): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);

    this.ctx.save();
    // Efecto de sacudida de pantalla al explotar
    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      this.ctx.translate(sx, sy);
    }

    // 1. Dibujar estrellas
    for (const s of this.stars) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // 2. Cuadrícula y ejes balísticos
    this.ctx.strokeStyle = 'rgba(255, 0, 85, 0.12)';
    this.ctx.lineWidth = 1;
    for (let x = 80; x < w; x += 110) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 40);
      this.ctx.lineTo(x, h - 50);
      this.ctx.stroke();
    }
    for (let y = 60; y < h - 50; y += 75) {
      this.ctx.beginPath();
      this.ctx.moveTo(80, y);
      this.ctx.lineTo(w - 30, y);
      this.ctx.stroke();
    }

    // Ejes principales
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(80, 30);
    this.ctx.lineTo(80, h - 50);
    this.ctx.lineTo(w - 20, h - 50);
    this.ctx.stroke();

    // 3. Trazo de la curva de trayectoria del cohete
    if (this.state === 'FLYING' || this.state === 'CRASHED') {
      const rx = this.getRocketX();
      const ry = this.getRocketY();

      this.ctx.save();
      // Gradiente de la curva
      const curveGrad = this.ctx.createLinearGradient(80, h - 50, rx, ry);
      curveGrad.addColorStop(0, 'rgba(255, 0, 85, 0.1)');
      curveGrad.addColorStop(1, this.state === 'CRASHED' ? '#ff0055' : '#00f0ff');

      this.ctx.strokeStyle = curveGrad;
      this.ctx.lineWidth = 3.5;
      this.ctx.shadowColor = this.state === 'CRASHED' ? '#ff0055' : '#00f0ff';
      this.ctx.shadowBlur = 12;

      this.ctx.beginPath();
      this.ctx.moveTo(80, h - 50);
      // Curva cuadrática hacia el cohete
      this.ctx.quadraticCurveTo(80 + (rx - 80) * 0.65, h - 50, rx, ry);
      this.ctx.stroke();

      // Sombreado de área bajo la curva
      this.ctx.lineTo(rx, h - 50);
      this.ctx.closePath();
      this.ctx.fillStyle = this.state === 'CRASHED' ? 'rgba(255, 0, 85, 0.06)' : 'rgba(0, 240, 255, 0.05)';
      this.ctx.fill();
      this.ctx.restore();
    }

    // 4. Dibujar partículas (estela y explosión)
    for (const p of this.particles) {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 8;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    // 5. Dibujar el cohete y el Panda Astronauta (solo si no ha explotado)
    if (this.state !== 'CRASHED') {
      const rx = this.getRocketX();
      const ry = this.getRocketY();
      this.drawPandaRocket(rx, ry);
    }

    // 6. Rampa de despegue en el origen
    this.ctx.fillStyle = '#18243c';
    this.ctx.strokeStyle = '#32486c';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.roundRect(70, h - 65, 75, 14, 4);
    this.ctx.fill();
    this.ctx.stroke();

    // 7. Visualización Gigante Central del Multiplicador o Cuenta Regresiva
    if (this.state === 'COUNTDOWN') {
      this.ctx.save();
      this.ctx.font = 'bold 22px "Segoe UI", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = '#ffb700';
      this.ctx.fillText('PRÓXIMO DESPEGUE EN', w / 2, h / 2 - 25);

      this.ctx.font = '900 68px "Courier New", monospace';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.shadowColor = '#ffb700';
      this.ctx.shadowBlur = 18;
      this.ctx.fillText(`${Math.max(0, this.countdownRemaining).toFixed(1)}s`, w / 2, h / 2 + 45);

      // Barra de progreso circular o de llenado
      const prog = Math.max(0, this.countdownRemaining) / 3.5;
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      this.ctx.lineWidth = 6;
      this.ctx.beginPath();
      this.ctx.roundRect(w / 2 - 130, h / 2 + 70, 260, 8, 4);
      this.ctx.stroke();

      this.ctx.fillStyle = '#ff0055';
      this.ctx.beginPath();
      this.ctx.roundRect(w / 2 - 130, h / 2 + 70, 260 * (1 - prog), 8, 4);
      this.ctx.fill();
      this.ctx.restore();
    } else if (this.state === 'FLYING') {
      this.ctx.save();
      let color = '#ffffff';
      if (this.currentMultiplier >= 50.0) color = '#ff0055';
      else if (this.currentMultiplier >= 10.0) color = '#bd00ff';
      else if (this.currentMultiplier >= 2.0) color = '#ffb700';
      else color = '#00f0ff';

      this.ctx.font = '900 78px "Courier New", monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = color;
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = 24;
      this.ctx.fillText(`x${this.currentMultiplier.toFixed(2)}`, w / 2, h / 2);

      this.ctx.font = 'bold 15px "Segoe UI", sans-serif';
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      this.ctx.shadowBlur = 0;
      this.ctx.fillText('COHETE EN ASCENSO', w / 2, h / 2 + 42);
      this.ctx.restore();
    } else if (this.state === 'CRASHED') {
      this.ctx.save();
      this.ctx.font = '900 74px "Courier New", monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = '#ff0055';
      this.ctx.shadowColor = '#ff0055';
      this.ctx.shadowBlur = 30;
      this.ctx.fillText(`x${this.targetCrashMultiplier.toFixed(2)}`, w / 2, h / 2);

      this.ctx.font = '900 24px "Segoe UI", sans-serif';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillText('💥 ¡CRASH! COLAPSO DEL COHETE', w / 2, h / 2 + 45);
      this.ctx.restore();
    }

    this.ctx.restore();
  }

  private drawPandaRocket(x: number, y: number): void {
    this.ctx.save();
    this.ctx.translate(x, y);

    // Ángulo de inclinación del cohete:
    // Con la punta en (0, -42), un ángulo positivo (+45° a +55°) orienta la punta
    // hacia arriba y la derecha, siguiendo con precisión matemática la trayectoria de ascenso.
    const angle = this.state === 'COUNTDOWN' 
      ? Math.PI / 4 
      : Math.PI / 4 + Math.min(0.20, this.flightTime * 0.012);
    this.ctx.rotate(angle);

    // 1. Cuerpo aerodinámico del cohete (Plata / Dorado)
    const grad = this.ctx.createLinearGradient(-15, -25, 15, 25);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, '#e2e8f0');
    grad.addColorStop(1, '#94a3b8');

    this.ctx.fillStyle = grad;
    this.ctx.strokeStyle = '#ffb700';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, 15, 34, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    // 2. Punta cónica roja
    this.ctx.fillStyle = '#ff0055';
    this.ctx.beginPath();
    this.ctx.moveTo(-12, -22);
    this.ctx.lineTo(0, -42);
    this.ctx.lineTo(12, -22);
    this.ctx.closePath();
    this.ctx.fill();

    // 3. Aletas rojas laterales
    this.ctx.fillStyle = '#ff0055';
    // Aleta izquierda
    this.ctx.beginPath();
    this.ctx.moveTo(-14, 10);
    this.ctx.lineTo(-26, 28);
    this.ctx.lineTo(-12, 28);
    this.ctx.closePath();
    this.ctx.fill();
    // Aleta derecha
    this.ctx.beginPath();
    this.ctx.moveTo(14, 10);
    this.ctx.lineTo(26, 28);
    this.ctx.lineTo(12, 28);
    this.ctx.closePath();
    this.ctx.fill();

    // 4. Ventana esférica de la cabina con Panda Astronauta 🐼
    this.ctx.fillStyle = '#06132b';
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 2.5;
    this.ctx.beginPath();
    this.ctx.arc(0, -6, 9.5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    // Cara del Panda dentro de la cabina
    // Cabeza blanca
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(0, -5, 6.5, 0, Math.PI * 2);
    this.ctx.fill();

    // Orejas negras
    this.ctx.fillStyle = '#1e293b';
    this.ctx.beginPath();
    this.ctx.arc(-4.5, -10.5, 2.2, 0, Math.PI * 2);
    this.ctx.arc(4.5, -10.5, 2.2, 0, Math.PI * 2);
    this.ctx.fill();

    // Manchas negras en los ojos
    this.ctx.beginPath();
    this.ctx.arc(-2.5, -6, 1.8, 0, Math.PI * 2);
    this.ctx.arc(2.5, -6, 1.8, 0, Math.PI * 2);
    this.ctx.fill();

    // Ojos brillantes
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(-2.5, -6, 0.7, 0, Math.PI * 2);
    this.ctx.arc(2.5, -6, 0.7, 0, Math.PI * 2);
    this.ctx.fill();

    // Nariz
    this.ctx.fillStyle = '#0f172a';
    this.ctx.beginPath();
    this.ctx.arc(0, -3.5, 1, 0, Math.PI * 2);
    this.ctx.fill();

    // 5. Tobera del motor y fuego propulsor
    this.ctx.fillStyle = '#475569';
    this.ctx.beginPath();
    this.ctx.roundRect(-8, 30, 16, 6, 2);
    this.ctx.fill();

    if (this.state === 'FLYING') {
      const flameLen = 22 + Math.random() * 14;
      const flameGrad = this.ctx.createLinearGradient(0, 36, 0, 36 + flameLen);
      flameGrad.addColorStop(0, '#ffffff');
      flameGrad.addColorStop(0.3, '#00f0ff');
      flameGrad.addColorStop(0.7, '#ff0055');
      flameGrad.addColorStop(1, 'transparent');

      this.ctx.fillStyle = flameGrad;
      this.ctx.beginPath();
      this.ctx.moveTo(-6, 36);
      this.ctx.lineTo(0, 36 + flameLen);
      this.ctx.lineTo(6, 36);
      this.ctx.closePath();
      this.ctx.fill();
    }

    this.ctx.restore();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PandaCrashRocketGame();
});
