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

type ArenaState = 'IDLE' | 'PLAYING' | 'CASHED_OUT' | 'DEAD';
type ArenaTierKey = 'classic' | 'pro' | 'vip';

interface ArenaTierConfig {
  label: string;
  botCount: number;
  radius: number;
  baseSpeed: number;
  maxMult: number;
  orbTarget: number;
  goldenOrbs: number;
  killBoostFactor: number;
}

interface Vec2 {
  x: number;
  y: number;
}

interface FoodOrb {
  x: number;
  y: number;
  radius: number;
  valueMult: number;
  color: string;
  isGolden: boolean;
  pulse: number;
  vx: number;
  vy: number;
}

interface SnakeEntity {
  id: string;
  name: string;
  isPlayer: boolean;
  alive: boolean;
  headColor: string;
  bodyColor: string;
  glowColor: string;
  angle: number;
  targetAngle: number;
  baseSpeed: number;
  turnSpeed: number;
  radius: number;
  boosting: boolean;
  extracting: boolean;
  extractProgress: number;
  spawnShield: number;
  valueMult: number;
  kills: number;
  targetLength: number;
  segments: Vec2[];
  boostOrbCarry: number;
  aiThinkTimer: number;
  aiBurstTimer: number;
  aiWanderAngle: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
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
const SEG_SPACING = 7.5;
const EXTRACT_DURATION_SEC = 2.5;
const INITIAL_SHIELD_SEC = 2.2;
const VIEW_W = 780;
const VIEW_H = 540;

const ARENA_TIERS: Record<ArenaTierKey, ArenaTierConfig> = {
  classic: {
    label: 'Clásica',
    botCount: 8,
    radius: 1350,
    baseSpeed: 192,
    maxMult: 50,
    orbTarget: 210,
    goldenOrbs: 14,
    killBoostFactor: 0.42
  },
  pro: {
    label: 'Pro',
    botCount: 12,
    radius: 1250,
    baseSpeed: 218,
    maxMult: 100,
    orbTarget: 230,
    goldenOrbs: 20,
    killBoostFactor: 0.58
  },
  vip: {
    label: 'VIP',
    botCount: 16,
    radius: 1150,
    baseSpeed: 245,
    maxMult: 200,
    orbTarget: 250,
    goldenOrbs: 28,
    killBoostFactor: 0.78
  }
};

const BOT_NAMES = [
  'ViperSOL', 'NeonCobra', 'CyberMamba', 'CryptoFang', 'LuckyBoa',
  'TurboAsp', 'PixelPython', 'GoldViper', 'ApexDrake', 'VenomX',
  'TitanWurm', 'NovaCoil', 'HyperKrait', 'LaserAdder', 'ZetaSerpent',
  'ShadowSly', 'OmegaFang', 'BlazeCoil'
];

const BOT_PALETTES = [
  { head: '#ff2e63', body: '#c9184a', glow: 'rgba(255, 46, 99, 0.48)' },
  { head: '#bd00ff', body: '#8900b8', glow: 'rgba(189, 0, 255, 0.48)' },
  { head: '#ffb700', body: '#d97706', glow: 'rgba(255, 183, 0, 0.48)' },
  { head: '#00e701', body: '#00a300', glow: 'rgba(0, 231, 1, 0.45)' },
  { head: '#ff7b00', body: '#cc5200', glow: 'rgba(255, 123, 0, 0.48)' },
  { head: '#38bdf8', body: '#0284c7', glow: 'rgba(56, 189, 248, 0.48)' },
  { head: '#f472b6', body: '#db2777', glow: 'rgba(244, 114, 182, 0.45)' }
];

const ORB_COLORS = ['#00f0ff', '#00e701', '#ff2e63', '#bd00ff', '#38bdf8', '#a3e635'];

class PandaSlitherGame {
  private userState: UserSession;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private state: ArenaState = 'IDLE';
  private tier: ArenaTierKey = 'pro';

  private betAmount = 50;
  private currentMultiplier = 1.00;
  private cashoutPayout = 0;
  private playerKills = 0;

  private isAutoCashoutEnabled = false;
  private autoCashoutTarget = 2.00;

  // Mundo y entidades
  private snakes: SnakeEntity[] = [];
  private player: SnakeEntity | null = null;
  private orbs: FoodOrb[] = [];
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private camX = 0;
  private camY = 0;
  private screenShake = 0;
  private worldTime = 0;

  // Inputs
  private mouseActive = false;
  private mouseAngle = 0;
  private mouseDownBoost = false;
  private keySpaceBoost = false;
  private btnBoostHeld = false;
  private keyQExtract = false;
  private btnExtractHeld = false;
  private keyTurnLeft = false;
  private keyTurnRight = false;

  // Joystick táctil por pointerId
  private steerPointerId: number | null = null;
  private touchOriginX = 0;
  private touchOriginY = 0;
  private touchCurX = 0;
  private touchCurY = 0;

  // Estadísticas de sesión
  private totalRounds = 0;
  private totalKillsSession = 0;
  private totalDiamondsWon = 0;
  private bestMultiplier = 0;

  // Audio
  private soundEnabled = true;
  private audioCtx: AudioContext | null = null;
  private extractTickAccum = 0;

  private lastFrameTime = performance.now();

