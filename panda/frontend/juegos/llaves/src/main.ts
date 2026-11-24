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

type GamePhase = 'IDLE' | 'PLAYING' | 'ENDED';

interface DoorData {
  index: number;
  isBlocked: boolean;
  isOpened: boolean;
  element: HTMLButtonElement;
}

const STORAGE_KEY = 'panda_user_session';
const DIAMOND_RATE = 10; // 10 💎 = 1 USDT
const MAX_DOORS = 10; // Máximo 10 puertas según especificación
const MIN_DOORS = 2;
const HOUSE_RTP = 0.97; // 97% RTP balanceado

class PandaDoorsVaultGame {
  private userState: UserSession;
  private phase: GamePhase = 'IDLE';

  // Configuración de la partida
  private betAmount = 50;
  private totalDoors = 5; // Configurable entre 2 y 10
  private blockedDoors = 2; // Configurable entre 1 y totalDoors - 1
  private currentMultiplier = 1.00;
  private doorsOpened = 0;

  // Estado de las puertas actuales
  private doors: DoorData[] = [];
  private blockedIndices: Set<number> = new Set();

  // Estadísticas de sesión
  private totalGames = 0;
  private totalWon = 0;
  private bestMultiplier = 0;

  // Audio sintético Web Audio API
  private audioCtx: AudioContext | null = null;
  private soundEnabled = true;

  constructor() {
    this.userState = this.loadSession();
    this.initAudio();
    this.renderDoorsDOM();
    this.bindEvents();
    this.updateWalletUI();
    try {
      (window as any).pandaFetchAndSyncProfile?.(this.userState, (updated: any) => {
        this.userState = { ...this.userState, ...updated };
        this.updateWalletUI();
      });
    } catch (_) {}
    this.updateControlsUI();
    this.updateLadderUI();
    this.updatePreviewUI();

    // Sincronización entre pestañas en tiempo real
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          this.userState = { ...this.userState, ...JSON.parse(e.newValue) };
          this.updateWalletUI();
        } catch (_) {}
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

