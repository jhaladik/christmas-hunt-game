// Object Registry - Defines all game objects, their properties, and rendering
// Used by both client (rendering) and server (physics/logic)

const OBJECT_TYPES = {
  // ============ SOLID OBSTACLES (block movement) ============
  solidTree: {
    category: 'solid',
    radius: 30,
    solid: true,
    theme: 'christmas',
    render: 'drawSolidTree'
  },
  solidSnowman: {
    category: 'solid',
    radius: 25,
    solid: true,
    theme: 'christmas',
    render: 'drawSolidSnowman'
  },
  turret: {
    category: 'solid',
    radius: 25,
    solid: true,
    shoots: true,
    shootInterval: [2500, 4500], // min-max ms
    theme: 'christmas',
    render: 'drawTurret'
  },
  wall: {
    category: 'solid',
    shape: 'rect',
    solid: true,
    theme: 'neutral',
    render: 'drawWall'
  },
  rock: {
    category: 'solid',
    radius: 40,
    solid: true,
    theme: 'neutral',
    render: 'drawRock'
  },

  // ============ TERRAIN (affect movement, not block) ============
  ice: {
    category: 'terrain',
    radius: 50,
    solid: false,
    effect: 'slide',
    theme: 'christmas',
    render: 'drawIce'
  },
  snowdrift: {
    category: 'terrain',
    radius: 35,
    solid: false,
    effect: 'slow',
    slowFactor: 0.5,
    theme: 'christmas',
    render: 'drawSnowdrift'
  },
  frozenLake: {
    category: 'terrain',
    radius: 100,
    solid: false,
    effect: 'danger',
    dangerTime: 30, // ticks before falling through
    theme: 'christmas',
    render: 'drawFrozenLake'
  },

  // ============ TEAM OBJECTS ============
  teamTree: {
    category: 'team',
    radius: 80,
    solid: false,
    capturable: true,
    captureRadius: 80,
    theme: 'christmas',
    render: 'drawTeamTree'
  },
  teamSpawn: {
    category: 'team',
    radius: 50,
    solid: false,
    spawnPoint: true,
    theme: 'neutral',
    render: 'drawSpawnPoint'
  },

  // ============ PICKUPS ============
  gift: {
    category: 'pickup',
    radius: 20,
    solid: false,
    collectible: true,
    points: [10, 25, 50, 100, 200], // by rarity
    theme: 'christmas',
    render: 'drawGift'
  },
  powerup: {
    category: 'pickup',
    radius: 20,
    solid: false,
    collectible: true,
    theme: 'neutral',
    render: 'drawPowerup'
  },
  snowballPickup: {
    category: 'pickup',
    radius: 15,
    solid: false,
    collectible: true,
    gives: { snowballs: 5 },
    theme: 'christmas',
    render: 'drawSnowballPickup'
  },

  // ============ NPCS ============
  grinch: {
    category: 'npc',
    radius: 25,
    solid: false,
    ai: 'chase',
    speed: 3,
    hostile: true,
    theme: 'christmas',
    render: 'drawGrinch'
  },

  // ============ PROJECTILES ============
  snowball: {
    category: 'projectile',
    radius: 8,
    solid: false,
    speed: 15,
    lifetime: 3000,
    damage: 1,
    theme: 'christmas',
    render: 'drawSnowball'
  }
};

// Gift rarity definitions
const GIFT_RARITIES = [
  { type: 'common', color: '#ff6b6b', points: 10, weight: 50 },
  { type: 'uncommon', color: '#4ecdc4', points: 25, weight: 30 },
  { type: 'rare', color: '#ffe66d', points: 50, weight: 15 },
  { type: 'epic', color: '#a855f7', points: 100, weight: 4 },
  { type: 'legendary', color: '#f97316', points: 200, weight: 1 }
];

// Powerup definitions
const POWERUP_TYPES = [
  { type: 'speed', emoji: '⚡', color: '#ffd700', duration: 5000, effect: 'speed x2' },
  { type: 'magnet', emoji: '🧲', color: '#ff6b6b', duration: 8000, effect: 'attract gifts' },
  { type: 'shield', emoji: '🛡️', color: '#4ecdc4', duration: 10000, effect: 'block damage' },
  { type: 'freeze', emoji: '❄️', color: '#87ceeb', duration: 0, effect: 'freeze nearby' },
  { type: 'teleport', emoji: '🌀', color: '#a855f7', duration: 0, effect: 'random location' },
  { type: 'double', emoji: '✨', color: '#ff69b4', duration: 10000, effect: '2x points' },
  { type: 'invisible', emoji: '👻', color: '#ddd', duration: 7000, effect: 'invisible' },
  { type: 'giftbomb', emoji: '💣', color: '#ff4444', duration: 0, effect: 'spawn gifts' }
];

