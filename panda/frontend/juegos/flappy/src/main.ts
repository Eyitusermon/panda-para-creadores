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

type StepGameState = 'IDLE' | 'MOVING' | 'DECISION' | 'CASHED_OUT' | 'CRASHED';
type DifficultyKey = 'easy' | 'medium' | 'hard' | 'extreme';

interface DifficultyConfig {
  label: string;
  basePassProb: number;
  stepPenalty: number;
  minPassProb: number;
  multipliers: number[];
}

interface StepPipe {
  step: number;
  x: number;
  width: number;
  gapY: number;
  gapH: number;
  multiplier: number;
  status: 'pending' | 'active' | 'passed' | 'crashed';
  gemCollected: boolean;
  closeAmount: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
  twinklePhase: number;
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

interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  alpha: number;
}

const STORAGE_KEY = 'panda_user_session';
const DIAMOND_RATE = 10;
const TOTAL_STEPS = 10;
const GROUND_HEIGHT = 50;
const TILE_SPACING = 230;
const START_PAD_X = 120;
const STEP_DURATION_SEC = 0.62;
const VIEW_W = 760;
const VIEW_H = 540;

const DIFFICULTIES: Record<DifficultyKey, DifficultyConfig> = {
  easy: {
    label: 'Fácil',
    basePassProb: 0.95,
    stepPenalty: 0,
    minPassProb: 0.95,
    multipliers: [1.17, 1.42, 1.73, 2.11, 2.58, 3.15, 3.84, 4.68, 5.70, 7.00]
  },
  medium: {
    label: 'Medio',
    basePassProb: 0.92,
    stepPenalty: 0,
    minPassProb: 0.92,
    multipliers: [1.33, 1.85, 2.56, 3.56, 4.95, 6.88, 9.55, 13.25, 18.40, 25.50]
  },
  hard: {
    label: 'Difícil',
    basePassProb: 0.88,
    stepPenalty: 0,
    minPassProb: 0.88,
    multipliers: [1.60, 2.65, 4.42, 7.35, 12.25, 20.40, 34.00, 56.50, 94.00, 155.00]
  },
  extreme: {
    label: 'Extremo',
    basePassProb: 0.84,
    stepPenalty: 0,
    minPassProb: 0.84,
    multipliers: [1.92, 3.84, 7.68, 15.30, 30.50, 61.00, 122.00, 240.00, 380.00, 500.00]
  }
};

class FlappyPandaGame {
  private userState: UserSession;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private state: StepGameState = 'IDLE';
  private difficulty: DifficultyKey = 'medium';

  private betAmount = 50;
  private currentStep = 0; // 0 = inicio, 1..10 = casillas completadas
  private currentMultiplier = 1.00;
  private cashoutPayout = 0;

  private isAutoCashoutEnabled = false;
  private autoCashoutTarget = 2.00;

  // Coordenadas mundiales y cámara
  private birdX = START_PAD_X;
  private birdY = 230;
  private birdRot = 0;
  private cameraX = 0;
  private wingPhase = 0;

  // Animación de casilla en curso
  private moveFromX = START_PAD_X;
  private moveFromY = 230;
  private moveTargetStep = 1;
  private moveWillPass = true;
  private moveCrashTop = true;
  private moveElapsed = 0;
  private crashTriggered = false;
  private crashDropVy = 0;

  // Escenario
  private pipes: StepPipe[] = [];
  private stars: Star[] = [];
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private screenShake = 0;
  private idleTime = 0;

  // Estadísticas de sesión
  private totalRounds = 0;
  private totalDiamondsWon = 0;
  private bestMultiplier = 0;

  // Audio
  private soundEnabled = true;
  private audioCtx: AudioContext | null = null;

  private lastFrameTime = performance.now();