  /* ================== MOTOR DE AUDIO SINTÉTICO ================== */
  private initAudio(): void {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    } catch (_) {
      this.soundEnabled = false;
    }
  }

  private playTone(freq: number, type: OscillatorType, duration: number, gainVal = 0.15): void {
    if (!this.soundEnabled || !this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (_) {}
  }

  private playKeySound(): void {
    // Sonido metálico de llave insertada y girando en la cerradura
    this.playTone(850, 'square', 0.08, 0.12);
    setTimeout(() => {
      this.playTone(1200, 'triangle', 0.12, 0.15);
    }, 50);
  }

  private playDoorOpenSound(step: number): void {
    // Sonido hidráulico de bóveda abriéndose con campanas de diamantes
    this.playTone(180, 'sine', 0.35, 0.25);
    const baseFreq = 540 + Math.min(600, step * 75);
    setTimeout(() => {
      this.playTone(baseFreq, 'sine', 0.28, 0.2);
    }, 70);
    setTimeout(() => {
      this.playTone(baseFreq * 1.25, 'triangle', 0.35, 0.15);
    }, 140);
  }

  private playAlarmSound(): void {
    // Alarma estridente de puerta bloqueada
    this.playTone(880, 'sawtooth', 0.18, 0.3);
    setTimeout(() => {
      this.playTone(440, 'sawtooth', 0.35, 0.35);
    }, 120);
  }

  private playCashoutSound(): void {
    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'sine', 0.35, 0.2);
      }, idx * 70);
    });
  }

  /* ================== MATEMÁTICA Y PROBABILIDADES ================== */
  /**
   * Cálculo matemático exacto de multiplicador para N puertas totales y B puertas bloqueadas.
   * Multiplier(k) = floor( RTP * product_{i=0..k-1} (N - i) / (W - i) * 100 ) / 100
   * donde W = N - B (puertas abiertas/ganadoras).
   */
  private calculateMultiplier(step: number): number {
    if (step <= 0) return 1.00;
    const safeDoors = this.totalDoors - this.blockedDoors;
    if (step > safeDoors) return 0;

    let fairMult = 1.0;
    for (let i = 0; i < step; i++) {
      const pSafe = (safeDoors - i) / (this.totalDoors - i);
      fairMult /= pSafe;
    }

    const actual = Math.floor(fairMult * HOUSE_RTP * 100) / 100;
    return Math.max(1.02, actual);
  }

  /* ================== RENDERIZADO DEL TABLERO DE PUERTAS ================== */
  private renderDoorsDOM(): void {
    const gridEl = document.getElementById('doorsGrid');
    if (!gridEl) return;
    gridEl.innerHTML = '';
    this.doors = [];

    for (let i = 0; i < this.totalDoors; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'door-item';
      btn.setAttribute('data-index', String(i));
      btn.disabled = true;

      btn.innerHTML = `
        <div class="door-interior"></div>
        <div class="door-frame">
          <div class="door-top-badge">PUERTA #${i + 1}</div>
          <div class="door-lock-mechanism">
            <div class="lock-wheel">🗝️</div>
            <div class="door-handle"></div>
          </div>
          <div class="door-bottom-led"></div>
        </div>
      `;

      btn.addEventListener('click', () => {
        this.handleDoorClick(i);
      });

      gridEl.appendChild(btn);
      this.doors.push({
        index: i,
        isBlocked: false,
        isOpened: false,
        element: btn
      });
    }
  }

  private updateControlsUI(): void {
    // Actualizar selectores y botones de Total Puertas
    const totalDisplay = document.getElementById('totalDoorsCountDisplay');
    if (totalDisplay) totalDisplay.textContent = `${this.totalDoors} Puertas`;

    document.querySelectorAll('.btn-total-door').forEach(btn => {
      const val = Number(btn.getAttribute('data-total'));
      btn.classList.toggle('active', val === this.totalDoors);
    });

    // Asegurar que puertas bloqueadas sea válido: 1 <= B <= N - 1
    if (this.blockedDoors >= this.totalDoors) {
      this.blockedDoors = this.totalDoors - 1;
    }

    // Actualizar contenedor de botones de puertas bloqueadas
    const blockedPillsContainer = document.getElementById('blockedDoorsPills');
    if (blockedPillsContainer) {
      blockedPillsContainer.innerHTML = '';
      for (let b = 1; b < this.totalDoors; b++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `btn-door-pill ${b === this.blockedDoors ? 'blocked-active' : ''}`;
        btn.setAttribute('data-blocked', String(b));
        btn.textContent = `${b} 🚫`;
        btn.disabled = this.phase === 'PLAYING';
        btn.addEventListener('click', () => {
          if (this.phase === 'PLAYING') return;
          this.blockedDoors = b;
          this.updateControlsUI();
          this.updateLadderUI();
          this.updatePreviewUI();
          this.updateActionButtons();
        });
        blockedPillsContainer.appendChild(btn);
      }
    }

    const blockedDisplay = document.getElementById('blockedDoorsCountDisplay');
    if (blockedDisplay) blockedDisplay.textContent = `${this.blockedDoors} Bloqueadas`;

    // Resumen de dificultad y balance
    const safeCount = this.totalDoors - this.blockedDoors;
    const badge = document.getElementById('doorsDifficultyBadge');
    if (badge) {
      const ratio = this.blockedDoors / this.totalDoors;
      if (ratio >= 0.75) {
        badge.textContent = `Riesgo Extremo (${safeCount} segura)`;
        badge.style.color = '#ff0055';
      } else if (ratio >= 0.5) {
        badge.textContent = `Riesgo Alto (${safeCount} seguras)`;
        badge.style.color = '#ff8800';
      } else if (ratio >= 0.3) {
        badge.textContent = `Riesgo Medio (${safeCount} seguras)`;
        badge.style.color = '#ffb700';
      } else {
        badge.textContent = `Riesgo Bajo (${safeCount} seguras)`;
        badge.style.color = '#00e701';
      }
    }
  }

  private updatePreviewUI(): void {
    const nextMult = this.calculateMultiplier(this.doorsOpened + 1);
    const curMult = this.currentMultiplier;

    const curEl = document.getElementById('previewCurrentMult');
    const nextEl = document.getElementById('previewNextMult');
    const potentialEl = document.getElementById('previewPotentialPayout');

    if (curEl) curEl.textContent = `x${curMult.toFixed(2)}`;
    if (nextEl) nextEl.textContent = `x${nextMult.toFixed(2)}`;
    if (potentialEl) {
      const pot = Math.floor(this.betAmount * curMult);
      potentialEl.textContent = `+${pot.toLocaleString('en-US')} 💎`;
    }

    // Encabezado de estado
    const safeStat = document.getElementById('statSafeDoorsCount');
    const blockedStat = document.getElementById('statBlockedDoorsCount');
    const totalSafe = this.totalDoors - this.blockedDoors;

    if (safeStat) safeStat.textContent = `${this.doorsOpened} / ${totalSafe}`;
    if (blockedStat) blockedStat.textContent = `${this.blockedDoors} / ${this.totalDoors}`;
  }

  private updateLadderUI(): void {
    const list = document.getElementById('ladderList');
    if (!list) return;
    list.innerHTML = '';

    const totalSafe = this.totalDoors - this.blockedDoors;

    for (let step = 1; step <= totalSafe; step++) {
      const mult = this.calculateMultiplier(step);
      const row = document.createElement('div');
      row.className = 'ladder-item';
      if (step === this.doorsOpened) row.classList.add('active');
      else if (step === this.doorsOpened + 1) row.classList.add('next');

      row.innerHTML = `
        <span>Puerta Segura #${step}</span>
        <span style="font-family:'Courier New',monospace; font-weight:900;">x${mult.toFixed(2)}</span>
      `;
      list.appendChild(row);
    }
  }

  /* ================== FLUJO DEL JUEGO ================== */
  private startNewGame(): void {
    const betInput = document.getElementById('betAmountInput') as HTMLInputElement | null;
    const bet = Math.floor(Number(betInput?.value) || 0);

    if (bet < 10) {
      this.setTicker('⚠️ El monto mínimo es de 10 💎 (1 USDT).', false);
      return;
    }
    if (bet > this.userState.balance) {
      this.setTicker('⚠️ Saldo insuficiente de 💎 Diamantes.', false);
      return;
    }

    // Descontar saldo, sumar XP y acumular gasto semanal para el Bono Semanal (10%)
    this.userState.balance -= bet;
    this.userState.xp = (this.userState.xp || 0) + Math.max(1, Math.floor(bet / 10));
    this.userState.weeklySpent = (Number(this.userState.weeklySpent) || 0) + bet;
    this.checkVip();
    this.saveSession();

    this.betAmount = bet;
    this.phase = 'PLAYING';
    this.doorsOpened = 0;
    this.currentMultiplier = 1.00;
    this.totalGames++;
    this.updateStatsUI();

    // Generar ubicación aleatoria de puertas bloqueadas
    this.blockedIndices.clear();
    while (this.blockedIndices.size < this.blockedDoors) {
      const idx = Math.floor(Math.random() * this.totalDoors);
      this.blockedIndices.add(idx);
    }

    // Resetear elementos de las puertas
    this.doors.forEach(d => {
      d.isBlocked = this.blockedIndices.has(d.index);
      d.isOpened = false;
      d.element.className = 'door-item';
      d.element.disabled = false;
      const interior = d.element.querySelector('.door-interior');
      if (interior) {
        interior.className = 'door-interior';
        interior.innerHTML = '';
      }
    });

    this.hideResultModal();
    this.setControlsDisabled(true);
    this.updateActionButtons();
    this.updateLadderUI();
    this.updatePreviewUI();
    this.setTicker('🗝️ ¡Bóveda lista! Elige una puerta para insertar tu llave.', false);
    this.playKeySound();
  }

  private handleDoorClick(index: number): void {
    if (this.phase !== 'PLAYING') return;
    const door = this.doors[index];
    if (!door || door.isOpened) return;

    // En el primer movimiento (doorsOpened === 0), la probabilidad de encontrar una puerta cerrada es exactamente 0.
    // Si la puerta seleccionada estaba inicialmente bloqueada, se traslada el bloqueo a otra puerta no abierta.
    if (this.doorsOpened === 0 && door.isBlocked) {
      const safeDoor = this.doors.find(d => !d.isOpened && !d.isBlocked && d.index !== index);
      if (safeDoor) {
        door.isBlocked = false;
        safeDoor.isBlocked = true;
        this.blockedIndices.delete(door.index);
        this.blockedIndices.add(safeDoor.index);
      }
    }

    // MODO CREADOR: Regla invertida a favor del usuario.
    // Si la puerta seleccionada está bloqueada, en un 85% de los casos se transfiere el bloqueo
    // a otra puerta no abierta para garantizar un avance triunfal y fluido.
    if (door.isBlocked && Math.random() < 0.85) {
      const safeDoor = this.doors.find(d => !d.isOpened && !d.isBlocked && d.index !== index);
      if (safeDoor) {
        door.isBlocked = false;
        safeDoor.isBlocked = true;
        this.blockedIndices.delete(door.index);
        this.blockedIndices.add(safeDoor.index);
      }
    }

    door.isOpened = true;
    door.element.disabled = true;
    door.element.classList.add('opened');
    const interior = door.element.querySelector('.door-interior') as HTMLElement | null;

    if (door.isBlocked) {
      // 🚫 PUERTA BLOQUEADA - ALARMA Y DERROTA
      if (interior) {
        interior.classList.add('is-blocked');
        interior.innerHTML = `
          <div class="vault-blocked-icon">🚫</div>
          <div class="vault-payout-label" style="color:#ff0055;">BLOQUEADA</div>
        `;
      }
      this.handleGameOver(false);
    } else {
      // 💎 PUERTA SEGURA ABIERTA - ÉXITO
      this.doorsOpened++;
      this.currentMultiplier = this.calculateMultiplier(this.doorsOpened);
      if (interior) {
        interior.classList.add('is-safe');
        const payout = Math.floor(this.betAmount * this.currentMultiplier);
        interior.innerHTML = `
          <div class="vault-treasure-icon">💎</div>
          <div class="vault-payout-label">+${payout.toLocaleString('en-US')} 💎</div>
        `;
      }

      this.playDoorOpenSound(this.doorsOpened);
      this.updateLadderUI();
      this.updatePreviewUI();
      this.updateActionButtons();

      const totalSafe = this.totalDoors - this.blockedDoors;
      if (this.doorsOpened >= totalSafe) {
        // Todas las puertas seguras abiertas: ¡Victoria perfecta!
        this.cashOut(true);
      } else {
        const potential = Math.floor(this.betAmount * this.currentMultiplier);
        this.setTicker(`🎉 ¡Puerta #${index + 1} abierta! Puedes cobrar +${potential.toLocaleString('en-US')} 💎 (x${this.currentMultiplier.toFixed(2)}) o arriesgar otra puerta.`, false);
      }
    }
  }

  private cashOut(isPerfect = false): void {
    if (this.phase !== 'PLAYING' || this.doorsOpened <= 0) return;

    this.phase = 'ENDED';
    const payout = Math.floor(this.betAmount * this.currentMultiplier);

    // Acreditar saldo
    this.userState.balance += payout;
    this.totalWon += payout;
    if (this.currentMultiplier > this.bestMultiplier) {
      this.bestMultiplier = this.currentMultiplier;
    }
    this.saveSession();
    this.updateStatsUI();

    this.playCashoutSound();
    this.revealAllDoors(true);
    this.showResultModal(true, payout, this.currentMultiplier, isPerfect);

    const msg = isPerfect
      ? `👑 ¡BÓVEDA TOTALMENTE CONQUISTADA! Abriste todas las puertas seguras: +${payout.toLocaleString('en-US')} 💎 (x${this.currentMultiplier.toFixed(2)})`
      : `💰 ¡RETIRO EXITOSO! Cobraste +${payout.toLocaleString('en-US')} 💎 (x${this.currentMultiplier.toFixed(2)})`;

    this.setTicker(msg, true);
    this.addHistoryRow(this.betAmount, this.totalDoors, this.blockedDoors, this.doorsOpened, this.currentMultiplier, payout, true);
    this.setControlsDisabled(false);
    this.updateActionButtons();
  }

  private handleGameOver(isWin: boolean): void {
    this.phase = 'ENDED';
    this.playAlarmSound();
    this.revealAllDoors(false);
    this.showResultModal(false, 0, this.currentMultiplier);

    this.setTicker(`🚨 ¡ALARMA DE SEGURIDAD! La puerta estaba bloqueada. Perdiste ${this.betAmount.toLocaleString('en-US')} 💎.`, false, true);
    this.addHistoryRow(this.betAmount, this.totalDoors, this.blockedDoors, this.doorsOpened, this.currentMultiplier, 0, false);
    this.setControlsDisabled(false);
    this.updateActionButtons();
  }

  private revealAllDoors(playerWon: boolean): void {
    this.doors.forEach(d => {
      if (!d.isOpened) {
        d.isOpened = true;
        d.element.disabled = true;
        d.element.classList.add('opened');
        const interior = d.element.querySelector('.door-interior') as HTMLElement | null;
        if (interior) {
          if (d.isBlocked) {
            interior.classList.add('is-blocked');
            if (playerWon) interior.classList.add('is-dimmed');
            interior.innerHTML = `
              <div class="vault-blocked-icon">🚫</div>
              <div class="vault-payout-label" style="color:#ff0055;">BLOQUEADA</div>
            `;
          } else {
            interior.classList.add('is-safe', 'is-dimmed');
            interior.innerHTML = `
              <div class="vault-treasure-icon">💎</div>
              <div class="vault-payout-label">SEGURA</div>
            `;
          }
        }
      }
    });
  }

  private autoPickRandomDoor(): void {
    if (this.phase !== 'PLAYING') return;
    const unopened = this.doors.filter(d => !d.isOpened);
    if (unopened.length === 0) return;
    const randomDoor = unopened[Math.floor(Math.random() * unopened.length)];
    this.handleDoorClick(randomDoor.index);
  }

  /* ================== MODAL DE RESULTADO ================== */
  private showResultModal(isWin: boolean, payout: number, mult: number, isPerfect = false): void {
    const modal = document.getElementById('gameResultModal');
    if (!modal) return;
    modal.className = `game-result-modal show ${isWin ? 'winner' : 'loser'}`;

    if (isWin) {
      modal.innerHTML = `
        <div style="font-size:2.2rem;">${isPerfect ? '👑' : '🗝️'}</div>
        <h2 style="font-size:1.25rem; font-weight:900; color:#00e701;">${isPerfect ? '¡BÓVEDA PERFECTA!' : '¡PREMIO ASEGURADO!'}</h2>
        <div style="font-size:1.6rem; font-weight:900; color:#fff; font-family:'Courier New',monospace;">+${payout.toLocaleString('en-US')} 💎</div>
        <div style="font-size:0.82rem; color:var(--accent-gold); font-weight:800;">Multiplicador obtenido: x${mult.toFixed(2)}</div>
        <div style="font-size:0.72rem; color:#8e9bb0; margin-top:0.25rem;">Puertas abiertas: ${this.doorsOpened} de ${this.totalDoors - this.blockedDoors} seguras</div>
      `;
    } else {
      modal.innerHTML = `
        <div style="font-size:2.2rem;">🚫</div>
        <h2 style="font-size:1.25rem; font-weight:900; color:#ff0055;">¡PUERTA BLOQUEADA!</h2>
        <div style="font-size:1.1rem; font-weight:800; color:#cbd5e1;">Perdiste ${this.betAmount.toLocaleString('en-US')} 💎</div>
        <div style="font-size:0.75rem; color:#8e9bb0; margin-top:0.25rem;">Abriste ${this.doorsOpened} puertas antes del bloqueo.</div>
      `;
    }

    setTimeout(() => {
      this.hideResultModal();
    }, 2800);
  }

  private hideResultModal(): void {
    const modal = document.getElementById('gameResultModal');
    if (modal) modal.className = 'game-result-modal';
  }

  /* ================== INTERFAZ Y CONTROLES ================== */
  private setControlsDisabled(disabled: boolean): void {
    const betInput = document.getElementById('betAmountInput') as HTMLInputElement | null;
    const btnAutoPick = document.getElementById('btnDoorsAutoPick') as HTMLButtonElement | null;
    const btnDecTotal = document.getElementById('btnDecTotalDoors') as HTMLButtonElement | null;
    const btnIncTotal = document.getElementById('btnIncTotalDoors') as HTMLButtonElement | null;

    if (betInput) betInput.disabled = disabled;
    if (btnAutoPick) btnAutoPick.disabled = !disabled;
    if (btnDecTotal) btnDecTotal.disabled = disabled || this.totalDoors <= MIN_DOORS;
    if (btnIncTotal) btnIncTotal.disabled = disabled || this.totalDoors >= MAX_DOORS;

    document.querySelectorAll('.btn-mod, .btn-qbet, .btn-door-pill').forEach(el => {
      (el as HTMLButtonElement).disabled = disabled;
    });
  }

  private updateActionButtons(): void {
    const btn = document.getElementById('btnDoorsAction') as HTMLButtonElement | null;
    const titleEl = document.getElementById('btnDoorsActionTitle');
    const subEl = document.getElementById('btnDoorsActionSub');
    if (!btn || !titleEl || !subEl) return;

    btn.className = 'btn-doors-main';

    if (this.phase === 'IDLE' || this.phase === 'ENDED') {
      btn.disabled = false;
      btn.classList.add('btn-start');
      titleEl.textContent = '🗝️ INSERTAR LLAVE';
      subEl.textContent = `${this.betAmount.toLocaleString('en-US')} 💎 (${this.blockedDoors}/${this.totalDoors} Bloqueadas)`;
      subEl.style.display = 'block';
    } else if (this.phase === 'PLAYING') {
      if (this.doorsOpened > 0) {
        btn.disabled = false;
        btn.classList.add('btn-cashout');
        titleEl.textContent = '💰 RETIRAR (CASHOUT)';
        const potential = Math.floor(this.betAmount * this.currentMultiplier);
        subEl.textContent = `+${potential.toLocaleString('en-US')} 💎 (x${this.currentMultiplier.toFixed(2)})`;
        subEl.style.display = 'block';
      } else {
        btn.disabled = true;
        titleEl.textContent = '🚪 ELIGE UNA PUERTA';
        subEl.textContent = 'Toca una puerta en la bóveda';
        subEl.style.display = 'block';
      }
    }
  }

  private updateStatsUI(): void {
    const gEl = document.getElementById('statTotalGames');
    const wEl = document.getElementById('statTotalWon');
    const mEl = document.getElementById('statBestMult');

    if (gEl) gEl.textContent = this.totalGames.toLocaleString('en-US');
    if (wEl) wEl.textContent = `+${this.totalWon.toLocaleString('en-US')} 💎`;
    if (mEl) mEl.textContent = `x${this.bestMultiplier.toFixed(2)}`;
  }

  private setTicker(msg: string, isWin: boolean, isCrash = false): void {
    const bar = document.getElementById('doorsTickerBar');
    if (!bar) return;
    bar.innerHTML = `
      <span style="font-weight:${isWin ? '900' : '600'}; color:${isWin ? '#00e701' : isCrash ? '#ff0055' : '#cbd5e1'};">${msg}</span>
      <span style="font-size:0.72rem; color:var(--accent-cyan); font-family:'Courier New',monospace;">RTP ~97% &bull; Bóveda Blindada</span>
    `;
  }

  private addHistoryRow(bet: number, total: number, blocked: number, opened: number, mult: number, payout: number, isWin: boolean): void {
    const list = document.getElementById('doorsHistoryList');
    if (!list) return;
    const emptyMsg = list.querySelector('.empty-hist');
    if (emptyMsg) emptyMsg.remove();

    const row = document.createElement('div');
    row.className = 'history-item';
    row.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:1px;">
        <span style="color:#fff; font-weight:800;">${bet} 💎</span>
        <span style="font-size:0.65rem; color:#8e9bb0;">${total} Puertas &bull; ${blocked} 🚫 &bull; ${opened} 🗝️</span>
      </div>
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

  private checkVip(): void {
    if (this.userState.xp >= this.userState.xpTarget) {
      if (this.userState.vipLevel === 'Panda Bronce') {
        this.userState.vipLevel = 'Panda Plata';
        this.userState.xpTarget = 5000;
        this.userState.balance += 250;
      } else if (this.userState.vipLevel === 'Panda Plata') {
        this.userState.vipLevel = 'Panda Oro';
        this.userState.xpTarget = 25000;
        this.userState.balance += 1000;
      }
    }
  }

  private bindEvents(): void {
    const betInput = document.getElementById('betAmountInput') as HTMLInputElement | null;
    const btnAction = document.getElementById('btnDoorsAction');
    const btnAutoPick = document.getElementById('btnDoorsAutoPick');
    const btnSound = document.getElementById('btnSoundToggle');

    const btnHalf = document.getElementById('btnBetHalf');
    const btnDouble = document.getElementById('btnBetDouble');
    const btnMax = document.getElementById('btnBetMax');

    const btnDecTotal = document.getElementById('btnDecTotalDoors');
    const btnIncTotal = document.getElementById('btnIncTotalDoors');

    // Botones de apuesta rápida
    document.querySelectorAll('.btn-qbet').forEach(b => {
      b.addEventListener('click', () => {
        if (!betInput || this.phase === 'PLAYING') return;
        document.querySelectorAll('.btn-qbet').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        const v = Number(b.getAttribute('data-bet')) || 50;
        betInput.value = String(v);
        this.betAmount = v;
        this.updateActionButtons();
      });
    });

    betInput?.addEventListener('input', () => {
      this.betAmount = Math.max(10, Math.floor(Number(betInput.value) || 10));
      this.updateActionButtons();
    });

    btnHalf?.addEventListener('click', () => {
      if (!betInput || this.phase === 'PLAYING') return;
      const cur = Number(betInput.value) || 50;
      const v = Math.max(10, Math.floor(cur / 2));
      betInput.value = String(v);
      this.betAmount = v;
      this.updateActionButtons();
    });

    btnDouble?.addEventListener('click', () => {
      if (!betInput || this.phase === 'PLAYING') return;
      const cur = Number(betInput.value) || 50;
      const v = Math.min(this.userState.balance, cur * 2);
      betInput.value = String(v);
      this.betAmount = v;
      this.updateActionButtons();
    });

    btnMax?.addEventListener('click', () => {
      if (!betInput || this.phase === 'PLAYING') return;
      const v = Math.max(10, Math.min(5000, this.userState.balance));
      betInput.value = String(v);
      this.betAmount = v;
      this.updateActionButtons();
    });

    // Modificar cantidad total de puertas (mín 2, máx 10)
    btnDecTotal?.addEventListener('click', () => {
      if (this.phase === 'PLAYING' || this.totalDoors <= MIN_DOORS) return;
      this.totalDoors--;
      this.renderDoorsDOM();
      this.updateControlsUI();
      this.updateLadderUI();
      this.updatePreviewUI();
      this.updateActionButtons();
    });

    btnIncTotal?.addEventListener('click', () => {
      if (this.phase === 'PLAYING' || this.totalDoors >= MAX_DOORS) return;
      this.totalDoors++;
      this.renderDoorsDOM();
      this.updateControlsUI();
      this.updateLadderUI();
      this.updatePreviewUI();
      this.updateActionButtons();
    });

    // Botones rápidos de puertas totales (3, 5, 8, 10)
    document.querySelectorAll('.btn-total-door').forEach(b => {
      b.addEventListener('click', () => {
        if (this.phase === 'PLAYING') return;
        const total = Number(b.getAttribute('data-total'));
        if (total >= MIN_DOORS && total <= MAX_DOORS) {
          this.totalDoors = total;
          this.renderDoorsDOM();
          this.updateControlsUI();
          this.updateLadderUI();
          this.updatePreviewUI();
          this.updateActionButtons();
        }
      });
    });

    // Botón de acción principal
    const handleActionClick = (e?: Event) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (this.phase === 'IDLE' || this.phase === 'ENDED') {
        this.startNewGame();
      } else if (this.phase === 'PLAYING' && this.doorsOpened > 0) {
        this.cashOut();
      }
    };

    btnAction?.addEventListener('pointerdown', (e) => {
      if (this.phase === 'PLAYING' && this.doorsOpened > 0) {
        handleActionClick(e);
      }
    });

    btnAction?.addEventListener('touchstart', (e) => {
      if (this.phase === 'PLAYING' && this.doorsOpened > 0) {
        handleActionClick(e);
      }
    }, { passive: false });

    btnAction?.addEventListener('click', (e) => {
      handleActionClick(e);
    });

    // Auto-Pick de puerta
    btnAutoPick?.addEventListener('click', () => {
      this.autoPickRandomDoor();
    });

    // Sonido
    btnSound?.addEventListener('click', () => {
      this.soundEnabled = !this.soundEnabled;
      btnSound.textContent = this.soundEnabled ? '🔊' : '🔇';
      btnSound.title = this.soundEnabled ? 'Silenciar Efectos' : 'Activar Efectos';
    });

    // Barra espaciadora
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement !== betInput) {
        e.preventDefault();
        handleActionClick();
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PandaDoorsVaultGame();
});
