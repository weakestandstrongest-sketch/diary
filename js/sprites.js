// ドット絵スプライト（文字マップ -> SVG）

// 気分は「わるい ↔ よい」の発散スケール（むらさき ↔ グレー ↔ みどり）。
// ヒートマップやグラフも同じ色を使う。
export const MOOD_COLORS = {
  5: { b: '#2fb350', h: '#9be8a8', o: '#0d4a1e' },
  4: { b: '#86d98a', h: '#d4f5d2', o: '#2a6b31' },
  3: { b: '#a3a8b8', h: '#e6e8ee', o: '#3d4150' },
  2: { b: '#b79be6', h: '#e5d8fa', o: '#4b2f7a' },
  1: { b: '#7444b8', h: '#b89ae6', o: '#2a1150' },
};

export const MOOD_LABEL = { 5: 'さいこう', 4: 'よい', 3: 'ふつう', 2: 'わるい', 1: 'さいあく' };

const SLIME = [
  '.....oo.....',
  '....obbo....',
  '...obhbbo...',
  '..obhbbbbo..',
  '.obhbbbbbbo.',
  '.obbbbbbbbo.',
  'obbbbbbbbbbo',
  'obbbbbbbbbbo',
  'obbbbbbbbbbo',
  'obbbbbbbbbbo',
  '.obbbbbbbbo.',
  '..oooooooo..',
];

// 顔パーツ（8x6）を 5..10行目・2..9列目に重ねる
const FACES = {
  5: ['........', '.e....e.', 'e.e..e.e', 'c......c', '..mrrm..', '...mm...'],
  4: ['........', '.e....e.', '.e....e.', 'c......c', '.m....m.', '..mmmm..'],
  3: ['........', '.e....e.', '.e....e.', '........', '..mmmm..', '........'],
  2: ['.......s', '.e....e.', '.e....e.', '.......s', '..mmmm..', '.m....m.'],
  1: ['........', 'e.e..e.e', '.e....e.', 'e.e..e.e', '...mm...', '..m..m..'],
};

const FACE_PAL = { e: '#14141c', m: '#14141c', r: '#e83a3a', c: '#ff8fa3', s: '#7fd8ff' };

function slimeMap(mood) {
  const rows = SLIME.map((r) => r.split(''));
  FACES[mood].forEach((line, dy) => {
    line.split('').forEach((ch, dx) => {
      if (ch !== '.') rows[5 + dy][2 + dx] = ch;
    });
  });
  return rows.map((r) => r.join(''));
}

const HERO = [
  '......oooo......',
  '....ooHHhhoo....',
  '...oHHhhhhhho...',
  '..ohhhhhhhhhho..',
  '..ohooooooooho..',
  '..oossssssssoo..',
  '...osesssseso...',
  '...o' + 's'.repeat(8) + 'o...',
  '....oossssoo....',
  '..oaaaaaaaaaao..',
  '.oaaoaaaaaaoaao.',
  '.osoaaaaaaaaoso.',
  '..ooaaaaaaaaoo..',
  '...obbbooobbbo..',
  '...obbbo.obbbo..',
  '...ooooo.ooooo..',
];

const HERO_PAL = {
  o: '#14141c',
  h: '#3a6df0',
  H: '#9db8ff',
  s: '#ffcf9e',
  e: '#14141c',
  a: '#d6d9e6',
  b: '#7a4a2a',
};

const HERO_HURT_PAL = { ...HERO_PAL, h: '#c05a2a', H: '#ffb08a', a: '#e0b0a0' };

/** 文字マップを SVG 文字列に。横に並ぶ同色ピクセルはまとめて1つの rect にする */
export function renderMap(map, palette, size, label = '') {
  const h = map.length;
  const w = map[0].length;
  let rects = '';
  map.forEach((row, y) => {
    let x = 0;
    while (x < w) {
      const ch = row[x];
      if (ch === '.' || !palette[ch]) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < w && row[x + run] === ch) run++;
      rects += `<rect x="${x}" y="${y}" width="${run}" height="1" fill="${palette[ch]}"/>`;
      x += run;
    }
  });
  const aria = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="px" ${aria} viewBox="0 0 ${w} ${h}" width="${size}" height="${size}" shape-rendering="crispEdges">${rects}</svg>`;
}

export function moodSprite(mood, size = 24) {
  if (!MOOD_COLORS[mood]) return emptySprite(size);
  return renderMap(slimeMap(mood), { ...MOOD_COLORS[mood], ...FACE_PAL }, size, MOOD_LABEL[mood]);
}

export function emptySprite(size = 24) {
  const pal = { o: '#4a4a55', b: 'transparent', h: 'transparent' };
  return renderMap(SLIME, pal, size, 'きろくなし');
}

export function heroSprite(size = 64, hurt = false) {
  return renderMap(HERO, hurt ? HERO_HURT_PAL : HERO_PAL, size, 'ゆうしゃ');
}

export const _maps = { SLIME, HERO, FACES };
