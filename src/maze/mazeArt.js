// Maze Rush: the small pixel pictures that are drawn in code (the fruit, the two power-ups). Each is a 12x12 sprite on its own canvas.

const S = 12;

const make = (draw) => {
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  return c;
};

const px = (c, x, y, w, h, col) => {
  c.fillStyle = col;
  c.fillRect(x, y, w, h);
};
const disc = (c, cx, cy, r, col) => {
  c.fillStyle = col;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) c.fillRect(x, y, 1, 1);
    }
  }
};
const ellipse = (c, cx, cy, rx, ry, col) => {
  c.fillStyle = col;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) c.fillRect(x, y, 1, 1);
    }
  }
};

const DRAW = {
  strawberry: (c) => {
    // leaves, then the body in rows that narrow to a point
    px(c, 3, 1, 6, 1, '#3f9e43');
    px(c, 4, 0, 1, 1, '#3f9e43');
    px(c, 7, 0, 1, 1, '#3f9e43');
    px(c, 5, 2, 2, 1, '#2e7d32');
    const rows = [[2, 8], [1, 10], [1, 10], [1, 10], [2, 8], [2, 8], [3, 6], [4, 4], [5, 2]];
    rows.forEach(([x, w], i) => {
      px(c, x, 2 + i, w, 1, '#e63946');
      px(c, x, 2 + i, 1, 1, '#b8222f');
    });
    px(c, 3, 3, 2, 1, '#ff8fa0');
    for (const [x, y] of [[4, 5], [7, 4], [6, 6], [3, 7], [8, 7], [5, 8]]) px(c, x, y, 1, 1, '#ffe08a');
  },
  cherry: (c) => {
    px(c, 6, 0, 3, 1, '#3f9e43');
    px(c, 6, 1, 1, 1, '#2e7d32');
    for (const [x, y] of [[5, 2], [4, 3], [3, 4], [2, 5], [7, 2], [8, 3], [9, 4]]) px(c, x, y, 1, 1, '#6b8e23');
    disc(c, 3.2, 8, 2.9, '#d62839');
    disc(c, 8.6, 8, 2.9, '#d62839');
    px(c, 2, 7, 1, 1, '#ff9aa6');
    px(c, 7, 7, 1, 1, '#ff9aa6');
    px(c, 4, 10, 2, 1, '#9b1b2a');
    px(c, 9, 10, 2, 1, '#9b1b2a');
  },
  lemon: (c) => {
    ellipse(c, 6, 6.6, 5.2, 3.7, '#ffd93b');
    px(c, 0, 6, 1, 1, '#e0a800');
    px(c, 11, 6, 1, 1, '#e0a800');
    px(c, 3, 9, 6, 1, '#e0a800');
    px(c, 3, 4, 3, 1, '#fff3a6');
    px(c, 4, 1, 3, 2, '#3f9e43');
    px(c, 6, 3, 1, 1, '#2e7d32');
  },
  grape: (c) => {
    px(c, 6, 0, 1, 2, '#7a4a21');
    px(c, 7, 1, 3, 1, '#3f9e43');
    for (const [x, y] of [[3, 4], [6, 4], [9, 4], [4.5, 7], [7.5, 7], [6, 10]]) {
      disc(c, x, y, 1.9, '#8e44ad');
      px(c, Math.round(x - 1), Math.round(y - 1.5), 1, 1, '#d7a8f0');
    }
  },
  orange: (c) => {
    disc(c, 6, 6.8, 4.9, '#ff9f1c');
    px(c, 3, 4, 2, 1, '#ffd08a');
    px(c, 4, 9, 4, 1, '#d97904');
    px(c, 5, 1, 2, 1, '#7a4a21');
    px(c, 6, 0, 3, 2, '#3f9e43');
  },
  apple: (c) => {
    disc(c, 4.4, 7, 3.6, '#e63946');
    disc(c, 7.6, 7, 3.6, '#e63946');
    disc(c, 6, 8, 3.6, '#e63946');
    px(c, 2, 5, 1, 2, '#ff9aa6');
    px(c, 5, 10, 3, 1, '#b8222f');
    px(c, 6, 1, 1, 3, '#7a4a21');
    px(c, 7, 1, 3, 2, '#3f9e43');
  },
  watermelon: (c) => {
    // a slice: green rind, pale edge, red middle, black seeds
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const d = Math.hypot(x + 0.5 - 6, y + 0.5 - 2);
        if (y < 2 || d > 9) continue;
        c.fillStyle = d > 8 ? '#2e7d32' : d > 7 ? '#b9e38a' : '#ee4266';
        c.fillRect(x, y, 1, 1);
      }
    }
    px(c, 0, 2, 12, 1, '#b9e38a');
    for (const [x, y] of [[4, 4], [7, 4], [5, 6], [8, 6], [6, 8]]) px(c, x, y, 1, 1, '#222');
  },
  blueberry: (c) => {
    for (const [x, y] of [[3.5, 7], [8.5, 7], [6, 4.2]]) {
      disc(c, x, y, 3, '#3b5bdb');
      px(c, Math.round(x - 1), Math.round(y - 1.5), 1, 1, '#9db4ff');
      px(c, Math.round(x - 0.5), Math.round(y + 0.5), 1, 1, '#22307a');
    }
  },
};

const POWER = {
  freeze: (c) => {
    disc(c, 6, 6, 5.6, '#9fdcff');
    disc(c, 6, 6, 4.6, '#d9f3ff');
    px(c, 6, 2, 1, 8, '#4aa3df');
    px(c, 2, 6, 8, 1, '#4aa3df');
    for (const [x, y] of [[4, 4], [8, 4], [4, 8], [8, 8]]) px(c, x, y, 1, 1, '#4aa3df');
    px(c, 5, 5, 3, 3, '#ffffff');
  },
  boost: (c) => {
    disc(c, 6, 6, 5.6, '#ff9f1c');
    disc(c, 6, 6, 4.6, '#ffd93b');
    px(c, 6, 2, 2, 1, '#fff');
    px(c, 5, 3, 2, 1, '#fff');
    px(c, 4, 4, 5, 1, '#fff');
    px(c, 6, 5, 2, 1, '#fff');
    px(c, 5, 6, 2, 1, '#fff');
    px(c, 4, 7, 2, 1, '#fff');
    px(c, 3, 8, 1, 1, '#fff');
  },
};

const cache = {};
export const fruitSprite = (kind) => (cache[kind] ||= make(DRAW[kind] || DRAW.apple));
export const powerSprite = (type) => (cache[`p:${type}`] ||= make(POWER[type] || POWER.boost));

// a picture the page can show in an <img> (the goal list)
const urls = {};
export const fruitUrl = (kind) => (urls[kind] ||= fruitSprite(kind).toDataURL());
export const powerUrl = (type) => (urls[`p:${type}`] ||= powerSprite(type).toDataURL());
