// Weapon icons in three styles: flat (filled), outline (line art), and pixel (retro blocks).
export const ICON_SETS = { flat: 'Flat', outline: 'Outline', pixel: 'Pixel', military: 'Military (olive)' };

const FLAT = {
  rfpg: '<rect x="6" y="17" width="28" height="13" rx="4" fill="#6ef7ff"/><rect x="30" y="20" width="13" height="4" rx="2" fill="#bfefff"/><rect x="30" y="26" width="13" height="4" rx="2" fill="#bfefff"/><circle cx="14" cy="36" r="5" fill="#2d4a55"/><circle cx="30" cy="36" r="5" fill="#2d4a55"/>',
  erfpg: '<rect x="6" y="17" width="28" height="13" rx="4" fill="#d8fbff"/><rect x="30" y="20" width="13" height="4" rx="2" fill="#ffd23a"/><rect x="30" y="26" width="13" height="4" rx="2" fill="#ffd23a"/><circle cx="16" cy="23" r="3.5" fill="#ffd23a"/><circle cx="14" cy="36" r="5" fill="#2d4a55"/><circle cx="30" cy="36" r="5" fill="#2d4a55"/>',
  mortar: '<rect x="19" y="6" width="10" height="28" rx="4" fill="#ffa64d" transform="rotate(25 24 24)"/><rect x="9" y="34" width="30" height="7" rx="3" fill="#5f5a50"/><circle cx="24" cy="38" r="3" fill="#ffd23a"/>',
  napalm: '<path d="M24 5 C31 16 39 21 35 33 C33 41 17 43 14 31 C12 22 20 20 24 5 Z" fill="#ff5a20"/><path d="M24 23 C27 29 31 31 29 37 C27 42 21 41 20 35 C19 30 22 28 24 23 Z" fill="#ffd23a"/>',
};

const OUTLINE = {
  rfpg: '<rect x="6" y="17" width="28" height="13" rx="4"/><rect x="30" y="20" width="13" height="4" rx="2"/><rect x="30" y="26" width="13" height="4" rx="2"/><circle cx="14" cy="36" r="5"/><circle cx="30" cy="36" r="5"/>',
  erfpg: '<rect x="6" y="17" width="28" height="13" rx="4"/><rect x="30" y="20" width="13" height="4" rx="2"/><rect x="30" y="26" width="13" height="4" rx="2"/><circle cx="16" cy="23" r="3.5"/><circle cx="14" cy="36" r="5"/><circle cx="30" cy="36" r="5"/>',
  mortar: '<rect x="19" y="6" width="10" height="28" rx="4" transform="rotate(25 24 24)"/><rect x="9" y="34" width="30" height="7" rx="3"/><circle cx="24" cy="38" r="3"/>',
  napalm: '<path d="M24 5 C31 16 39 21 35 33 C33 41 17 43 14 31 C12 22 20 20 24 5 Z"/><path d="M24 23 C27 29 31 31 29 37 C27 42 21 41 20 35 C19 30 22 28 24 23 Z"/>',
};

// Olive-drab military style, drawn after the isometric vehicle reference.
const MILITARY = {
  rfpg: '<rect x="6" y="30" width="32" height="7" rx="3.5" fill="#2a2d22"/><path d="M6 30 L10 22 H32 L38 30 Z" fill="#56623a" stroke="#2b3120" stroke-width="1.5"/><rect x="16" y="15" width="12" height="9" rx="2" fill="#6b7a48" stroke="#2b3120"/><rect x="27" y="17" width="16" height="3" fill="#2b3120"/><circle cx="12" cy="26" r="2" fill="#8a9460"/><circle cx="26" cy="25" r="1.6" fill="#8a9460"/>',
  erfpg: '<rect x="6" y="30" width="32" height="7" rx="3.5" fill="#2a2d22"/><path d="M6 30 L10 22 H32 L38 30 Z" fill="#56623a" stroke="#2b3120" stroke-width="1.5"/><rect x="16" y="15" width="12" height="9" rx="2" fill="#6b7a48" stroke="#2b3120"/><rect x="27" y="17" width="16" height="3" fill="#2b3120"/><circle cx="22" cy="20" r="1.8" fill="#ffd23a"/><circle cx="12" cy="26" r="2" fill="#8a9460"/>',
  mortar: '<rect x="8" y="34" width="32" height="5" rx="2" fill="#2a2d22"/><rect x="20" y="8" width="8" height="26" rx="3" fill="#56623a" stroke="#2b3120" transform="rotate(25 24 24)"/><path d="M18 34 L24 24 L30 34" fill="none" stroke="#2b3120" stroke-width="2"/><circle cx="24" cy="38" r="2" fill="#ffd23a"/>',
  napalm: '<rect x="8" y="26" width="26" height="10" rx="3" fill="#56623a" stroke="#2b3120"/><rect x="32" y="23" width="8" height="5" fill="#2b3120"/><path d="M38 22 C42 15 38 11 42 6 C44 12 46 15 44 22 Z" fill="#ff7a2a"/><path d="M39 21 C41 17 40 15 41 12 C42 16 43 18 42 21 Z" fill="#ffd23a"/><circle cx="14" cy="31" r="2" fill="#8a9460"/>',
};

// 12x12 pixel grids: "#" body, "+" highlight, "." empty.
const PIXEL_GRID = {
  rfpg: ['............', '............', '..########..', '.##++++##...', '##########..', '##++++++##..', '##########.#', '.###....###.', '............', '............', '............', '............'],
  erfpg: ['............', '............', '..########..', '.##+##+##...', '##########..', '##++++++##..', '##########.#', '.###....###.', '............', '............', '............', '............'],
  mortar: ['.....##.....', '.....##.....', '....####....', '....####....', '...######...', '...######...', '..########..', '.##########.', '.##########.', '.##########.', '............', '............'],
  napalm: ['.....##.....', '....####....', '....####....', '...##+##....', '..###+###...', '.##+++###...', '.###++###...', '.###+####...', '..#####.....', '...###......', '............', '............'],
};
const PIXEL_COLORS = { rfpg: ['#6ef7ff', '#d8fbff'], erfpg: ['#d8fbff', '#ffd23a'], mortar: ['#ffa64d', '#ffd23a'], napalm: ['#ff5a20', '#ffd23a'] };

function pixelSvg(id) {
  const [body, hi] = PIXEL_COLORS[id];
  let out = '';
  PIXEL_GRID[id].forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === '.') continue;
      out += `<rect x="${x * 4}" y="${y * 4}" width="4" height="4" fill="${c === '+' ? hi : body}"/>`;
    }
  });
  return out;
}

export function weaponIcon(set, id) {
  let inner;
  if (set === 'outline') inner = `<g fill="none" stroke="#6ef7ff" stroke-width="2.5" stroke-linejoin="round">${OUTLINE[id]}</g>`;
  else if (set === 'pixel') inner = `<g shape-rendering="crispEdges">${pixelSvg(id)}</g>`;
  else if (set === 'military') inner = MILITARY[id];
  else inner = FLAT[id];
  return `<svg viewBox="0 0 48 48" aria-hidden="true">${inner}</svg>`;
}
