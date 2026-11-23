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

interface TileData {
  index: number;
  isMine: boolean;
  isRevealed: boolean;
  element: HTMLButtonElement;
}

const STORAGE_KEY = 'panda_user_session';
const DIAMOND_RATE = 10; // 10 💎 = 1 USDT
const TOTAL_TILES = 16; // Rejilla 4x4
const HOUSE_RTP = 0.97; // 97% RTP comprobable (dificultad balanceada)

class CyberMinesGame {
  private userState: UserSession;
  private phase: GamePhase = 'IDLE';

  // Configuración de la partida
  private betAmount = 50;
  private mineCount = 3;
  private currentMultiplier = 1.00;
  private gemsFound = 0;

  // Estado del tablero (25 casillas)
  private tiles: TileData[] = [];
  private mineIndices: Set<number> = new Set();

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
    this.buildGridDOM();
    this.bindEvents();
    this.updateWalletUI();
    this.updateLadderUI();
    this.updatePreviewUI();

    // Sincronización entre pestañas
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

  private playGemSound(step: number): void {
    const baseFreq = 480;
    const freq = baseFreq + Math.min(1200, step * 65);
    this.playTone(freq, 'sine', 0.22, 0.18);
    setTimeout(() => {
      this.playTone(freq * 1.25, 'triangle', 0.28, 0.14);
    }, 45);
  }

  private playExplosionSound(): void {
    this.playTone(130, 'sawtooth', 0.45, 0.35);
    setTimeout(() => {
      this.playTone(70, 'square', 0.6, 0.4);
    }, 60);
  }

  private playCashoutSound(): void {
    const chords = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    chords.forEach((note, i) => {
      setTimeout(() => {
        this.playTone(note, 'sine', 0.35, 0.2);
      }, i * 75);
    });
  }

  /* ================== MATEMÁTICA Y PROBABILIDADES ================== */
  /**
   * Cálculo matemático riguroso según combinatoria de casino.
   * Multiplier(k) = RTP * product( (25 - i) / (25 - M - i) )
   */
  private calculateMultiplier(step: number, mines = this.mineCount): number {
    if (step <= 0) return 1.00;
    const totalGems = TOTAL_TILES - mines;
    if (step > totalGems) return 0;

    let fairMultiplier = 1.0;
    for (let i = 0; i < step; i++) {
      const pSafe = (totalGems - i) / (TOTAL_TILES - i);
      fairMultiplier /= pSafe;
    }

    const actual = Math.floor(fairMultiplier * HOUSE_RTP * 100) / 100;
    return Math.max(1.01, actual);
  }

  /* ================== CONSTRUCCIÓN DEL TABLERO ================== */
  private buildGridDOM(): void {
    const gridEl = document.getElementById('minesGrid');
    if (!gridEl) return;
    gridEl.innerHTML = '';
    this.tiles = [];

    for (let i = 0; i < TOTAL_TILES; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tile-cell';
      btn.setAttribute('data-index', String(i));
      btn.disabled = true;

      btn.innerHTML = `
        <div class="tile-front"></div>
        <div class="tile-back"></div>
      `;

      btn.addEventListener('click', () => {
        this.handleTileClick(i);
      });

      gridEl.appendChild(btn);
      this.tiles.push({
        index: i,
        isMine: false,
        isRevealed: false,
        element: btn
      });
    }
  }

  private updatePreviewUI(): void {
    const nextMult = this.calculateMultiplier(this.gemsFound + 1);
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

    // Encabezado de gemas
    const gemStat = document.getElementById('statGemsCount');
    const mineStat = document.getElementById('statMinesCount');
    const totalGems = TOTAL_TILES - this.mineCount;

    if (gemStat) gemStat.textContent = `${this.gemsFound} / ${totalGems}`;
    if (mineStat) mineStat.textContent = `${this.mineCount}`;
    this.updateDifficultyBadge();
  }

  private updateDifficultyBadge(): void {
    const badge = document.getElementById('minesDifficultyBadge');
    if (!badge) return;
    const labels: Record<number, string> = {
      3: '3 Minas (Bajo)',
      4: '4 Minas (Medio)',
      5: '5 Minas (Balanceado)',
      6: '6 Minas (Alto)',
      7: '7 Minas (Extremo)'
    };
    badge.textContent = labels[this.mineCount] || `${this.mineCount} Minas`;
  }

