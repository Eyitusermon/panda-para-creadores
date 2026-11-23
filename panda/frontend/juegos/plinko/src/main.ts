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

type RiskLevel = 'low' | 'medium' | 'high';

interface Peg {
  x: number;
  y: number;
  radius: number;
  glow: number; // 0 a 1
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

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  bet: number;
  color: string;
  trail: Array<{ x: number; y: number; alpha: number }>;
}

interface SlotBucket {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  multiplier: number;
  color: string;
  glow: number;
}

const STORAGE_KEY = 'panda_user_session';
const DIAMOND_RATE = 10; // 10 💎 = 1 USDT

// Tablas de multiplicadores calibradas para distribución balanceada y amigable
const MULTIPLIERS_CONFIG: Record<number, Record<RiskLevel, number[]>> = {
  10: {
    low:    [8.0, 4.0, 2.5, 1.8, 1.4, 1.1, 1.4, 1.8, 2.5, 4.0, 8.0],
    medium: [25, 8.0, 4.0, 2.2, 1.4, 0.9, 1.4, 2.2, 4.0, 8.0, 25],
    high:   [150, 25.0, 8.0, 2.8, 1.4, 0.7, 1.4, 2.8, 8.0, 25.0, 150]
  },
  12: {
    low:    [10.0, 5.0, 3.0, 2.0, 1.5, 1.2, 1.1, 1.2, 1.5, 2.0, 3.0, 5.0, 10.0],
    medium: [35, 10.0, 5.0, 2.5, 1.6, 1.2, 0.9, 1.2, 1.6, 2.5, 5.0, 10.0, 35],
    high:   [300, 35.0, 10.0, 3.5, 1.8, 1.1, 0.7, 1.1, 1.8, 3.5, 10.0, 35.0, 300]
  },
  14: {
    low:    [15.0, 7.0, 3.5, 2.2, 1.6, 1.3, 1.1, 1.0, 1.1, 1.3, 1.6, 2.2, 3.5, 7.0, 15.0],
    medium: [50, 15.0, 6.0, 3.0, 2.0, 1.4, 1.1, 0.9, 1.1, 1.4, 2.0, 3.0, 6.0, 15.0, 50],
    high:   [500, 45.0, 14.0, 5.0, 2.2, 1.4, 0.9, 0.6, 0.9, 1.4, 2.2, 5.0, 14.0, 45.0, 500]
  }
};

class NeonPlinkoGame {
  private userState: UserSession;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private rows = 12;
  private risk: RiskLevel = 'medium';

  private pegs: Peg[] = [];
  private slots: SlotBucket[] = [];
  private balls: Ball[] = [];
  private particles: Particle[] = [];
  private nextBallId = 1;

  private isAutoDropping = false;
  private autoDropTimer: number | null = null;

  // Estadísticas de la sesión
  private totalBallsDropped = 0;
  private totalDiamondsWon = 0;
  private bestMultiplier = 0;

  private lastFrameTime = performance.now();

  constructor() {
    this.userState = this.loadSession();
    const canvasEl = document.getElementById('plinkoCanvas') as HTMLCanvasElement | null;
    if (!canvasEl) throw new Error('Canvas #plinkoCanvas no encontrado');
    this.canvas = canvasEl;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('No se pudo inicializar Canvas 2D');
    this.ctx = context;

    this.initBoard();
    this.bindEvents();
    this.updateWalletUI();
    this.updateSideTable();

    // Sincronización en vivo con dashboard y otros juegos
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

  private initBoard(): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.pegs = [];
    this.slots = [];

    const topY = 65;
    const bottomY = h - 60;
    const totalHeight = bottomY - topY;
    const rowSpacing = totalHeight / (this.rows + 0.5);

    // 1. Generar la pirámide de pines (pegs)
    for (let r = 0; r < this.rows; r++) {
      const pegsInRow = r + 3; // Fila 0 tiene 3 pines, Fila 1 tiene 4...
      const y = topY + r * rowSpacing;
      const rowWidth = (pegsInRow - 1) * (w / (this.rows + 3.8));
      const startX = (w - rowWidth) / 2;
      const stepX = rowWidth / (pegsInRow - 1);

      for (let p = 0; p < pegsInRow; p++) {
        this.pegs.push({
          x: startX + p * stepX,
          y,
          radius: 4.2,
          glow: 0
        });
      }
    }

    // 2. Generar las casillas inferiores (slots con multiplicadores)
    const multList = MULTIPLIERS_CONFIG[this.rows][this.risk];
    const slotCount = multList.length;
    const lastRowPegs = this.rows + 2;
    const lastRowWidth = (lastRowPegs - 1) * (w / (this.rows + 3.8));
    const slotStartX = (w - lastRowWidth) / 2 - 14;
    const slotTotalWidth = lastRowWidth + 28;
    const slotWidth = slotTotalWidth / slotCount;
    const slotY = bottomY + 12;
    const slotHeight = 36;

    for (let i = 0; i < slotCount; i++) {
      const mult = multList[i];
      let color = '#00e701'; // Verde en centro
      if (mult >= 100) color = '#bd00ff'; // Violeta épico en bordes
      else if (mult >= 20) color = '#ff007f'; // Rosa neón
      else if (mult >= 4) color = '#ff9900'; // Naranja
      else if (mult >= 1.5) color = '#ffea00'; // Amarillo

      this.slots.push({
        index: i,
        x: slotStartX + i * slotWidth,
        y: slotY,
        width: slotWidth - 2.5,
        height: slotHeight,
        multiplier: mult,
        color,
        glow: 0
      });
    }
  }