  constructor() {
    this.userState = this.loadSession();
    const canvasEl = document.getElementById('slitherCanvas') as HTMLCanvasElement | null;
    if (!canvasEl) throw new Error('Canvas #slitherCanvas no encontrado');
    this.canvas = canvasEl;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('No se pudo inicializar Canvas 2D');
    this.ctx = context;

    this.setupIdleArenaPreview();
    this.bindEvents();
    this.updateWalletUI();
    try {
      (window as any).pandaFetchAndSyncProfile?.(this.userState, (updated: any) => {
        this.userState = { ...this.userState, ...updated };
        this.updateWalletUI();
      });
    } catch (_) {}
    this.updateHudStrip();
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

  private normalizeAngle(a: number): number {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  private createSnake(
    id: string,
    name: string,
    isPlayer: boolean,
    x: number,
    y: number,
    angle: number,
    segmentsCount: number,
    valueMult: number,
    palette: { head: string; body: string; glow: string }
  ): SnakeEntity {
    const cfg = ARENA_TIERS[this.tier];
    const segs: Vec2[] = [];
    for (let i = 0; i < segmentsCount; i++) {
      segs.push({
        x: x - Math.cos(angle) * i * SEG_SPACING,
        y: y - Math.sin(angle) * i * SEG_SPACING
      });
    }
    return {
      id,
      name,
      isPlayer,
      alive: true,
      headColor: palette.head,
      bodyColor: palette.body,
      glowColor: palette.glow,
      angle,
      targetAngle: angle,
      baseSpeed: isPlayer ? cfg.baseSpeed : cfg.baseSpeed * (0.94 + Math.random() * 0.12),
      turnSpeed: isPlayer ? 5.6 : 4.2 + Math.random() * 1.1,
      radius: isPlayer ? 13.5 : 12 + Math.random() * 4.5,
      boosting: false,
      extracting: false,
      extractProgress: 0,
      spawnShield: isPlayer ? INITIAL_SHIELD_SEC : 1.5,
      valueMult,
      kills: 0,
      targetLength: segmentsCount,
      segments: segs,
      boostOrbCarry: 0,
      aiThinkTimer: 0,
      aiBurstTimer: 0,
      aiWanderAngle: angle
    };
  }

  private randomArenaPoint(minDistRatio = 0.08, maxDistRatio = 0.78): Vec2 {
    const rMax = ARENA_TIERS[this.tier].radius;
    const dist = (minDistRatio + Math.random() * (maxDistRatio - minDistRatio)) * rMax;
    const theta = Math.random() * Math.PI * 2;
    return { x: Math.cos(theta) * dist, y: Math.sin(theta) * dist };
  }

  private spawnAmbientOrbs(fillFull = false): void {
    const cfg = ARENA_TIERS[this.tier];
    while (this.orbs.length < cfg.orbTarget) {
      const goldenCount = this.orbs.filter(o => o.isGolden).length;
      const shouldGolden = goldenCount < cfg.goldenOrbs && (fillFull ? Math.random() < 0.14 : Math.random() < 0.2);
      const pt = shouldGolden ? this.randomArenaPoint(0.02, 0.34) : this.randomArenaPoint(0.05, 0.92);
      this.orbs.push({
        x: pt.x,
        y: pt.y,
        radius: shouldGolden ? 8.5 : 4.2 + Math.random() * 2.4,
        valueMult: shouldGolden ? 0.07 : 0.015 + Math.random() * 0.015,
        color: shouldGolden ? '#ffb700' : ORB_COLORS[Math.floor(Math.random() * ORB_COLORS.length)],
        isGolden: shouldGolden,
        pulse: Math.random() * Math.PI * 2,
        vx: 0,
        vy: 0
      });
    }
  }

  private spawnBot(index: number, avoidPoint?: Vec2): SnakeEntity {
    const cfg = ARENA_TIERS[this.tier];
    let pt = this.randomArenaPoint(0.18, 0.78);
    if (avoidPoint) {
      for (let tries = 0; tries < 10; tries++) {
        const candidate = this.randomArenaPoint(0.22, 0.78);
        const dx = candidate.x - avoidPoint.x;
        const dy = candidate.y - avoidPoint.y;
        if (Math.hypot(dx, dy) > 430) {
          pt = candidate;
          break;
        }
      }
    }
    const startMult = 1.00 + Math.random() * (this.tier === 'vip' ? 2.4 : 1.4);
    const segLen = 16 + Math.floor(startMult * 8);
    const pal = BOT_PALETTES[index % BOT_PALETTES.length];
    const name = BOT_NAMES[(index * 3 + Math.floor(Math.random() * 5)) % BOT_NAMES.length];
    return this.createSnake(
      `bot_${index}_${Date.now()}`,
      name,
      false,
      pt.x,
      pt.y,
      Math.random() * Math.PI * 2,
      segLen,
      Math.min(cfg.maxMult, Math.round(startMult * 100) / 100),
      pal
    );
  }

  private setupIdleArenaPreview(): void {
    const cfg = ARENA_TIERS[this.tier];
    this.snakes = [];
    this.player = null;
    this.orbs = [];
    this.particles = [];
    this.floatingTexts = [];
    this.camX = 0;
    this.camY = 0;
    this.spawnAmbientOrbs(true);
    for (let i = 0; i < cfg.botCount; i++) {
      this.snakes.push(this.spawnBot(i));
    }
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

  private playOrbSound(isGolden: boolean): void {
    if (isGolden) {
      this.playTone(720, 1180, 0.14, 'triangle', 0.065);
    } else {
      this.playTone(520, 680, 0.055, 'sine', 0.025);
    }
  }

  private playKillSound(): void {
    this.playTone(220, 960, 0.22, 'sawtooth', 0.075);
  }

  private playExtractPulse(progress: number): void {
    const f = 440 + progress * 520;
    this.playTone(f, f * 1.08, 0.08, 'sine', 0.035);
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
      const t0 = now + idx * 0.06;
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
    this.playTone(200, 48, 0.34, 'sawtooth', 0.09);
  }

  private spawnParticles(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 45 + Math.random() * 190;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        radius: 2 + Math.random() * 3.5,
        color,
        alpha: 1
      });
    }
  }

  private addFloatText(x: number, y: number, text: string, color: string): void {
    this.floatingTexts.push({
      x,
      y,
      vy: -38,
      text,
      color,
      alpha: 1
    });
  }

  public startArenaRound(): void {
    if (this.state === 'PLAYING') return;

    const betInput = document.getElementById('betAmountInput') as HTMLInputElement | null;
    const rawBet = betInput ? parseFloat(betInput.value) : 50;
    const cleanBet = Math.max(10, Math.round(rawBet || 0));

    if (cleanBet > this.userState.balance) {
      if (typeof (window as any).showInsufficientBalanceAlert === 'function') {
        (window as any).showInsufficientBalanceAlert(cleanBet, this.userState.balance);
      } else {
        this.setTicker(`Saldo insuficiente. Necesitas ${cleanBet} 💎 para entrar a la arena.`, true);
      }
      return;
    }

    const autoInput = document.getElementById('autoCashoutMultInput') as HTMLInputElement | null;
    if (autoInput) {
      this.autoCashoutTarget = Math.max(1.10, Math.min(200, parseFloat(autoInput.value) || 2.00));
    }

    this.betAmount = cleanBet;
    this.userState.balance = Math.max(0, this.userState.balance - this.betAmount);
    this.userState.weeklySpent = (this.userState.weeklySpent || 0) + this.betAmount;
    this.userState.xp = (this.userState.xp || 0) + Math.max(1, Math.floor(this.betAmount / 10));
    this.saveSession();

    const cfg = ARENA_TIERS[this.tier];
    this.snakes = [];
    this.orbs = [];
    this.particles = [];
    this.floatingTexts = [];
    this.mouseDownBoost = false;
    this.btnBoostHeld = false;
    this.keyQExtract = false;
    this.btnExtractHeld = false;
    this.steerPointerId = null;

    // Generar jugador en anillo medio seguro
    const spawnPt = this.randomArenaPoint(0.25, 0.56);
    const startAngle = Math.atan2(-spawnPt.y, -spawnPt.x);
    const playerSnake = this.createSnake(
      'player',
      this.userState.username || 'Tú',
      true,
      spawnPt.x,
      spawnPt.y,
      startAngle,
      18,
      1.00,
      { head: '#ffffff', body: '#00f0ff', glow: 'rgba(0, 240, 255, 0.65)' }
    );
    this.player = playerSnake;
    this.snakes.push(playerSnake);
    this.camX = spawnPt.x;
    this.camY = spawnPt.y;

    this.spawnAmbientOrbs(true);
    for (let i = 0; i < cfg.botCount; i++) {
      this.snakes.push(this.spawnBot(i, spawnPt));
    }

    this.state = 'PLAYING';
    this.currentMultiplier = 1.00;
    this.cashoutPayout = 0;
    this.playerKills = 0;
    this.screenShake = 0;
    this.ensureAudio();

    this.setTicker(
      `¡En la Arena ${cfg.label}! Come orbes y elimina rivales. Mantén Q o COBRAR (2.5s) para extraer.`,
      false
    );
    this.updateHudStrip();
    this.updateControlsUI();
  }

