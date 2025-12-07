// Christmas Hunt Game - Client with all features

class ChristmasHuntGame {
  constructor() {
    this.ws = null;
    this.playerId = null;
    this.player = null;
    this.players = new Map();
    this.gifts = new Map();
    this.powerups = new Map();
    this.obstacles = new Map();
    this.grinches = new Map();
    this.snowballs = new Map();
    this.teams = new Map();
    this.worldSize = { width: 3000, height: 2000 };
    this.camera = { x: 0, y: 0 };
    this.cameraZoom = 1.0; // Normal zoom (was 0.7 but caused edge issues)
    this.keys = {};
    this.levels = [];
    this.powerupTypes = [];
    this.emotes = [];
    this.gameMode = 'capture';
    this.weather = 'clear';
    this.timeOfDay = 'night';
    this.floatingEmotes = [];

    // Capture the Tree mode state
    this.roundActive = false;
    this.roundEndTime = 0;
    this.hitsToRespawn = 3;

    // Canvas
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas.getContext('2d');

    // Snowflakes for weather
    this.snowflakes = [];
    this.blizzardSnowflakes = [];

    // Pre-generated decorations
    this.decorations = [];

    // Joystick
    this.joystick = { active: false, dx: 0, dy: 0 };

    // Mouse position for throwing
    this.mouseX = 0;
    this.mouseY = 0;

    // Player facing direction (default: right)
    this.facingDirX = 1;
    this.facingDirY = 0;

    // Pending collection requests to avoid duplicates
    this.pendingGiftCollections = new Set();
    this.pendingPowerupCollections = new Set();

    // Visual effects
    this.particles = [];
    this.floatingTexts = [];
    this.trails = [];
    this.screenShake = { x: 0, y: 0, intensity: 0 };
    this.lastPlayerPos = { x: 0, y: 0 };
    this.animationTime = 0;

    // Stars for night sky
    this.stars = [];

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.resizeCanvas();
    this.createSnowflakes();
    this.createStars();
    this.connect();
  }

