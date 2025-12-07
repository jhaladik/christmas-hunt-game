// Level definitions for the game server
// These are embedded at build time since Workers can't read files at runtime

export const LEVELS = {
  'capture-christmas': {
    id: 'capture-christmas',
    name: 'Christmas Battleground',
    description: 'A symmetrical battlefield with three lanes and strategic cover',
    gameMode: 'capture',
    theme: 'christmas',
    worldSize: { width: 3000, height: 2000 },
    teams: [
      { id: 'red', name: 'Red Team', color: '#ff4444', spawnX: 250, spawnY: 1000, treeX: 120, treeY: 1000 },
      { id: 'blue', name: 'Blue Team', color: '#4444ff', spawnX: 2750, spawnY: 1000, treeX: 2880, treeY: 1000 }
    ],
    objects: [
      // === RED BASE DEFENSE (vertical tree wall) ===
      { type: 'solidTree', x: 350, y: 850 },
      { type: 'solidTree', x: 350, y: 920 },
      { type: 'solidTree', x: 350, y: 990 },
      { type: 'solidTree', x: 350, y: 1060 },
      { type: 'solidTree', x: 350, y: 1130 },

      // === BLUE BASE DEFENSE (vertical tree wall) ===
      { type: 'solidTree', x: 2650, y: 850 },
      { type: 'solidTree', x: 2650, y: 920 },
      { type: 'solidTree', x: 2650, y: 990 },
      { type: 'solidTree', x: 2650, y: 1060 },
      { type: 'solidTree', x: 2650, y: 1130 },

      // === TOP LANE - Red side barrier ===
      { type: 'solidTree', x: 600, y: 300 },
      { type: 'solidTree', x: 670, y: 300 },
      { type: 'solidTree', x: 740, y: 300 },
      { type: 'solidTree', x: 810, y: 300 },

      // === TOP LANE - Blue side barrier ===
      { type: 'solidTree', x: 2190, y: 300 },
      { type: 'solidTree', x: 2260, y: 300 },
      { type: 'solidTree', x: 2330, y: 300 },
      { type: 'solidTree', x: 2400, y: 300 },

      // === BOTTOM LANE - Red side barrier ===
      { type: 'solidTree', x: 600, y: 1700 },
      { type: 'solidTree', x: 670, y: 1700 },
      { type: 'solidTree', x: 740, y: 1700 },
      { type: 'solidTree', x: 810, y: 1700 },

      // === BOTTOM LANE - Blue side barrier ===
      { type: 'solidTree', x: 2190, y: 1700 },
      { type: 'solidTree', x: 2260, y: 1700 },
      { type: 'solidTree', x: 2330, y: 1700 },
      { type: 'solidTree', x: 2400, y: 1700 },

      // === TOP LANE - Center choke left ===
      { type: 'solidTree', x: 1100, y: 300 },
      { type: 'solidTree', x: 1100, y: 370 },
      { type: 'solidTree', x: 1100, y: 440 },
      { type: 'solidTree', x: 1100, y: 510 },

      // === TOP LANE - Center choke right ===
      { type: 'solidTree', x: 1900, y: 300 },
      { type: 'solidTree', x: 1900, y: 370 },
      { type: 'solidTree', x: 1900, y: 440 },
      { type: 'solidTree', x: 1900, y: 510 },

      // === BOTTOM LANE - Center choke left ===
      { type: 'solidTree', x: 1100, y: 1490 },
      { type: 'solidTree', x: 1100, y: 1560 },
      { type: 'solidTree', x: 1100, y: 1630 },
      { type: 'solidTree', x: 1100, y: 1700 },

      // === BOTTOM LANE - Center choke right ===
      { type: 'solidTree', x: 1900, y: 1490 },
      { type: 'solidTree', x: 1900, y: 1560 },
      { type: 'solidTree', x: 1900, y: 1630 },
      { type: 'solidTree', x: 1900, y: 1700 },

      // === CENTER ISLAND - Top wall ===
      { type: 'solidTree', x: 1430, y: 900 },
      { type: 'solidTree', x: 1500, y: 900 },
      { type: 'solidTree', x: 1570, y: 900 },

      // === CENTER ISLAND - Bottom wall ===
      { type: 'solidTree', x: 1430, y: 1100 },
      { type: 'solidTree', x: 1500, y: 1100 },
      { type: 'solidTree', x: 1570, y: 1100 },

      // === SNOWMAN CLUSTERS - Strategic cover ===
      // Top left junction
      { type: 'solidSnowman', x: 900, y: 600 },
      { type: 'solidSnowman', x: 940, y: 630 },
      { type: 'solidSnowman', x: 920, y: 680 },

      // Top right junction
      { type: 'solidSnowman', x: 2100, y: 600 },
      { type: 'solidSnowman', x: 2060, y: 630 },
      { type: 'solidSnowman', x: 2080, y: 680 },

      // Bottom left junction
      { type: 'solidSnowman', x: 900, y: 1320 },
      { type: 'solidSnowman', x: 940, y: 1350 },
      { type: 'solidSnowman', x: 920, y: 1400 },

      // Bottom right junction
      { type: 'solidSnowman', x: 2100, y: 1320 },
      { type: 'solidSnowman', x: 2060, y: 1350 },
      { type: 'solidSnowman', x: 2080, y: 1400 },

      // Center lane cover
      { type: 'solidSnowman', x: 1350, y: 1000 },
      { type: 'solidSnowman', x: 1650, y: 1000 },

      // Mid-field cover
      { type: 'solidSnowman', x: 700, y: 1000 },
      { type: 'solidSnowman', x: 2300, y: 1000 },

      // === TURRETS - Neutral hazards ===
      // Top lane turrets
      { type: 'turret', x: 1200, y: 400 },
      { type: 'turret', x: 1800, y: 400 },

      // Bottom lane turrets
      { type: 'turret', x: 1200, y: 1600 },
      { type: 'turret', x: 1800, y: 1600 },

      // Map edge turrets
      { type: 'turret', x: 1500, y: 150 },
      { type: 'turret', x: 1500, y: 1850 }
    ],
    terrain: [
      // === FROZEN LAKES - High risk/reward areas ===
      // Center - main battle zone
      { type: 'frozenLake', x: 1500, y: 1000, radius: 120 },

      // Lane junction hazards
      { type: 'frozenLake', x: 750, y: 400, radius: 80 },
      { type: 'frozenLake', x: 2250, y: 400, radius: 80 },
      { type: 'frozenLake', x: 750, y: 1600, radius: 80 },
      { type: 'frozenLake', x: 2250, y: 1600, radius: 80 },

      // === ICE PATCHES - Speed boost areas ===
      // Near base approaches
      { type: 'ice', x: 500, y: 500, radius: 50 },
      { type: 'ice', x: 2500, y: 500, radius: 50 },
      { type: 'ice', x: 500, y: 1500, radius: 50 },
      { type: 'ice', x: 2500, y: 1500, radius: 50 },

      // Mid-lane ice
      { type: 'ice', x: 1000, y: 1000, radius: 45 },
      { type: 'ice', x: 2000, y: 1000, radius: 45 },

      // Transition zones
      { type: 'ice', x: 1300, y: 600, radius: 40 },
      { type: 'ice', x: 1700, y: 600, radius: 40 },
      { type: 'ice', x: 1300, y: 1400, radius: 40 },
      { type: 'ice', x: 1700, y: 1400, radius: 40 },

      // === SNOWDRIFTS - Slow zones for defense ===
      // Defensive positions
      { type: 'snowdrift', x: 600, y: 800, radius: 35 },
      { type: 'snowdrift', x: 2400, y: 800, radius: 35 },
      { type: 'snowdrift', x: 600, y: 1200, radius: 35 },
      { type: 'snowdrift', x: 2400, y: 1200, radius: 35 },

      // Lane edges
      { type: 'snowdrift', x: 1200, y: 200, radius: 38 },
      { type: 'snowdrift', x: 1800, y: 200, radius: 38 },
      { type: 'snowdrift', x: 1200, y: 1800, radius: 38 },
      { type: 'snowdrift', x: 1800, y: 1800, radius: 38 },

      // Center approach
      { type: 'snowdrift', x: 1400, y: 750, radius: 30 },
      { type: 'snowdrift', x: 1600, y: 750, radius: 30 },
      { type: 'snowdrift', x: 1400, y: 1250, radius: 30 },
      { type: 'snowdrift', x: 1600, y: 1250, radius: 30 }
    ],
    spawners: {
      gift: { minCount: 25, maxCount: 50, interval: 4000 },
      powerup: { minCount: 6, maxCount: 12, interval: 7000 },
      grinch: { minCount: 1, maxCount: 3, interval: 45000 }
    },
    settings: {
      roundDuration: 180000,
      freezeDuration: 5000,
      hitsToRespawn: 3,
      initialSnowballs: 10,
      maxSnowballs: 20,
      treeCaptureRadius: 80
    }
  }
};

// Object type definitions (physics properties)
export const OBJECT_TYPES = {
  solidTree: { radius: 30, solid: true },
  solidSnowman: { radius: 25, solid: true },
  turret: { radius: 25, solid: true, shoots: true, shootIntervalMin: 2500, shootIntervalMax: 4500 },
  ice: { solid: false, effect: 'slide' },
  snowdrift: { solid: false, effect: 'slow', slowFactor: 0.5 },
  frozenLake: { solid: false, effect: 'danger', dangerTicks: 30 }
};

export function getLevel(levelId) {
  return LEVELS[levelId] || LEVELS['capture-christmas'];
}

export function getLevelList() {
  return Object.values(LEVELS).map(l => ({
    id: l.id,
    name: l.name,
    description: l.description,
    gameMode: l.gameMode
  }));
}