  private updateSideTable(): void {
    const listWrap = document.getElementById('multipliersBreakdown');
    if (!listWrap) return;
    const multList = MULTIPLIERS_CONFIG[this.rows][this.risk];
    const uniqueMults = Array.from(new Set(multList)).sort((a, b) => b - a);

    listWrap.innerHTML = uniqueMults.map(m => {
      let badgeColor = '#00e701';
      if (m >= 100) badgeColor = '#bd00ff';
      else if (m >= 20) badgeColor = '#ff007f';
      else if (m >= 4) badgeColor = '#ffb700';
      else if (m < 1) badgeColor = '#8e9bb0';

      return `
        <div class="mult-row-stat">
          <span style="color:${badgeColor}; font-weight:800; font-family:'Courier New',monospace;">x${m}</span>
          <span style="color:#d1d5db;">Retorno: ${(m * 100).toFixed(0)}%</span>
        </div>
      `;
    }).join('');
  }

  private bindEvents(): void {
    const betInput = document.getElementById('betAmountInput') as HTMLInputElement | null;
    const btnDrop = document.getElementById('btnDropBall') as HTMLButtonElement | null;
    const btnAuto = document.getElementById('btnToggleAutoDrop');
    const btnHalf = document.getElementById('btnBetHalf');
    const btnDouble = document.getElementById('btnBetDouble');
    const btnMax = document.getElementById('btnBetMax');

    // Botones rápidos de inversión
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

    // Selector de Riesgo
    document.querySelectorAll('[data-risk]').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('[data-risk]').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        this.risk = (b.getAttribute('data-risk') as RiskLevel) || 'medium';
        this.initBoard();
        this.updateSideTable();
      });
    });

    // Selector de Filas
    document.querySelectorAll('[data-rows]').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('[data-rows]').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        this.rows = Number(b.getAttribute('data-rows')) || 12;
        this.initBoard();
        this.updateSideTable();
      });
    });

    // Lanzar bola individual
    btnDrop?.addEventListener('click', () => {
      this.dropBall();
    });

    // Alternar auto-drop
    btnAuto?.addEventListener('click', () => {
      this.isAutoDropping = !this.isAutoDropping;
      btnAuto.classList.toggle('active', this.isAutoDropping);
      btnAuto.textContent = this.isAutoDropping ? '⏹ Detener Auto' : '🔄 Auto-Drop';

      if (this.isAutoDropping) {
        this.autoDropTimer = window.setInterval(() => {
          if (this.isAutoDropping) {
            this.dropBall();
          }
        }, 320);
      } else if (this.autoDropTimer) {
        clearInterval(this.autoDropTimer);
        this.autoDropTimer = null;
      }
    });

    // Barra espaciadora para soltar rápido
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && document.activeElement !== betInput) {
        e.preventDefault();
        this.dropBall();
      }
    });
  }

  private dropBall(): void {
    const betInput = document.getElementById('betAmountInput') as HTMLInputElement | null;
    const bet = Math.floor(Number(betInput?.value) || 0);

    if (bet < 10) {
      this.setTicker('⚠️ El monto mínimo es de 10 💎 (1 USDT).', false);
      this.stopAutoDrop();
      return;
    }

    if (bet > this.userState.balance) {
      this.setTicker('⚠️ Saldo insuficiente de 💎 Diamantes.', false);
      this.stopAutoDrop();
      return;
    }

    // Descontar saldo y añadir XP VIP (+1 XP por cada 10 💎) y acumular gasto semanal para el Bono Semanal (10%)
    this.userState.balance -= bet;
    this.userState.xp = (this.userState.xp || 0) + Math.max(1, Math.floor(bet / 10));
    this.userState.weeklySpent = (Number(this.userState.weeklySpent) || 0) + bet;
    this.checkVip();
    this.saveSession();

    this.totalBallsDropped++;
    this.updateStatsUI();

    // Posición inicial en el embudo superior con mayor dispersión estocástica
    const startX = this.canvas.width / 2 + (Math.random() - 0.5) * 16;
    const startY = 30;

    this.balls.push({
      id: this.nextBallId++,
      x: startX,
      y: startY,
      vx: (Math.random() - 0.5) * 20,
      vy: 42,
      radius: 6.2,
      bet,
      color: '#bd00ff',
      trail: []
    });
  }

  private stopAutoDrop(): void {
    this.isAutoDropping = false;
    if (this.autoDropTimer) {
      clearInterval(this.autoDropTimer);
      this.autoDropTimer = null;
    }
    const btnAuto = document.getElementById('btnToggleAutoDrop');
    if (btnAuto) {
      btnAuto.classList.remove('active');
      btnAuto.textContent = '🔄 Auto-Drop';
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

  private updateStatsUI(): void {
    const bEl = document.getElementById('statTotalBalls');
    const wEl = document.getElementById('statTotalWon');
    const mEl = document.getElementById('statBestMult');

    if (bEl) bEl.textContent = this.totalBallsDropped.toLocaleString('en-US');
    if (wEl) wEl.textContent = `+${this.totalDiamondsWon.toLocaleString('en-US')} 💎`;
    if (mEl) mEl.textContent = `x${this.bestMultiplier.toFixed(1)}`;
  }

  private setTicker(msg: string, isWin: boolean): void {
    const bar = document.getElementById('plinkoTickerBar');
    if (!bar) return;
    bar.classList.toggle('winner', isWin);
    bar.innerHTML = `
      <span style="font-weight:${isWin ? '900' : '600'}; color:${isWin ? '#00e701' : '#cbd5e1'};">${msg}</span>
      <span style="font-size:0.72rem; color:#ffb700; font-family:'Courier New',monospace;">Neon Gravity</span>
    `;
  }

  private onBallHitSlot(ball: Ball, slot: SlotBucket): void {
    slot.glow = 1.0;
    const mult = slot.multiplier;
    const payout = Math.floor(ball.bet * mult);

    if (payout > 0) {
      this.userState.balance += payout;
      this.saveSession();
      this.totalDiamondsWon += payout;
    }

    if (mult > this.bestMultiplier) {
      this.bestMultiplier = mult;
    }
    this.updateStatsUI();

    const isProfit = mult >= 1.0;
    this.setTicker(
      `¡Multiplicador x${mult}! ${isProfit ? `Ganaste +${payout.toLocaleString('en-US')} 💎` : `Retorno: ${payout} 💎`}`,
      isProfit
    );

    // Añadir chip al strip horizontal
    this.addRecentChip(mult);

    // Añadir fila al historial lateral
    this.addHistoryRow(ball.bet, mult, payout);

    // Partículas de celebración en la casilla
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 4;
      this.particles.push({
        x: slot.x + slot.width / 2,
        y: slot.y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 2,
        alpha: 1.0,
        color: slot.color,
        radius: 2 + Math.random() * 2.5
      });
    }
  }

  private addRecentChip(mult: number): void {
    const strip = document.getElementById('recentChipsStrip');
    if (!strip) return;
    const chip = document.createElement('div');
    chip.className = 'chip-mult';
    if (mult >= 100) chip.classList.add('chip-epic');
    else if (mult >= 10) chip.classList.add('chip-high');
    else if (mult >= 2) chip.classList.add('chip-mid');
    else chip.classList.add('chip-low');

    chip.textContent = `x${mult}`;
    strip.prepend(chip);

    while (strip.children.length > 15) {
      strip.lastElementChild?.remove();
    }
  }

  private addHistoryRow(bet: number, mult: number, payout: number): void {
    const list = document.getElementById('plinkoHistoryList');
    if (!list) return;
    const emptyMsg = list.querySelector('.empty-hist');
    if (emptyMsg) emptyMsg.remove();

    const row = document.createElement('div');
    row.className = 'history-item';
    const isProfit = mult >= 1.0;
    row.innerHTML = `
      <span style="color:#8e9bb0;">${bet} 💎</span>
      <span style="color:${isProfit ? '#00e701' : '#ffb700'}; font-weight:800;">x${mult}</span>
      <span style="color:${isProfit ? '#00e701' : '#8e9bb0'}; font-weight:900; font-family:'Courier New',monospace;">
        ${payout > 0 ? `+${payout} 💎` : '0 💎'}
      </span>
    `;
    list.prepend(row);

    while (list.children.length > 15) {
      list.lastElementChild?.remove();
    }
  }

  private loop(currentTime: number): void {
    const dt = Math.min(0.033, (currentTime - this.lastFrameTime) / 1000);
    this.lastFrameTime = currentTime;

    this.updatePhysics(dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  private updatePhysics(dt: number): void {
    // Gravedad suave, controlada y cinematográfica (caída en ~2.8 segundos)
    const gravity = 420; // px/s²
    const elasticity = 0.44;
    const h = this.canvas.height;
    const centerX = this.canvas.width / 2;

    // Actualizar bolas
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];

      b.vy += gravity * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Estela de la bola
      b.trail.push({ x: b.x, y: b.y, alpha: 0.55 });
      if (b.trail.length > 6) b.trail.shift();

      // Colisión con los pines (pegs)
      for (const peg of this.pegs) {
        const dx = b.x - peg.x;
        const dy = b.y - peg.y;
        const dist = Math.hypot(dx, dy);
        const minDist = b.radius + peg.radius;

        if (dist < minDist) {
          // Normalizar vector de rebote
          const nx = dx / (dist || 1);
          const ny = dy / (dist || 1);

          // Separar la bola para evitar que quede atrapada
          b.x = peg.x + nx * minDist;
          b.y = peg.y + ny * minDist;

          // Reflejo elástico natural
          const dot = b.vx * nx + b.vy * ny;
          if (dot < 0) {
            b.vx = (b.vx - 1.5 * dot * nx) * elasticity;
            b.vy = (b.vy - 1.5 * dot * ny) * elasticity;
          }

          // Bifurcación natural Galton con dispersión lateral amigable
          const side = Math.abs(dx) > 0.5 ? Math.sign(dx) : (Math.random() < 0.5 ? 1 : -1);
          b.vx += side * (14 + Math.random() * 16);
          b.vx *= 0.94; // Mayor fluidez y dispersión hacia multiplicadores altos

          // Impulso hacia afuera si la bola pasa cerca del centro (evita acumulación en centro)
          const centerCanvas = w / 2;
          const distFromCenter = Math.abs(b.x - centerCanvas);
          const outwardDir = b.x >= centerCanvas ? 1 : -1;
          if (distFromCenter < 60 && Math.random() < 0.45) {
            b.vx += outwardDir * (12 + Math.random() * 15);
          }

          // Velocidad mínima y límites terminales
          if (b.vy < 35) b.vy = 35;
          if (b.vy > 250) b.vy = 250;
          if (Math.abs(b.vx) > 140) b.vx = Math.sign(b.vx) * 140;

          peg.glow = 1.0;

          // Chispas de impacto
          if (Math.random() < 0.5) {
            this.particles.push({
              x: peg.x,
              y: peg.y,
              vx: (Math.random() - 0.5) * 2.5,
              vy: (Math.random() - 0.5) * 2.5,
              alpha: 0.85,
              color: '#00f0ff',
              radius: 1.6
            });
          }
        }
      }

      // Colisión con ranuras inferiores
      const slotY = this.slots[0]?.y || (h - 50);
      if (b.y >= slotY) {
        // Encontrar casilla alcanzada
        let matchedSlot = this.slots.find(s => b.x >= s.x && b.x <= s.x + s.width);
        if (!matchedSlot) {
          if (b.x < this.slots[0].x) matchedSlot = this.slots[0];
          else matchedSlot = this.slots[this.slots.length - 1];
        }

        // MODO CREADOR: 92% de protección contra casillas bajas/pérdidas (< 1.0)
        // Redirige la bola hacia casillas rentables y multiplicadores elevados (x2, x4, x10, etc.)
        if (matchedSlot && matchedSlot.multiplier < 1.0 && Math.random() < 0.92) {
          const idx = this.slots.indexOf(matchedSlot);
          const profitableIndices: number[] = [];
          this.slots.forEach((s, sIdx) => {
            if (s.multiplier >= 1.2) profitableIndices.push(sIdx);
          });
          if (profitableIndices.length > 0) {
            profitableIndices.sort((a, b) => Math.abs(a - idx) - Math.abs(b - idx));
            const chosenIdx = profitableIndices[Math.floor(Math.random() * Math.min(3, profitableIndices.length))];
            matchedSlot = this.slots[chosenIdx];
            b.x = matchedSlot.x + matchedSlot.width / 2;
          }
        }

        this.onBallHitSlot(b, matchedSlot);
        this.balls.splice(i, 1);
      }
    }

    // Actualizar brillo de pines y casillas
    for (const peg of this.pegs) {
      if (peg.glow > 0) peg.glow = Math.max(0, peg.glow - dt * 3.5);
    }
    for (const slot of this.slots) {
      if (slot.glow > 0) slot.glow = Math.max(0, slot.glow - dt * 2.2);
    }

    // Actualizar partículas
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= dt * 2.0;
      if (p.alpha <= 0) this.particles.splice(i, 1);
    }
  }

  private render(): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);

    // 1. Dibujar embudo superior
    this.ctx.save();
    this.ctx.fillStyle = '#0e1730';
    this.ctx.strokeStyle = '#bd00ff';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.moveTo(w / 2 - 30, 8);
    this.ctx.lineTo(w / 2 - 12, 40);
    this.ctx.lineTo(w / 2 + 12, 40);
    this.ctx.lineTo(w / 2 + 30, 8);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();

    // 2. Dibujar pines (pegs)
    for (const peg of this.pegs) {
      this.ctx.save();
      const isGlowing = peg.glow > 0;
      if (isGlowing) {
        this.ctx.shadowColor = '#00f0ff';
        this.ctx.shadowBlur = 12 * peg.glow;
      }

      this.ctx.fillStyle = isGlowing ? '#ffffff' : '#4a5b82';
      this.ctx.beginPath();
      this.ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
      this.ctx.fill();

      // Borde neón sutil
      this.ctx.strokeStyle = isGlowing ? '#00f0ff' : 'rgba(189, 0, 255, 0.4)';
      this.ctx.lineWidth = 1.2;
      this.ctx.stroke();
      this.ctx.restore();
    }

    // 3. Dibujar casillas inferiores (slots con multiplicadores)
    for (const slot of this.slots) {
      this.ctx.save();
      const isGlowing = slot.glow > 0;
      if (isGlowing) {
        this.ctx.shadowColor = slot.color;
        this.ctx.shadowBlur = 15;
      }

      this.ctx.fillStyle = isGlowing ? slot.color : '#0c1326';
      this.ctx.strokeStyle = slot.color;
      this.ctx.lineWidth = 1.5;

      this.ctx.beginPath();
      this.ctx.roundRect(slot.x, slot.y, slot.width, slot.height, 5);
      this.ctx.fill();
      this.ctx.stroke();

      // Texto de multiplicador
      this.ctx.font = 'bold 11px "Courier New", monospace';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = isGlowing ? '#070a14' : slot.color;
      this.ctx.fillText(`x${slot.multiplier}`, slot.x + slot.width / 2, slot.y + slot.height / 2);
      this.ctx.restore();
    }

    // 4. Dibujar partículas
    for (const p of this.particles) {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    // 5. Dibujar bolas cayendo
    for (const b of this.balls) {
      this.ctx.save();

      // Estela neón
      for (let i = 0; i < b.trail.length; i++) {
        const t = b.trail[i];
        this.ctx.fillStyle = `rgba(189, 0, 255, ${t.alpha * 0.4})`;
        this.ctx.beginPath();
        this.ctx.arc(t.x, t.y, b.radius * (0.5 + 0.5 * (i / b.trail.length)), 0, Math.PI * 2);
        this.ctx.fill();
      }

      // Bola principal con resplandor
      this.ctx.shadowColor = '#bd00ff';
      this.ctx.shadowBlur = 10;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.strokeStyle = '#bd00ff';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      this.ctx.restore();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new NeonPlinkoGame();
});
