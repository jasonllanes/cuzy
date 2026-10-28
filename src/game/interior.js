// The inside of your cottage (Free Roam): a small room of its own that you are teleported into when you walk through the
// front door. The furniture is cut from the Farm RPG "Interior" sheet and the Modern Interiors sheet; the floor and
// walls are painted from rectangles. Coordinates are in pixels, 16 to a tile.

export const ROOM = { w: 240, h: 176, wall: 56 };

// where your feet may go
export const WALK = { l: 18, r: 222, top: 64, bottom: 170 };

// the door mat at the bottom: step on it (or press Space beside it) to go back outside
export const DOOR = { x0: 100, x1: 140, y: 158 };

// things the hero cannot walk through (feet-level boxes)
export const SOLIDS = [
  { x: 12, y: 60, w: 56, h: 32 }, // the bed and its bedside table
  { x: 106, y: 104, w: 28, h: 16 }, // the table
  { x: 186, y: 56, w: 36, h: 32 }, // the chest
  { x: 14, y: 138, w: 38, h: 16 }, // the sofa
  { x: 198, y: 102, w: 28, h: 18 }, // the dressers
];

// what you can use, and where you stand to do it
export const SPOTS = {
  chest: { x: 204, y: 94, label: 'Space · open storage' },
  bed: { x: 40, y: 100, label: 'Space · rest in bed' },
};

// [sheet, x, y, w, h]: a rough box around each piece of furniture; it is trimmed down to the drawing inside
const PIECES = {
  plantRed: ['farm', 0, 0, 16, 16],
  picture: ['farm', 16, 0, 16, 16],
  plantGreen: ['farm', 32, 0, 16, 16],
  clock: ['farm', 0, 16, 16, 16],
  egg: ['farm', 16, 16, 16, 16],
  bed: ['farm', 79, 51, 34, 26],
  fireplace: ['farm', 116, 8, 24, 40],
  dresser: ['farm', 96, 120, 16, 18],
  dresser2: ['farm', 112, 120, 16, 18],
  table: ['farm', 69, 120, 24, 24],
  chairR: ['farm', 34, 125, 14, 19],
  chairL: ['farm', 50, 125, 14, 19],
  rugGreen: ['farm', 0, 81, 48, 32],
  windowRed: ['modern', 115, 392, 26, 20],
  windowCurtain: ['modern', 70, 392, 36, 24],
  rugRed: ['modern', 114, 244, 60, 40],
  sofa: ['modern', 128, 288, 34, 26],
  shelf: ['modern', 80, 225, 31, 31],
  paintFire: ['modern', 130, 330, 29, 14],
  paintLand: ['modern', 130, 362, 29, 14],
  mirror: ['modern', 135, 1065, 17, 30],
  globe: ['modern', 193, 1057, 13, 22],
};

const cutCache = new Map();
// the piece as its own small canvas, with the empty border cut away
function piece(img, name) {
  let c = cutCache.get(name);
  if (c) return c;
  const [sheet, x, y, w, h] = PIECES[name];
  const src = img[`interior/${sheet}`];
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const tg = tmp.getContext('2d');
  tg.drawImage(src, x, y, w, h, 0, 0, w, h);
  const px = tg.getImageData(0, 0, w, h).data;
  let l = w, r = -1, t = h, b = -1;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (!px[(j * w + i) * 4 + 3]) continue;
      l = Math.min(l, i);
      r = Math.max(r, i);
      t = Math.min(t, j);
      b = Math.max(b, j);
    }
  }
  if (r < 0) {
    l = 0; r = w - 1; t = 0; b = h - 1;
  }
  c = document.createElement('canvas');
  c.width = r - l + 1;
  c.height = b - t + 1;
  c.getContext('2d').drawImage(tmp, l, t, c.width, c.height, 0, 0, c.width, c.height);
  cutCache.set(name, c);
  return c;
}

