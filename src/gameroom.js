// GameRoom - Durable Object for managing real-time multiplayer state

const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 2000;
const GIFT_SPAWN_INTERVAL = 5000;
const POWERUP_SPAWN_INTERVAL = 8000;
const GRINCH_UPDATE_INTERVAL = 100;
const WEATHER_CHANGE_INTERVAL = 60000;
const DAY_CYCLE_INTERVAL = 120000;
const MAX_GIFTS = 50;
const MAX_POWERUPS = 15;
const MAX_GRINCHES = 5;
const MAX_SNOWBALLS = 100;

const LEVELS = [
  { name: 'Beginner', giftsRequired: 0, speed: 5, giftPoints: 10 },
  { name: 'Collector', giftsRequired: 10, speed: 6, giftPoints: 15 },
  { name: 'Hunter', giftsRequired: 30, speed: 7, giftPoints: 20 },
  { name: 'Expert', giftsRequired: 60, speed: 8, giftPoints: 25 },
  { name: 'Master', giftsRequired: 100, speed: 9, giftPoints: 30 },
  { name: 'Legend', giftsRequired: 150, speed: 10, giftPoints: 40 },
];

const POWERUP_TYPES = [
  { type: 'speed', emoji: '⚡', color: '#ffd700', duration: 5000, effect: 'speed x2' },
  { type: 'magnet', emoji: '🧲', color: '#ff6b6b', duration: 8000, effect: 'attract gifts' },
  { type: 'shield', emoji: '🛡️', color: '#4ecdc4', duration: 10000, effect: 'block damage' },
  { type: 'freeze', emoji: '❄️', color: '#87ceeb', duration: 0, effect: 'freeze nearby' },
  { type: 'teleport', emoji: '🌀', color: '#a855f7', duration: 0, effect: 'random location' },
  { type: 'double', emoji: '✨', color: '#ff69b4', duration: 10000, effect: '2x points' },
  { type: 'invisible', emoji: '👻', color: '#ddd', duration: 7000, effect: 'invisible' },
  { type: 'giftbomb', emoji: '💣', color: '#ff4444', duration: 0, effect: 'spawn gifts' },
];

const WEATHER_TYPES = ['clear', 'snow', 'blizzard', 'aurora'];
const EMOTES = ['👋', '😀', '😂', '🎉', '👍', '❤️', '🔥', '💀', '😱', '🤔'];

