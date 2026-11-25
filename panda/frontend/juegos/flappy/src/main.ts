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

type FlightState = 'IDLE' | 'READY' | 'FLYING' | 'CASHED_OUT' | 'CRASHED';
type DifficultyKey = 'easy' | 'medium' | 'hard';

interface DifficultyConfig {
  label: string;
  gap: number;
  speed: number;
  spacing: number;
  factor: number;
  oscillateAmp: number;
}

interface Pipe {
  index: number;
  x: number;
  width: number;
  gapY: number;
  baseGapY: number;
  gapH: number;
  phase: number;
  passed: boolean;
  gemCollected: boolean;
  multiplier: number;
}

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
const GROUND_HEIGHT = 48;

const DIFFICULTIES: Record<DifficultyKey, DifficultyConfig> = {
  easy: {
    label: 'Clásico',
    gap: 182,
    speed: 205,
    spacing: 295,
    factor: 1.16,
    oscillateAmp: 0
  },
  medium: {
    label: 'Pro',
    gap: 154,
    speed: 248,
    spacing: 280,
    factor: 1.30,
    oscillateAmp: 0
  },
  hard: {
    label: 'Turbo',
    gap: 134,
    speed: 295,
    spacing: 265,
    factor: 1.52,
    oscillateAmp: 22
  }
};

class FlappyPandaGame {
  private userState: UserSession;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private state: FlightState = 'IDLE';
  private difficulty: DifficultyKey = 'medium';

  private betAmount = 50;
  private currentMultiplier = 1.00;
  private pipesCleared = 0;
  private cashoutPayout = 0;

  private isAutoCashoutEnabled = false;
  private autoCashoutTarget = 2.00;

  // Física del Panda
  private pandaX = 165;
  private pandaY = 235;
  private pandaVy = 0;
  private pandaRadius = 18;
  private wingPhase = 0;
  private flapBurstTimer = 0;

  // Entorno
  private pipes: Pipe[] = [];
  private nextPipeIndex = 1;
  private groundOffset = 0;
  private cityOffset = 0;
  private stars: Star[] = [];
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private screenShake = 0;
  private elapsedIdle = 0;

  // Estadísticas
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
    this.resetWorldForIdle();
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

  private calcMultiplier(diff: DifficultyKey, pipes: number): number {
    if (pipes <= 0) return 1.00;
    const raw = Math.pow(DIFFICULTIES[diff].factor, pipes);
    return Math.min(500.0, Math.round(raw * 100) / 100);
  }

  private initStars(): void {
    const w = this.canvas.width;
    const h = this.canvas.height - GROUND_HEIGHT;
    this.stars = [];
    for (let i = 0; i < 65; i++) {
      this.stars.push({
        x: Math.random() * w,
        y: Math.random() * h * 0.78,
        size: 0.8 + Math.random() * 2.0,
        speed: 14 + Math.random() * 22,
        alpha: 0.25 + Math.random() * 0.75
      });
    }
  }

  private resetWorldForIdle(): void {
    this.pandaX = 165;
    this.pandaY = (this.canvas.height - GROUND_HEIGHT) * 0.46;
    this.pandaVy = 0;
    this.pipes = [];
    this.particles = [];
    this.floatingTexts = [];
    this.nextPipeIndex = 1;
    this.pipesCleared = 0;
    this.currentMultiplier = 1.00;
    this.cashoutPayout = 0;
    this.screenShake = 0;
  }

  private spawnInitialPipes(): void {
    this.pipes = [];
    this.nextPipeIndex = 1;
    const startX = this.canvas.width + 80;
    const cfg = DIFFICULTIES[this.difficulty];
    for (let i = 0; i < 4; i++) {
      this.addPipeAt(startX + i * cfg.spacing);
    }
  }