// draw a piece with its top-left corner at (x, y)
const putTop = (g, img, name, x, y) => g.drawImage(piece(img, name), Math.round(x), Math.round(y));
// ...or standing with its bottom-centre at (x, y), with a soft shadow
function putFeet(g, img, name, x, y, shadow = true) {
  const c = piece(img, name);
  if (shadow) {
    g.fillStyle = 'rgba(60,40,30,0.22)';
    g.fillRect(Math.round(x - c.width / 2) + 1, Math.round(y) - 2, c.width - 2, 3);
  }
  g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height));
}

const wood = ['#c99d68', '#c29561', '#cfa571', '#bd8f5b'];

// the floor, walls and wall hangings never change, so they are painted once
let backdrop = null;
function paintBackdrop(img) {
  const c = document.createElement('canvas');
  c.width = ROOM.w;
  c.height = ROOM.h;
  const g = c.getContext('2d');
  // floorboards
  for (let y = ROOM.wall; y < ROOM.h; y += 16) {
    for (let x = 0; x < ROOM.w; x += 16) {
      g.fillStyle = wood[((x >> 4) * 7 + (y >> 4) * 3) % wood.length];
      g.fillRect(x, y, 16, 16);
      g.fillStyle = 'rgba(90,55,28,0.28)';
      g.fillRect(x, y + 15, 16, 1);
      g.fillRect(x + ((y >> 4) % 2 ? 5 : 11), y, 1, 16);
      g.fillStyle = 'rgba(255,235,200,0.16)';
      g.fillRect(x + 2, y + 3, 6, 1);
    }
  }
  // back wall: papered, with a skirting board
  g.fillStyle = '#f3e3c6';
  g.fillRect(0, 0, ROOM.w, ROOM.wall);
  g.fillStyle = '#ead2a8';
  for (let x = 8; x < ROOM.w; x += 16) g.fillRect(x, 4, 4, ROOM.wall - 10);
  g.fillStyle = '#5b3d26';
  g.fillRect(0, 0, ROOM.w, 4);
  g.fillStyle = '#7a5535';
  g.fillRect(0, ROOM.wall - 6, ROOM.w, 6);
  g.fillStyle = '#946a42';
  g.fillRect(0, ROOM.wall - 6, ROOM.w, 1);
  // side and bottom walls
  g.fillStyle = '#6e4a2c';
  g.fillRect(0, 0, 10, ROOM.h);
  g.fillRect(ROOM.w - 10, 0, 10, ROOM.h);
  g.fillStyle = '#8a6038';
  g.fillRect(10, ROOM.wall, 2, ROOM.h - ROOM.wall);
  g.fillRect(ROOM.w - 12, ROOM.wall, 2, ROOM.h - ROOM.wall);
  g.fillStyle = '#6e4a2c';
  g.fillRect(0, ROOM.h - 6, DOOR.x0, 6);
  g.fillRect(DOOR.x1, ROOM.h - 6, ROOM.w - DOOR.x1, 6);
  // rugs
  putTop(g, img, 'rugRed', 90, 110);
  putTop(g, img, 'rugGreen', 178, 124);
  // door mat and the light from outside
  g.fillStyle = '#9b7a52';
  g.fillRect(DOOR.x0 + 4, ROOM.h - 14, DOOR.x1 - DOOR.x0 - 8, 8);
  g.fillStyle = '#7a5d3c';
  g.fillRect(DOOR.x0 + 6, ROOM.h - 12, DOOR.x1 - DOOR.x0 - 12, 1);
  g.fillStyle = 'rgba(255,245,200,0.35)';
  g.fillRect(DOOR.x0, ROOM.h - 36, DOOR.x1 - DOOR.x0, 30);
  // things on the back wall
  putTop(g, img, 'picture', 12, 14);
  putTop(g, img, 'windowRed', 34, 12);
  putTop(g, img, 'windowCurtain', 68, 10);
  putTop(g, img, 'clock', 112, 6);
  putTop(g, img, 'egg', 130, 8);
  putTop(g, img, 'paintFire', 142, 20);
  putTop(g, img, 'fireplace', 176, 14);
  putTop(g, img, 'paintLand', 204, 16);
  return c;
}