  private eliminateSnake(victim: SnakeEntity, killer: SnakeEntity | null): void {
    if (!victim.alive) return;
    victim.alive = false;

    const cfg = ARENA_TIERS[this.tier];
    const head = victim.segments[0];
    this.spawnParticles(head.x, head.y, '#ffb700', victim.isPlayer ? 28 : 18);

    // Convertir el cuerpo derrotado en botín dorado en la arena
    const totalDropMult = Math.max(0.45, victim.valueMult * cfg.killBoostFactor);
    const step = Math.max(2, Math.floor(victim.segments.length / 18));
    const dropNodes: Vec2[] = [];
    for (let i = 0; i < victim.segments.length; i += step) {
      dropNodes.push(victim.segments[i]);
    }
    const perOrb = totalDropMult / Math.max(1, dropNodes.length);
    for (const seg of dropNodes) {
      this.orbs.push({
        x: seg.x + (Math.random() - 0.5) * 14,
        y: seg.y + (Math.random() - 0.5) * 14,
        radius: 8 + Math.random() * 2.5,
        valueMult: Math.min(0.45, Math.max(0.05, perOrb)),
        color: '#ffb700',
        isGolden: true,
        pulse: Math.random() * Math.PI * 2,
        vx: (Math.random() - 0.5) * 24,
        vy: (Math.random() - 0.5) * 24
      });
    }

    if (killer && killer.alive) {
      killer.kills += 1;
      if (killer.isPlayer) {
        this.playerKills += 1;
        this.totalKillsSession += 1;
        this.playKillSound();
        this.addFloatText(head.x, head.y - 16, `💀 ¡BAJA! +BOTÍN DORADO`, '#ffb700');
        this.setTicker(
          `¡Eliminaste a ${victim.name}! Recoge los orbes dorados para subir tu premio.`,
          false,
          'winner'
        );
      }
    }

    if (victim.isPlayer) {
      this.handlePlayerDeath();
    }
  }

  private handlePlayerDeath(): void {
    if (this.state !== 'PLAYING') return;
    this.state = 'DEAD';
    this.keyQExtract = false;
    this.btnExtractHeld = false;
    this.mouseDownBoost = false;
    this.btnBoostHeld = false;
    this.screenShake = 11;
    this.playCrashSound();

    this.totalRounds += 1;
    this.addHistoryRow(this.betAmount, this.playerKills, this.currentMultiplier, 0, false);
    this.updateStatsUI();
    this.setTicker(`Colisión fatal en la arena. Apuesta perdida: ${this.betAmount.toLocaleString('en-US')} 💎.`, true, 'crashed');
    this.updateControlsUI();
  }

  private completeCashout(isAuto: boolean): void {
    if (this.state !== 'PLAYING' || !this.player || !this.player.alive) return;

    this.state = 'CASHED_OUT';
    this.player.alive = false;
    this.keyQExtract = false;
    this.btnExtractHeld = false;
    this.mouseDownBoost = false;
    this.btnBoostHeld = false;

    const head = this.player.segments[0];
    this.spawnParticles(head.x, head.y, '#00e701', 26);
    this.playCashoutSound();

    this.cashoutPayout = Math.max(this.betAmount, Math.round(this.betAmount * this.currentMultiplier));
    this.userState.balance += this.cashoutPayout;
    this.saveSession();

    this.totalRounds += 1;
    this.totalDiamondsWon += this.cashoutPayout;
    if (this.currentMultiplier > this.bestMultiplier) {
      this.bestMultiplier = this.currentMultiplier;
    }

    this.addHistoryRow(this.betAmount, this.playerKills, this.currentMultiplier, this.cashoutPayout, true);
    this.updateStatsUI();

    const tag = isAuto ? 'Auto-Retiro' : 'Extracción Exitosa';
    this.setTicker(
      `¡${tag} en x${this.currentMultiplier.toFixed(2)}! Aseguraste +${this.cashoutPayout.toLocaleString('en-US')} 💎`,
      false,
      'winner'
    );
    this.updateControlsUI();
  }

  private updateBotAI(bot: SnakeEntity, dt: number): void {
    const cfg = ARENA_TIERS[this.tier];
    const head = bot.segments[0];
    const distFromCenter = Math.hypot(head.x, head.y);

    // 1. Evasión estricta del borde rojo
    if (distFromCenter > cfg.radius - 170) {
      const toCenter = Math.atan2(-head.y, -head.x);
      bot.targetAngle = toCenter;
      bot.boosting = distFromCenter > cfg.radius - 95;
      return;
    }

    bot.aiThinkTimer -= dt;
    bot.aiBurstTimer -= dt;
    if (bot.aiThinkTimer > 0) return;
    bot.aiThinkTimer = 0.14 + Math.random() * 0.14;

    // 2. Detectar peligro cercano por delante (cuerpos rivales)
    let dangerVectorX = 0;
    let dangerVectorY = 0;
    const lookAhead = 155;
    const lookX = head.x + Math.cos(bot.angle) * 55;
    const lookY = head.y + Math.sin(bot.angle) * 55;

    for (const other of this.snakes) {
      if (!other.alive || other.id === bot.id) continue;
      for (let i = 0; i < other.segments.length; i += 2) {
        const seg = other.segments[i];
        const dx = seg.x - lookX;
        const dy = seg.y - lookY;
        const d2 = dx * dx + dy * dy;
        if (d2 < lookAhead * lookAhead) {
          const d = Math.max(8, Math.sqrt(d2));
          const w = (lookAhead - d) / lookAhead;
          dangerVectorX -= (dx / d) * w;
          dangerVectorY -= (dy / d) * w;
        }
      }
    }

    if (Math.hypot(dangerVectorX, dangerVectorY) > 0.35 && Math.random() < 0.88) {
      bot.targetAngle = Math.atan2(dangerVectorY, dangerVectorX);
      bot.boosting = bot.targetLength > 18 && Math.random() < 0.45;
      return;
    }

    // 3. Si el jugador está canalizando extracción cerca, los bots cercanos lo cazan ligeramente
    if (this.player && this.player.alive && this.player.extracting) {
      const pHead = this.player.segments[0];
      const dp = Math.hypot(pHead.x - head.x, pHead.y - head.y);
      if (dp < 420 && dp > 75 && Math.random() < (this.tier === 'vip' ? 0.72 : 0.48)) {
        bot.targetAngle = Math.atan2(pHead.y - head.y, pHead.x - head.x);
        bot.boosting = bot.targetLength > 20 && Math.random() < 0.6;
        return;
      }
    }

    // 4. Buscar orbe dorado cercano o comida
    let bestOrb: FoodOrb | null = null;
    let bestScore = -1;
    for (let i = 0; i < this.orbs.length; i++) {
      const o = this.orbs[i];
      const d = Math.hypot(o.x - head.x, o.y - head.y);
      if (d > 420) continue;
      const sc = (o.isGolden ? 4.5 : 1.0) / Math.max(30, d);
      if (sc > bestScore) {
        bestScore = sc;
        bestOrb = o;
      }
    }

    if (bestOrb) {
      bot.targetAngle = Math.atan2(bestOrb.y - head.y, bestOrb.x - head.x);
      bot.boosting = bestOrb.isGolden && bot.targetLength > 20 && Math.random() < 0.4;
    } else {
      bot.aiWanderAngle += (Math.random() - 0.5) * 0.9;
      bot.targetAngle = bot.aiWanderAngle;
      bot.boosting = false;
    }
  }