  constructor() {
    this.userState = this.loadSession();
    const canvasEl = document.getElementById('flappyCanvas') as HTMLCanvasElement | null;
    if (!canvasEl) throw new Error('Canvas #flappyCanvas no encontrado');
    this.canvas = canvasEl;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('No se pudo inicializar Canvas 2D');
    this.ctx = context;

    this.initStars();
    this.buildCourse();
    this.bindEvents();
    this.updateWalletUI();
    try {
      (window as any).pandaFetchAndSyncProfile?.(this.userState, (updated: any) => {
        this.userState = { ...this.userState, ...updated };
        this.updateWalletUI();
      });
    } catch (_) {}
    this.updateLadderUI();
    this.updateControlsUI();

    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          this.userState = { ...this.userState, ...JSON.parse(e.newValue) };
          this.updateWalletUI();
        } catch (_) {}
      }
    });

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

  private standX(stepIndex: number): number {
    return START_PAD_X + stepIndex * TILE_SPACING;
  }

  private pipeX(stepNumber: number): number {
    // Cada pareja de tubos k (1..10) se ubica justo delante de la posición de espera k-1
    return this.standX(stepNumber - 1) + 122;
  }

  private initStars(): void {
    this.stars = [];
    for (let i = 0; i < 65; i++) {
      this.stars.push({
        x: Math.random() * VIEW_W,
        y: Math.random() * (VIEW_H - GROUND_HEIGHT) * 0.72,
        size: 0.9 + Math.random() * 1.9,
        alpha: 0.3 + Math.random() * 0.65,
        twinklePhase: Math.random() * Math.PI * 2
      });
    }
  }

  private buildCourse(): void {
    const cfg = DIFFICULTIES[this.difficulty];
    const playH = VIEW_H - GROUND_HEIGHT;
    const baseGapH = this.difficulty === 'easy'
      ? 162
      : this.difficulty === 'medium'
        ? 144
        : this.difficulty === 'hard'
          ? 126
          : 112;

    this.pipes = [];
    for (let k = 1; k <= TOTAL_STEPS; k++) {
      const minCenter = 95 + baseGapH / 2;
      const maxCenter = playH - 95 - baseGapH / 2;
      const center = minCenter + ((Math.sin(k * 1.37 + 0.4) * 0.5 + 0.5) * (maxCenter - minCenter));
      this.pipes.push({
        step: k,
        x: this.pipeX(k),
        width: 68,
        gapY: center,
        gapH: baseGapH,
        multiplier: cfg.multipliers[k - 1],
        status: k === 1 ? 'active' : 'pending',
        gemCollected: false,
        closeAmount: 0
      });
    }

    this.currentStep = 0;
    this.currentMultiplier = 1.00;
    this.cashoutPayout = 0;
    this.birdX = this.standX(0);
    this.birdY = this.pipes[0].gapY;
    this.birdRot = 0;
    this.cameraX = this.birdX - 180;
    this.particles = [];
    this.floatingTexts = [];
    this.screenShake = 0;
  }

  private ensureAudio(): void {
    if (!this.soundEnabled) return;
    if (!this.audioCtx) {
      const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtor) this.audioCtx = new AudioCtor();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  private playTone(freq: number, endFreq: number, dur: number, type: OscillatorType, vol = 0.05): void {
    if (!this.soundEnabled) return;
    this.ensureAudio();
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + dur);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + dur);
  }

  private playFlapSound(): void {
    this.playTone(340, 560, 0.11, 'sine', 0.055);
  }

  private playStepPassSound(step: number): void {
    const base = 540 + step * 48;
    this.playTone(base, base * 1.35, 0.16, 'triangle', 0.07);
  }

  private playCashoutSound(): void {
    if (!this.soundEnabled) return;
    this.ensureAudio();
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      if (!this.audioCtx) return;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      const t0 = now + i * 0.06;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.07, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.24);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.24);
    });
  }

  private playCrashSound(): void {
    this.playTone(210, 48, 0.34, 'sawtooth', 0.09);
  }

  private spawnParticles(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 45 + Math.random() * 175;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        alpha: 1,
        color,
        radius: 2 + Math.random() * 3.5
      });
    }
  }

  private addFloatText(x: number, y: number, text: string, color: string): void {
    this.floatingTexts.push({
      x,
      y,
      vy: -36,
      text,
      color,
      alpha: 1
    });
  }

  public startRound(): void {
    if (this.state === 'MOVING' || this.state === 'DECISION') return;

    const betInput = document.getElementById('betAmountInput') as HTMLInputElement | null;
    const rawBet = betInput ? parseFloat(betInput.value) : 50;
    const cleanBet = Math.max(10, Math.round(rawBet || 0));

    if (cleanBet > this.userState.balance) {
      if (typeof (window as any).showInsufficientBalanceAlert === 'function') {
        (window as any).showInsufficientBalanceAlert(cleanBet, this.userState.balance);
      } else {
        this.setTicker(`Saldo insuficiente. Necesitas ${cleanBet} 💎 para iniciar.`, true);
      }
      return;
    }

    const autoInput = document.getElementById('autoCashoutMultInput') as HTMLInputElement | null;
    if (autoInput) {
      this.autoCashoutTarget = Math.max(1.10, Math.min(500, parseFloat(autoInput.value) || 2.00));
    }

    this.betAmount = cleanBet;
    this.userState.balance = Math.max(0, this.userState.balance - this.betAmount);
    this.userState.weeklySpent = (this.userState.weeklySpent || 0) + this.betAmount;
    this.userState.xp = (this.userState.xp || 0) + Math.max(1, Math.floor(this.betAmount / 10));
    this.saveSession();

    this.buildCourse();
    this.launchNextStep();
  }

  public advanceStep(): void {
    if (this.state !== 'DECISION') return;
    if (this.currentStep >= TOTAL_STEPS) return;
    this.launchNextStep();
  }

  private calcStepPassProbability(step: number): number {
    // MODO CREADOR: alta probabilidad para rachas fluidas y clips en stream
    if (step === 1) return 0.96;
    return DIFFICULTIES[this.difficulty].basePassProb;
  }

  private launchNextStep(): void {
    const cfg = DIFFICULTIES[this.difficulty];
    const nextStep = this.currentStep + 1;
    if (nextStep > TOTAL_STEPS) return;

    this.pipes.forEach(p => {
      if (p.step === nextStep) p.status = 'active';
    });

    this.moveFromX = this.birdX;
    this.moveFromY = this.birdY;
    this.moveTargetStep = nextStep;
    this.moveWillPass = Math.random() < this.calcStepPassProbability(nextStep);
    this.moveCrashTop = Math.random() < 0.5;
    this.moveElapsed = 0;
    this.crashTriggered = false;
    this.crashDropVy = 0;

    this.state = 'MOVING';
    this.playFlapSound();
    this.spawnParticles(this.birdX - 10, this.birdY + 6, '#00f0ff', 7);

    this.setTicker(`Volando hacia la Casilla ${nextStep}/10 (x${cfg.multipliers[nextStep - 1].toFixed(2)})...`, false);
    this.updateLadderUI();
    this.updateControlsUI();
  }

  public cashOut(isAuto = false): void {
    if (this.state !== 'DECISION' || this.currentStep < 1) return;

    this.state = 'CASHED_OUT';
    this.cashoutPayout = Math.max(1, Math.round(this.betAmount * this.currentMultiplier));
    this.userState.balance += this.cashoutPayout;
    this.saveSession();

    this.totalRounds += 1;
    this.totalDiamondsWon += this.cashoutPayout;
    if (this.currentMultiplier > this.bestMultiplier) {
      this.bestMultiplier = this.currentMultiplier;
    }

    this.playCashoutSound();
    this.spawnParticles(this.birdX, this.birdY, '#00e701', 26);

    const tag = this.currentStep >= TOTAL_STEPS
      ? '¡JACKPOT 10/10!'
      : isAuto
        ? 'Auto-Retiro'
        : 'Cashout';
    this.setTicker(
      `¡${tag} en Casilla ${this.currentStep}/10 (x${this.currentMultiplier.toFixed(2)})! Ganaste +${this.cashoutPayout.toLocaleString('en-US')} 💎`,
      false,
      'winner'
    );
    this.addHistoryRow(this.betAmount, this.currentStep, this.currentMultiplier, this.cashoutPayout, true);
    this.updateStatsUI();
    this.updateLadderUI();
    this.updateControlsUI();
  }

  private finishStepSuccess(pipe: StepPipe): void {
    this.currentStep = pipe.step;
    this.currentMultiplier = pipe.multiplier;
    pipe.status = 'passed';
    pipe.gemCollected = true;

    this.birdX = this.standX(this.currentStep);
    const nextPipe = this.pipes[this.currentStep];
    this.birdY = nextPipe ? nextPipe.gapY : pipe.gapY;
    this.birdRot = 0;

    this.playStepPassSound(this.currentStep);
    this.spawnParticles(pipe.x, pipe.gapY, '#ffb700', 14);
    this.addFloatText(pipe.x, pipe.gapY - 22, `x${pipe.multiplier.toFixed(2)} ✓`, '#00e701');

    if (this.currentStep >= TOTAL_STEPS) {
      this.state = 'DECISION';
      this.cashOut(false);
      return;
    }

    if (this.isAutoCashoutEnabled && this.currentMultiplier >= this.autoCashoutTarget) {
      this.state = 'DECISION';
      this.cashOut(true);
      return;
    }

    this.state = 'DECISION';
    const nextMult = DIFFICULTIES[this.difficulty].multipliers[this.currentStep];
    const currentWin = Math.round(this.betAmount * this.currentMultiplier);
    this.setTicker(
      `¡Casilla ${this.currentStep}/10 superada! Tienes ${currentWin.toLocaleString('en-US')} 💎. ¿Hacer Cashout o ir por x${nextMult.toFixed(2)}?`,
      false
    );
    this.updateLadderUI();
    this.updateControlsUI();
  }

  private finishStepCrash(): void {
    this.state = 'CRASHED';
    this.totalRounds += 1;
    this.addHistoryRow(this.betAmount, this.currentStep, this.currentMultiplier, 0, false);
    this.updateStatsUI();
    this.updateLadderUI();
    this.setTicker(
      `💥 Choque en Casilla ${this.moveTargetStep}/10. Apuesta perdida: ${this.betAmount.toLocaleString('en-US')} 💎.`,
      true,
      'crashed'
    );
    this.updateControlsUI();
  }

  private step(dt: number): void {
    this.idleTime += dt;
    this.wingPhase += dt * (this.state === 'MOVING' ? 20 : 10);

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - 28 * dt);
    }

    // Actualizar partículas y textos flotantes
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 240 * dt;
      p.alpha -= dt * 1.65;
      if (p.alpha <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.alpha -= dt * 1.05;
      if (ft.alpha <= 0) this.floatingTexts.splice(i, 1);
    }

    if (this.state === 'IDLE' || this.state === 'DECISION' || this.state === 'CASHED_OUT') {
      const anchorPipe = this.pipes[Math.min(this.currentStep, TOTAL_STEPS - 1)];
      const baseHoverY = anchorPipe ? anchorPipe.gapY : 230;
      this.birdY = baseHoverY + Math.sin(this.idleTime * 4.5) * 6;
      this.birdRot = Math.sin(this.idleTime * 4.5) * 0.06;

      const targetCamX = this.birdX - 205;
      this.cameraX += (targetCamX - this.cameraX) * Math.min(1, dt * 8);
      return;
    }

    if (this.state === 'MOVING') {
      const targetPipe = this.pipes[this.moveTargetStep - 1];
      if (!targetPipe) return;

      if (this.moveWillPass) {
        this.moveElapsed += dt;
        const t = Math.min(1, this.moveElapsed / STEP_DURATION_SEC);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        const destX = this.standX(this.moveTargetStep);
        const nextPipe = this.pipes[this.moveTargetStep];
        const destY = nextPipe ? nextPipe.gapY : targetPipe.gapY;

        this.birdX = this.moveFromX + (destX - this.moveFromX) * ease;
        // Cruzar suavemente por el hueco del tubo actual en la mitad del trayecto
        const midPull = Math.sin(t * Math.PI);
        const linearY = this.moveFromY + (destY - this.moveFromY) * ease;
        this.birdY = linearY * (1 - 0.55 * midPull) + targetPipe.gapY * (0.55 * midPull) - Math.sin(t * Math.PI) * 14;
        this.birdRot = Math.sin(t * Math.PI * 2) * 0.14;

        if (!targetPipe.gemCollected && this.birdX >= targetPipe.x) {
          targetPipe.gemCollected = true;
          this.spawnParticles(targetPipe.x, targetPipe.gapY, '#00e701', 10);
        }

        const targetCamX = this.birdX - 205;
        this.cameraX += (targetCamX - this.cameraX) * Math.min(1, dt * 9);

        if (t >= 1) {
          this.finishStepSuccess(targetPipe);
        }
      } else {
        // Trayectoria de choque contra los tubos
        this.moveElapsed += dt;
        const impactTime = 0.36;
        if (!this.crashTriggered) {
          const t = Math.min(1, this.moveElapsed / impactTime);
          const hitX = targetPipe.x - targetPipe.width * 0.35;
          const hitY = this.moveCrashTop
            ? targetPipe.gapY - targetPipe.gapH / 2 + 12
            : targetPipe.gapY + targetPipe.gapH / 2 - 12;

          this.birdX = this.moveFromX + (hitX - this.moveFromX) * t;
          this.birdY = this.moveFromY + (hitY - this.moveFromY) * t;
          this.birdRot = (this.moveCrashTop ? -0.35 : 0.35) * t;
          targetPipe.closeAmount = t * 18;

          const targetCamX = this.birdX - 205;
          this.cameraX += (targetCamX - this.cameraX) * Math.min(1, dt * 9);

          if (t >= 1) {
            this.crashTriggered = true;
            this.crashDropVy = -90;
            targetPipe.status = 'crashed';
            this.screenShake = 12;
            this.playCrashSound();
            this.spawnParticles(this.birdX, this.birdY, '#ff0055', 26);
            this.addFloatText(this.birdX, this.birdY - 14, '💥 ¡CHOQUE!', '#ff4d7a');
            this.finishStepCrash();
          }
        }
      }
      return;
    }

    if (this.state === 'CRASHED') {
      const groundY = VIEW_H - GROUND_HEIGHT - 16;
      if (this.birdY < groundY) {
        this.crashDropVy += 920 * dt;
        this.birdY = Math.min(groundY, this.birdY + this.crashDropVy * dt);
        this.birdRot = Math.min(Math.PI / 2, this.birdRot + 5.5 * dt);
      }
    }
  }

  private render(): void {
    const ctx = this.ctx;
    const playH = VIEW_H - GROUND_HEIGHT;

    ctx.save();
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    if (this.screenShake > 0) {
      ctx.translate((Math.random() - 0.5) * this.screenShake, (Math.random() - 0.5) * this.screenShake);
    }

    // 1. Cielo nocturno
    const sky = ctx.createLinearGradient(0, 0, 0, playH);
    sky.addColorStop(0, '#040814');
    sky.addColorStop(0.6, '#091428');
    sky.addColorStop(1, '#0c1d35');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_W, playH);

    // 2. Estrellas
    for (const s of this.stars) {
      const twinkle = 0.55 + 0.45 * Math.sin(this.idleTime * 2.5 + s.twinklePhase);
      ctx.fillStyle = `rgba(220, 240, 255, ${s.alpha * twinkle})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Silueta ciudad parallax
    const cityScroll = (this.cameraX * 0.25) % 42;
    ctx.fillStyle = 'rgba(13, 25, 48, 0.9)';
    for (let bx = -cityScroll - 42; bx < VIEW_W + 42; bx += 42) {
      const idx = Math.round((bx + cityScroll) / 42);
      const bh = 42 + Math.abs(Math.sin(idx * 2.13)) * 88;
      ctx.fillRect(bx, playH - bh, 36, bh);
    }

    // Transformar al mundo horizontal
    ctx.save();
    ctx.translate(-this.cameraX, 0);

    // 4. Plataformas de espera (casillas 0..10) y línea de meta
    for (let i = 0; i <= TOTAL_STEPS; i++) {
      const sx = this.standX(i);
      if (sx < this.cameraX - 100 || sx > this.cameraX + VIEW_W + 100) continue;

      ctx.save();
      const isDone = i <= this.currentStep && i > 0;
      ctx.strokeStyle = isDone ? 'rgba(0, 231, 1, 0.45)' : 'rgba(0, 240, 255, 0.22)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(sx, 36);
      ctx.lineTo(sx, playH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Etiqueta de plataforma en suelo
      ctx.fillStyle = i === TOTAL_STEPS ? '#ffb700' : isDone ? '#00e701' : '#8e9bb0';
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(i === 0 ? 'INICIO' : i === TOTAL_STEPS ? '🏆 META 10' : `CASILLA ${i}`, sx, playH - 8);
      ctx.restore();
    }

    // 5. Los 10 pares de tubos neón
    for (const p of this.pipes) {
      if (p.x + p.width < this.cameraX - 80 || p.x - p.width > this.cameraX + VIEW_W + 80) continue;
      this.drawPipePair(p, playH);
    }

    // 6. Partículas y textos flotantes
    for (const pt of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.alpha);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = '900 15px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 7. Panda-Pájaro
    this.drawPandaBird();

    ctx.restore(); // fin transformación mundo

    // 8. Suelo fijo con banda neón en movimiento
    ctx.fillStyle = '#060c1a';
    ctx.fillRect(0, playH, VIEW_W, GROUND_HEIGHT);
    ctx.fillStyle = '#00e701';
    ctx.fillRect(0, playH, VIEW_W, 3);
    ctx.fillStyle = 'rgba(0, 231, 1, 0.14)';
    const stripeOff = ((this.cameraX % 32) + 32) % 32;
    for (let gx = -stripeOff; gx < VIEW_W + 32; gx += 32) {
      ctx.fillRect(gx, playH + 3, 14, 7);
    }

    // 9. Marcador superior de casilla / multiplicador en vivo
    if (this.state === 'MOVING' || this.state === 'DECISION') {
      const pot = Math.round(this.betAmount * this.currentMultiplier);
      ctx.save();
      ctx.fillStyle = 'rgba(6, 11, 24, 0.8)';
      ctx.strokeStyle = this.currentStep > 0 ? 'rgba(0, 231, 1, 0.55)' : 'rgba(0, 240, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(14, 14, 215, 50, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = this.currentStep > 0 ? '#00e701' : '#00f0ff';
      ctx.font = '900 18px "Courier New", monospace';
      ctx.fillText(`Casilla ${this.currentStep}/10 • x${this.currentMultiplier.toFixed(2)}`, 24, 36);

      ctx.fillStyle = '#ffb700';
      ctx.font = 'bold 12px "Segoe UI", sans-serif';
      ctx.fillText(
        this.currentStep > 0 ? `Acumulado: ${pot.toLocaleString('en-US')} 💎` : `Apuesta en juego: ${this.betAmount.toLocaleString('en-US')} 💎`,
        24,
        55
      );
      ctx.restore();
    }

    ctx.restore();
  }

  private drawPipePair(p: StepPipe, playH: number): void {
    const ctx = this.ctx;
    const x = p.x - p.width / 2;
    const halfGap = Math.max(26, p.gapH / 2 - p.closeAmount);
    const topH = Math.max(24, p.gapY - halfGap);
    const botY = Math.min(playH - 24, p.gapY + halfGap);
    const botH = playH - botY;

    const borderColor = p.status === 'passed'
      ? '#00e701'
      : p.status === 'crashed'
        ? '#ff0055'
        : p.status === 'active'
          ? '#ffb700'
          : '#00c6ff';

    const bodyGrad = ctx.createLinearGradient(x, 0, x + p.width, 0);
    if (p.status === 'passed') {
      bodyGrad.addColorStop(0, '#093818');
      bodyGrad.addColorStop(0.5, '#135c2b');
      bodyGrad.addColorStop(1, '#072711');
    } else if (p.status === 'crashed') {
      bodyGrad.addColorStop(0, '#440919');
      bodyGrad.addColorStop(0.5, '#6e1029');
      bodyGrad.addColorStop(1, '#2b0510');
    } else {
      bodyGrad.addColorStop(0, '#0d1b36');
      bodyGrad.addColorStop(0.5, '#1b3563');
      bodyGrad.addColorStop(1, '#0b152b');
    }

    // Tubo superior
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.fillRect(x, 0, p.width, topH - 18);
    ctx.strokeRect(x, 0, p.width, topH - 18);
    ctx.fillRect(x - 5, topH - 18, p.width + 10, 18);
    ctx.strokeRect(x - 5, topH - 18, p.width + 10, 18);

    // Tubo inferior
    ctx.fillRect(x - 5, botY, p.width + 10, 18);
    ctx.strokeRect(x - 5, botY, p.width + 10, 18);
    ctx.fillRect(x, botY + 18, p.width, Math.max(0, botH - 18));
    ctx.strokeRect(x, botY + 18, p.width, Math.max(0, botH - 18));

    // Placa con el multiplicador sobre la abertura
    const badgeW = 66;
    const badgeH = 22;
    const bx = p.x - badgeW / 2;
    const by = Math.max(8, topH - 46);
    ctx.fillStyle = 'rgba(7, 12, 26, 0.92)';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bx, by, badgeW, badgeH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = borderColor;
    ctx.font = '900 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`x${p.multiplier.toFixed(2)}`, p.x, by + 15);

    // Gema brillante dentro del hueco si aún no se recoge
    if (!p.gemCollected && p.status !== 'crashed') {
      const bob = Math.sin(this.idleTime * 5 + p.step) * 4;
      ctx.save();
      ctx.translate(p.x, p.gapY + bob);
      ctx.fillStyle = p.status === 'active' ? '#ffb700' : 'rgba(0, 240, 255, 0.65)';
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(9, 0);
      ctx.lineTo(0, 10);
      ctx.lineTo(-9, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private drawPandaBird(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.birdX, this.birdY);
    ctx.rotate(this.birdRot);

    const wingLift = Math.sin(this.wingPhase) * 6;

    // Ala
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.ellipse(-6, 4 + wingLift * 0.4, 11, 7, -0.35, 0, Math.PI * 2);
    ctx.fill();

    // Cuerpo blanco del Panda-Pájaro
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#00e701';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Oreja panda y parche
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(-7, -14, 5.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(5, -3, 5.5, 6.8, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Ojo brillante
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(6.5, -3.5, 2.4, 0, Math.PI * 2);
    ctx.fill();

    // Pico dorado
    ctx.fillStyle = '#ffb700';
    ctx.beginPath();
    ctx.moveTo(14, -2);
    ctx.lineTo(24, 3);
    ctx.lineTo(14, 8);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private loop(now: number): void {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastFrameTime) / 1000));
    this.lastFrameTime = now;

    this.step(dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  private updateLadderUI(): void {
    const strip = document.getElementById('flappyLadderStrip');
    if (!strip) return;
    const cfg = DIFFICULTIES[this.difficulty];
    let html = '';
    for (let s = 1; s <= TOTAL_STEPS; s++) {
      const m = cfg.multipliers[s - 1];
      const cls = s <= this.currentStep
        ? 'passed'
        : s === this.currentStep + 1
          ? 'next'
          : '';
      html += `<span class="ladder-pill ${cls}">#${s} x${m.toFixed(2)}</span>`;
    }
    strip.innerHTML = html;
  }

  private setTicker(text: string, isError = false, mood: '' | 'winner' | 'crashed' = ''): void {
    const bar = document.getElementById('flappyTickerBar');
    if (!bar) return;
    bar.className = 'flappy-ticker-bar' + (mood ? ' ' + mood : '');
    const color = isError ? '#ff4d7a' : mood === 'winner' ? '#00e701' : '#cbd5e1';
    bar.innerHTML = `
      <span style="color: ${color};">${text}</span>
      <span style="font-size: 0.72rem; color: var(--accent-gold); font-family: 'Courier New', monospace;">Flappy Panda &bull; ${DIFFICULTIES[this.difficulty].label}</span>
    `;
  }

  private updateControlsUI(): void {
    const busy = this.state === 'MOVING' || this.state === 'DECISION';
    const betInput = document.getElementById('betAmountInput') as HTMLInputElement | null;
    if (betInput) betInput.disabled = busy;
    document.querySelectorAll('.btn-mod, .btn-qbet, .btn-diff').forEach(el => {
      (el as HTMLButtonElement).disabled = busy;
    });

    const mainBtn = document.getElementById('btnFlappyAction') as HTMLButtonElement | null;
    const mainTitle = document.getElementById('btnFlappyMainTitle');
    const mainSub = document.getElementById('btnFlappySubTitle');

    if (mainBtn && mainTitle && mainSub) {
      mainBtn.classList.remove('btn-bet', 'btn-cashout', 'btn-cashed-out', 'btn-crashed');
      delete mainBtn.dataset.mode;

      if (this.state === 'MOVING') {
        mainBtn.disabled = true;
        mainBtn.dataset.mode = 'cashout';
        mainBtn.classList.add('btn-cashout');
        mainTitle.textContent = `🐥 VOLANDO CASILLA ${this.moveTargetStep}/10...`;
        mainSub.style.display = 'none';
      } else if (this.state === 'DECISION') {
        const winAmt = Math.round(this.betAmount * this.currentMultiplier);
        mainBtn.disabled = true;
        mainBtn.dataset.mode = 'cashout';
        mainBtn.classList.add('btn-cashout');
        mainTitle.textContent = `🎯 ELIGE EN EL TABLERO (${this.currentStep}/10)`;
        mainSub.style.display = 'block';
        mainSub.textContent = `Tienes ${winAmt.toLocaleString('en-US')} 💎 (x${this.currentMultiplier.toFixed(2)})`;
      } else if (this.state === 'CASHED_OUT') {
        mainBtn.disabled = false;
        mainBtn.classList.add('btn-cashed-out');
        mainTitle.textContent = '✓ ¡PREMIO COBRADO!';
        mainSub.style.display = 'block';
        mainSub.textContent = `+${this.cashoutPayout.toLocaleString('en-US')} 💎 • CLIC PARA OTRA PARTIDA`;
      } else if (this.state === 'CRASHED') {
        mainBtn.disabled = false;
        mainBtn.classList.add('btn-crashed');
        mainTitle.textContent = '💥 CHOQUE • JUGAR DE NUEVO';
        mainSub.style.display = 'block';
        mainSub.textContent = 'Pulsa para intentar otra partida';
      } else {
        mainBtn.disabled = false;
        mainBtn.dataset.mode = 'bet';
        mainBtn.classList.add('btn-bet');
        mainTitle.textContent = '🐥 INICIAR PARTIDA';
        mainSub.style.display = 'none';
      }
    }

    const overlay = document.getElementById('flappyCanvasOverlay');
    if (overlay) {
      overlay.classList.remove('decision-mode');
      if (this.state === 'MOVING') {
        overlay.style.display = 'none';
      } else if (this.state === 'DECISION') {
        overlay.style.display = 'flex';
        overlay.classList.add('decision-mode');
        const currentWin = Math.round(this.betAmount * this.currentMultiplier);
        const nextStep = this.currentStep + 1;
        const nextMult = DIFFICULTIES[this.difficulty].multipliers[nextStep - 1];

        overlay.innerHTML = `
          <div class="decision-modal-card" id="flappyDecisionModal">
            <div class="decision-top-row">
              <span class="decision-step-badge">✓ Casilla ${this.currentStep}/10 Superada</span>
              <span class="decision-current-info">Asegurado: <strong>x${this.currentMultiplier.toFixed(2)} (${currentWin.toLocaleString('en-US')} 💎)</strong></span>
            </div>
            <div class="decision-actions-grid">
              <button type="button" class="btn-decision-cashout" id="btnModalCashout">
                <span>💰 HACER CASHOUT</span>
                <small>+${currentWin.toLocaleString('en-US')} 💎 ahora</small>
              </button>
              <button type="button" class="btn-decision-advance" id="btnModalContinue">
                <span>🐥 SEGUIR AVANZANDO</span>
                <small>Casilla ${nextStep}/10 • x${nextMult.toFixed(2)}</small>
              </button>
            </div>
          </div>
        `;
      } else {
        overlay.style.display = 'flex';
        if (this.state === 'CASHED_OUT') {
          overlay.innerHTML = `
            <div class="overlay-card win">
              <div class="overlay-title" style="color:#00e701;">🏆 ¡COBRO x${this.currentMultiplier.toFixed(2)}!</div>
              <div class="overlay-sub">Aseguraste <strong style="color:#ffb700;">+${this.cashoutPayout.toLocaleString('en-US')} 💎</strong> en la Casilla ${this.currentStep}/10</div>
              <button type="button" class="overlay-btn" id="btnOverlayPlayAgain">🐥 JUGAR DE NUEVO</button>
            </div>
          `;
        } else if (this.state === 'CRASHED') {
          overlay.innerHTML = `
            <div class="overlay-card crash">
              <div class="overlay-title" style="color:#ff4d7a;">💥 ¡CHOQUE EN TUBOS!</div>
              <div class="overlay-sub">Fallo al intentar la Casilla <strong>${this.moveTargetStep}/10</strong> &bull; Apuesta: ${this.betAmount.toLocaleString('en-US')} 💎</div>
              <button type="button" class="overlay-btn" id="btnOverlayPlayAgain">🔄 JUGAR DE NUEVO</button>
            </div>
          `;
        } else {
          const cfg = DIFFICULTIES[this.difficulty];
          overlay.innerHTML = `
            <div class="overlay-card">
              <div class="overlay-title">🐥 Flappy Panda • 10 Casillas</div>
              <div class="overlay-sub">Avanza entre 10 parejas de tubos (${cfg.label}: hasta <strong>x${cfg.multipliers[9].toFixed(2)}</strong>) y elige en cada casilla si hacer Cashout o seguir.</div>
              <button type="button" class="overlay-btn" id="btnOverlayPlayAgain">▶ INICIAR PARTIDA</button>
            </div>
          `;
        }
      }
    }
  }

  private updateStatsUI(): void {
    const rEl = document.getElementById('statTotalRounds');
    const wEl = document.getElementById('statTotalWon');
    const mEl = document.getElementById('statBestMult');
    if (rEl) rEl.textContent = String(this.totalRounds);
    if (wEl) wEl.textContent = `+${this.totalDiamondsWon.toLocaleString('en-US')} 💎`;
    if (mEl) mEl.textContent = `x${this.bestMultiplier.toFixed(2)}`;
  }

  private addHistoryRow(bet: number, stepReached: number, mult: number, payout: number, isWin: boolean): void {
    const list = document.getElementById('flappyHistoryList');
    if (!list) return;
    const empty = list.querySelector('.empty-hist');
    if (empty) empty.remove();

    const row = document.createElement('div');
    row.className = 'history-item';
    row.style.borderLeft = `3px solid ${isWin ? '#00e701' : '#ff0055'}`;
    row.innerHTML = `
      <div>
        <span style="color:#fff; font-weight:700;">${bet} 💎</span>
        <span style="color:#8e9bb0; margin-left:4px;">(${isWin ? `C${stepReached}/10 • x${mult.toFixed(2)}` : `Choque C${this.moveTargetStep}`})</span>
      </div>
      <span style="color:${isWin ? '#00e701' : '#ff3377'}; font-weight:900; font-family:'Courier New',monospace;">
        ${isWin ? `+${payout} 💎` : '0 💎'}
      </span>
    `;
    list.prepend(row);
    while (list.children.length > 25) {
      list.lastElementChild?.remove();
    }
  }

  private bindEvents(): void {
    const betInput = document.getElementById('betAmountInput') as HTMLInputElement | null;
    const btnHalf = document.getElementById('btnBetHalf');
    const btnDouble = document.getElementById('btnBetDouble');
    const btnMax = document.getElementById('btnBetMax');

    btnHalf?.addEventListener('click', () => {
      if (!betInput) return;
      const v = Math.max(10, Math.floor((parseFloat(betInput.value) || 10) / 2));
      betInput.value = String(v);
    });
    btnDouble?.addEventListener('click', () => {
      if (!betInput) return;
      const cur = parseFloat(betInput.value) || 10;
      betInput.value = String(Math.max(10, Math.min(this.userState.balance, cur * 2)));
    });
    btnMax?.addEventListener('click', () => {
      if (!betInput) return;
      betInput.value = String(Math.max(10, Math.min(5000, this.userState.balance)));
    });

    document.querySelectorAll('.btn-qbet').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (this.state === 'MOVING' || this.state === 'DECISION') return;
        document.querySelectorAll('.btn-qbet').forEach(b => b.classList.remove('active'));
        const el = e.currentTarget as HTMLElement;
        el.classList.add('active');
        const val = el.getAttribute('data-bet');
        if (betInput && val) betInput.value = val;
      });
    });

    document.querySelectorAll('.btn-diff').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (this.state === 'MOVING' || this.state === 'DECISION') return;
        document.querySelectorAll('.btn-diff').forEach(b => b.classList.remove('active'));
        const el = e.currentTarget as HTMLElement;
        el.classList.add('active');
        const d = el.getAttribute('data-diff') as DifficultyKey | null;
        if (d && DIFFICULTIES[d]) {
          this.difficulty = d;
          this.buildCourse();
          this.updateLadderUI();
          this.updateControlsUI();
          this.setTicker(
            `Dificultad ${DIFFICULTIES[d].label}: 10 casillas (desde x${DIFFICULTIES[d].multipliers[0].toFixed(2)} hasta x${DIFFICULTIES[d].multipliers[9].toFixed(2)}).`,
            false
          );
        }
      });
    });

    // Auto-Retiro
    const autoBox = document.getElementById('autoCashoutBox');
    const toggleBtn = document.getElementById('btnToggleAutoCashout');
    const statusBadge = document.getElementById('autoCashoutStatusBadge');
    const autoContainer = document.getElementById('autoInputContainer');
    const autoInput = document.getElementById('autoCashoutMultInput') as HTMLInputElement | null;

    const toggleAuto = () => {
      this.isAutoCashoutEnabled = !this.isAutoCashoutEnabled;
      toggleBtn?.classList.toggle('active', this.isAutoCashoutEnabled);
      autoBox?.classList.toggle('active', this.isAutoCashoutEnabled);
      autoContainer?.classList.toggle('disabled', !this.isAutoCashoutEnabled);
      if (autoInput) autoInput.disabled = !this.isAutoCashoutEnabled;
      if (statusBadge) {
        statusBadge.textContent = this.isAutoCashoutEnabled ? 'ACTIVO' : 'APAGADO';
        statusBadge.className = `toggle-status-badge ${this.isAutoCashoutEnabled ? 'badge-on' : 'badge-off'}`;
      }
      if (autoInput) {
        this.autoCashoutTarget = Math.max(1.10, parseFloat(autoInput.value) || 2.00);
      }
    };

    toggleBtn?.addEventListener('click', toggleAuto);
    statusBadge?.addEventListener('click', toggleAuto);
    autoInput?.addEventListener('change', () => {
      if (!autoInput) return;
      const val = Math.max(1.10, Math.min(500, parseFloat(autoInput.value) || 2.0));
      this.autoCashoutTarget = val;
      autoInput.value = val.toFixed(2);
    });

    document.querySelectorAll('.btn-autopreset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (!this.isAutoCashoutEnabled) toggleAuto();
        document.querySelectorAll('.btn-autopreset').forEach(b => b.classList.remove('active'));
        const el = e.currentTarget as HTMLElement;
        el.classList.add('active');
        const m = parseFloat(el.getAttribute('data-mult') || '2.00');
        this.autoCashoutTarget = m;
        if (autoInput) autoInput.value = m.toFixed(2);
      });
    });

    // Sonido
    const soundBtn = document.getElementById('btnSoundToggle');
    soundBtn?.addEventListener('click', () => {
      this.soundEnabled = !this.soundEnabled;
      soundBtn.textContent = this.soundEnabled ? '🔊' : '🔇';
    });

    // Botón principal izquierda (solo para iniciar o reintentar partida)
    document.getElementById('btnFlappyAction')?.addEventListener('click', () => {
      if (this.state !== 'MOVING' && this.state !== 'DECISION') {
        this.startRound();
      }
    });

    // Botones del overlay (Iniciar / Reintentar + Modal de Decisión: Cashout vs Avanzar)
    document.getElementById('flappyCanvasOverlay')?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('#btnOverlayPlayAgain')) {
        this.startRound();
      } else if (target.closest('#btnModalCashout')) {
        this.cashOut(false);
      } else if (target.closest('#btnModalContinue')) {
        this.advanceStep();
      }
    });

    // Teclado (Espacio / Enter para avanzar o iniciar; C para hacer cashout)
    window.addEventListener('keydown', (e) => {
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      if (e.code === 'Space' || e.code === 'Enter') {
        if (this.state === 'DECISION') {
          e.preventDefault();
          this.advanceStep();
        } else if (this.state === 'IDLE' || this.state === 'CASHED_OUT' || this.state === 'CRASHED') {
          e.preventDefault();
          this.startRound();
        }
      } else if (e.code === 'KeyC') {
        if (this.state === 'DECISION') {
          e.preventDefault();
          this.cashOut(false);
        }
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new FlappyPandaGame();
});