// what the window shows
const sky = (hour, weather) => {
  if (weather === 'rain') return hour >= 6 && hour < 19.5 ? '#8a9bb0' : '#1f2840';
  if (weather === 'snow') return hour >= 6 && hour < 19.5 ? '#dde8f2' : '#2d3858';
  return hour >= 6.5 && hour < 19 ? '#a8e4f7' : hour >= 5 && hour < 6.5 ? '#f5c6a2' : hour >= 19 && hour < 20.5 ? '#f0a98c' : '#25305a';
};

// the whole room. The hero is drawn in between the furniture so walking behind the table looks right.
export function drawRoom(g, { img, t, hour, weather, storageOpen, drawMe, meY }) {
  backdrop ||= paintBackdrop(img);
  g.fillStyle = '#17110d';
  g.fillRect(-400, -400, ROOM.w + 800, ROOM.h + 800);
  g.drawImage(backdrop, 0, 0);

  // a tint through the windows, so the time of day and the weather show indoors
  const wc = piece(img, 'windowRed');
  g.fillStyle = sky(hour, weather);
  g.globalAlpha = 0.5;
  g.fillRect(34 + 3, 12 + 3, wc.width - 6, wc.height - 7);
  g.globalAlpha = 1;
  if (weather === 'rain') {
    g.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 6; i++) g.fillRect(38 + ((i * 7 + Math.floor(t * 20)) % 18), 15 + ((i * 5 + Math.floor(t * 30)) % 12), 1, 3);
  }
  // the fire flickers
  const fl = Math.sin(t * 9) * 0.5 + 0.5;
  g.fillStyle = `rgba(255,170,60,${0.12 + 0.1 * fl})`;
  g.beginPath();
  g.ellipse(188, 70, 36, 24, 0, 0, Math.PI * 2);
  g.fill();

  // furniture and the hero, back to front
  const things = [
    { y: 92, draw: () => putFeet(g, img, 'bed', 32, 92) },
    { y: 68, draw: () => putFeet(g, img, 'dresser', 58, 88) },
    { y: 62, draw: () => putFeet(g, img, 'shelf', 126, 62, false) },
    { y: 120, draw: () => putFeet(g, img, 'table', 120, 120) },
    { y: 118, draw: () => putFeet(g, img, 'chairR', 100, 119) },
    { y: 118, draw: () => putFeet(g, img, 'chairL', 141, 119) },
    { y: 154, draw: () => putFeet(g, img, 'sofa', 32, 156) },
    { y: 122, draw: () => { putFeet(g, img, 'dresser', 206, 122); putFeet(g, img, 'dresser2', 222, 122); putFeet(g, img, 'plantRed', 206, 105, false); } },
    { y: 150, draw: () => putFeet(g, img, 'plantGreen', 216, 156, false) },
    { y: 112, draw: () => putFeet(g, img, 'globe', 120, 105, false) },
    {
      y: 90,
      draw: () => {
        g.fillStyle = 'rgba(60,40,30,0.25)';
        g.fillRect(186, 84, 34, 4);
        g.drawImage(img.chest, 0, storageOpen ? 16 : 0, 32, 16, 188, 66, 32, 16);
      },
    },
    { y: meY, draw: drawMe },
  ].sort((a, b) => a.y - b.y);
  for (const th of things) th.draw();
}

// is a pair of feet at (x, y) in the way of a wall or a piece of furniture?
export function roomBlocked(x, y, footW, footH) {
  const l = x - footW / 2;
  const t = y - footH;
  if (l < WALK.l || l + footW > WALK.r || y < WALK.top || y > WALK.bottom) return true;
  for (const s of SOLIDS) if (l < s.x + s.w && l + footW > s.x && t < s.y + s.h && t + footH > s.y) return true;
  return false;
}