  private addPipeAt(xPos: number): void {
    const cfg = DIFFICULTIES[this.difficulty];
    const playH = this.canvas.height - GROUND_HEIGHT;
    const minY = 58 + cfg.gap / 2;
    const maxY = playH - 58 - cfg.gap / 2;

    let targetY = minY + Math.random() * (maxY - minY);
    if (this.pipes.length > 0) {
      const prevY = this.pipes[this.pipes.length - 1].baseGapY;
      const clampedMin = Math.max(minY, prevY - 140);
      const clampedMax = Math.min(maxY, prevY + 140);
      targetY = clampedMin + Math.random() * (clampedMax - clampedMin);
    }

    const idx = this.nextPipeIndex++;
    this.pipes.push({
      index: idx,
      x: xPos,
      width: 68,
      gapY: targetY,
      baseGapY: targetY,
      gapH: cfg.gap,
      phase: idx * 0.9,
      passed: false,
      gemCollected: false,
      multiplier: this.calcMultiplier(this.difficulty, idx)
    });
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

  private playFlapSound(): void {
    if (!this.soundEnabled) return;
    this.ensureAudio();
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.08);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  private playPointSound(streak: number): void {
    if (!this.soundEnabled) return;
    this.ensureAudio();
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    const baseFreq = Math.min(1150, 560 + streak * 32);
    [baseFreq, baseFreq * 1.25].forEach((freq, i) => {
      if (!this.audioCtx) return;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.045);
      gain.gain.setValueAtTime(0.1, now + i * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.14);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now + i * 0.045);
      osc.stop(now + i * 0.045 + 0.15);
    });
  }

  private playCashoutSound(): void {
    if (!this.soundEnabled) return;
    this.ensureAudio();
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      if (!this.audioCtx) return;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.11, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.26);
    });
  }

  private playCrashSound(): void {
    if (!this.soundEnabled) return;
    this.ensureAudio();
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.26);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  private spawnParticles(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 190;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 35,
        alpha: 1,
        color,
        radius: 1.8 + Math.random() * 3.2
      });
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

  private startFlightRound(): void {
    const betInput = document.getElementById('betAmountInput') as HTMLInputElement | null;
    const bet = betInput ? Math.floor(parseFloat(betInput.value) || 0) : 0;

    if (bet < 10) {
      this.setTicker('⚠️ La apuesta mínima es de 10 💎 (1 USDT).', false);
      return;
    }
    if (bet > this.userState.balance) {
      this.setTicker('⚠️ Saldo insuficiente de 💎 Diamantes.', false);
      (window as any).showInsufficientBalanceAlert?.(bet, this.userState.balance);
      return;
    }

    this.ensureAudio();
    this.betAmount = bet;
    this.userState.balance -= bet;
    this.userState.xp = (this.userState.xp || 0) + Math.floor(bet / 10);
    this.checkVip();
    this.saveSession();

    this.resetWorldForIdle();
    this.spawnInitialPipes();
    this.state = 'READY';

    this.setTicker(`✈️ Apuesta de ${bet.toLocaleString('en-US')} 💎 lista. Toca la pantalla o pulsa Espacio para despegar.`, false);
    this.updateLadderUI();
    this.updateControlsUI();
  }

  private cancelReadyRound(): void {
    if (this.state !== 'READY') return;
    this.userState.balance += this.betAmount;
    this.saveSession();
    this.state = 'IDLE';
    this.resetWorldForIdle();
    this.setTicker('↩️ Vuelo cancelado. Tu apuesta fue devuelta a tu saldo.', false);
    this.updateLadderUI();
    this.updateControlsUI();
  }

  private flap(): void {
    if (this.state === 'READY') {
      this.state = 'FLYING';
      this.pandaVy = -375;
      this.flapBurstTimer = 0.22;
      this.playFlapSound();
      this.spawnParticles(this.pandaX - 14, this.pandaY + 8, '#00f0ff', 7);
      this.setTicker(`⚡ ¡En el aire! Cruza pilares (${DIFFICULTIES[this.difficulty].label}) y cobra a tiempo.`, false);
      this.updateControlsUI();
      return;
    }

    if (this.state === 'FLYING') {
      this.pandaVy = -375;
      this.flapBurstTimer = 0.2;
      this.playFlapSound();
      this.spawnParticles(this.pandaX - 14, this.pandaY + 8, '#ffb700', 5);
    }
  }

  private cashOut(isAuto = false): void {
    if (this.state !== 'FLYING' || this.pipesCleared < 1) return;

    this.state = 'CASHED_OUT';
    this.cashoutPayout = Math.floor(this.betAmount * this.currentMultiplier);
    this.userState.balance += this.cashoutPayout;
    this.totalRounds++;
    this.totalDiamondsWon += this.cashoutPayout;
    if (this.currentMultiplier > this.bestMultiplier) {
      this.bestMultiplier = this.currentMultiplier;
    }
    this.saveSession();

    this.playCashoutSound();
    this.spawnParticles(this.pandaX, this.pandaY, '#00e701', 28);
    this.spawnParticles(this.pandaX, this.pandaY, '#ffb700', 18);

    const tag = isAuto ? '🎯 ¡AUTO-RETIRO' : '💰 ¡COBRO EXITOSO';
    this.setTicker(
      `${tag} en x${this.currentMultiplier.toFixed(2)}! Ganaste +${this.cashoutPayout.toLocaleString('en-US')} 💎.`,
      true
    );

    this.addHistoryRow(this.betAmount, this.pipesCleared, this.currentMultiplier, this.cashoutPayout, true);
    this.updateStatsUI();
    this.updateControlsUI();
  }

  private crash(): void {
    if (this.state !== 'FLYING') return;
    this.state = 'CRASHED';
    this.screenShake = 0.35;
    this.totalRounds++;
    this.playCrashSound();
    this.spawnParticles(this.pandaX, this.pandaY, '#ff0055', 30);
    this.spawnParticles(this.pandaX, this.pandaY, '#ffb700', 12);

    this.setTicker(
      `💥 ¡COLISIÓN tras ${this.pipesCleared} pilares! Perdiste ${this.betAmount.toLocaleString('en-US')} 💎.`,
      false,
      true
    );

    this.addHistoryRow(this.betAmount, this.pipesCleared, this.currentMultiplier, 0, false);
    this.updateStatsUI();
    this.updateControlsUI();
  }

  private update(dt: number): void {
    const w = this.canvas.width;
    const playH = this.canvas.height - GROUND_HEIGHT;
    const cfg = DIFFICULTIES[this.difficulty];

    // Estrellas ambientales
    for (const s of this.stars) {
      s.x -= s.speed * dt;
      if (s.x < 0) s.x = w;
    }

    // Partículas y textos flotantes
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 320 * dt;
      p.alpha -= 1.45 * dt;
      if (p.alpha <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.alpha -= 1.15 * dt;
      if (ft.alpha <= 0) this.floatingTexts.splice(i, 1);
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt);
    }

    if (this.flapBurstTimer > 0) {
      this.flapBurstTimer = Math.max(0, this.flapBurstTimer - dt);
    }

    if (this.state === 'IDLE' || this.state === 'READY') {
      this.elapsedIdle += dt;
      this.wingPhase += dt * 11;
      this.pandaY = playH * 0.45 + Math.sin(this.elapsedIdle * 3.4) * 11;
      this.groundOffset = (this.groundOffset + cfg.speed * 0.45 * dt) % 48;
      this.cityOffset = (this.cityOffset + cfg.speed * 0.14 * dt) % w;
      return;
    }

    if (this.state !== 'FLYING') {
      return;
    }

    // Física de vuelo
    this.wingPhase += dt * (this.flapBurstTimer > 0 ? 22 : 12);
    this.pandaVy = Math.min(560, this.pandaVy + 1150 * dt);
    this.pandaY += this.pandaVy * dt;

    this.groundOffset = (this.groundOffset + cfg.speed * dt) % 48;
    this.cityOffset = (this.cityOffset + cfg.speed * 0.25 * dt) % w;

    // Límite superior e inferior
    if (this.pandaY - this.pandaRadius <= 4) {
      this.pandaY = 4 + this.pandaRadius;
      this.pandaVy = 60;
    }
    if (this.pandaY + this.pandaRadius >= playH) {
      this.pandaY = playH - this.pandaRadius;
      this.crash();
      return;
    }

    // Mover y verificar tuberías
    const hitR = this.pandaRadius * 0.78;
    for (const p of this.pipes) {
      p.x -= cfg.speed * dt;
      if (cfg.oscillateAmp > 0 && p.index >= 4) {
        p.phase += dt * 2.1;
        p.gapY = p.baseGapY + Math.sin(p.phase) * cfg.oscillateAmp;
      }

      const gapTop = p.gapY - p.gapH / 2;
      const gapBottom = p.gapY + p.gapH / 2;

      // Colisión AABB vs círculo indulgente
      const closestX = Math.max(p.x, Math.min(this.pandaX, p.x + p.width));
      const inHoriz = Math.abs(this.pandaX - closestX) < hitR;
      if (inHoriz) {
        if (this.pandaY - hitR < gapTop || this.pandaY + hitR > gapBottom) {
          this.crash();
          return;
        }
      }

      // Superar pilar
      if (!p.passed && p.x + p.width / 2 < this.pandaX) {
        p.passed = true;
        p.gemCollected = true;
        this.pipesCleared++;
        this.currentMultiplier = p.multiplier;

        this.playPointSound(this.pipesCleared);
        this.spawnParticles(p.x + p.width / 2, p.gapY, '#ffb700', 14);
        this.floatingTexts.push({
          x: this.pandaX + 18,
          y: this.pandaY - 22,
          vy: -48,
          text: `x${this.currentMultiplier.toFixed(2)} 💎`,
          color: '#00e701',
          alpha: 1
        });

        this.updateLadderUI();
        this.updateControlsUI();

        const payoutNow = Math.floor(this.betAmount * this.currentMultiplier);
        this.setTicker(
          `🔥 ¡Pilar #${this.pipesCleared} superado! Cobro disponible: +${payoutNow.toLocaleString('en-US')} 💎 (x${this.currentMultiplier.toFixed(2)})`,
          false
        );

        if (this.isAutoCashoutEnabled && this.currentMultiplier >= this.autoCashoutTarget) {
          this.cashOut(true);
          return;
        }
      }
    }

    // Reciclar pilares
    while (this.pipes.length > 0 && this.pipes[0].x + this.pipes[0].width < -40) {
      this.pipes.shift();
      const lastX = this.pipes[this.pipes.length - 1]?.x ?? w;
      this.addPipeAt(lastX + cfg.spacing);
    }
  }

  private draw(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const playH = h - GROUND_HEIGHT;

    ctx.save();
    if (this.screenShake > 0) {
      const mag = (this.screenShake / 0.35) * 9;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    // 1. Cielo nocturno neón
    const skyGrad = ctx.createLinearGradient(0, 0, 0, playH);
    skyGrad.addColorStop(0, '#050918');
    skyGrad.addColorStop(0.55, '#0b1630');
    skyGrad.addColorStop(1, '#10243e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, playH);

    // Estrellas
    for (const s of this.stars) {
      ctx.fillStyle = `rgba(226, 232, 240, ${s.alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Luna / Portal Dorado al fondo
    const moonGrad = ctx.createRadialGradient(w * 0.78, 92, 10, w * 0.78, 92, 95);
    moonGrad.addColorStop(0, 'rgba(255, 183, 0, 0.25)');
    moonGrad.addColorStop(0.5, 'rgba(0, 240, 255, 0.08)');
    moonGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = moonGrad;
    ctx.beginPath();
    ctx.arc(w * 0.78, 92, 95, 0, Math.PI * 2);
    ctx.fill();

    // Skyline ciudad cibernética en paralaje
    this.drawSkyline(ctx, w, playH);

    // 2. Tuberías Neón con Multiplicadores
    for (const p of this.pipes) {
      this.drawPipePair(ctx, p, playH);
    }

    // 3. Suelo deslizante
    ctx.fillStyle = '#070f1e';
    ctx.fillRect(0, playH, w, GROUND_HEIGHT);
    ctx.fillStyle = '#00e701';
    ctx.fillRect(0, playH, w, 4);

    ctx.strokeStyle = 'rgba(0, 231, 1, 0.25)';
    ctx.lineWidth = 2;
    for (let x = -this.groundOffset; x < w + 48; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, playH + 4);
      ctx.lineTo(x - 24, h);
      ctx.stroke();
    }

    // 4. Partículas
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 5. Flappy Panda Aviador
    this.drawPanda(ctx);

    // 6. Textos flotantes
    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = '900 20px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 10;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // 7. HUD en vivo sobre el cielo cuando está volando
    if (this.state === 'FLYING' || this.state === 'CASHED_OUT') {
      ctx.textAlign = 'center';
      ctx.font = '900 42px "Courier New", monospace';
      ctx.fillStyle = this.pipesCleared > 0 ? '#00e701' : '#00f0ff';
      ctx.shadowColor = this.pipesCleared > 0 ? 'rgba(0,231,1,0.6)' : 'rgba(0,240,255,0.5)';
      ctx.shadowBlur = 16;
      ctx.fillText(`x${this.currentMultiplier.toFixed(2)}`, w / 2, 54);
      ctx.shadowBlur = 0;

      if (this.pipesCleared > 0) {
        const potential = Math.floor(this.betAmount * this.currentMultiplier);
        ctx.font = '800 15px "Segoe UI", sans-serif';
        ctx.fillStyle = '#ffb700';
        ctx.fillText(`Cobro actual: +${potential.toLocaleString('en-US')} 💎 (${this.pipesCleared} pilares)`, w / 2, 78);
      }
    }

    ctx.restore();
  }

  private drawSkyline(ctx: CanvasRenderingContext2D, w: number, playH: number): void {
    const buildings = [44, 68, 52, 84, 58, 92, 48, 72, 62, 88, 50, 76];
    const bw = w / buildings.length;
    ctx.fillStyle = '#0d1b36';
    for (let rep = 0; rep < 2; rep++) {
      for (let i = 0; i < buildings.length; i++) {
        const bh = buildings[i];
        const bx = i * bw - this.cityOffset + rep * w;
        if (bx + bw < 0 || bx > w) continue;
        ctx.fillRect(bx, playH - bh, bw - 3, bh);
        ctx.fillStyle = 'rgba(0, 240, 255, 0.14)';
        ctx.fillRect(bx + 6, playH - bh + 8, 6, 6);
        ctx.fillRect(bx + bw - 16, playH - bh + 16, 6, 6);
        ctx.fillStyle = '#0d1b36';
      }
    }
  }

  private drawPipePair(ctx: CanvasRenderingContext2D, p: Pipe, playH: number): void {
    const gapTop = p.gapY - p.gapH / 2;
    const gapBottom = p.gapY + p.gapH / 2;

    const borderColor = p.passed ? '#00e701' : '#00f0ff';
    const bodyGrad = ctx.createLinearGradient(p.x, 0, p.x + p.width, 0);
    if (p.passed) {
      bodyGrad.addColorStop(0, '#0a3d1c');
      bodyGrad.addColorStop(0.5, '#136e33');
      bodyGrad.addColorStop(1, '#082d14');
    } else {
      bodyGrad.addColorStop(0, '#10213d');
      bodyGrad.addColorStop(0.5, '#1b3560');
      bodyGrad.addColorStop(1, '#0c182e');
    }

    // Tubería superior
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(p.x, 0, p.width, gapTop);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x, -2, p.width, gapTop + 2);

    // Capuchón superior
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(p.x - 5, gapTop - 18, p.width + 10, 18);
    ctx.strokeRect(p.x - 5, gapTop - 18, p.width + 10, 18);

    // Tubería inferior
    const botH = playH - gapBottom;
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(p.x, gapBottom, p.width, botH);
    ctx.strokeRect(p.x, gapBottom, p.width, botH + 2);

    // Capuchón inferior
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(p.x - 5, gapBottom, p.width + 10, 18);
    ctx.strokeRect(p.x - 5, gapBottom, p.width + 10, 18);

    // Etiqueta del multiplicador en la tubería inferior
    const labelY = Math.min(playH - 22, gapBottom + 42);
    ctx.fillStyle = p.passed ? '#00e701' : '#ffb700';
    ctx.font = '900 13px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`x${p.multiplier.toFixed(2)}`, p.x + p.width / 2, labelY);

    // Diamante flotante dentro del hueco si no ha sido recogido
    if (!p.gemCollected) {
      const gx = p.x + p.width / 2;
      const gy = p.gapY + Math.sin(performance.now() * 0.006 + p.index) * 5;
      ctx.save();
      ctx.translate(gx, gy);
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(10, -2);
      ctx.lineTo(0, 12);
      ctx.lineTo(-10, -2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(4, -2);
      ctx.lineTo(0, 4);
      ctx.lineTo(-4, -2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private drawPanda(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.pandaX, this.pandaY);

    let rot = 0;
    if (this.state === 'FLYING') {
      rot = Math.max(-0.45, Math.min(0.65, this.pandaVy / 520));
    } else if (this.state === 'CRASHED') {
      rot = 0.75;
    }
    ctx.rotate(rot);

    // Aura de estado
    if (this.state === 'CASHED_OUT') {
      ctx.shadowColor = '#00e701';
      ctx.shadowBlur = 22;
    } else if (this.state === 'FLYING') {
      ctx.shadowColor = '#ffb700';
      ctx.shadowBlur = 12;
    }

    // Bufanda aviador ondeante detrás
    const scarfWave = Math.sin(this.wingPhase * 0.9) * 4;
    ctx.strokeStyle = '#ff0055';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-10, 4);
    ctx.quadraticCurveTo(-22, 2 + scarfWave, -32, 6 - scarfWave);
    ctx.stroke();

    // Orejas negras
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(-9, -14, 6.5, 0, Math.PI * 2);
    ctx.arc(9, -14, 6.5, 0, Math.PI * 2);
    ctx.fill();

    // Cabeza/cuerpo redondo blanco
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(0, 0, this.pandaRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffb700';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Parches de panda en ojos
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(6, -3, 5, 6.2, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Gafas de aviador doradas + cristal cian
    ctx.fillStyle = this.state === 'CRASHED' ? '#ff0055' : '#00f0ff';
    ctx.strokeStyle = '#ffb700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(7, -3, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (this.state !== 'CRASHED') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(8.5, -4.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Nariz y sonrisa
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(14, 3, 2.5, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ala animada dorada
    const wingY = Math.sin(this.wingPhase) * 6;
    ctx.save();
    ctx.translate(-3, 4);
    ctx.rotate(wingY * 0.08);
    ctx.fillStyle = '#ffb700';
    ctx.beginPath();
    ctx.ellipse(-2, 2, 10, 6, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff3b0';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  private loop(now: number): void {
    const dt = Math.min(0.04, Math.max(0.001, (now - this.lastFrameTime) / 1000));
    this.lastFrameTime = now;

    this.update(dt);
    this.draw();
    requestAnimationFrame((t) => this.loop(t));
  }

  private setTicker(msg: string, isWin: boolean, isCrash = false): void {
    const bar = document.getElementById('flappyTickerBar');
    if (!bar) return;
    bar.className = 'flappy-ticker-bar';
    if (isWin) bar.classList.add('winner');
    if (isCrash) bar.classList.add('crashed');
    bar.innerHTML = `
      <span style="font-weight:${isWin || isCrash ? '900' : '600'}; color:${isWin ? '#00e701' : isCrash ? '#ff4d7a' : '#cbd5e1'};">${msg}</span>
      <span style="font-size:0.72rem; color:var(--accent-gold); font-family:'Courier New',monospace;">Flappy Panda &bull; ${DIFFICULTIES[this.difficulty].label}</span>
    `;
  }

  private updateLadderUI(): void {
    const strip = document.getElementById('flappyLadderStrip');
    if (!strip) return;
    const startIdx = Math.max(1, this.pipesCleared);
    let html = '';
    for (let i = startIdx; i < startIdx + 9; i++) {
      const mult = this.calcMultiplier(this.difficulty, i);
      const cls = i <= this.pipesCleared ? 'passed' : i === this.pipesCleared + 1 ? 'next' : '';
      html += `<span class="ladder-pill ${cls}">P${i} &bull; x${mult.toFixed(2)}</span>`;
    }
    strip.innerHTML = html;
  }

  private updateControlsUI(): void {
    const mainBtn = document.getElementById('btnFlappyAction') as HTMLButtonElement | null;
    const mainTitle = document.getElementById('btnFlappyMainTitle');
    const mainSub = document.getElementById('btnFlappySubTitle');
    const tapBtn = document.getElementById('btnFlappyTap') as HTMLButtonElement | null;
    const quickCashBtn = document.getElementById('btnFlappyCashoutQuick') as HTMLButtonElement | null;
    const betInput = document.getElementById('betAmountInput') as HTMLInputElement | null;

    const locked = this.state === 'READY' || this.state === 'FLYING';
    if (betInput) betInput.disabled = locked;
    document.querySelectorAll<HTMLButtonElement>('.btn-mod, .btn-qbet, .btn-diff').forEach(b => {
      b.disabled = locked;
    });

    if (tapBtn) {
      tapBtn.disabled = !(this.state === 'READY' || this.state === 'FLYING');
      tapBtn.textContent = this.state === 'READY' ? '🚀 DESPEGAR' : '🐥 ALETEAR';
    }

    if (quickCashBtn) {
      if (this.state === 'FLYING' && this.pipesCleared >= 1) {
        const pay = Math.floor(this.betAmount * this.currentMultiplier);
        quickCashBtn.disabled = false;
        quickCashBtn.textContent = `💰 COBRAR +${pay.toLocaleString('en-US')} 💎`;
      } else {
        quickCashBtn.disabled = true;
        quickCashBtn.textContent = '💰 COBRAR';
      }
    }

    if (mainBtn && mainTitle && mainSub) {
      mainBtn.classList.remove('btn-bet', 'btn-bet-cancel', 'btn-cashout', 'btn-cashed-out', 'btn-crashed');
      mainBtn.disabled = false;

      if (this.state === 'READY') {
        mainBtn.dataset.mode = 'cancel';
        mainBtn.classList.add('btn-bet-cancel');
        mainTitle.textContent = '↩️ CANCELAR VUELO';
        mainSub.style.display = 'block';
        mainSub.textContent = `Devolver ${this.betAmount.toLocaleString('en-US')} 💎`;
      } else if (this.state === 'FLYING') {
        mainBtn.dataset.mode = 'cashout';
        if (this.pipesCleared >= 1) {
          const pay = Math.floor(this.betAmount * this.currentMultiplier);
          mainBtn.classList.add('btn-cashout');
          mainTitle.textContent = `💰 COBRAR x${this.currentMultiplier.toFixed(2)}`;
          mainSub.style.display = 'block';
          mainSub.textContent = `Recibir +${pay.toLocaleString('en-US')} 💎`;
        } else {
          mainBtn.classList.add('btn-bet');
          mainBtn.disabled = true;
          mainTitle.textContent = '🐥 CRUZA EL 1er PILAR';
          mainSub.style.display = 'block';
          mainSub.textContent = `Meta P1: x${this.calcMultiplier(this.difficulty, 1).toFixed(2)}`;
        }
      } else if (this.state === 'CASHED_OUT') {
        mainBtn.dataset.mode = 'bet';
        mainBtn.classList.add('btn-bet');
        mainTitle.textContent = '🐥 JUGAR DE NUEVO';
        mainSub.style.display = 'block';
        mainSub.textContent = `Último cobro: +${this.cashoutPayout.toLocaleString('en-US')} 💎`;
      } else if (this.state === 'CRASHED') {
        mainBtn.dataset.mode = 'bet';
        mainBtn.classList.add('btn-bet');
        mainTitle.textContent = '🐥 VOLVER A VOLAR';
        mainSub.style.display = 'none';
      } else {
        mainBtn.dataset.mode = 'bet';
        mainBtn.classList.add('btn-bet');
        mainTitle.textContent = '🐥 INICIAR VUELO';
        mainSub.style.display = 'none';
      }
    }

    // Overlay visual sobre el canvas
    const overlay = document.getElementById('flappyCanvasOverlay');
    if (overlay) {
      if (this.state === 'FLYING') {
        overlay.style.display = 'none';
      } else {
        overlay.style.display = 'flex';
        if (this.state === 'READY') {
          overlay.innerHTML = `
            <div class="overlay-card ready">
              <div class="overlay-title" style="color:#00f0ff;">🚀 ¡PANDA LISTO!</div>
              <div class="overlay-sub" style="margin-bottom:0;">Toca aquí o pulsa <strong>ESPACIO</strong> para dar el primer salto</div>
            </div>
          `;
        } else if (this.state === 'CASHED_OUT') {
          overlay.innerHTML = `
            <div class="overlay-card win">
              <div class="overlay-title" style="color:#00e701;">🏆 ¡COBRO x${this.currentMultiplier.toFixed(2)}!</div>
              <div class="overlay-sub">Aseguraste <strong style="color:#ffb700;">+${this.cashoutPayout.toLocaleString('en-US')} 💎</strong> tras ${this.pipesCleared} pilares</div>
              <button type="button" class="overlay-btn" id="btnOverlayPlayAgain">🐥 JUGAR DE NUEVO</button>
            </div>
          `;
        } else if (this.state === 'CRASHED') {
          overlay.innerHTML = `
            <div class="overlay-card crash">
              <div class="overlay-title" style="color:#ff4d7a;">💥 ¡COLISIÓN!</div>
              <div class="overlay-sub">Pilares superados: <strong>${this.pipesCleared}</strong> &bull; Apuesta: ${this.betAmount.toLocaleString('en-US')} 💎</div>
              <button type="button" class="overlay-btn" id="btnOverlayPlayAgain">🔄 REINTENTAR</button>
            </div>
          `;
        } else {
          overlay.innerHTML = `
            <div class="overlay-card">
              <div class="overlay-title">🐥 Flappy Panda Turbo</div>
              <div class="overlay-sub">Cruza cada pilar para multiplicar hasta <strong>x500</strong> y cobra cuando quieras</div>
              <button type="button" class="overlay-btn" id="btnOverlayPlayAgain">▶ INICIAR VUELO</button>
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

  private addHistoryRow(bet: number, pipes: number, mult: number, payout: number, isWin: boolean): void {
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
        <span style="color:#8e9bb0; margin-left:4px;">(${pipes}P &bull; ${isWin ? 'x' + mult.toFixed(2) : 'Crash'})</span>
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
        if (this.state === 'READY' || this.state === 'FLYING') return;
        document.querySelectorAll('.btn-qbet').forEach(b => b.classList.remove('active'));
        const el = e.currentTarget as HTMLElement;
        el.classList.add('active');
        const val = el.getAttribute('data-bet');
        if (betInput && val) betInput.value = val;
      });
    });

    document.querySelectorAll('.btn-diff').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (this.state === 'READY' || this.state === 'FLYING') return;
        document.querySelectorAll('.btn-diff').forEach(b => b.classList.remove('active'));
        const el = e.currentTarget as HTMLElement;
        el.classList.add('active');
        const d = el.getAttribute('data-diff') as DifficultyKey | null;
        if (d && DIFFICULTIES[d]) {
          this.difficulty = d;
          this.updateLadderUI();
          this.setTicker(`Modo ${DIFFICULTIES[d].label} seleccionado (x${DIFFICULTIES[d].factor.toFixed(2)} por pilar).`, false);
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

    // Botón principal izquierda
    const mainActionBtn = document.getElementById('btnFlappyAction');
    mainActionBtn?.addEventListener('click', () => {
      if (this.state === 'READY') {
        this.cancelReadyRound();
      } else if (this.state === 'FLYING') {
        this.cashOut(false);
      } else {
        this.startFlightRound();
      }
    });

    // Botón del overlay (Iniciar / Reintentar)
    const overlay = document.getElementById('flappyCanvasOverlay');
    overlay?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('#btnOverlayPlayAgain')) {
        this.startFlightRound();
      }
    });

    // Controles táctiles/ratón para aletear con latencia mínima
    const handleTap = (e: Event) => {
      e.preventDefault();
      this.flap();
    };
    this.canvas.addEventListener('pointerdown', handleTap);
    document.getElementById('btnFlappyTap')?.addEventListener('pointerdown', handleTap);

    // Botón rápido de cobro bajo el canvas
    document.getElementById('btnFlappyCashoutQuick')?.addEventListener('click', () => {
      this.cashOut(false);
    });

    // Teclado (Espacio / Flecha Arriba / W para aletear; C / Enter para cobrar)
    window.addEventListener('keydown', (e) => {
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        if (this.state === 'READY' || this.state === 'FLYING') {
          e.preventDefault();
          this.flap();
        }
      } else if (e.code === 'KeyC' || e.code === 'Enter') {
        if (this.state === 'FLYING' && this.pipesCleared >= 1) {
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