export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.players = new Map();
    this.gifts = new Map();
    this.powerups = new Map();
    this.obstacles = new Map();
    this.grinches = new Map();
    this.snowballs = new Map();
    this.teams = new Map();
    this.chat = [];
    this.giftIdCounter = 0;
    this.powerupIdCounter = 0;
    this.grinchIdCounter = 0;
    this.snowballIdCounter = 0;
    this.gameMode = 'ffa';
    this.weather = 'clear';
    this.timeOfDay = 'day';
    this.dayProgress = 0;

    // Initialize default teams
    this.teams.set('red', { id: 'red', name: 'Red Team', color: '#ff4444', score: 0, members: [] });
    this.teams.set('blue', { id: 'blue', name: 'Blue Team', color: '#4444ff', score: 0, members: [] });

    // Generate static obstacles
    this.generateObstacles();

    // Load persisted state
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get('gameState');
      if (stored) {
        this.gifts = new Map(stored.gifts || []);
        this.teams = new Map(stored.teams || []);
        this.giftIdCounter = stored.giftIdCounter || 0;
      }
    });

    // Start game loops
    this.spawnGiftsLoop();
    this.spawnPowerupsLoop();
    this.grinchAILoop();
    this.snowballUpdateLoop();
    this.weatherLoop();
    this.dayCycleLoop();
  }

  generateObstacles() {
    const seed = 54321;
    const random = this.seededRandom(seed);

    // Ice patches
    for (let i = 0; i < 20; i++) {
      this.obstacles.set(`ice_${i}`, {
        id: `ice_${i}`,
        type: 'ice',
        x: random() * WORLD_WIDTH,
        y: random() * WORLD_HEIGHT,
        radius: 40 + random() * 60
      });
    }

    // Snowdrifts
    for (let i = 0; i < 25; i++) {
      this.obstacles.set(`snow_${i}`, {
        id: `snow_${i}`,
        type: 'snowdrift',
        x: random() * WORLD_WIDTH,
        y: random() * WORLD_HEIGHT,
        radius: 30 + random() * 40
      });
    }

    // Snowball turrets
    for (let i = 0; i < 8; i++) {
      this.obstacles.set(`turret_${i}`, {
        id: `turret_${i}`,
        type: 'turret',
        x: random() * WORLD_WIDTH,
        y: random() * WORLD_HEIGHT,
        radius: 25,
        lastShot: 0,
        shootInterval: 2000 + random() * 2000
      });
    }

    // Frozen lakes
    for (let i = 0; i < 5; i++) {
      this.obstacles.set(`lake_${i}`, {
        id: `lake_${i}`,
        type: 'frozenlake',
        x: random() * WORLD_WIDTH,
        y: random() * WORLD_HEIGHT,
        radius: 80 + random() * 60
      });
    }
  }

  seededRandom(seed) {
    return function() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.handleSession(server);
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response('Expected WebSocket', { status: 400 });
  }

  handleSession(ws) {
    ws.accept();
    const session = { ws, playerId: null, joined: false };
    this.sessions.set(ws, session);

    ws.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data);
        await this.handleMessage(session, data);
      } catch (e) {
        console.error('Message error:', e);
      }
    });

    ws.addEventListener('close', () => this.handleDisconnect(session));
    ws.addEventListener('error', () => this.handleDisconnect(session));
  }

  async handleMessage(session, data) {
    switch (data.type) {
      case 'join': await this.handleJoin(session, data); break;
      case 'move': this.handleMove(session, data); break;
      case 'chat': this.handleChat(session, data); break;
      case 'collect': await this.handleCollect(session, data); break;
      case 'collectPowerup': this.handleCollectPowerup(session, data); break;
      case 'throwSnowball': this.handleThrowSnowball(session, data); break;
      case 'emote': this.handleEmote(session, data); break;
      case 'joinTeam': this.handleJoinTeam(session, data); break;
      case 'createTeam': this.handleCreateTeam(session, data); break;
      case 'setMode': this.handleSetMode(session, data); break;
    }
  }

  async handleJoin(session, data) {
    const playerId = crypto.randomUUID();
    const spawnPos = this.getSafeSpawnPosition();

    const player = {
      id: playerId,
      name: data.name || `Player${Math.floor(Math.random() * 1000)}`,
      x: spawnPos.x,
      y: spawnPos.y,
      color: data.color || this.getRandomColor(),
      score: 0,
      giftsCollected: 0,
      level: 0,
      team: null,
      lastUpdate: Date.now(),
      powerups: {},
      snowballs: 5,
      frozen: false,
      frozenUntil: 0,
      onIce: false,
      iceVelocity: { x: 0, y: 0 },
      inSnowdrift: false,
      onFrozenLake: false,
      lakeTimer: 0,
      lastEmote: 0
    };

    session.playerId = playerId;
    session.joined = true;
    this.players.set(playerId, player);

    // Spawn a Grinch if not enough
    if (this.grinches.size < MAX_GRINCHES) {
      this.spawnGrinch();
    }

    this.send(session.ws, {
      type: 'welcome',
      playerId,
      player,
      worldSize: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
      players: Array.from(this.players.values()),
      gifts: Array.from(this.gifts.values()),
      powerups: Array.from(this.powerups.values()),
      obstacles: Array.from(this.obstacles.values()),
      grinches: Array.from(this.grinches.values()),
      snowballs: Array.from(this.snowballs.values()),
      teams: Array.from(this.teams.values()),
      chat: this.chat.slice(-50),
      gameMode: this.gameMode,
      levels: LEVELS,
      powerupTypes: POWERUP_TYPES,
      weather: this.weather,
      timeOfDay: this.timeOfDay,
      emotes: EMOTES
    });

    this.broadcast({ type: 'playerJoined', player }, session.ws);
    this.addChatMessage({ type: 'system', text: `${player.name} joined the hunt!` });
  }

  getSafeSpawnPosition() {
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * WORLD_WIDTH;
      const y = Math.random() * WORLD_HEIGHT;
      let safe = true;

      for (const obs of this.obstacles.values()) {
        const dx = x - obs.x;
        const dy = y - obs.y;
        if (Math.sqrt(dx*dx + dy*dy) < obs.radius + 50) {
          safe = false;
          break;
        }
      }

      if (safe) return { x, y };
    }
    return { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
  }

  handleMove(session, data) {
    const player = this.players.get(session.playerId);
    if (!player) return;

    // Check if frozen
    if (player.frozen && Date.now() < player.frozenUntil) {
      return;
    }
    player.frozen = false;

    const levelData = LEVELS[player.level] || LEVELS[0];
    let speed = levelData.speed;

    // Speed powerup
    if (player.powerups.speed && Date.now() < player.powerups.speed) {
      speed *= 2;
    }

    // Snowdrift slowdown
    if (player.inSnowdrift) {
      speed *= 0.5;
    }

    let dx = (data.dx || 0) * speed;
    let dy = (data.dy || 0) * speed;

    // Ice sliding
    if (player.onIce) {
      player.iceVelocity.x = player.iceVelocity.x * 0.95 + dx * 0.1;
      player.iceVelocity.y = player.iceVelocity.y * 0.95 + dy * 0.1;
      dx = player.iceVelocity.x;
      dy = player.iceVelocity.y;
    } else {
      player.iceVelocity = { x: 0, y: 0 };
    }

    let newX = Math.max(0, Math.min(WORLD_WIDTH, player.x + dx));
    let newY = Math.max(0, Math.min(WORLD_HEIGHT, player.y + dy));

    player.x = newX;
    player.y = newY;
    player.lastUpdate = Date.now();

    // Check obstacle collisions
    this.checkObstacleCollisions(player);

    // Check magnet powerup - attract gifts
    if (player.powerups.magnet && Date.now() < player.powerups.magnet) {
      this.attractGiftsToPlayer(player);
    }

    this.broadcast({
      type: 'playerMoved',
      playerId: player.id,
      x: player.x,
      y: player.y,
      onIce: player.onIce,
      inSnowdrift: player.inSnowdrift,
      frozen: player.frozen
    });
  }

  checkObstacleCollisions(player) {
    player.onIce = false;
    player.inSnowdrift = false;
    player.onFrozenLake = false;

    for (const obs of this.obstacles.values()) {
      const dx = player.x - obs.x;
      const dy = player.y - obs.y;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < obs.radius) {
        switch (obs.type) {
          case 'ice':
            player.onIce = true;
            break;
          case 'snowdrift':
            player.inSnowdrift = true;
            break;
          case 'frozenlake':
            player.onFrozenLake = true;
            player.lakeTimer = (player.lakeTimer || 0) + 1;
            if (player.lakeTimer > 30 && !player.powerups.shield) {
              // Fall through ice!
              this.handleFallThroughIce(player);
            }
            break;
        }
      }
    }

    if (!player.onFrozenLake) {
      player.lakeTimer = 0;
    }
  }

  handleFallThroughIce(player) {
    // Lose some points and teleport to safe spot
    const lostPoints = Math.floor(player.score * 0.1);
    player.score = Math.max(0, player.score - lostPoints);

    const safePos = this.getSafeSpawnPosition();
    player.x = safePos.x;
    player.y = safePos.y;
    player.lakeTimer = 0;

    this.broadcast({
      type: 'playerFellThroughIce',
      playerId: player.id,
      x: player.x,
      y: player.y,
      lostPoints
    });

    this.addChatMessage({
      type: 'system',
      text: `💦 ${player.name} fell through the ice! Lost ${lostPoints} points!`
    });
  }

  attractGiftsToPlayer(player) {
    const magnetRange = 150;
    const movedGifts = [];

    for (const gift of this.gifts.values()) {
      const dx = player.x - gift.x;
      const dy = player.y - gift.y;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < magnetRange && dist > 0) {
        gift.x += (dx / dist) * 3;
        gift.y += (dy / dist) * 3;
        movedGifts.push({ id: gift.id, x: gift.x, y: gift.y });
      }
    }

    // Broadcast gift positions to all clients
    if (movedGifts.length > 0) {
      this.broadcast({ type: 'giftsMoved', gifts: movedGifts });
    }
  }

  handleChat(session, data) {
    const player = this.players.get(session.playerId);
    if (!player) return;

    this.addChatMessage({
      type: 'player',
      playerId: player.id,
      name: player.name,
      color: player.color,
      text: data.text?.slice(0, 200) || '',
      team: player.team,
      timestamp: Date.now()
    });
  }

  addChatMessage(message) {
    message.timestamp = message.timestamp || Date.now();
    this.chat.push(message);
    if (this.chat.length > 100) this.chat = this.chat.slice(-100);
    this.broadcast({ type: 'chat', message });
  }

  async handleCollect(session, data) {
    const player = this.players.get(session.playerId);
    if (!player) return;

    const gift = this.gifts.get(data.giftId);
    if (!gift) return;

    const dx = player.x - gift.x;
    const dy = player.y - gift.y;
    // Increased collection distance for better feel
    if (Math.sqrt(dx*dx + dy*dy) > 60) return;

    this.gifts.delete(data.giftId);

    let points = gift.points;
    if (player.powerups.double && Date.now() < player.powerups.double) {
      points *= 2;
    }

    player.score += points;
    player.giftsCollected++;
    player.snowballs = Math.min(20, player.snowballs + 1);

    const newLevel = this.calculateLevel(player.giftsCollected);
    const leveledUp = newLevel > player.level;
    player.level = newLevel;

    if (player.team && this.teams.has(player.team)) {
      this.teams.get(player.team).score += points;
    }

    await this.saveState();

    this.broadcast({
      type: 'giftCollected',
      giftId: data.giftId,
      playerId: player.id,
      points,
      playerScore: player.score,
      giftsCollected: player.giftsCollected,
      level: player.level,
      leveledUp,
      snowballs: player.snowballs
    });

    if (leveledUp) {
      this.addChatMessage({
        type: 'system',
        text: `🎉 ${player.name} reached level ${LEVELS[player.level].name}!`
      });
    }
  }

  handleCollectPowerup(session, data) {
    const player = this.players.get(session.playerId);
    if (!player) return;

    const powerup = this.powerups.get(data.powerupId);
    if (!powerup) return;

    const dx = player.x - powerup.x;
    const dy = player.y - powerup.y;
    // Increased collection distance for better feel
    if (Math.sqrt(dx*dx + dy*dy) > 60) return;

    this.powerups.delete(data.powerupId);

    // Apply powerup effect
    const pType = POWERUP_TYPES.find(p => p.type === powerup.type);
    if (!pType) return;

    let effectMessage = '';

    switch (powerup.type) {
      case 'speed':
      case 'magnet':
      case 'shield':
      case 'double':
      case 'invisible':
        player.powerups[powerup.type] = Date.now() + pType.duration;
        effectMessage = `${pType.emoji} ${player.name} got ${pType.effect}!`;
        break;

      case 'freeze':
        // Freeze nearby players
        const freezeRange = 200;
        for (const other of this.players.values()) {
          if (other.id === player.id) continue;
          if (other.team && other.team === player.team) continue;
          const dist = Math.sqrt((other.x - player.x)**2 + (other.y - player.y)**2);
          if (dist < freezeRange && !other.powerups.shield) {
            other.frozen = true;
            other.frozenUntil = Date.now() + 3000;
          }
        }
        effectMessage = `${pType.emoji} ${player.name} froze nearby players!`;
        break;

      case 'teleport':
        const newPos = this.getSafeSpawnPosition();
        player.x = newPos.x;
        player.y = newPos.y;
        effectMessage = `${pType.emoji} ${player.name} teleported!`;
        break;

      case 'giftbomb':
        // Spawn gifts around player
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2;
          const dist = 80 + Math.random() * 40;
          this.spawnGiftAt(
            player.x + Math.cos(angle) * dist,
            player.y + Math.sin(angle) * dist
          );
        }
        effectMessage = `${pType.emoji} ${player.name} dropped a gift bomb!`;
        break;
    }

    this.broadcast({
      type: 'powerupCollected',
      powerupId: data.powerupId,
      playerId: player.id,
      powerupType: powerup.type,
      x: player.x,
      y: player.y,
      playerPowerups: player.powerups
    });

    if (effectMessage) {
      this.addChatMessage({ type: 'system', text: effectMessage });
    }
  }

  handleThrowSnowball(session, data) {
    const player = this.players.get(session.playerId);
    if (!player || player.snowballs <= 0) return;

    player.snowballs--;

    const snowballId = `sb_${++this.snowballIdCounter}`;
    const speed = 15;
    const dx = data.targetX - player.x;
    const dy = data.targetY - player.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    const snowball = {
      id: snowballId,
      x: player.x,
      y: player.y,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      ownerId: player.id,
      ownerTeam: player.team,
      createdAt: Date.now()
    };

    this.snowballs.set(snowballId, snowball);

    this.broadcast({
      type: 'snowballThrown',
      snowball,
      throwerSnowballs: player.snowballs
    });
  }

  handleEmote(session, data) {
    const player = this.players.get(session.playerId);
    if (!player) return;

    // Rate limit emotes
    if (Date.now() - player.lastEmote < 1000) return;
    player.lastEmote = Date.now();

    if (EMOTES.includes(data.emote)) {
      this.broadcast({
        type: 'playerEmote',
        playerId: player.id,
        emote: data.emote,
        x: player.x,
        y: player.y
      });
    }
  }

  calculateLevel(giftsCollected) {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (giftsCollected >= LEVELS[i].giftsRequired) return i;
    }
    return 0;
  }

  handleJoinTeam(session, data) {
    const player = this.players.get(session.playerId);
    if (!player) return;

    const team = this.teams.get(data.teamId);
    if (!team) return;

    if (player.team) {
      const oldTeam = this.teams.get(player.team);
      if (oldTeam) oldTeam.members = oldTeam.members.filter(id => id !== player.id);
    }

    player.team = data.teamId;
    team.members.push(player.id);

    this.broadcast({ type: 'playerTeamChanged', playerId: player.id, teamId: data.teamId });
    this.addChatMessage({ type: 'system', text: `${player.name} joined ${team.name}!` });
  }

  handleCreateTeam(session, data) {
    const player = this.players.get(session.playerId);
    if (!player) return;

    const teamId = crypto.randomUUID().slice(0, 8);
    const team = {
      id: teamId,
      name: data.name?.slice(0, 20) || `Team ${teamId}`,
      color: data.color || this.getRandomColor(),
      score: 0,
      members: [player.id],
      creator: player.id
    };

    this.teams.set(teamId, team);

    if (player.team) {
      const oldTeam = this.teams.get(player.team);
      if (oldTeam) oldTeam.members = oldTeam.members.filter(id => id !== player.id);
    }

    player.team = teamId;

    this.broadcast({ type: 'teamCreated', team });
    this.broadcast({ type: 'playerTeamChanged', playerId: player.id, teamId });
    this.addChatMessage({ type: 'system', text: `${player.name} created ${team.name}!` });
  }

  handleSetMode(session, data) {
    if (['ffa', 'teams', 'custom'].includes(data.mode)) {
      this.gameMode = data.mode;
      this.broadcast({ type: 'modeChanged', mode: this.gameMode });
    }
  }

  handleDisconnect(session) {
    if (session.playerId) {
      const player = this.players.get(session.playerId);
      if (player) {
        if (player.team) {
          const team = this.teams.get(player.team);
          if (team) team.members = team.members.filter(id => id !== player.id);
        }
        this.players.delete(session.playerId);
        this.broadcast({ type: 'playerLeft', playerId: session.playerId });
        this.addChatMessage({ type: 'system', text: `${player.name} left the game` });
      }
    }
    this.sessions.delete(session.ws);
  }

  // Spawning loops
  spawnGiftsLoop() {
    setInterval(() => {
      if (this.gifts.size < MAX_GIFTS && this.players.size > 0) {
        this.spawnGift();
      }
    }, GIFT_SPAWN_INTERVAL);
  }

  spawnPowerupsLoop() {
    setInterval(() => {
      if (this.powerups.size < MAX_POWERUPS && this.players.size > 0) {
        this.spawnPowerup();
      }
    }, POWERUP_SPAWN_INTERVAL);
  }

  spawnGift() {
    const pos = this.getSafeSpawnPosition();
    this.spawnGiftAt(pos.x, pos.y);
  }

  spawnGiftAt(x, y) {
    const giftId = `gift_${++this.giftIdCounter}`;
    const giftTypes = [
      { type: 'common', color: '#ff6b6b', points: 10, emoji: '🎁' },
      { type: 'uncommon', color: '#4ecdc4', points: 25, emoji: '🎄' },
      { type: 'rare', color: '#ffe66d', points: 50, emoji: '⭐' },
      { type: 'epic', color: '#a855f7', points: 100, emoji: '🌟' },
      { type: 'legendary', color: '#f97316', points: 200, emoji: '🎅' },
    ];

    const weights = [50, 30, 15, 4, 1];
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    let typeIndex = 0;

    for (let i = 0; i < weights.length; i++) {
      random -= weights[i];
      if (random <= 0) { typeIndex = i; break; }
    }

    const gift = {
      id: giftId,
      x: Math.max(0, Math.min(WORLD_WIDTH, x)),
      y: Math.max(0, Math.min(WORLD_HEIGHT, y)),
      ...giftTypes[typeIndex],
      spawnTime: Date.now()
    };

    this.gifts.set(giftId, gift);
    this.broadcast({ type: 'giftSpawned', gift });
  }

  spawnPowerup() {
    const powerupId = `pu_${++this.powerupIdCounter}`;
    const pos = this.getSafeSpawnPosition();
    const typeIndex = Math.floor(Math.random() * POWERUP_TYPES.length);
    const pType = POWERUP_TYPES[typeIndex];

    const powerup = {
      id: powerupId,
      x: pos.x,
      y: pos.y,
      type: pType.type,
      emoji: pType.emoji,
      color: pType.color,
      spawnTime: Date.now()
    };

    this.powerups.set(powerupId, powerup);
    this.broadcast({ type: 'powerupSpawned', powerup });
  }

  spawnGrinch() {
    const grinchId = `grinch_${++this.grinchIdCounter}`;
    const pos = this.getSafeSpawnPosition();

    const grinch = {
      id: grinchId,
      x: pos.x,
      y: pos.y,
      targetPlayerId: null,
      speed: 3,
      stolenGifts: 0
    };

    this.grinches.set(grinchId, grinch);
    this.broadcast({ type: 'grinchSpawned', grinch });
  }

  grinchAILoop() {
    setInterval(() => {
      for (const grinch of this.grinches.values()) {
        this.updateGrinch(grinch);
      }
    }, GRINCH_UPDATE_INTERVAL);
  }

  updateGrinch(grinch) {
    if (this.players.size === 0) return;

    // Find closest player
    let closest = null;
    let closestDist = Infinity;

    for (const player of this.players.values()) {
      if (player.powerups.invisible && Date.now() < player.powerups.invisible) continue;
      const dist = Math.sqrt((player.x - grinch.x)**2 + (player.y - grinch.y)**2);
      if (dist < closestDist) {
        closestDist = dist;
        closest = player;
      }
    }

    if (!closest) return;

    // Move towards closest player
    const dx = closest.x - grinch.x;
    const dy = closest.y - grinch.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (dist > 0) {
      grinch.x += (dx / dist) * grinch.speed;
      grinch.y += (dy / dist) * grinch.speed;
    }

    // Check if caught a player
    if (dist < 30) {
      // Steal gifts if player doesn't have shield
      if (!closest.powerups.shield || Date.now() >= closest.powerups.shield) {
        const stolenPoints = Math.min(50, Math.floor(closest.score * 0.05));
        if (stolenPoints > 0) {
          closest.score -= stolenPoints;
          grinch.stolenGifts++;

          this.broadcast({
            type: 'grinchStole',
            grinchId: grinch.id,
            playerId: closest.id,
            stolenPoints,
            playerScore: closest.score
          });

          // Move grinch away after stealing
          const angle = Math.random() * Math.PI * 2;
          grinch.x += Math.cos(angle) * 200;
          grinch.y += Math.sin(angle) * 200;
          grinch.x = Math.max(0, Math.min(WORLD_WIDTH, grinch.x));
          grinch.y = Math.max(0, Math.min(WORLD_HEIGHT, grinch.y));
        }
      }
    }

    this.broadcast({
      type: 'grinchMoved',
      grinchId: grinch.id,
      x: grinch.x,
      y: grinch.y
    });
  }

  snowballUpdateLoop() {
    setInterval(() => {
      const now = Date.now();
      const toRemove = [];

      for (const [id, sb] of this.snowballs) {
        // Move snowball
        sb.x += sb.vx;
        sb.y += sb.vy;

        // Remove if out of bounds or too old
        if (sb.x < 0 || sb.x > WORLD_WIDTH || sb.y < 0 || sb.y > WORLD_HEIGHT || now - sb.createdAt > 3000) {
          toRemove.push(id);
          continue;
        }

        // Check player collisions
        for (const player of this.players.values()) {
          if (player.id === sb.ownerId) continue;
          if (sb.ownerTeam && sb.ownerTeam === player.team) continue;

          const dist = Math.sqrt((player.x - sb.x)**2 + (player.y - sb.y)**2);
          if (dist < 25) {
            // Hit!
            if (!player.powerups.shield || Date.now() >= player.powerups.shield) {
              player.frozen = true;
              player.frozenUntil = now + 1500;

              this.broadcast({
                type: 'snowballHit',
                snowballId: id,
                hitPlayerId: player.id,
                thrownBy: sb.ownerId
              });
            }
            toRemove.push(id);
            break;
          }
        }

        // Check grinch collisions
        for (const grinch of this.grinches.values()) {
          const dist = Math.sqrt((grinch.x - sb.x)**2 + (grinch.y - sb.y)**2);
          if (dist < 30) {
            // Push grinch back
            const pushDist = 100;
            grinch.x += sb.vx * pushDist / 15;
            grinch.y += sb.vy * pushDist / 15;
            grinch.x = Math.max(0, Math.min(WORLD_WIDTH, grinch.x));
            grinch.y = Math.max(0, Math.min(WORLD_HEIGHT, grinch.y));

            this.broadcast({
              type: 'grinchHit',
              grinchId: grinch.id,
              x: grinch.x,
              y: grinch.y
            });

            toRemove.push(id);
            break;
          }
        }
      }

      // Remove hit/expired snowballs
      for (const id of toRemove) {
        this.snowballs.delete(id);
        this.broadcast({ type: 'snowballRemoved', snowballId: id });
      }

      // Turret shooting
      for (const obs of this.obstacles.values()) {
        if (obs.type === 'turret' && now - obs.lastShot > obs.shootInterval) {
          this.turretShoot(obs);
          obs.lastShot = now;
        }
      }
    }, 50);
  }

  turretShoot(turret) {
    // Find closest player
    let closest = null;
    let closestDist = 300; // Max range

    for (const player of this.players.values()) {
      const dist = Math.sqrt((player.x - turret.x)**2 + (player.y - turret.y)**2);
      if (dist < closestDist) {
        closestDist = dist;
        closest = player;
      }
    }

    if (!closest) return;

    const snowballId = `tsb_${++this.snowballIdCounter}`;
    const dx = closest.x - turret.x;
    const dy = closest.y - turret.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const speed = 10;

    const snowball = {
      id: snowballId,
      x: turret.x,
      y: turret.y,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      ownerId: 'turret',
      ownerTeam: null,
      createdAt: Date.now(),
      fromTurret: true
    };

    this.snowballs.set(snowballId, snowball);
    this.broadcast({ type: 'turretShot', turretId: turret.id, snowball });
  }

  weatherLoop() {
    setInterval(() => {
      const oldWeather = this.weather;
      this.weather = WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)];

      if (oldWeather !== this.weather) {
        this.broadcast({ type: 'weatherChanged', weather: this.weather });
        this.addChatMessage({
          type: 'system',
          text: `🌤️ Weather changed to ${this.weather}!`
        });
      }
    }, WEATHER_CHANGE_INTERVAL);
  }

  dayCycleLoop() {
    setInterval(() => {
      this.dayProgress = (this.dayProgress + 1) % 4;
      const times = ['dawn', 'day', 'dusk', 'night'];
      this.timeOfDay = times[this.dayProgress];

      this.broadcast({ type: 'timeChanged', timeOfDay: this.timeOfDay });
    }, DAY_CYCLE_INTERVAL);
  }

  getRandomColor() {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9', '#a29bfe', '#fd79a8'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  async saveState() {
    await this.state.storage.put('gameState', {
      gifts: Array.from(this.gifts.entries()),
      teams: Array.from(this.teams.entries()),
      giftIdCounter: this.giftIdCounter
    });
  }

  send(ws, data) {
    try { ws.send(JSON.stringify(data)); } catch (e) {}
  }

  broadcast(data, exclude = null) {
    const message = JSON.stringify(data);
    for (const [ws] of this.sessions) {
      if (ws !== exclude) {
        try { ws.send(message); } catch (e) {}
      }
    }
  }
}