// Team colors
const TEAM_COLORS = {
  red: { primary: '#ff4444', secondary: '#cc0000', name: 'Red Team' },
  blue: { primary: '#4444ff', secondary: '#0000cc', name: 'Blue Team' },
  green: { primary: '#44ff44', secondary: '#00cc00', name: 'Green Team' },
  yellow: { primary: '#ffff44', secondary: '#cccc00', name: 'Yellow Team' },
  purple: { primary: '#aa44ff', secondary: '#7700cc', name: 'Purple Team' },
  orange: { primary: '#ff8844', secondary: '#cc5500', name: 'Orange Team' }
};

// Player levels
const PLAYER_LEVELS = [
  { name: 'Beginner', giftsRequired: 0, speed: 5, giftPoints: 10 },
  { name: 'Collector', giftsRequired: 10, speed: 6, giftPoints: 15 },
  { name: 'Hunter', giftsRequired: 30, speed: 7, giftPoints: 20 },
  { name: 'Expert', giftsRequired: 60, speed: 8, giftPoints: 25 },
  { name: 'Master', giftsRequired: 100, speed: 9, giftPoints: 30 },
  { name: 'Legend', giftsRequired: 150, speed: 10, giftPoints: 40 }
];

// Game mode configurations
const GAME_MODES = {
  capture: {
    name: 'Capture the Tree',
    description: 'Capture the enemy team tree or collect the most gifts!',
    roundDuration: 180000, // 3 minutes
    freezeDuration: 5000,
    hitsToRespawn: 3,
    treeCaptureRadius: 80,
    minTeams: 1, // for testing, normally 2
    maxTeams: 8
  },
  ffa: {
    name: 'Free For All',
    description: 'Collect the most gifts to win!',
    roundDuration: 300000, // 5 minutes
    maxPlayers: 20
  }
};

// Theme configurations (for seasonal variants)
const THEMES = {
  christmas: {
    name: 'Christmas',
    background: {
      day: { top: '#87CEEB', bottom: '#E0F6FF' },
      dawn: { top: '#FFB6C1', bottom: '#FFA07A' },
      dusk: { top: '#4A4063', bottom: '#8B7B8B' },
      night: { top: '#1a1a2e', bottom: '#16213e' }
    },
    snowfall: true,
    music: 'christmas.mp3'
  },
  halloween: {
    name: 'Halloween',
    background: {
      day: { top: '#4A4063', bottom: '#8B7B8B' },
      dawn: { top: '#FF6347', bottom: '#8B0000' },
      dusk: { top: '#2F1B41', bottom: '#1A0A2E' },
      night: { top: '#0D0D1A', bottom: '#1A0A2E' }
    },
    snowfall: false,
    fogEffect: true,
    music: 'halloween.mp3'
  },
  easter: {
    name: 'Easter',
    background: {
      day: { top: '#87CEEB', bottom: '#98FB98' },
      dawn: { top: '#FFB6C1', bottom: '#DDA0DD' },
      dusk: { top: '#DDA0DD', bottom: '#9370DB' },
      night: { top: '#191970', bottom: '#483D8B' }
    },
    snowfall: false,
    petalFall: true,
    music: 'easter.mp3'
  }
};

// Export for use in modules (or attach to window for non-module)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    OBJECT_TYPES,
    GIFT_RARITIES,
    POWERUP_TYPES,
    TEAM_COLORS,
    PLAYER_LEVELS,
    GAME_MODES,
    THEMES
  };
} else if (typeof window !== 'undefined') {
  window.OBJECT_TYPES = OBJECT_TYPES;
  window.GIFT_RARITIES = GIFT_RARITIES;
  window.POWERUP_TYPES = POWERUP_TYPES;
  window.TEAM_COLORS = TEAM_COLORS;
  window.PLAYER_LEVELS = PLAYER_LEVELS;
  window.GAME_MODES = GAME_MODES;
  window.THEMES = THEMES;
}