  private updateLadderUI(): void {
    const list = document.getElementById('ladderList');
    if (!list) return;
    list.innerHTML = '';

    const totalGems = TOTAL_TILES - this.mineCount;
    const maxSteps = Math.min(10, totalGems);

    for (let step = 1; step <= maxSteps; step++) {
      const mult = this.calculateMultiplier(step);
      const row = document.createElement('div');
      row.className = 'ladder-item';
      if (step === this.gemsFound) row.classList.add('active');
      else if (step === this.gemsFound + 1) row.classList.add('next');

      row.innerHTML = `
        <span>Acierto #${step}</span>
        <span style="font-family:'Courier New',monospace;">x${mult.toFixed(2)}</span>
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
    this.gemsFound = 0;
    this.currentMultiplier = 1.00;
    this.totalGames++;
    this.updateStatsUI();

    // Generar ubicación aleatoria de minas (RNG seguro del cliente)
    this.mineIndices.clear();
    while (this.mineIndices.size < this.mineCount) {
      const idx = Math.floor(Math.random() * TOTAL_TILES);
      this.mineIndices.add(idx);
    }

    // Resetear casillas en el DOM
    this.tiles.forEach(t => {
      t.isMine = this.mineIndices.has(t.index);
      t.isRevealed = false;
      t.element.className = 'tile-cell';
      t.element.disabled = false;
      const back = t.element.querySelector('.tile-back');
      if (back) {
        back.className = 'tile-back';
        back.innerHTML = '';
      }
    });

    this.hideResultModal();
    this.setControlsDisabled(true);
    this.updateActionButtons();
    this.updateLadderUI();
    this.updatePreviewUI();
    this.setTicker('🎮 ¡Misión iniciada! Toca casillas para descubrir Gemas Cyber.', false);
    this.playTone(400, 'sine', 0.15);
  }

  private handleTileClick(index: number): void {
    if (this.phase !== 'PLAYING') return;
    const tile = this.tiles[index];
    if (!tile || tile.isRevealed) return;

    // MODO CREADOR: Regla invertida a favor del usuario.
    // Si la casilla elegida es una mina, con un 85% de probabilidad se reubica la mina a otra casilla no revelada
    // para que el jugador obtenga una Gema Cyber y avance multiplicadores masivos fácilmente.
    if (tile.isMine && Math.random() < 0.85) {
      const safeTile = this.tiles.find(t => !t.isRevealed && !t.isMine && t.index !== index);
      if (safeTile) {
        tile.isMine = false;
        safeTile.isMine = true;
        this.mineIndices.delete(tile.index);
        this.mineIndices.add(safeTile.index);
      }
    }

    tile.isRevealed = true;
    tile.element.disabled = true;
    tile.element.classList.add('revealed');
    const back = tile.element.querySelector('.tile-back') as HTMLElement | null;

    if (tile.isMine) {
      // 💥 MINA EXPLOTADA - DERROTA
      if (back) {
        back.classList.add('is-mine');
        back.innerHTML = this.getMineSVG();
      }
      this.handleGameOver(false);
    } else {
      // 💎 GEMA ENCONTRADA - ÉXITO
      this.gemsFound++;
      this.currentMultiplier = this.calculateMultiplier(this.gemsFound);
      if (back) {
        back.classList.add('is-gem');
        back.innerHTML = this.getGemSVG();
      }

      this.playGemSound(this.gemsFound);
      this.updateLadderUI();
      this.updatePreviewUI();
      this.updateActionButtons();

      const totalGems = TOTAL_TILES - this.mineCount;
      if (this.gemsFound >= totalGems) {
        // Victoria perfecta (todas las gemas encontradas)
        this.cashOut(true);
      } else {
        const potential = Math.floor(this.betAmount * this.currentMultiplier);
        this.setTicker(`💎 ¡Gema asegurada! Cobro actual: +${potential.toLocaleString('en-US')} 💎 (x${this.currentMultiplier.toFixed(2)})`, false);
      }
    }
  }

  private cashOut(isPerfect = false): void {
    if (this.phase !== 'PLAYING' || this.gemsFound <= 0) return;

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
    this.revealAllTiles(true);
    this.showResultModal(true, payout, this.currentMultiplier, isPerfect);

    const msg = isPerfect
      ? `🏆 ¡TABLERO PERFECTO! Descubriste todas las gemas: +${payout.toLocaleString('en-US')} 💎 (x${this.currentMultiplier.toFixed(2)})`
      : `🎉 ¡RETIRO EXITOSO! Cobraste +${payout.toLocaleString('en-US')} 💎 (x${this.currentMultiplier.toFixed(2)})`;

    this.setTicker(msg, true);
    this.addHistoryRow(this.betAmount, this.mineCount, this.gemsFound, this.currentMultiplier, payout, true);
    this.setControlsDisabled(false);
    this.updateActionButtons();
  }

  private handleGameOver(isWin: boolean): void {
    this.phase = 'ENDED';
    this.playExplosionSound();
    this.revealAllTiles(false);
    this.showResultModal(false, 0, this.currentMultiplier);

    this.setTicker(`💥 ¡BOMBA CYBER ACTIVADA! Perdiste ${this.betAmount.toLocaleString('en-US')} 💎.`, false, true);
    this.addHistoryRow(this.betAmount, this.mineCount, this.gemsFound, this.currentMultiplier, 0, false);
    this.setControlsDisabled(false);
    this.updateActionButtons();
  }

  private revealAllTiles(playerWon: boolean): void {
    this.tiles.forEach(t => {
      if (!t.isRevealed) {
        t.isRevealed = true;
        t.element.disabled = true;
        t.element.classList.add('revealed');
        const back = t.element.querySelector('.tile-back') as HTMLElement | null;
        if (back) {
          if (t.isMine) {
            back.classList.add('is-mine');
            if (playerWon) back.classList.add('is-dimmed');
            back.innerHTML = this.getMineSVG();
          } else {
            back.classList.add('is-gem', 'is-dimmed');
            back.innerHTML = this.getGemSVG();
          }
        }
      }
    });
  }

  private autoPickRandomTile(): void {
    if (this.phase !== 'PLAYING') return;
    const unrevealed = this.tiles.filter(t => !t.isRevealed);
    if (unrevealed.length === 0) return;
    const randomTile = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    this.handleTileClick(randomTile.index);
  }

  /* ================== MODAL DE RESULTADO ================== */
  private showResultModal(isWin: boolean, payout: number, mult: number, isPerfect = false): void {
    const modal = document.getElementById('gameResultModal');
    if (!modal) return;
    modal.className = `game-result-modal show ${isWin ? 'winner' : 'loser'}`;

    if (isWin) {
      modal.innerHTML = `
        <div style="font-size:2.2rem;">${isPerfect ? '👑' : '💎'}</div>
        <h2 style="font-size:1.25rem; font-weight:900; color:#00e701;">${isPerfect ? '¡MISIÓN IMPECABLE!' : '¡GANANCIA COBRADA!'}</h2>
        <div style="font-size:1.6rem; font-weight:900; color:#fff; font-family:'Courier New',monospace;">+${payout.toLocaleString('en-US')} 💎</div>
        <div style="font-size:0.82rem; color:var(--accent-gold); font-weight:800;">Multiplicador alcanzado: x${mult.toFixed(2)}</div>
        <div style="font-size:0.72rem; color:#8e9bb0; margin-top:0.25rem;">Aciertos: ${this.gemsFound} Gemas</div>
      `;
    } else {
      modal.innerHTML = `
        <div style="font-size:2.2rem;">💣</div>
        <h2 style="font-size:1.25rem; font-weight:900; color:#ff0055;">¡MINA DETONADA!</h2>
        <div style="font-size:1.1rem; font-weight:800; color:#cbd5e1;">Perdiste ${this.betAmount.toLocaleString('en-US')} 💎</div>
        <div style="font-size:0.75rem; color:#8e9bb0; margin-top:0.25rem;">Descubriste ${this.gemsFound} gemas antes de la detonación.</div>
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
    const mineSelect = document.getElementById('minesSelectDropdown') as HTMLSelectElement | null;
    const btnAutoPick = document.getElementById('btnMinesAutoPick') as HTMLButtonElement | null;

    if (betInput) betInput.disabled = disabled;
    if (mineSelect) mineSelect.disabled = disabled;
    if (btnAutoPick) btnAutoPick.disabled = !disabled; // Auto-pick solo activo durante el juego

    document.querySelectorAll('.btn-mod, .btn-qbet, .btn-qmine').forEach(el => {
      (el as HTMLButtonElement).disabled = disabled;
    });
  }

  private updateActionButtons(): void {
    const btn = document.getElementById('btnMinesAction') as HTMLButtonElement | null;
    const titleEl = document.getElementById('btnMinesActionTitle');
    const subEl = document.getElementById('btnMinesActionSub');
    if (!btn || !titleEl || !subEl) return;

    btn.className = 'btn-mines-main';

    if (this.phase === 'IDLE' || this.phase === 'ENDED') {
      btn.disabled = false;
      btn.classList.add('btn-start');
      titleEl.textContent = '💣 INICIAR MISIÓN';
      subEl.textContent = `${this.betAmount.toLocaleString('en-US')} 💎 (${this.mineCount} Minas)`;
      subEl.style.display = 'block';
    } else if (this.phase === 'PLAYING') {
      btn.disabled = false;
      btn.classList.add('btn-cashout');
      titleEl.textContent = '💰 RETIRAR (CASHOUT)';
      const potential = Math.floor(this.betAmount * this.currentMultiplier);
      subEl.textContent = `+${potential.toLocaleString('en-US')} 💎 (x${this.currentMultiplier.toFixed(2)})`;
      subEl.style.display = 'block';
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
    const bar = document.getElementById('minesTickerBar');
    if (!bar) return;
    bar.innerHTML = `
      <span style="font-weight:${isWin ? '900' : '600'}; color:${isWin ? '#00e701' : isCrash ? '#ff0055' : '#cbd5e1'};">${msg}</span>
      <span style="font-size:0.72rem; color:var(--accent-gold); font-family:'Courier New',monospace;">RTP ~97% &bull; Provably Fair</span>
    `;
  }

  private addHistoryRow(bet: number, mines: number, gems: number, mult: number, payout: number, isWin: boolean): void {
    const list = document.getElementById('minesHistoryList');
    if (!list) return;
    const emptyMsg = list.querySelector('.empty-hist');
    if (emptyMsg) emptyMsg.remove();

    const row = document.createElement('div');
    row.className = 'history-item';
    row.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:1px;">
        <span style="color:#fff; font-weight:800;">${bet} 💎</span>
        <span style="font-size:0.65rem; color:#8e9bb0;">${mines} 💣 &bull; ${gems} 💎</span>
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
    const mineSelect = document.getElementById('minesSelectDropdown') as HTMLSelectElement | null;
    const btnAction = document.getElementById('btnMinesAction');
    const btnAutoPick = document.getElementById('btnMinesAutoPick');
    const btnSound = document.getElementById('btnSoundToggle');

    const btnHalf = document.getElementById('btnBetHalf');
    const btnDouble = document.getElementById('btnBetDouble');
    const btnMax = document.getElementById('btnBetMax');

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

    // Selector de minas (mínimo 3, máximo 7)
    mineSelect?.addEventListener('change', () => {
      if (this.phase === 'PLAYING') return;
      this.mineCount = Math.max(3, Math.min(7, Number(mineSelect.value) || 3));
      document.querySelectorAll('.btn-qmine').forEach(b => {
        const mv = Number(b.getAttribute('data-mines'));
        b.classList.toggle('active', mv === this.mineCount);
      });
      this.updateLadderUI();
      this.updatePreviewUI();
      this.updateActionButtons();
    });

    // Botones rápidos de minas (3, 4, 5, 6, 7)
    document.querySelectorAll('.btn-qmine').forEach(b => {
      b.addEventListener('click', () => {
        if (this.phase === 'PLAYING') return;
        const mv = Math.max(3, Math.min(7, Number(b.getAttribute('data-mines')) || 3));
        this.mineCount = mv;
        if (mineSelect) mineSelect.value = String(mv);
        document.querySelectorAll('.btn-qmine').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        this.updateLadderUI();
        this.updatePreviewUI();
        this.updateActionButtons();
      });
    });

    // Botón de acción principal (Apuesta o Retiro)
    const handleActionClick = (e?: Event) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (this.phase === 'IDLE' || this.phase === 'ENDED') {
        this.startNewGame();
      } else if (this.phase === 'PLAYING') {
        this.cashOut();
      }
    };

    btnAction?.addEventListener('pointerdown', (e) => {
      if (this.phase === 'PLAYING') {
        handleActionClick(e);
      }
    });

    btnAction?.addEventListener('touchstart', (e) => {
      if (this.phase === 'PLAYING') {
        handleActionClick(e);
      }
    }, { passive: false });

    btnAction?.addEventListener('click', (e) => {
      handleActionClick(e);
    });

    // Auto-Pick
    btnAutoPick?.addEventListener('click', () => {
      this.autoPickRandomTile();
    });

    // Sonido
    btnSound?.addEventListener('click', () => {
      this.soundEnabled = !this.soundEnabled;
      btnSound.textContent = this.soundEnabled ? '🔊' : '🔇';
      btnSound.title = this.soundEnabled ? 'Silenciar Efectos' : 'Activar Efectos';
    });

    // Atajo barra espaciadora
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement !== betInput && document.activeElement !== mineSelect) {
        e.preventDefault();
        handleActionClick();
      }
    });
  }

  /* ================== GRÁFICOS VECTORIALES HD ================== */
  private getGemSVG(): string {
    return `
      <svg class="gem-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="50,6 88,28 88,72 50,94 12,72 12,28" fill="url(#gemGradCore)" stroke="#00e701" stroke-width="3"/>
        <polygon points="50,6 88,28 50,48 12,28" fill="#a7f3d0" fill-opacity="0.55"/>
        <polygon points="12,28 50,48 50,94 12,72" fill="#059669" fill-opacity="0.8"/>
        <polygon points="88,28 50,48 50,94 88,72" fill="#10b981" fill-opacity="0.9"/>
        <circle cx="50" cy="48" r="8" fill="#ffffff" fill-opacity="0.85" filter="drop-shadow(0 0 6px #fff)"/>
        <defs>
          <linearGradient id="gemGradCore" x1="12" y1="6" x2="88" y2="94" gradientUnits="userSpaceOnUse">
            <stop stop-color="#34d399"/>
            <stop offset="0.5" stop-color="#059669"/>
            <stop offset="1" stop-color="#022c22"/>
          </linearGradient>
        </defs>
      </svg>
    `;
  }

  private getMineSVG(): string {
    return `
      <svg class="mine-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="28" fill="url(#mineGradCore)" stroke="#ff0055" stroke-width="3"/>
        <line x1="50" y1="10" x2="50" y2="22" stroke="#ff0055" stroke-width="4" stroke-linecap="round"/>
        <line x1="50" y1="78" x2="50" y2="90" stroke="#ff0055" stroke-width="4" stroke-linecap="round"/>
        <line x1="10" y1="50" x2="22" y2="50" stroke="#ff0055" stroke-width="4" stroke-linecap="round"/>
        <line x1="78" y1="50" x2="90" y2="50" stroke="#ff0055" stroke-width="4" stroke-linecap="round"/>
        <line x1="22" y1="22" x2="31" y2="31" stroke="#ff0055" stroke-width="4" stroke-linecap="round"/>
        <line x1="69" y1="69" x2="78" y2="78" stroke="#ff0055" stroke-width="4" stroke-linecap="round"/>
        <line x1="22" y1="78" x2="31" y2="69" stroke="#ff0055" stroke-width="4" stroke-linecap="round"/>
        <line x1="69" y1="31" x2="78" y2="22" stroke="#ff0055" stroke-width="4" stroke-linecap="round"/>
        <circle cx="50" cy="50" r="10" fill="#ffffff" filter="drop-shadow(0 0 8px #ff0055)"/>
        <defs>
          <radialGradient id="mineGradCore" cx="50" cy="50" r="28" gradientUnits="userSpaceOnUse">
            <stop stop-color="#ff0055"/>
            <stop offset="0.6" stop-color="#880026"/>
            <stop offset="1" stop-color="#30000a"/>
          </radialGradient>
        </defs>
      </svg>
    `;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new CyberMinesGame();
});