  private stepSnakePhysics(snake: SnakeEntity, dt: number): void {
    if (!snake.alive) return;
    const cfg = ARENA_TIERS[this.tier];

    if (snake.spawnShield > 0) {
      snake.spawnShield = Math.max(0, snake.spawnShield - dt);
    }

    const canBoost = snake.boosting && !snake.extracting && snake.segments.length > 14;
    let speed = snake.baseSpeed;
    if (canBoost) {
      speed *= 1.76;
      snake.boostOrbCarry += dt;
      if (snake.boostOrbCarry >= 0.22) {
        snake.boostOrbCarry = 0;
        const tail = snake.segments[snake.segments.length - 1];
        if (snake.targetLength > 15) snake.targetLength -= 0.45;
        if (snake.valueMult > 1.01) {
          snake.valueMult = Math.max(1.00, Math.round((snake.valueMult - 0.01) * 100) / 100);
          if (snake.isPlayer) this.currentMultiplier = snake.valueMult;
        }
        this.orbs.push({
          x: tail.x + (Math.random() - 0.5) * 6,
          y: tail.y + (Math.random() - 0.5) * 6,
          radius: 4.5,
          valueMult: 0.01,
          color: snake.headColor,
          isGolden: false,
          pulse: 0,
          vx: 0,
          vy: 0
        });
      }
    } else if (snake.extracting) {
      // Ventana de vulnerabilidad al canalizar extracción
      speed *= 0.6;
    }

    // Giro suave hacia el ángulo objetivo
    const diff = this.normalizeAngle(snake.targetAngle - snake.angle);
    const maxTurn = snake.turnSpeed * dt;
    if (Math.abs(diff) <= maxTurn) {
      snake.angle = snake.targetAngle;
    } else {
      snake.angle = this.normalizeAngle(snake.angle + Math.sign(diff) * maxTurn);
    }

    const head = snake.segments[0];
    const newHeadX = head.x + Math.cos(snake.angle) * speed * dt;
    const newHeadY = head.y + Math.sin(snake.angle) * speed * dt;

    head.x = newHeadX;
    head.y = newHeadY;

    // Arrastrar cada segmento manteniendo separación fija
    for (let i = 1; i < snake.segments.length; i++) {
      const prev = snake.segments[i - 1];
      const cur = snake.segments[i];
      const dx = prev.x - cur.x;
      const dy = prev.y - cur.y;
      const dist = Math.hypot(dx, dy);
      if (dist > SEG_SPACING) {
        const pull = (dist - SEG_SPACING) / dist;
        cur.x += dx * pull;
        cur.y += dy * pull;
      }
    }

    // Ajustar cantidad de segmentos al targetLength
    const desiredCount = Math.min(130, Math.max(12, Math.floor(snake.targetLength)));
    while (snake.segments.length < desiredCount) {
      const tail = snake.segments[snake.segments.length - 1];
      snake.segments.push({ x: tail.x, y: tail.y });
    }
    while (snake.segments.length > desiredCount) {
      snake.segments.pop();
    }

    // Engrosar suavemente con el multiplicador
    const growthExtra = Math.min(8, Math.sqrt(Math.max(0, snake.valueMult - 1)) * 1.4);
    snake.radius = (snake.isPlayer ? 13.5 : 12.5) + growthExtra;

    // Comer orbes cercanos
    const eatDist = snake.radius + 13;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i];
      const dx = orb.x - head.x;
      const dy = orb.y - head.y;
      const dist = Math.hypot(dx, dy);
      if (dist < eatDist + 16 && dist > eatDist) {
        // Atracción magnética suave
        orb.x -= (dx / dist) * 140 * dt;
        orb.y -= (dy / dist) * 140 * dt;
      } else if (dist <= eatDist) {
        snake.valueMult = Math.min(cfg.maxMult, Math.round((snake.valueMult + orb.valueMult) * 100) / 100);
        snake.targetLength = Math.min(130, snake.targetLength + (orb.isGolden ? 1.8 : 0.45));
        if (snake.isPlayer) {
          this.currentMultiplier = snake.valueMult;
          this.playOrbSound(orb.isGolden);
          if (orb.isGolden) {
            this.addFloatText(orb.x, orb.y - 10, `+${orb.valueMult.toFixed(2)}x 💎`, '#ffb700');
          }
        }
        this.orbs.splice(i, 1);
      }
    }

