// Default map. Legend: '.' buildable, '#' blocked, 'P' path, 'S' spawn, 'E' exit.
// Waypoints are in tile coordinates; the path runs along straight segments between them.
export const DEFAULT_MAP = {
  tileSize: 64,
  grid: [
    '....................',
    'SPPPPPPPPPPPPPPPPP..',
    '........##.......P..',
    '.................P..',
    '..PPPPPPPPPPPPPPPP..',
    '..P.......##........',
    '..P.................',
    '..PPPPPPPPPPPPPPPPPE',
    '....................',
    '.....##.............',
  ],
  waypoints: [
    { col: 0, row: 1 },
    { col: 17, row: 1 },
    { col: 17, row: 4 },
    { col: 2, row: 4 },
    { col: 2, row: 7 },
    { col: 19, row: 7 },
  ],
};