  createStars() {
    this.stars = [];
    for (let i = 0; i < 100; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random() * 0.4,
        size: Math.random() * 2 + 0.5,
        twinkle: Math.random() * Math.PI * 2
      });
    }
  }

  // Particle system
  spawnParticles(x, y, color, count = 10, speed = 3) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed * (0.5 + Math.random()),
        vy: Math.sin(angle) * speed * (0.5 + Math.random()),
        color,
        life: 1,
        decay: 0.02 + Math.random() * 0.02,
        size: 3 + Math.random() * 4
      });
    }
  }

  spawnSparkles(x, y, color) {
    for (let i = 0; i < 5; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 2 - 1,
        color,
        life: 1,
        decay: 0.03,
        size: 2 + Math.random() * 3,
        sparkle: true
      });
    }
  }

  addFloatingText(x, y, text, color = '#fff') {
    this.floatingTexts.push({
      x, y,
      text,
      color,
      life: 1,
      vy: -2
    });
  }

  addTrail(x, y, color) {
    this.trails.push({
      x, y,
      color,
      life: 1,
      size: 8
    });
  }

  triggerScreenShake(intensity = 5) {
    this.screenShake.intensity = intensity;
  }

  connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}/ws?room=main`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('join-screen').classList.remove('hidden');
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.ws.onclose = () => {
      setTimeout(() => this.connect(), 3000);
    };
  }

  handleMessage(data) {
    switch (data.type) {
      case 'welcome':
        this.handleWelcome(data);
        break;
      case 'playerJoined':
        this.players.set(data.player.id, data.player);
        this.updateUI();
        break;
      case 'playerLeft':
        this.players.delete(data.playerId);
        this.updateUI();
        break;
      case 'playerMoved':
        const p = this.players.get(data.playerId);
        if (p) {
          p.x = data.x;
          p.y = data.y;
          p.onIce = data.onIce;
          p.inSnowdrift = data.inSnowdrift;
          p.frozen = data.frozen;
        }
        // Also update local player with server authoritative position
        if (data.playerId === this.playerId && this.player) {
          this.player.x = data.x;
          this.player.y = data.y;
          this.player.onIce = data.onIce;
          this.player.inSnowdrift = data.inSnowdrift;
          this.player.frozen = data.frozen;
        }
        break;
      case 'giftSpawned':
        this.gifts.set(data.gift.id, data.gift);
        break;
      case 'giftsMoved':
        // Update gift positions when magnet moves them
        for (const g of data.gifts) {
          const gift = this.gifts.get(g.id);
          if (gift) {
            gift.x = g.x;
            gift.y = g.y;
          }
        }
        break;
      case 'giftCollected':
        // Get gift position before deleting for particles
        const collectedGift = this.gifts.get(data.giftId);
        if (collectedGift) {
          this.spawnParticles(collectedGift.x, collectedGift.y, collectedGift.color, 12, 4);
          this.addFloatingText(collectedGift.x, collectedGift.y - 20, '+' + data.points, '#ffd700');
        }
        this.gifts.delete(data.giftId);
        this.pendingGiftCollections.delete(data.giftId);
        if (data.playerId === this.playerId) {
          this.player.score = data.playerScore;
          this.player.giftsCollected = data.giftsCollected;
          this.player.level = data.level;
          this.player.snowballs = data.snowballs;
          this.updateHUD();
          if (data.leveledUp) this.showLevelUp();
        }
        const collector = this.players.get(data.playerId);
        if (collector) {
          collector.score = data.playerScore;
          collector.level = data.level;
        }
        this.updateLeaderboard();
        break;
      case 'powerupSpawned':
        this.powerups.set(data.powerup.id, data.powerup);
        break;
      case 'powerupCollected':
        const collectedPowerup = this.powerups.get(data.powerupId);
        if (collectedPowerup) {
          this.spawnParticles(collectedPowerup.x, collectedPowerup.y, collectedPowerup.color, 15, 5);
        }
        this.powerups.delete(data.powerupId);
        this.pendingPowerupCollections.delete(data.powerupId);
        if (data.playerId === this.playerId) {
          this.player.powerups = data.playerPowerups;
          this.player.x = data.x;
          this.player.y = data.y;
          this.updateActivePowerups();
        }
        break;
      case 'grinchSpawned':
        this.grinches.set(data.grinch.id, data.grinch);
        break;
      case 'grinchMoved':
        const g = this.grinches.get(data.grinchId);
        if (g) { g.x = data.x; g.y = data.y; }
        break;
      case 'grinchStole':
        if (data.playerId === this.playerId) {
          this.player.score = data.playerScore;
          this.updateHUD();
          this.showNotification('Grinch stole ' + data.stolenPoints + ' points!', '#ff4444');
          this.triggerScreenShake(8);
          // Spawn red particles around player
          this.spawnParticles(this.player.x, this.player.y, '#ff4444', 20, 6);
        }
        break;
      case 'grinchHit':
        const gh = this.grinches.get(data.grinchId);
        if (gh) { gh.x = data.x; gh.y = data.y; }
        break;
      case 'snowballThrown':
        this.snowballs.set(data.snowball.id, data.snowball);
        if (data.snowball.ownerId === this.playerId) {
          this.player.snowballs = data.throwerSnowballs;
          this.updateHUD();
        }
        break;
      case 'snowballRemoved':
        this.snowballs.delete(data.snowballId);
        break;
      case 'snowballHit':
        this.snowballs.delete(data.snowballId);
        if (data.hitPlayerId === this.playerId) {
          this.player.frozen = true;
          this.showFrozenOverlay();
        }
        break;
      case 'turretShot':
        this.snowballs.set(data.snowball.id, data.snowball);
        break;
      case 'playerFellThroughIce':
        if (data.playerId === this.playerId) {
          this.player.x = data.x;
          this.player.y = data.y;
          this.player.score -= data.lostPoints;
          this.updateHUD();
          this.showNotification('Fell through ice! -' + data.lostPoints, '#87ceeb');
        }
        break;
      case 'playerEmote':
        this.showFloatingEmote(data.emote, data.x, data.y);
        break;
      case 'weatherChanged':
        this.weather = data.weather;
        this.updateWeatherUI();
        break;
      case 'timeChanged':
        this.timeOfDay = data.timeOfDay;
        this.updateTimeUI();
        break;
      case 'chat':
        this.addChatMessage(data.message);
        break;
      case 'playerTeamChanged':
        const player = this.players.get(data.playerId);
        if (player) player.team = data.teamId;
        if (data.playerId === this.playerId) this.player.team = data.teamId;
        this.updateTeamsPanel();
        break;
      case 'teamCreated':
        this.teams.set(data.team.id, data.team);
        this.updateTeamsPanel();
        break;

      // Capture the Tree mode events
      case 'roundStart':
        this.roundActive = true;
        this.roundEndTime = data.roundEndTime;
        this.showNotification('ROUND STARTED!', '#4ecdc4');
        // Reset local player position from server
        break;
      case 'roundTimer':
        this.roundEndTime = data.roundEndTime;
        this.updateRoundTimer();
        break;
      case 'roundEnd':
        this.roundActive = false;
        this.showRoundEndScreen(data);
        break;
      case 'treeCapture':
        this.showTreeCaptureEffect(data);
        break;
      case 'snowballHit':
        // Handle hit effects
        if (data.hitPlayerId === this.playerId) {
          this.player.hits = data.hits;
          this.updateHitsDisplay();
          this.triggerScreenShake(6);
          if (data.respawned) {
            this.player.x = data.playerX;
            this.player.y = data.playerY;
            this.player.hits = 0;
            this.showNotification('RESPAWNED!', '#ff6b6b');
          } else {
            this.showNotification(`HIT! ${data.hits}/${data.hitsToRespawn}`, '#87ceeb');
          }
        }
        const hitPlayer = this.players.get(data.hitPlayerId);
        if (hitPlayer) {
          hitPlayer.hits = data.hits;
          if (data.respawned) {
            hitPlayer.x = data.playerX;
            hitPlayer.y = data.playerY;
          }
          this.spawnParticles(hitPlayer.x, hitPlayer.y, '#87ceeb', 15, 4);
        }
        this.snowballs.delete(data.snowballId);
        break;
    }
  }

  handleWelcome(data) {
    this.playerId = data.playerId;
    this.player = data.player;
    this.worldSize = data.worldSize;
    this.levels = data.levels;
    this.powerupTypes = data.powerupTypes;
    this.emotes = data.emotes;
    this.weather = data.weather;
    this.timeOfDay = data.timeOfDay;
    this.gameMode = data.gameMode;

    // Capture the Tree state
    this.roundActive = data.roundActive;
    this.roundEndTime = data.roundEndTime;
    this.hitsToRespawn = data.hitsToRespawn || 3;

    data.players.forEach(p => this.players.set(p.id, p));
    data.gifts.forEach(g => this.gifts.set(g.id, g));
    data.powerups.forEach(p => this.powerups.set(p.id, p));
    data.obstacles.forEach(o => this.obstacles.set(o.id, o));
    data.grinches.forEach(g => this.grinches.set(g.id, g));
    data.snowballs.forEach(s => this.snowballs.set(s.id, s));
    data.teams.forEach(t => this.teams.set(t.id, t));
    data.chat.forEach(msg => this.addChatMessage(msg, false));

    document.getElementById('join-screen').classList.add('hidden');
    document.getElementById('game-container').classList.add('active');

    // Generate decorations once we know world size
    this.generateDecorations();

    this.setupEmotesBar();
    this.updateHUD();
    this.updateUI();
    this.updateWeatherUI();
    this.updateTimeUI();
    this.updateRoundTimer();
    this.updateHitsDisplay();
    this.startGameLoop();
  }

  generateDecorations() {
    this.decorations = [];
    let seed = 12345;

    const mulberry32 = () => {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };

    for (let i = 0; i < 80; i++) {
      const x = mulberry32() * this.worldSize.width;
      const y = mulberry32() * this.worldSize.height;
      const type = mulberry32() > 0.75 ? 'snowman' : 'tree';
      const scale = 0.5 + mulberry32() * 0.8;

      this.decorations.push({ x, y, type, scale });
    }
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.resizeCanvas());

    // Join
    document.getElementById('join-btn').addEventListener('click', () => this.joinGame());
    document.getElementById('player-name').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.joinGame();
    });

    // Colors
    document.querySelectorAll('.color-option').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.color-option').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
      });
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      if (e.key === 'Enter' && document.activeElement !== document.getElementById('chat-input')) {
        document.getElementById('chat-input').focus();
      }
      // Space to throw snowball
      if (e.code === 'Space' && this.player) {
        this.throwSnowball();
      }
    });
    document.addEventListener('keyup', (e) => this.keys[e.key.toLowerCase()] = false);

    // Mouse
    this.canvas.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX + this.camera.x;
      this.mouseY = e.clientY + this.camera.y;
    });
    this.canvas.addEventListener('click', (e) => {
      if (this.player) this.throwSnowball();
    });

    // Chat
    document.getElementById('chat-send').addEventListener('click', () => this.sendChat());
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendChat();
    });
    document.getElementById('chat-toggle').addEventListener('click', () => {
      document.getElementById('chat-container').classList.toggle('collapsed');
    });

    // Toggles
    document.getElementById('leaderboard-toggle').addEventListener('click', () => {
      document.getElementById('leaderboard').classList.toggle('collapsed');
    });
    document.getElementById('teams-toggle').addEventListener('click', () => {
      document.getElementById('teams-panel').classList.toggle('collapsed');
    });

    // Create team
    document.getElementById('create-team-btn').addEventListener('click', () => {
      const name = prompt('Team name:');
      if (name) this.ws.send(JSON.stringify({ type: 'createTeam', name }));
    });

    // Mobile throw button - use facing direction
    document.getElementById('throw-btn').addEventListener('click', () => {
      if (this.player) {
        this.throwSnowball();
      }
    });

    // Virtual joystick
    this.setupJoystick();
  }

  setupJoystick() {
    const zone = document.getElementById('joystick-zone');
    const stick = document.getElementById('joystick-stick');
    const baseX = 60, baseY = 60;
    const maxDist = 35;

    const handleMove = (clientX, clientY) => {
      const rect = zone.getBoundingClientRect();
      let dx = clientX - rect.left - baseX;
      let dy = clientY - rect.top - baseY;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist > maxDist) {
        dx = (dx / dist) * maxDist;
        dy = (dy / dist) * maxDist;
      }

      stick.style.left = (baseX + dx - 25) + 'px';
      stick.style.top = (baseY + dy - 25) + 'px';

      this.joystick.dx = dx / maxDist;
      this.joystick.dy = dy / maxDist;
    };

    const handleEnd = () => {
      this.joystick.active = false;
      this.joystick.dx = 0;
      this.joystick.dy = 0;
      stick.style.left = '35px';
      stick.style.top = '35px';
    };

    zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.joystick.active = true;
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    });

    zone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (this.joystick.active) {
        const touch = e.touches[0];
        handleMove(touch.clientX, touch.clientY);
      }
    });

    zone.addEventListener('touchend', handleEnd);
    zone.addEventListener('touchcancel', handleEnd);
  }

  setupEmotesBar() {
    const bar = document.getElementById('emotes-bar');
    bar.innerHTML = this.emotes.map(e =>
      `<button class="emote-btn" data-emote="${e}">${e}</button>`
    ).join('');

    bar.querySelectorAll('.emote-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.ws.send(JSON.stringify({ type: 'emote', emote: btn.dataset.emote }));
      });
    });
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.minimapCanvas.width = 150;
    this.minimapCanvas.height = 100;
  }

  joinGame() {
    const name = document.getElementById('player-name').value.trim() || `Player${Math.floor(Math.random() * 1000)}`;
    const selected = document.querySelector('.color-option.selected');
    const color = selected ? selected.dataset.color : '#ff6b6b';
    this.ws.send(JSON.stringify({ type: 'join', name, color }));
  }

  startGameLoop() {
    const loop = () => {
      this.update();
      this.render();
      requestAnimationFrame(loop);
    };
    loop();
  }

  update() {
    if (!this.player) return;

    // Update round timer every frame for smooth countdown
    this.updateRoundTimer();

    let dx = 0, dy = 0;

    // Keyboard
    if (this.keys['w'] || this.keys['arrowup']) dy = -1;
    if (this.keys['s'] || this.keys['arrowdown']) dy = 1;
    if (this.keys['a'] || this.keys['arrowleft']) dx = -1;
    if (this.keys['d'] || this.keys['arrowright']) dx = 1;

    // Joystick
    if (Math.abs(this.joystick.dx) > 0.1) dx = this.joystick.dx;
    if (Math.abs(this.joystick.dy) > 0.1) dy = this.joystick.dy;

    if (dx !== 0 || dy !== 0) {
      // Normalize
      const len = Math.sqrt(dx*dx + dy*dy);
      if (len > 1) { dx /= len; dy /= len; }

      // Update facing direction
      this.facingDirX = dx;
      this.facingDirY = dy;

      this.ws.send(JSON.stringify({ type: 'move', dx, dy }));

      // Optimistic update
      const levelData = this.levels[this.player.level] || this.levels[0];
      let speed = levelData.speed;
      const hasSpeed = this.player.powerups?.speed && Date.now() < this.player.powerups.speed;
      if (hasSpeed) speed *= 2;
      if (this.player.inSnowdrift) speed *= 0.5;

      // Add trail when moving (more frequent with speed powerup)
      if (Math.random() < (hasSpeed ? 0.4 : 0.15)) {
        this.addTrail(this.player.x, this.player.y, hasSpeed ? '#ffd700' : this.player.color + '80');
      }

      // Add sparkles when player has speed boost
      if (hasSpeed && Math.random() < 0.3) {
        this.spawnSparkles(this.player.x, this.player.y, '#ffd700');
      }

      this.player.x = Math.max(0, Math.min(this.worldSize.width, this.player.x + dx * speed));
      this.player.y = Math.max(0, Math.min(this.worldSize.height, this.player.y + dy * speed));
    }

    // Auto-collect gifts and powerups (with duplicate prevention)
    this.gifts.forEach((gift, id) => {
      if (this.pendingGiftCollections.has(id)) return;
      const dist = this.distance(this.player, gift);
      if (dist < 45) {
        this.pendingGiftCollections.add(id);
        this.ws.send(JSON.stringify({ type: 'collect', giftId: id }));
        // Remove from pending after timeout in case server doesn't respond
        setTimeout(() => this.pendingGiftCollections.delete(id), 2000);
      }
    });

    this.powerups.forEach((pu, id) => {
      if (this.pendingPowerupCollections.has(id)) return;
      const dist = this.distance(this.player, pu);
      if (dist < 45) {
        this.pendingPowerupCollections.add(id);
        this.ws.send(JSON.stringify({ type: 'collectPowerup', powerupId: id }));
        setTimeout(() => this.pendingPowerupCollections.delete(id), 2000);
      }
    });

    // Update camera
    this.camera.x = this.player.x - this.canvas.width / 2;
    this.camera.y = this.player.y - this.canvas.height / 2;
    this.camera.x = Math.max(0, Math.min(this.worldSize.width - this.canvas.width, this.camera.x));
    this.camera.y = Math.max(0, Math.min(this.worldSize.height - this.canvas.height, this.camera.y));

    // Update snowballs locally
    this.snowballs.forEach(sb => {
      sb.x += sb.vx;
      sb.y += sb.vy;
    });

    // Update powerup display
    this.updateActivePowerups();
  }

  throwSnowball() {
    if (!this.player || this.player.snowballs <= 0) return;

    // Always shoot in the direction the player is facing/moving
    const throwDistance = 300;
    const targetX = this.player.x + this.facingDirX * throwDistance;
    const targetY = this.player.y + this.facingDirY * throwDistance;

    this.ws.send(JSON.stringify({
      type: 'throwSnowball',
      targetX,
      targetY
    }));
  }

  distance(a, b) {
    return Math.sqrt((a.x - b.x)**2 + (a.y - b.y)**2);
  }

  render() {
    const ctx = this.ctx;

    // Update animation time
    this.animationTime += 0.016;

    // Apply screen shake
    if (this.screenShake.intensity > 0) {
      this.screenShake.x = (Math.random() - 0.5) * this.screenShake.intensity;
      this.screenShake.y = (Math.random() - 0.5) * this.screenShake.intensity;
      this.screenShake.intensity *= 0.9;
      if (this.screenShake.intensity < 0.1) this.screenShake.intensity = 0;
    }

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Background based on time (drawn without zoom)
    this.drawBackground();

    // Apply screen shake transform
    ctx.save();
    if (this.screenShake.intensity > 0) {
      ctx.translate(this.screenShake.x, this.screenShake.y);
    }

    // Grid
    this.drawGrid();

    // Obstacles
    this.obstacles.forEach(obs => this.drawObstacle(obs));

    // Decorations
    this.drawDecorations();

    // Team base trees (for capture mode)
    if (this.gameMode === 'capture') {
      this.drawTeamTrees();
    }

    // Gifts
    this.gifts.forEach(gift => this.drawGift(gift));

    // Powerups
    this.powerups.forEach(pu => this.drawPowerup(pu));

    // Snowballs
    this.snowballs.forEach(sb => this.drawSnowball(sb));

    // Grinches
    this.grinches.forEach(g => this.drawGrinch(g));

    // Other players
    this.players.forEach(p => {
      if (p.id !== this.playerId) this.drawPlayer(p);
    });

    // Local player
    if (this.player) this.drawPlayer(this.player, true);

    // Draw trails
    this.drawTrails();

    // Draw particles
    this.drawParticles();

    // Draw floating texts
    this.drawFloatingTexts();

    // Weather effects
    this.drawWeatherEffects();

    // Draw stars at night
    if (this.timeOfDay === 'night') {
      this.drawStars();
    }

    // Restore from zoom/shake transform
    ctx.restore();

    // Minimap (drawn without zoom)
    this.drawMinimap();
  }

  drawParticles() {
    const ctx = this.ctx;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Update
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1; // gravity
      p.life -= p.decay;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Draw
      const sx = p.x - this.camera.x;
      const sy = p.y - this.camera.y;

      if (sx < -20 || sx > this.canvas.width + 20) continue;
      if (sy < -20 || sy > this.canvas.height + 20) continue;

      ctx.globalAlpha = p.life;

      if (p.sparkle) {
        // Draw sparkle star shape
        ctx.fillStyle = p.color;
        this.drawSparkle(sx, sy, p.size);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawSparkle(x, y, size) {
    const ctx = this.ctx;
    const points = 4;
    const innerRadius = size * 0.3;
    const outerRadius = size;

    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  drawFloatingTexts() {
    const ctx = this.ctx;

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];

      // Update
      ft.y += ft.vy;
      ft.life -= 0.02;

      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }

      // Draw
      const sx = ft.x - this.camera.x;
      const sy = ft.y - this.camera.y;

      if (sx < -50 || sx > this.canvas.width + 50) continue;
      if (sy < -50 || sy > this.canvas.height + 50) continue;

      ctx.globalAlpha = ft.life;
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';

      // Draw shadow
      ctx.fillStyle = '#000';
      ctx.fillText(ft.text, sx + 1, sy + 1);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, sx, sy);
    }
    ctx.globalAlpha = 1;
  }

  drawTrails() {
    const ctx = this.ctx;

    for (let i = this.trails.length - 1; i >= 0; i--) {
      const t = this.trails[i];
      t.life -= 0.05;

      if (t.life <= 0) {
        this.trails.splice(i, 1);
        continue;
      }

      const sx = t.x - this.camera.x;
      const sy = t.y - this.camera.y;

      if (sx < -20 || sx > this.canvas.width + 20) continue;
      if (sy < -20 || sy > this.canvas.height + 20) continue;

      ctx.globalAlpha = t.life * 0.5;
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.arc(sx, sy, t.size * t.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawStars() {
    const ctx = this.ctx;

    for (const star of this.stars) {
      const twinkle = Math.sin(this.animationTime * 3 + star.twinkle) * 0.3 + 0.7;
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(
        star.x * this.canvas.width,
        star.y * this.canvas.height,
        star.size,
        0, Math.PI * 2
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawBackground() {
    const ctx = this.ctx;
    const colors = {
      day: ['#87ceeb', '#e0f7fa'],
      dawn: ['#ffb74d', '#ffcc80'],
      dusk: ['#7e57c2', '#5c6bc0'],
      night: ['#1a1a2e', '#0f3460']
    };
    const [c1, c2] = colors[this.timeOfDay] || colors.night;

    const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, c1);
    gradient.addColorStop(1, c2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawGrid() {
    const ctx = this.ctx;
    const gridSize = 100;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;

    const startX = Math.floor(this.camera.x / gridSize) * gridSize;
    const startY = Math.floor(this.camera.y / gridSize) * gridSize;

    for (let x = startX; x < this.camera.x + this.canvas.width + gridSize; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x - this.camera.x, 0);
      ctx.lineTo(x - this.camera.x, this.canvas.height);
      ctx.stroke();
    }
    for (let y = startY; y < this.camera.y + this.canvas.height + gridSize; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y - this.camera.y);
      ctx.lineTo(this.canvas.width, y - this.camera.y);
      ctx.stroke();
    }
  }

  drawObstacle(obs) {
    const ctx = this.ctx;
    const sx = obs.x - this.camera.x;
    const sy = obs.y - this.camera.y;

    if (sx < -200 || sx > this.canvas.width + 200) return;
    if (sy < -200 || sy > this.canvas.height + 200) return;

    switch (obs.type) {
      case 'ice':
        ctx.fillStyle = 'rgba(135, 206, 235, 0.4)';
        ctx.beginPath();
        ctx.arc(sx, sy, obs.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        break;

      case 'snowdrift':
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, obs.radius, obs.radius * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'turret':
        // Base
        ctx.fillStyle = '#555';
        ctx.beginPath();
        ctx.arc(sx, sy, obs.radius, 0, Math.PI * 2);
        ctx.fill();
        // Top
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.arc(sx, sy, obs.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
        // Cannon
        ctx.fillStyle = '#333';
        ctx.fillRect(sx - 5, sy - obs.radius - 10, 10, 15);
        break;

      case 'frozenlake':
        ctx.fillStyle = 'rgba(100, 149, 237, 0.5)';
        ctx.beginPath();
        ctx.arc(sx, sy, obs.radius, 0, Math.PI * 2);
        ctx.fill();
        // Cracks
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(angle) * obs.radius * 0.8, sy + Math.sin(angle) * obs.radius * 0.8);
          ctx.stroke();
        }
        // Warning
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('THIN ICE', sx, sy);
        break;

      case 'solidtree':
        // Draw a solid tree barrier (simpler, darker tree to indicate solid)
        this.drawSolidTree(sx, sy, obs.radius);
        break;

      case 'solidsnowman':
        // Draw a solid snowman barrier
        this.drawSolidSnowman(sx, sy, obs.radius);
        break;
    }
  }

  drawSolidTree(x, y, radius) {
    const ctx = this.ctx;
    const scale = radius / 30;

    // Snow base
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.ellipse(x, y + 5 * scale, 18 * scale, 6 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trunk
    ctx.fillStyle = '#4a3728';
    ctx.fillRect(x - 4 * scale, y - 5 * scale, 8 * scale, 15 * scale);

    // Tree layers (darker green to show it's solid)
    const layers = [
      { w: 32 * scale, h: 18 * scale, c: '#1a3d1c' },
      { w: 26 * scale, h: 15 * scale, c: '#225525' },
      { w: 20 * scale, h: 12 * scale, c: '#2a6b2e' }
    ];

    let oy = 5 * scale;
    layers.forEach(l => {
      ctx.fillStyle = l.c;
      ctx.beginPath();
      ctx.moveTo(x, y - oy - l.h);
      ctx.lineTo(x - l.w / 2, y - oy);
      ctx.lineTo(x + l.w / 2, y - oy);
      ctx.closePath();
      ctx.fill();

      // Snow caps
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.moveTo(x, y - oy - l.h);
      ctx.lineTo(x - l.w * 0.3, y - oy - l.h * 0.3);
      ctx.lineTo(x + l.w * 0.3, y - oy - l.h * 0.3);
      ctx.closePath();
      ctx.fill();

      oy += l.h * 0.5;
    });

    // Collision indicator circle (faint)
    ctx.strokeStyle = 'rgba(139, 69, 19, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawSolidSnowman(x, y, radius) {
    const ctx = this.ctx;
    const scale = radius / 25;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x, y + 15 * scale, 18 * scale, 6 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bottom ball
    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.arc(x, y, 18 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Middle ball
    ctx.beginPath();
    ctx.arc(x, y - 22 * scale, 13 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(x, y - 40 * scale, 10 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(x - 4 * scale, y - 42 * scale, 2 * scale, 0, Math.PI * 2);
    ctx.arc(x + 4 * scale, y - 42 * scale, 2 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Carrot nose
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.moveTo(x, y - 38 * scale);
    ctx.lineTo(x + 10 * scale, y - 36 * scale);
    ctx.lineTo(x, y - 34 * scale);
    ctx.closePath();
    ctx.fill();

    // Buttons
    ctx.fillStyle = '#333';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x, y - 15 * scale + i * 8 * scale, 2 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // Top hat
    ctx.fillStyle = '#222';
    ctx.fillRect(x - 8 * scale, y - 54 * scale, 16 * scale, 3 * scale);
    ctx.fillRect(x - 6 * scale, y - 66 * scale, 12 * scale, 12 * scale);

    // Collision indicator (faint)
    ctx.strokeStyle = 'rgba(100,100,100,0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawDecorations() {
    for (const dec of this.decorations) {
      const sx = dec.x - this.camera.x;
      const sy = dec.y - this.camera.y;

      // Skip if off screen
      if (sx < -100 || sx > this.canvas.width + 100) continue;
      if (sy < -100 || sy > this.canvas.height + 100) continue;

      if (dec.type === 'snowman') {
        this.drawSnowman(sx, sy);
      } else {
        this.drawTree(sx, sy, dec.scale);
      }
    }
  }

  drawTree(x, y, scale = 1) {
    const ctx = this.ctx;
    const size = 35 * scale;

    // Snow on ground around tree
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 8 * scale, 20 * scale, 6 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trunk
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(x - 4 * scale, y, 8 * scale, 15 * scale);

    const layers = [
      { w: size, h: size * 0.5, c: '#2d5a27' },
      { w: size * 0.75, h: size * 0.4, c: '#357a38' },
      { w: size * 0.5, h: size * 0.3, c: '#43a047' }
    ];

    let oy = 0;
    layers.forEach((l, layerIdx) => {
      ctx.fillStyle = l.c;
      ctx.beginPath();
      ctx.moveTo(x, y - oy - l.h);
      ctx.lineTo(x - l.w / 2, y - oy);
      ctx.lineTo(x + l.w / 2, y - oy);
      ctx.closePath();
      ctx.fill();

      // Snow on edges
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.moveTo(x, y - oy - l.h + 2);
      ctx.lineTo(x - l.w / 2 + 5, y - oy);
      ctx.lineTo(x - l.w / 4, y - oy - l.h * 0.3);
      ctx.closePath();
      ctx.fill();

      oy += l.h * 0.5;
    });

    // Christmas lights on tree
    const lightColors = ['#ff0000', '#00ff00', '#ffff00', '#0080ff', '#ff00ff'];
    const numLights = Math.floor(5 * scale);
    const treeHeight = size * 0.9;

    for (let i = 0; i < numLights; i++) {
      const progress = (i + 0.5) / numLights;
      const ly = y - progress * treeHeight;
      const layerWidth = size * (1 - progress * 0.6);

      // Zigzag lights across tree
      const numLightsInRow = Math.floor(3 + (1 - progress) * 3);
      for (let j = 0; j < numLightsInRow; j++) {
        const lx = x + ((j / (numLightsInRow - 1)) - 0.5) * layerWidth * 0.7;
        const colorIdx = (i + j + Math.floor(x)) % lightColors.length;
        const twinkle = Math.sin(this.animationTime * 5 + i * 2 + j * 3 + x) * 0.4 + 0.6;

        // Light glow
        ctx.globalAlpha = twinkle * 0.5;
        ctx.fillStyle = lightColors[colorIdx];
        ctx.beginPath();
        ctx.arc(lx, ly, 5 * scale, 0, Math.PI * 2);
        ctx.fill();

        // Light bulb
        ctx.globalAlpha = twinkle;
        ctx.beginPath();
        ctx.arc(lx, ly, 2.5 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Star on top with glow
    const starY = y - oy - 3;
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#ffd700';
    this.drawStar(x, starY, 5, 6 * scale, 3 * scale);
    ctx.shadowBlur = 0;
  }

  drawStar(cx, cy, spikes, outerRadius, innerRadius) {
    const ctx = this.ctx;
    let rot = Math.PI / 2 * 3;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);

    for (let i = 0; i < spikes; i++) {
      let x = cx + Math.cos(rot) * outerRadius;
      let y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }

    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
  }

  drawSnowman(x, y) {
    const ctx = this.ctx;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y - 28, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y - 48, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(x - 3, y - 50, 2, 0, Math.PI * 2);
    ctx.arc(x + 3, y - 50, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.moveTo(x, y - 46);
    ctx.lineTo(x + 8, y - 44);
    ctx.lineTo(x, y - 42);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#333';
    ctx.fillRect(x - 10, y - 62, 20, 4);
    ctx.fillRect(x - 7, y - 74, 14, 12);
  }

  drawGift(gift) {
    const ctx = this.ctx;
    const sx = gift.x - this.camera.x;
    const sy = gift.y - this.camera.y;

    if (sx < -50 || sx > this.canvas.width + 50) return;
    if (sy < -50 || sy > this.canvas.height + 50) return;

    const bob = Math.sin(Date.now() / 300 + gift.x) * 4;
    const size = 25;

    // Glow
    const glow = ctx.createRadialGradient(sx, sy + bob, 0, sx, sy + bob, size * 1.5);
    glow.addColorStop(0, gift.color + '50');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy + bob, size * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Box
    ctx.fillStyle = gift.color;
    ctx.fillRect(sx - size/2, sy - size/2 + bob, size, size);

    // Ribbon
    ctx.fillStyle = '#fff';
    ctx.fillRect(sx - size/2, sy - 2 + bob, size, 4);
    ctx.fillRect(sx - 2, sy - size/2 + bob, 4, size);

    // Bow
    ctx.beginPath();
    ctx.arc(sx - 6, sy - size/2 - 4 + bob, 6, 0, Math.PI * 2);
    ctx.arc(sx + 6, sy - size/2 - 4 + bob, 6, 0, Math.PI * 2);
    ctx.fill();

    // Emoji
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(gift.emoji, sx, sy - size/2 - 12 + bob);

    if (gift.points > 10) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('+' + gift.points, sx, sy + size/2 + 12 + bob);
    }
  }

  drawPowerup(pu) {
    const ctx = this.ctx;
    const sx = pu.x - this.camera.x;
    const sy = pu.y - this.camera.y;

    if (sx < -50 || sx > this.canvas.width + 50) return;
    if (sy < -50 || sy > this.canvas.height + 50) return;

    const pulse = 1 + Math.sin(Date.now() / 200) * 0.1;
    const size = 30 * pulse;

    // Glow
    ctx.shadowColor = pu.color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = pu.color;
    ctx.beginPath();
    ctx.arc(sx, sy, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Emoji
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pu.emoji, sx, sy);
    ctx.textBaseline = 'alphabetic';
  }

  drawSnowball(sb) {
    const ctx = this.ctx;
    const sx = sb.x - this.camera.x;
    const sy = sb.y - this.camera.y;

    if (sx < -20 || sx > this.canvas.width + 20) return;
    if (sy < -20 || sy > this.canvas.height + 20) return;

    ctx.fillStyle = sb.fromTurret ? '#aaa' : '#fff';
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.fill();

    // Trail
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(sx - sb.vx, sy - sb.vy, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawGrinch(grinch) {
    const ctx = this.ctx;
    const sx = grinch.x - this.camera.x;
    const sy = grinch.y - this.camera.y;

    if (sx < -50 || sx > this.canvas.width + 50) return;
    if (sy < -50 || sy > this.canvas.height + 50) return;

    // Animation values
    const breathe = Math.sin(this.animationTime * 2 + grinch.x) * 2;
    const wobble = Math.sin(this.animationTime * 4 + grinch.x) * 3;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 35, 20, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Evil aura
    const auraGradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, 50);
    auraGradient.addColorStop(0, 'rgba(255, 0, 0, 0.1)');
    auraGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = auraGradient;
    ctx.beginPath();
    ctx.arc(sx, sy, 50, 0, Math.PI * 2);
    ctx.fill();

    // Furry body with animation
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.ellipse(sx + wobble * 0.3, sy, 25, 30 + breathe, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fur texture on body
    ctx.strokeStyle = '#27ae60';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const fx = sx + Math.cos(angle) * 20;
      const fy = sy + Math.sin(angle) * 25;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + Math.cos(angle) * 8, fy + Math.sin(angle) * 10);
      ctx.stroke();
    }

    // Face
    ctx.fillStyle = '#27ae60';
    ctx.beginPath();
    ctx.arc(sx + wobble * 0.5, sy - 18, 20, 0, Math.PI * 2);
    ctx.fill();

    // Bushy eyebrows (angry)
    ctx.fillStyle = '#1a5a2a';
    ctx.beginPath();
    ctx.moveTo(sx - 14, sy - 26);
    ctx.lineTo(sx - 3, sy - 22);
    ctx.lineTo(sx - 12, sy - 20);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(sx + 14, sy - 26);
    ctx.lineTo(sx + 3, sy - 22);
    ctx.lineTo(sx + 12, sy - 20);
    ctx.closePath();
    ctx.fill();

    // Eyes (looking around)
    const lookX = Math.sin(this.animationTime * 1.5) * 2;
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath();
    ctx.arc(sx - 7, sy - 20, 6, 0, Math.PI * 2);
    ctx.arc(sx + 7, sy - 20, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(sx - 7 + lookX, sy - 20, 3, 0, Math.PI * 2);
    ctx.arc(sx + 7 + lookX, sy - 20, 3, 0, Math.PI * 2);
    ctx.fill();

    // Evil smile with fangs
    ctx.strokeStyle = '#1a5a2a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy - 8, 10, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    // Fangs
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(sx - 6, sy - 6);
    ctx.lineTo(sx - 4, sy);
    ctx.lineTo(sx - 2, sy - 6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(sx + 2, sy - 6);
    ctx.lineTo(sx + 4, sy);
    ctx.lineTo(sx + 6, sy - 6);
    ctx.closePath();
    ctx.fill();

    // Pointy ears
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.moveTo(sx - 18, sy - 22);
    ctx.lineTo(sx - 28, sy - 40);
    ctx.lineTo(sx - 12, sy - 30);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(sx + 18, sy - 22);
    ctx.lineTo(sx + 28, sy - 40);
    ctx.lineTo(sx + 12, sy - 30);
    ctx.closePath();
    ctx.fill();

    // Label with glow
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GRINCH', sx, sy + 48);
    ctx.shadowBlur = 0;
  }

  drawPlayer(player, isLocal = false) {
    const ctx = this.ctx;
    const sx = player.x - this.camera.x;
    const sy = player.y - this.camera.y;

    if (sx < -50 || sx > this.canvas.width + 50) return;
    if (sy < -50 || sy > this.canvas.height + 50) return;

    // Invisible check
    if (player.powerups?.invisible && Date.now() < player.powerups.invisible && !isLocal) {
      return;
    }

    const radius = 18;
    const alpha = (player.powerups?.invisible && Date.now() < player.powerups.invisible) ? 0.3 : 1;

    ctx.globalAlpha = alpha;

    // Frozen effect
    if (player.frozen) {
      ctx.fillStyle = 'rgba(135, 206, 235, 0.5)';
      ctx.beginPath();
      ctx.arc(sx, sy, radius + 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Shield effect
    if (player.powerups?.shield && Date.now() < player.powerups.shield) {
      ctx.strokeStyle = '#4ecdc4';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, radius + 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Team outline
    if (player.team) {
      const team = this.teams.get(player.team);
      if (team) {
        ctx.strokeStyle = team.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sx, sy, radius + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Glow for local
    if (isLocal) {
      ctx.shadowColor = player.color;
      ctx.shadowBlur = 15;
    }

    // Body
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Face
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(sx - 5, sy - 3, 3, 0, Math.PI * 2);
    ctx.arc(sx + 5, sy - 3, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(sx - 5, sy - 3, 1.5, 0, Math.PI * 2);
    ctx.arc(sx + 5, sy - 3, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sx, sy + 2, 6, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    // Santa hat
    ctx.fillStyle = '#d32f2f';
    ctx.beginPath();
    ctx.moveTo(sx - 12, sy - 12);
    ctx.lineTo(sx + 4, sy - 28);
    ctx.lineTo(sx + 16, sy - 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(sx + 4, sy - 28, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(sx - 14, sy - 14, 30, 6);

    // Name
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(player.name, sx, sy + radius + 16);

    // Level
    const levelData = this.levels[player.level];
    if (levelData && player.level > 0) {
      ctx.fillStyle = '#f97316';
      ctx.font = '9px sans-serif';
      ctx.fillText(levelData.name, sx, sy + radius + 26);
    }

    // Score
    ctx.fillStyle = '#ffd93d';
    ctx.font = '10px sans-serif';
    ctx.fillText(player.score, sx, sy - radius - 20);

    ctx.globalAlpha = 1;
  }

  createSnowflakes() {
    for (let i = 0; i < 60; i++) {
      this.snowflakes.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.random() * 3 + 1,
        speed: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.5 + 0.3
      });
    }
    for (let i = 0; i < 100; i++) {
      this.blizzardSnowflakes.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.random() * 4 + 2,
        speed: Math.random() * 4 + 3,
        opacity: Math.random() * 0.7 + 0.3
      });
    }
  }

  drawWeatherEffects() {
    const ctx = this.ctx;

    if (this.weather === 'snow' || this.weather === 'blizzard') {
      const flakes = this.weather === 'blizzard' ? this.blizzardSnowflakes : this.snowflakes;
      const windX = this.weather === 'blizzard' ? 3 : 0.5;

      flakes.forEach(f => {
        f.y += f.speed;
        f.x += windX + Math.sin(Date.now() / 1000 + f.y / 30) * 0.5;

        if (f.y > this.canvas.height) {
          f.y = -10;
          f.x = Math.random() * this.canvas.width;
        }
        if (f.x > this.canvas.width) f.x = 0;

        ctx.fillStyle = `rgba(255,255,255,${f.opacity})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    if (this.weather === 'aurora') {
      const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height * 0.3);
      const wave = Math.sin(Date.now() / 2000) * 0.3 + 0.5;
      gradient.addColorStop(0, `rgba(0, 255, 128, ${0.1 * wave})`);
      gradient.addColorStop(0.5, `rgba(128, 0, 255, ${0.1 * wave})`);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height * 0.3);
    }
  }

  drawMinimap() {
    const ctx = this.minimapCtx;
    const scale = 150 / this.worldSize.width;

    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, 150, 100);

    // Obstacles
    ctx.fillStyle = 'rgba(135, 206, 235, 0.5)';
    this.obstacles.forEach(o => {
      if (o.type === 'ice' || o.type === 'frozenlake') {
        ctx.beginPath();
        ctx.arc(o.x * scale, o.y * scale, Math.max(2, o.radius * scale), 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Gifts
    ctx.fillStyle = '#ffd93d';
    this.gifts.forEach(g => {
      ctx.beginPath();
      ctx.arc(g.x * scale, g.y * scale, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Powerups
    ctx.fillStyle = '#a855f7';
    this.powerups.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x * scale, p.y * scale, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Grinches
    ctx.fillStyle = '#2ecc71';
    this.grinches.forEach(g => {
      ctx.beginPath();
      ctx.arc(g.x * scale, g.y * scale, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Other players
    this.players.forEach(p => {
      if (p.id !== this.playerId) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x * scale, p.y * scale, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Local player
    if (this.player) {
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = this.player.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.player.x * scale, this.player.y * scale, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Viewport
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        this.camera.x * scale,
        this.camera.y * scale,
        this.canvas.width * scale,
        this.canvas.height * scale
      );
    }
  }

  updateHUD() {
    if (!this.player) return;

    const scoreEl = document.getElementById('score-value');
    const giftsEl = document.getElementById('gifts-value');

    // Animate score change
    const oldScore = parseInt(scoreEl.textContent) || 0;
    if (this.player.score > oldScore) {
      scoreEl.classList.add('bump');
      setTimeout(() => scoreEl.classList.remove('bump'), 200);
    }

    const oldGifts = parseInt(giftsEl.textContent) || 0;
    if (this.player.giftsCollected > oldGifts) {
      giftsEl.classList.add('bump');
      setTimeout(() => giftsEl.classList.remove('bump'), 200);
    }

    scoreEl.textContent = this.player.score;
    giftsEl.textContent = this.player.giftsCollected;
    document.getElementById('snowball-count').textContent = this.player.snowballs;

    const levelData = this.levels[this.player.level];
    if (levelData) {
      document.getElementById('level-badge').textContent = levelData.name;
    }
  }

  updateUI() {
    this.updatePlayersCount();
    this.updateLeaderboard();
    this.updateTeamsPanel();
  }

  updatePlayersCount() {
    document.getElementById('players-count').textContent = this.players.size;
  }

  updateLeaderboard() {
    const sorted = Array.from(this.players.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    document.getElementById('leaderboard-list').innerHTML = sorted.map((p, i) => `
      <div class="player-row ${p.id === this.playerId ? 'me' : ''}">
        <span class="player-rank">${i + 1}</span>
        <span class="player-dot" style="background: ${p.color}"></span>
        <span class="player-name">${p.name}</span>
        <span class="player-score">${p.score}</span>
      </div>
    `).join('');
  }

  updateTeamsPanel() {
    document.getElementById('teams-list').innerHTML = Array.from(this.teams.values()).map(t => `
      <div class="team-item ${this.player?.team === t.id ? 'me' : ''}" onclick="game.joinTeam('${t.id}')">
        <span class="team-color" style="background: ${t.color}"></span>
        <span>${t.name}</span>
        <span class="team-score">${t.score}</span>
      </div>
    `).join('');
  }

  updateActivePowerups() {
    if (!this.player?.powerups) return;

    const now = Date.now();
    const active = [];

    for (const [type, until] of Object.entries(this.player.powerups)) {
      if (until > now) {
        const pType = this.powerupTypes.find(p => p.type === type);
        if (pType) {
          const remaining = Math.ceil((until - now) / 1000);
          active.push(`<div class="active-powerup">${pType.emoji} ${remaining}s</div>`);
        }
      }
    }

    document.getElementById('active-powerups').innerHTML = active.join('');
  }

  updateWeatherUI() {
    const icons = { clear: '☀️', snow: '❄️', blizzard: '🌨️', aurora: '🌌' };
    document.getElementById('weather-indicator').textContent =
      (icons[this.weather] || '') + ' ' + this.weather.charAt(0).toUpperCase() + this.weather.slice(1);
  }

  updateTimeUI() {
    document.body.className = 'time-' + this.timeOfDay;
  }

  joinTeam(teamId) {
    this.ws.send(JSON.stringify({ type: 'joinTeam', teamId }));
  }

  sendChat() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (text) {
      this.ws.send(JSON.stringify({ type: 'chat', text }));
      input.value = '';
    }
    input.blur();
  }

  addChatMessage(msg, scroll = true) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `chat-message ${msg.type}`;

    if (msg.type === 'system') {
      div.textContent = msg.text;
    } else {
      div.innerHTML = `<span class="name" style="color: ${msg.color}">${msg.name}:</span> ${this.escapeHtml(msg.text)}`;
    }

    container.appendChild(div);
    if (scroll) container.scrollTop = container.scrollHeight;
    while (container.children.length > 50) container.removeChild(container.firstChild);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showLevelUp() {
    const levelData = this.levels[this.player.level];
    if (!levelData) return;

    // Spawn celebration particles
    if (this.player) {
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          this.spawnParticles(this.player.x, this.player.y, '#ffd700', 15, 6);
          this.spawnParticles(this.player.x, this.player.y, '#ff6b6b', 10, 5);
        }, i * 100);
      }
    }

    // Screen flash
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(255, 215, 0, 0.3);
      z-index: 999;
      pointer-events: none;
      animation: flashOut 0.5s ease-out forwards;
    `;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 500);

    const notif = document.createElement('div');
    notif.className = 'level-up-notification';
    notif.innerHTML = `LEVEL UP!<br><span style="font-size: 1.2rem">${levelData.name}</span>`;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 2000);
  }

  showNotification(text, color = '#fff') {
    const notif = document.createElement('div');
    notif.style.cssText = `
      position: fixed; top: 40%; left: 50%; transform: translateX(-50%);
      background: ${color}; color: #fff; padding: 0.8rem 1.5rem;
      border-radius: 10px; font-weight: bold; z-index: 1000;
      animation: levelUp 1.5s ease-out forwards;
    `;
    notif.textContent = text;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 1500);
  }

  showFrozenOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'frozen-overlay';
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 1500);
  }

  showFloatingEmote(emote, worldX, worldY) {
    const sx = worldX - this.camera.x;
    const sy = worldY - this.camera.y;

    const el = document.createElement('div');
    el.className = 'floating-emote';
    el.textContent = emote;
    el.style.left = sx + 'px';
    el.style.top = sy + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  // ============ CAPTURE THE TREE MODE UI ============

  drawTeamTrees() {
    const ctx = this.ctx;

    for (const [teamId, team] of this.teams) {
      // Skip teams without tree positions
      if (team.treeX === undefined || team.treeY === undefined) continue;

      const sx = team.treeX - this.camera.x;
      const sy = team.treeY - this.camera.y;

      // Skip if off screen
      if (sx < -150 || sx > this.canvas.width + 150) continue;
      if (sy < -200 || sy > this.canvas.height + 200) continue;

      // Draw capture zone circle
      ctx.strokeStyle = team.color + '60';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      ctx.beginPath();
      ctx.arc(sx, sy, 80, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw glow around tree
      const glowGradient = ctx.createRadialGradient(sx, sy - 30, 0, sx, sy - 30, 100);
      glowGradient.addColorStop(0, team.color + '40');
      glowGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(sx, sy - 30, 100, 0, Math.PI * 2);
      ctx.fill();

      // Draw big Christmas tree
      this.drawBigTree(sx, sy, team.color, team.name);

      // Draw team label
      ctx.fillStyle = team.color;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(team.name + "'s Tree", sx, sy + 80);

      // Indicate if this is player's own tree or enemy tree
      if (this.player && this.player.team) {
        if (this.player.team === teamId) {
          ctx.fillStyle = '#4ecdc4';
          ctx.font = '12px sans-serif';
          ctx.fillText('DEFEND', sx, sy + 95);
        } else {
          ctx.fillStyle = '#ff6b6b';
          ctx.font = '12px sans-serif';
          ctx.fillText('CAPTURE!', sx, sy + 95);
        }
      }
    }
  }

  drawBigTree(x, y, teamColor, teamName) {
    const ctx = this.ctx;
    const scale = 2.5;
    const size = 35 * scale;

    // Snow base
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.ellipse(x, y + 20 * scale, 30 * scale, 10 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trunk
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(x - 6 * scale, y, 12 * scale, 20 * scale);

    // Tree layers with team color tint
    const layers = [
      { w: size, h: size * 0.5 },
      { w: size * 0.8, h: size * 0.45 },
      { w: size * 0.6, h: size * 0.4 },
      { w: size * 0.4, h: size * 0.35 }
    ];

    let oy = 0;
    layers.forEach((l, i) => {
      // Mix team color with green
      const greenBase = [45, 90, 39];
      const r = parseInt(teamColor.slice(1, 3), 16);
      const g = parseInt(teamColor.slice(3, 5), 16);
      const b = parseInt(teamColor.slice(5, 7), 16);
      const mix = 0.3;
      const finalR = Math.floor(greenBase[0] * (1 - mix) + r * mix);
      const finalG = Math.floor(greenBase[1] * (1 - mix) + g * mix);
      const finalB = Math.floor(greenBase[2] * (1 - mix) + b * mix);

      ctx.fillStyle = `rgb(${finalR}, ${finalG}, ${finalB})`;
      ctx.beginPath();
      ctx.moveTo(x, y - oy - l.h);
      ctx.lineTo(x - l.w / 2, y - oy);
      ctx.lineTo(x + l.w / 2, y - oy);
      ctx.closePath();
      ctx.fill();

      // Snow on edges
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.moveTo(x, y - oy - l.h + 4);
      ctx.lineTo(x - l.w / 2 + 8, y - oy);
      ctx.lineTo(x - l.w / 4, y - oy - l.h * 0.3);
      ctx.closePath();
      ctx.fill();

      oy += l.h * 0.45;
    });

    // Christmas lights
    const lightColors = ['#ff0000', '#00ff00', '#ffff00', '#0080ff', '#ff00ff'];
    const treeHeight = size * 1.2;

    for (let i = 0; i < 6; i++) {
      const progress = (i + 0.5) / 6;
      const ly = y - progress * treeHeight;
      const layerWidth = size * (1 - progress * 0.5);
      const numLights = Math.floor(4 + (1 - progress) * 4);

      for (let j = 0; j < numLights; j++) {
        const lx = x + ((j / (numLights - 1)) - 0.5) * layerWidth * 0.7;
        const colorIdx = (i + j) % lightColors.length;
        const twinkle = Math.sin(this.animationTime * 5 + i * 2 + j * 3) * 0.4 + 0.6;

        ctx.globalAlpha = twinkle * 0.6;
        ctx.fillStyle = lightColors[colorIdx];
        ctx.beginPath();
        ctx.arc(lx, ly, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = twinkle;
        ctx.beginPath();
        ctx.arc(lx, ly, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Star on top with team color glow
    ctx.shadowColor = teamColor;
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#ffd700';
    this.drawStar(x, y - oy - 8, 5, 15, 7);
    ctx.shadowBlur = 0;
  }

  updateRoundTimer() {
    const timerPanel = document.getElementById('round-timer-panel');
    const timerEl = document.getElementById('round-timer');
    if (!timerEl) return;

    // Show panel when player is on a team
    const playerTeam = this.player?.team;
    if (timerPanel) {
      timerPanel.style.display = playerTeam ? 'block' : 'none';
    }

    if (!this.roundActive) {
      timerEl.textContent = 'Waiting...';
      timerEl.style.color = '#888';
      return;
    }

    const timeLeft = Math.max(0, this.roundEndTime - Date.now());
    const seconds = Math.floor(timeLeft / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    timerEl.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;

    // Color based on time
    if (seconds <= 30) {
      timerEl.style.color = '#ff4444';
    } else if (seconds <= 60) {
      timerEl.style.color = '#ffa500';
    } else {
      timerEl.style.color = '#4ecdc4';
    }
  }

  updateHitsDisplay() {
    const hitsPanel = document.getElementById('hits-panel');
    const hitsEl = document.getElementById('hits-display');
    if (!hitsEl || !this.player) return;

    // Show panel when player is on a team
    const playerTeam = this.player?.team;
    if (hitsPanel) {
      hitsPanel.style.display = playerTeam ? 'flex' : 'none';
    }

    const hits = this.player.hits || 0;
    hitsEl.innerHTML = '';

    for (let i = 0; i < this.hitsToRespawn; i++) {
      const dot = document.createElement('div');
      dot.className = 'hit-dot' + (i < hits ? ' hit' : '');
      hitsEl.appendChild(dot);
    }
  }

  showRoundEndScreen(data) {
    const overlay = document.getElementById('round-end-overlay');
    if (!overlay) return;

    const titleEl = document.getElementById('round-end-title');
    const winnerEl = document.getElementById('round-end-winner');
    const statsEl = document.getElementById('round-end-stats');
    const messageEl = document.getElementById('round-end-message');

    if (data.reason === 'capture') {
      titleEl.textContent = 'TREE CAPTURED!';
      winnerEl.textContent = `${data.winnerName} WINS!`;
      winnerEl.style.color = this.teams.get(data.winner)?.color || '#fff';
      statsEl.textContent = `${data.capturedBy} captured the tree!`;
    } else if (data.reason === 'gifts') {
      titleEl.textContent = "TIME'S UP!";
      winnerEl.textContent = `${data.winnerName} WINS!`;
      winnerEl.style.color = this.teams.get(data.winner)?.color || '#fff';
      statsEl.textContent = `${data.gifts} gifts collected`;
    } else {
      titleEl.textContent = "TIME'S UP!";
      winnerEl.textContent = "IT'S A TIE!";
      winnerEl.style.color = '#fff';
      statsEl.textContent = '';
    }

    messageEl.textContent = 'Next round starting...';
    overlay.style.display = 'flex';

    setTimeout(() => {
      overlay.style.display = 'none';
    }, 4500);
  }

  showTreeCaptureEffect(data) {
    // Big particle explosion
    const team = this.teams.get(data.capturedTeam);
    if (team) {
      for (let i = 0; i < 50; i++) {
        this.spawnParticles(team.treeX, team.treeY, team.color, 10, 8);
      }
    }
    this.triggerScreenShake(15);
  }
}

const game = new ChristmasHuntGame();