    // Colisión contra el borde circular de la arena
    if (Math.hypot(head.x, head.y) >= cfg.radius - snake.radius * 0.65) {
      if (snake.spawnShield > 0) {
        // Rebotar suavemente al centro durante el escudo inicial
        snake.angle = Math.atan2(-head.y, -head.x);
        snake.targetAngle = snake.angle;
      } else {
        this.eliminateSnake(snake, null);
      }
    }
  }

  private checkSnakeCollisions(): void {
    for (const sA of this.snakes) {
      if (!sA.alive || sA.spawnShield > 0) continue;
      const headA = sA.segments[0];

      for (const sB of this.snakes) {
        if (!sB.alive || sA.id === sB.id || sB.spawnShield > 0) continue;
        const hitDist = sA.radius * 0.72 + sB.radius * 0.78;
        const hitDistSq = hitDist * hitDist;

        for (let i = 0; i < sB.segments.length; i++) {
          const seg = sB.segments[i];
          const dx = headA.x - seg.x;
          const dy = headA.y - seg.y;
          if (dx * dx + dy * dy <= hitDistSq) {
            // Choque de cabeza contra cabeza: sobrevive la de mayor longitud o la que esquivó mejor
            if (i === 0 && sA.segments.length > sB.segments.length) {
              this.eliminateSnake(sB, sA);
            } else {
              this.eliminateSnake(sA, sB);
            }
            break;
          }
        }
        if (!sA.alive) break;
      }
    }
  }

  private step(dt: number): void {
    this.worldTime += dt;
    const cfg = ARENA_TIERS[this.tier];

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - 28 * dt);
    }

    // Actualizar orbes
    for (const o of this.orbs) {
      o.pulse += dt * 4.5;
      if (o.vx !== 0 || o.vy !== 0) {
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        o.vx *= 0.92;
        o.vy *= 0.92;
      }
    }
    this.spawnAmbientOrbs(false);

    // Actualizar partículas y textos flotantes
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.alpha -= dt * 1.9;
      if (p.alpha <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.alpha -= dt * 1.1;
      if (ft.alpha <= 0) this.floatingTexts.splice(i, 1);
    }

    // Si estamos en partida activa, procesar input del jugador
    if (this.state === 'PLAYING' && this.player && this.player.alive) {
      if (this.keyTurnLeft) {
        this.player.targetAngle = this.normalizeAngle(this.player.angle - 3.6 * dt);
        this.mouseActive = false;
      } else if (this.keyTurnRight) {
        this.player.targetAngle = this.normalizeAngle(this.player.angle + 3.6 * dt);
        this.mouseActive = false;
      } else if (this.steerPointerId !== null || this.mouseActive) {
        this.player.targetAngle = this.mouseAngle;
      }

      const wantsExtract = this.keyQExtract || this.btnExtractHeld;
      const wantsBoost = this.mouseDownBoost || this.keySpaceBoost || this.btnBoostHeld;
      this.player.boosting = wantsBoost && !wantsExtract;
      this.player.extracting = wantsExtract;

      if (wantsExtract) {
        // Iniciar extracción remueve el escudo inicial para evitar abuso sin riesgo
        if (this.player.spawnShield > 0) this.player.spawnShield = 0;
        this.player.extractProgress = Math.min(1, this.player.extractProgress + dt / EXTRACT_DURATION_SEC);
        this.extractTickAccum += dt;
        if (this.extractTickAccum >= 0.25) {
          this.extractTickAccum = 0;
          this.playExtractPulse(this.player.extractProgress);
        }
        if (this.player.extractProgress >= 1) {
          this.completeCashout(false);
        }
      } else {
        this.player.extractProgress = Math.max(0, this.player.extractProgress - dt * 2.5);
        this.extractTickAccum = 0;
      }
    }

    // Actualizar todas las serpientes (bots + jugador)
    for (const s of this.snakes) {
      if (!s.alive) continue;
      if (!s.isPlayer) {
        this.updateBotAI(s, dt);
      }
      this.stepSnakePhysics(s, dt);
    }

    this.checkSnakeCollisions();

    // Auto-Retiro en PLAYING
    if (
      this.state === 'PLAYING' &&
      this.player &&
      this.player.alive &&
      this.isAutoCashoutEnabled &&
      this.currentMultiplier >= this.autoCashoutTarget
    ) {
      this.completeCashout(true);
    }

    // Mantener poblada la arena con bots frescos
    const aliveBots = this.snakes.filter(s => !s.isPlayer && s.alive);
    if (aliveBots.length < cfg.botCount) {
      const avoid = this.player && this.player.alive ? this.player.segments[0] : { x: this.camX, y: this.camY };
      const needed = cfg.botCount - aliveBots.length;
      for (let k = 0; k < needed; k++) {
        aliveBots.push(this.spawnBot(Math.floor(Math.random() * 50), avoid));
      }
    }
    this.snakes = this.player && this.player.alive ? [this.player, ...aliveBots] : aliveBots;

    // Cámara suavizada
    if (this.player && this.player.alive) {
      const head = this.player.segments[0];
      const lerp = 1 - Math.exp(-8.5 * dt);
      this.camX += (head.x - this.camX) * lerp;
      this.camY += (head.y - this.camY) * lerp;
      this.updateLiveBetUiDuringPlay();
    } else {
      // Paneo lento cinemático en IDLE/DEAD/CASHED_OUT
      this.camX = Math.cos(this.worldTime * 0.22) * 320;
      this.camY = Math.sin(this.worldTime * 0.17) * 240;
    }

    this.updateHudStrip();
  }

  private render(): void {
    const ctx = this.ctx;
    const cfg = ARENA_TIERS[this.tier];
    ctx.save();
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    // Fondo radial oscuro
    ctx.fillStyle = '#040813';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    if (this.screenShake > 0) {
      ctx.translate((Math.random() - 0.5) * this.screenShake, (Math.random() - 0.5) * this.screenShake);
    }

    // Transformar cámara centrada en VIEW_W / 2, VIEW_H / 2
    ctx.save();
    ctx.translate(VIEW_W / 2 - this.camX, VIEW_H / 2 - this.camY);

    // Rejilla geométrica del suelo de la arena
    const gridStep = 80;
    const startX = Math.floor((this.camX - VIEW_W / 2) / gridStep) * gridStep;
    const endX = this.camX + VIEW_W / 2 + gridStep;
    const startY = Math.floor((this.camY - VIEW_H / 2) / gridStep) * gridStep;
    const endY = this.camY + VIEW_H / 2 + gridStep;

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.055)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridStep) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += gridStep) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();

    // Zona central de botín dorado
    const centerGrad = ctx.createRadialGradient(0, 0, 20, 0, 0, 360);
    centerGrad.addColorStop(0, 'rgba(255, 183, 0, 0.12)');
    centerGrad.addColorStop(1, 'rgba(255, 183, 0, 0)');
    ctx.fillStyle = centerGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 360, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 183, 0, 0.22)';
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 340, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Orbes (culling de viewport para 60fps estables)
    const minVisX = this.camX - VIEW_W / 2 - 40;
    const maxVisX = this.camX + VIEW_W / 2 + 40;
    const minVisY = this.camY - VIEW_H / 2 - 40;
    const maxVisY = this.camY + VIEW_H / 2 + 40;

    for (const o of this.orbs) {
      if (o.x < minVisX || o.x > maxVisX || o.y < minVisY || o.y > maxVisY) continue;
      const pulseScale = 1 + Math.sin(o.pulse) * 0.15;
      const r = o.radius * pulseScale;

      ctx.save();
      ctx.beginPath();
      ctx.arc(o.x, o.y, r * 1.9, 0, Math.PI * 2);
      ctx.fillStyle = o.isGolden ? 'rgba(255, 183, 0, 0.22)' : 'rgba(0, 240, 255, 0.12)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
      ctx.fillStyle = o.color;
      ctx.fill();

      if (o.isGolden) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(o.x - r * 0.25, o.y - r * 0.25, r * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Serpientes (cuerpo de cola a cabeza)
    for (const s of this.snakes) {
      if (!s.alive) continue;
      this.drawSnake(s);
    }

    // Borde letal circular de plasma
    ctx.save();
    ctx.strokeStyle = '#ff0055';
    ctx.lineWidth = 8;
    ctx.shadowColor = '#ff0055';
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(0, 0, cfg.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Partículas y textos flotantes
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = 'bold 14px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore(); // fin cámara mundial

    // HUD en pantalla (Multiplicador, Top Leaderboard, Minimapa, Joystick táctil)
    this.drawCanvasHUD();

    ctx.restore();
  }

  private drawSnake(s: SnakeEntity): void {
    const ctx = this.ctx;
    const segs = s.segments;
    if (segs.length === 0) return;

    const minX = this.camX - VIEW_W / 2 - 60;
    const maxX = this.camX + VIEW_W / 2 + 60;
    const minY = this.camY - VIEW_H / 2 - 60;
    const maxY = this.camY + VIEW_H / 2 + 60;

    // Dibujar segmentos de atrás hacia adelante
    for (let i = segs.length - 1; i >= 1; i--) {
      const seg = segs[i];
      if (seg.x < minX || seg.x > maxX || seg.y < minY || seg.y > maxY) continue;
      const ratio = 1 - (i / segs.length) * 0.42;
      const r = s.radius * ratio;

      ctx.beginPath();
      ctx.arc(seg.x, seg.y, r, 0, Math.PI * 2);
      if (s.isPlayer) {
        ctx.fillStyle = i % 3 === 0 ? '#111827' : s.boosting ? '#ffb700' : s.bodyColor;
      } else {
        ctx.fillStyle = i % 4 === 0 ? s.headColor : s.bodyColor;
      }
      ctx.fill();
    }

    // Dibujar cabeza
    const head = segs[0];
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(s.angle);

    if (s.spawnShield > 0) {
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, s.radius + 7 + Math.sin(this.worldTime * 12) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (s.boosting) {
      ctx.shadowColor = '#ffb700';
      ctx.shadowBlur = 18;
    }

    if (s.isPlayer) {
      // Orejas de Panda
      ctx.fillStyle = '#0b101b';
      ctx.beginPath();
      ctx.arc(-s.radius * 0.35, -s.radius * 0.85, s.radius * 0.45, 0, Math.PI * 2);
      ctx.arc(-s.radius * 0.35, s.radius * 0.85, s.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // Cabeza blanca del Panda
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, s.radius * 1.12, 0, Math.PI * 2);
      ctx.fill();

      // Parches y ojos orientados hacia adelante
      ctx.fillStyle = '#0b101b';
      ctx.beginPath();
      ctx.ellipse(s.radius * 0.36, -s.radius * 0.44, s.radius * 0.28, s.radius * 0.22, 0, 0, Math.PI * 2);
      ctx.ellipse(s.radius * 0.36, s.radius * 0.44, s.radius * 0.28, s.radius * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(s.radius * 0.44, -s.radius * 0.44, s.radius * 0.13, 0, Math.PI * 2);
      ctx.arc(s.radius * 0.44, s.radius * 0.44, s.radius * 0.13, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = s.headColor;
      ctx.beginPath();
      ctx.arc(0, 0, s.radius * 1.08, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.radius * 0.38, -s.radius * 0.42, s.radius * 0.26, 0, Math.PI * 2);
      ctx.arc(s.radius * 0.38, s.radius * 0.42, s.radius * 0.26, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#070a14';
      ctx.beginPath();
      ctx.arc(s.radius * 0.48, -s.radius * 0.42, s.radius * 0.12, 0, Math.PI * 2);
      ctx.arc(s.radius * 0.48, s.radius * 0.42, s.radius * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Anillo dorado de canalización al extraer
    if (s.extracting && s.extractProgress > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 183, 0, 0.28)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(head.x, head.y, s.radius + 13, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#00e701';
      ctx.lineWidth = 5;
      ctx.shadowColor = '#00e701';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(
        head.x,
        head.y,
        s.radius + 13,
        -Math.PI / 2,
        -Math.PI / 2 + s.extractProgress * Math.PI * 2
      );
      ctx.stroke();
      ctx.restore();
    }

    // Nombre y multiplicador flotante sobre la serpiente
    if (head.x >= minX && head.x <= maxX && head.y >= minY && head.y <= maxY) {
      ctx.save();
      ctx.font = 'bold 11px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = s.isPlayer ? '#00f0ff' : '#e2e8f0';
      ctx.fillText(`${s.name} • x${s.valueMult.toFixed(2)}`, head.x, head.y - s.radius - 12);
      ctx.restore();
    }
  }

  private drawCanvasHUD(): void {
    const ctx = this.ctx;
    const cfg = ARENA_TIERS[this.tier];

    // 1. Indicador superior izquierdo: Multiplicador y Valor actual en 💎
    if (this.state === 'PLAYING' && this.player && this.player.alive) {
      const pot = Math.round(this.betAmount * this.currentMultiplier);
      ctx.save();
      ctx.fillStyle = 'rgba(7, 12, 26, 0.78)';
      ctx.strokeStyle = this.player.extracting ? '#00e701' : 'rgba(0, 240, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(14, 14, 178, 58, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#00e701';
      ctx.font = '900 22px "Courier New", monospace';
      ctx.fillText(`x${this.currentMultiplier.toFixed(2)}`, 24, 41);

      ctx.fillStyle = '#ffb700';
      ctx.font = 'bold 13px "Segoe UI", sans-serif';
      ctx.fillText(`Botín: ${pot.toLocaleString('en-US')} 💎`, 24, 62);
      ctx.restore();

      // Barra flotante si está canalizando extracción
      if (this.player.extracting) {
        const pct = Math.round(this.player.extractProgress * 100);
        const bw = 240;
        const bx = (VIEW_W - bw) / 2;
        const by = 18;
        ctx.save();
        ctx.fillStyle = 'rgba(6, 12, 24, 0.88)';
        ctx.strokeStyle = '#00e701';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, 36, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(0, 231, 1, 0.25)';
        ctx.beginPath();
        ctx.roundRect(bx + 4, by + 4, (bw - 8) * this.player.extractProgress, 28, 7);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 12px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`EXTRAYENDO BOTÍN... ${pct}%`, VIEW_W / 2, by + 23);
        ctx.restore();
      }
    }

    // 2. Top 5 Leaderboard en vivo (arriba derecha)
    const ranked = [...this.snakes].filter(s => s.alive).sort((a, b) => b.valueMult - a.valueMult).slice(0, 5);
    if (ranked.length > 0) {
      ctx.save();
      const lx = VIEW_W - 186;
      const ly = 14;
      const lh = 26 + ranked.length * 18;
      ctx.fillStyle = 'rgba(7, 12, 26, 0.72)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(lx, ly, 172, lh, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffb700';
      ctx.font = '800 10px "Segoe UI", sans-serif';
      ctx.fillText('🏆 TOP ARENA', lx + 10, ly + 16);

      ranked.forEach((s, idx) => {
        const ry = ly + 33 + idx * 18;
        ctx.fillStyle = s.isPlayer ? '#00f0ff' : '#cbd5e1';
        ctx.font = s.isPlayer ? '900 11px "Segoe UI", sans-serif' : '600 11px "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        const shortName = s.name.length > 12 ? s.name.slice(0, 11) + '…' : s.name;
        ctx.fillText(`${idx + 1}. ${shortName}`, lx + 10, ry);
        ctx.textAlign = 'right';
        ctx.fillStyle = s.isPlayer ? '#00e701' : '#94a3b8';
        ctx.fillText(`x${s.valueMult.toFixed(2)}`, lx + 162, ry);
      });
      ctx.restore();
    }

    // 3. Minimapa radar (abajo derecha)
    ctx.save();
    const mapR = 42;
    const mx = VIEW_W - mapR - 14;
    const my = VIEW_H - mapR - 14;
    ctx.fillStyle = 'rgba(7, 12, 26, 0.78)';
    ctx.strokeStyle = 'rgba(255, 0, 85, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx, my, mapR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Zona dorada en minimapa
    ctx.fillStyle = 'rgba(255, 183, 0, 0.16)';
    ctx.beginPath();
    ctx.arc(mx, my, mapR * 0.28, 0, Math.PI * 2);
    ctx.fill();

    for (const s of this.snakes) {
      if (!s.alive) continue;
      const h = s.segments[0];
      const sx = mx + (h.x / cfg.radius) * (mapR - 4);
      const sy = my + (h.y / cfg.radius) * (mapR - 4);
      ctx.fillStyle = s.isPlayer ? '#00f0ff' : '#ff4d7a';
      ctx.beginPath();
      ctx.arc(sx, sy, s.isPlayer ? 3.5 : 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 4. Joystick visual táctil si el jugador está arrastrando en móvil
    if (this.steerPointerId !== null && this.state === 'PLAYING') {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.touchOriginX, this.touchOriginY, 34, 0, Math.PI * 2);
      ctx.stroke();

      const dx = this.touchCurX - this.touchOriginX;
      const dy = this.touchCurY - this.touchOriginY;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(26, dist);
      const kx = this.touchOriginX + (dist > 0 ? (dx / dist) * clamped : 0);
      const ky = this.touchOriginY + (dist > 0 ? (dy / dist) * clamped : 0);

      ctx.fillStyle = 'rgba(0, 240, 255, 0.65)';
      ctx.beginPath();
      ctx.arc(kx, ky, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private loop(now: number): void {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastFrameTime) / 1000));
    this.lastFrameTime = now;

    this.step(dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  private updateHudStrip(): void {
    const cfg = ARENA_TIERS[this.tier];
    const arenaEl = document.getElementById('hudArenaLabel');
    const aliveEl = document.getElementById('hudAliveCount');
    const killsEl = document.getElementById('hudPlayerKills');
    const multEl = document.getElementById('hudMultiplier');

    if (arenaEl) arenaEl.textContent = `Arena: ${cfg.label}`;
    if (aliveEl) aliveEl.textContent = `Serpientes: ${this.snakes.filter(s => s.alive).length}`;
    if (killsEl) killsEl.textContent = `Bajas: ${this.playerKills}`;
    if (multEl) {
      const pot = this.state === 'PLAYING' ? Math.round(this.betAmount * this.currentMultiplier) : 0;
      multEl.textContent = this.state === 'PLAYING'
        ? `x${this.currentMultiplier.toFixed(2)} (${pot.toLocaleString('en-US')} 💎)`
        : `x1.00 (Máx x${cfg.maxMult})`;
    }
  }

  private updateLiveBetUiDuringPlay(): void {
    const mainBtn = document.getElementById('btnSlitherAction') as HTMLButtonElement | null;
    const mainTitle = document.getElementById('btnSlitherMainTitle');
    const mainSub = document.getElementById('btnSlitherSubTitle');
    const boostBtn = document.getElementById('btnSlitherBoost') as HTMLButtonElement | null;
    const quickCashBtn = document.getElementById('btnSlitherCashoutQuick') as HTMLButtonElement | null;
    if (!this.player || this.state !== 'PLAYING') return;

    const pot = Math.round(this.betAmount * this.currentMultiplier);
    const pct = Math.round(this.player.extractProgress * 100);
    const pctStr = `${pct}%`;

    if (mainBtn && mainTitle && mainSub) {
      mainBtn.style.setProperty('--extract-pct', pctStr);
      mainBtn.classList.toggle('extracting', this.player.extracting);
      mainTitle.textContent = this.player.extracting ? `⏳ EXTRAYENDO ${pct}%` : '💰 MANTENER P/ COBRAR (2.5s)';
      mainSub.style.display = 'block';
      mainSub.textContent = `x${this.currentMultiplier.toFixed(2)} = ${pot.toLocaleString('en-US')} 💎`;
    }

    if (boostBtn) {
      boostBtn.classList.toggle('boosting', this.player.boosting);
    }

    if (quickCashBtn) {
      quickCashBtn.style.setProperty('--extract-pct', pctStr);
      quickCashBtn.classList.toggle('extracting', this.player.extracting);
      quickCashBtn.textContent = this.player.extracting
        ? `⏳ COBRANDO ${pct}%`
        : `💰 COBRAR (${pot.toLocaleString('en-US')} 💎)`;
    }
  }

  private setTicker(text: string, isError = false, mood: '' | 'winner' | 'crashed' = ''): void {
    const bar = document.getElementById('slitherTickerBar');
    if (!bar) return;
    bar.className = 'slither-ticker-bar' + (mood ? ' ' + mood : '');
    const color = isError ? '#ff4d7a' : mood === 'winner' ? '#00e701' : '#cbd5e1';
    const rightTxt = `Panda Slither &bull; ${ARENA_TIERS[this.tier].label}`;
    bar.innerHTML = `
      <span style="color: ${color};">${text}</span>
      <span style="font-size: 0.72rem; color: var(--accent-gold); font-family: 'Courier New', monospace;">${rightTxt}</span>
    `;
  }

  private updateControlsUI(): void {
    const inPlay = this.state === 'PLAYING';
    const betInput = document.getElementById('betAmountInput') as HTMLInputElement | null;
    if (betInput) betInput.disabled = inPlay;
    document.querySelectorAll('.btn-mod, .btn-qbet, .btn-diff').forEach(el => {
      (el as HTMLButtonElement).disabled = inPlay;
    });

    const boostBtn = document.getElementById('btnSlitherBoost') as HTMLButtonElement | null;
    const quickCashBtn = document.getElementById('btnSlitherCashoutQuick') as HTMLButtonElement | null;
    if (boostBtn) {
      boostBtn.disabled = !inPlay;
      boostBtn.classList.remove('boosting');
    }
    if (quickCashBtn) {
      quickCashBtn.style.setProperty('--extract-pct', '0%');
      quickCashBtn.classList.remove('extracting', 'btn-cashed-out');
      if (this.state === 'PLAYING') {
        quickCashBtn.disabled = false;
        quickCashBtn.textContent = '💰 COBRAR (2.5s)';
      } else if (this.state === 'CASHED_OUT') {
        quickCashBtn.disabled = true;
        quickCashBtn.classList.add('btn-cashed-out');
        quickCashBtn.textContent = `✓ +${this.cashoutPayout.toLocaleString('en-US')} 💎`;
      } else {
        quickCashBtn.disabled = true;
        quickCashBtn.textContent = '💰 COBRAR (2.5s)';
      }
    }

    const mainBtn = document.getElementById('btnSlitherAction') as HTMLButtonElement | null;
    const mainTitle = document.getElementById('btnSlitherMainTitle');
    const mainSub = document.getElementById('btnSlitherSubTitle');

    if (mainBtn && mainTitle && mainSub) {
      mainBtn.style.setProperty('--extract-pct', '0%');
      mainBtn.classList.remove('btn-bet', 'btn-cashout', 'btn-cashed-out', 'btn-crashed', 'extracting');
      delete mainBtn.dataset.mode;

      if (this.state === 'PLAYING') {
        mainBtn.disabled = false;
        mainBtn.dataset.mode = 'cashout';
        mainBtn.classList.add('btn-cashout');
        mainTitle.textContent = '💰 MANTENER P/ COBRAR (2.5s)';
        mainSub.style.display = 'block';
        mainSub.textContent = `x${this.currentMultiplier.toFixed(2)} = ${Math.round(this.betAmount * this.currentMultiplier).toLocaleString('en-US')} 💎`;
      } else if (this.state === 'CASHED_OUT') {
        mainBtn.disabled = false;
        mainBtn.classList.add('btn-cashed-out');
        mainTitle.textContent = '✓ ¡EXTRACCIÓN EXITOSA!';
        mainSub.style.display = 'block';
        mainSub.textContent = `+${this.cashoutPayout.toLocaleString('en-US')} 💎 • CLIC PARA REENTRAR`;
      } else if (this.state === 'DEAD') {
        mainBtn.disabled = false;
        mainBtn.classList.add('btn-crashed');
        mainTitle.textContent = '💥 ELIMINADO • REINTENTAR';
        mainSub.style.display = 'block';
        mainSub.textContent = 'Pulsa para entrar otra vez a la arena';
      } else {
        mainBtn.disabled = false;
        mainBtn.dataset.mode = 'bet';
        mainBtn.classList.add('btn-bet');
        mainTitle.textContent = '🐍 ENTRAR A LA ARENA';
        mainSub.style.display = 'none';
      }
    }

    const overlay = document.getElementById('slitherCanvasOverlay');
    if (overlay) {
      if (this.state === 'PLAYING') {
        overlay.style.display = 'none';
      } else {
        overlay.style.display = 'flex';
        if (this.state === 'CASHED_OUT') {
          overlay.innerHTML = `
            <div class="overlay-card win">
              <div class="overlay-title" style="color:#00e701;">🏆 ¡COBRO x${this.currentMultiplier.toFixed(2)}!</div>
              <div class="overlay-sub">Extrajiste <strong style="color:#ffb700;">+${this.cashoutPayout.toLocaleString('en-US')} 💎</strong> (${this.playerKills} bajas)</div>
              <button type="button" class="overlay-btn" id="btnOverlayPlayAgain">🐍 REENTRAR A LA ARENA</button>
            </div>
          `;
        } else if (this.state === 'DEAD') {
          overlay.innerHTML = `
            <div class="overlay-card crash">
              <div class="overlay-title" style="color:#ff4d7a;">💥 ¡ELIMINADO!</div>
              <div class="overlay-sub">Bajas logradas: <strong>${this.playerKills}</strong> &bull; Apuesta: ${this.betAmount.toLocaleString('en-US')} 💎</div>
              <button type="button" class="overlay-btn" id="btnOverlayPlayAgain">🔄 VOLVER A ENTRAR</button>
            </div>
          `;
        } else {
          overlay.innerHTML = `
            <div class="overlay-card">
              <div class="overlay-title">🐍 Panda Slither Arena</div>
              <div class="overlay-sub">Come botines dorados, corta a tus rivales con Turbo y mantén <strong>Q</strong> o <strong>COBRAR</strong> (2.5s) para extraer ganancias.</div>
              <button type="button" class="overlay-btn" id="btnOverlayPlayAgain">▶ ENTRAR A LA ARENA</button>
            </div>
          `;
        }
      }
    }
  }

  private updateStatsUI(): void {
    const rEl = document.getElementById('statTotalRounds');
    const kEl = document.getElementById('statTotalKills');
    const wEl = document.getElementById('statTotalWon');
    const mEl = document.getElementById('statBestMult');
    if (rEl) rEl.textContent = String(this.totalRounds);
    if (kEl) kEl.textContent = String(this.totalKillsSession);
    if (wEl) wEl.textContent = `+${this.totalDiamondsWon.toLocaleString('en-US')} 💎`;
    if (mEl) mEl.textContent = `x${this.bestMultiplier.toFixed(2)}`;
  }

  private addHistoryRow(bet: number, kills: number, mult: number, payout: number, isWin: boolean): void {
    const list = document.getElementById('slitherHistoryList');
    if (!list) return;
    const empty = list.querySelector('.empty-hist');
    if (empty) empty.remove();

    const row = document.createElement('div');
    row.className = 'history-item';
    row.style.borderLeft = `3px solid ${isWin ? '#00e701' : '#ff0055'}`;
    row.innerHTML = `
      <div>
        <span style="color:#fff; font-weight:700;">${bet} 💎</span>
        <span style="color:#8e9bb0; margin-left:4px;">(${kills}💀 &bull; ${isWin ? 'x' + mult.toFixed(2) : 'Eliminado'})</span>
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

  private updateCanvasPointerAngle(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const cx = ((clientX - rect.left) / rect.width) * VIEW_W;
    const cy = ((clientY - rect.top) / rect.height) * VIEW_H;

    if (this.steerPointerId !== null) {
      this.touchCurX = cx;
      this.touchCurY = cy;
      const dx = cx - this.touchOriginX;
      const dy = cy - this.touchOriginY;
      if (Math.hypot(dx, dy) >= 8) {
        this.mouseAngle = Math.atan2(dy, dx);
      }
    } else {
      const dx = cx - VIEW_W / 2;
      const dy = cy - VIEW_H / 2;
      if (Math.hypot(dx, dy) >= 4) {
        this.mouseAngle = Math.atan2(dy, dx);
        this.mouseActive = true;
      }
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
        if (this.state === 'PLAYING') return;
        document.querySelectorAll('.btn-qbet').forEach(b => b.classList.remove('active'));
        const el = e.currentTarget as HTMLElement;
        el.classList.add('active');
        const val = el.getAttribute('data-bet');
        if (betInput && val) betInput.value = val;
      });
    });

    document.querySelectorAll('.btn-diff').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (this.state === 'PLAYING') return;
        document.querySelectorAll('.btn-diff').forEach(b => b.classList.remove('active'));
        const el = e.currentTarget as HTMLElement;
        el.classList.add('active');
        const d = el.getAttribute('data-diff') as ArenaTierKey | null;
        if (d && ARENA_TIERS[d]) {
          this.tier = d;
          this.setupIdleArenaPreview();
          this.updateHudStrip();
          this.setTicker(`Arena ${ARENA_TIERS[d].label} lista (${ARENA_TIERS[d].botCount} rivales • hasta x${ARENA_TIERS[d].maxMult}).`, false);
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
      const val = Math.max(1.10, Math.min(200, parseFloat(autoInput.value) || 2.0));
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

    // Botón principal izquierda (click para entrar, mantener pulsado para extraer durante la partida)
    const mainActionBtn = document.getElementById('btnSlitherAction');
    mainActionBtn?.addEventListener('pointerdown', (e) => {
      if (this.state === 'PLAYING') {
        e.preventDefault();
        this.btnExtractHeld = true;
      }
    });
    mainActionBtn?.addEventListener('click', () => {
      if (this.state !== 'PLAYING') {
        this.startArenaRound();
      }
    });

    // Botón del overlay (Entrar / Reintentar)
    const overlay = document.getElementById('slitherCanvasOverlay');
    overlay?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('#btnOverlayPlayAgain')) {
        this.startArenaRound();
      }
    });

    // Botones táctiles bajo el canvas: Turbo y Cobrar (2.5s)
    const boostBtn = document.getElementById('btnSlitherBoost');
    boostBtn?.addEventListener('pointerdown', (e) => {
      if (this.state !== 'PLAYING') return;
      e.preventDefault();
      this.btnBoostHeld = true;
    });

    const quickCashBtn = document.getElementById('btnSlitherCashoutQuick');
    quickCashBtn?.addEventListener('pointerdown', (e) => {
      if (this.state !== 'PLAYING') return;
      e.preventDefault();
      this.btnExtractHeld = true;
    });

    // Puntero / Ratón / Joystick Táctil en Canvas
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.state !== 'PLAYING') return;
      if (e.pointerType === 'mouse') {
        if (e.button === 0) this.mouseDownBoost = true;
        this.updateCanvasPointerAngle(e.clientX, e.clientY);
      } else {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          this.steerPointerId = e.pointerId;
          this.touchOriginX = ((e.clientX - rect.left) / rect.width) * VIEW_W;
          this.touchOriginY = ((e.clientY - rect.top) / rect.height) * VIEW_H;
          this.touchCurX = this.touchOriginX;
          this.touchCurY = this.touchOriginY;
        }
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (this.state !== 'PLAYING') return;
      if (e.pointerType === 'mouse') {
        if (this.steerPointerId === null) {
          const rect = this.canvas.getBoundingClientRect();
          if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
            this.updateCanvasPointerAngle(e.clientX, e.clientY);
          }
        }
      } else if (e.pointerId === this.steerPointerId) {
        this.updateCanvasPointerAngle(e.clientX, e.clientY);
      }
    });

    const releasePointer = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        this.mouseDownBoost = false;
      } else if (e.pointerId === this.steerPointerId) {
        this.steerPointerId = null;
      }
      this.btnBoostHeld = false;
      this.btnExtractHeld = false;
    };
    window.addEventListener('pointerup', releasePointer);
    window.addEventListener('pointercancel', releasePointer);
    window.addEventListener('blur', () => {
      this.mouseDownBoost = false;
      this.btnBoostHeld = false;
      this.btnExtractHeld = false;
      this.keySpaceBoost = false;
      this.keyQExtract = false;
      this.keyTurnLeft = false;
      this.keyTurnRight = false;
      this.steerPointerId = null;
    });

    // Teclado: Q (mantener para cobrar), Espacio (Turbo), Flechas / A / D
    window.addEventListener('keydown', (e) => {
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      if (e.code === 'KeyQ') {
        if (this.state === 'PLAYING') {
          e.preventDefault();
          this.keyQExtract = true;
        }
      } else if (e.code === 'Space') {
        if (this.state === 'PLAYING') {
          e.preventDefault();
          this.keySpaceBoost = true;
        }
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        if (this.state === 'PLAYING') {
          e.preventDefault();
          this.keyTurnLeft = true;
        }
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        if (this.state === 'PLAYING') {
          e.preventDefault();
          this.keyTurnRight = true;
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyQ') this.keyQExtract = false;
      if (e.code === 'Space') this.keySpaceBoost = false;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keyTurnLeft = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keyTurnRight = false;
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PandaSlitherGame();
});
