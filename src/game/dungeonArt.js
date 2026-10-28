// Pixel pictures for the dungeon entrances, the way out, and the wall torches. All drawn from rectangles.
// Every picture is anchored at its bottom centre (x, y).

const rect = (g, c, x, y, w, h) => {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), w, h);
};

function crypt(g, x, y) {
  rect(g, 'rgba(40,30,40,0.28)', x - 26, y - 2, 52, 4);
  rect(g, '#5d6070', x - 25, y - 36, 50, 6); // roof slab
  rect(g, '#7d8190', x - 22, y - 30, 44, 30);
  rect(g, '#6a6e7d', x - 22, y - 30, 44, 2);
  for (let i = 0; i < 5; i++) rect(g, '#6a6e7d', x - 22 + i * 9, y - 22 + (i % 2) * 8, 8, 1); // stone courses
  rect(g, '#9a9eae', x - 22, y - 30, 5, 30); // pillars
  rect(g, '#9a9eae', x + 17, y - 30, 5, 30);
  rect(g, '#4a4d5c', x - 22, y - 30, 1, 30);
  rect(g, '#14121c', x - 9, y - 22, 18, 22); // the doorway
  rect(g, '#14121c', x - 7, y - 25, 14, 3);
  rect(g, '#1e1b28', x - 9, y - 22, 18, 2);
  rect(g, '#a7abbb', x - 12, y - 3, 24, 3); // steps
  rect(g, '#8a8e9e', x - 14, y - 1, 28, 1);
  rect(g, '#e9e6dc', x - 3, y - 33, 6, 4); // a skull over the door
  rect(g, '#2a2833', x - 2, y - 32, 1, 1);
  rect(g, '#2a2833', x + 1, y - 32, 1, 1);
  rect(g, '#5f8a4a', x - 20, y - 36, 6, 2); // moss
  rect(g, '#5f8a4a', x + 10, y - 31, 5, 2);
}

function cave(g, x, y) {
  rect(g, 'rgba(40,30,40,0.28)', x - 28, y - 2, 56, 4);
  rect(g, '#57534f', x - 26, y - 8, 52, 8);
  rect(g, '#6e6a66', x - 22, y - 16, 44, 8);
  rect(g, '#85807a', x - 16, y - 23, 32, 7);
  rect(g, '#9a958e', x - 9, y - 28, 18, 5);
  rect(g, '#6e6a66', x - 26, y - 8, 52, 1);
  rect(g, '#0f0c10', x - 10, y - 16, 20, 16); // the mouth
  rect(g, '#0f0c10', x - 8, y - 19, 16, 3);
  rect(g, '#1b1620', x - 10, y - 16, 20, 2);
  rect(g, '#4d7a3d', x - 24, y - 10, 6, 2); // moss and little stones
  rect(g, '#4d7a3d', x + 14, y - 18, 7, 2);
  rect(g, '#9a958e', x + 22, y - 4, 5, 4);
  rect(g, '#9a958e', x - 29, y - 3, 4, 3);
}

// the ruined house: the cottage picture (already darkened) with boards across the door and a few cracks
function ruin(g, x, y, house) {
  rect(g, 'rgba(40,30,40,0.28)', x - 38, y - 2, 76, 4);
  if (house) g.drawImage(house, Math.round(x - 48), Math.round(y - 86));
  rect(g, '#4a3524', x - 8, y - 30, 16, 3); // boards
  rect(g, '#5b412c', x - 8, y - 20, 16, 3);
  rect(g, '#4a3524', x - 8, y - 10, 16, 3);
  rect(g, '#5b412c', x - 1, y - 32, 3, 30);
}

export function drawEntrance(g, o, house) {
  if (o.dkind === 'crypt') crypt(g, o.x, o.y);
  else if (o.dkind === 'cave') cave(g, o.x, o.y);
  else ruin(g, o.x, o.y, house);
}

// a darkened, cobwebbed copy of the cottage picture, made once
export function makeRuinHouse(houseImg, sx, sy, sw, sh) {
  const c = document.createElement('canvas');
  c.width = sw;
  c.height = sh;
  const g = c.getContext('2d');
  g.drawImage(houseImg, sx, sy, sw, sh, 0, 0, sw, sh);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(50,40,70,0.5)';
  g.fillRect(0, 0, sw, sh);
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = 'rgba(230,230,240,0.55)';
  for (let i = 0; i < 6; i++) g.fillRect(4 + i * 2, 36 + i, 1, 1); // cobweb
  return c;
}

// the way out: a softly glowing archway on the floor of the first room
export function drawExit(g, o, t) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 3);
  rect(g, '#8d8fa0', o.x - 11, o.y - 3, 22, 5);
  rect(g, '#a7abbb', o.x - 11, o.y - 3, 22, 1);
  g.fillStyle = `rgba(190,225,255,${0.3 + 0.2 * pulse})`;
  g.fillRect(Math.round(o.x - 8), Math.round(o.y - 32), 16, 30);
  g.fillStyle = `rgba(255,255,255,${0.35 + 0.25 * pulse})`;
  g.fillRect(Math.round(o.x - 3), Math.round(o.y - 30 - pulse * 3), 6, 26);
  rect(g, '#6a6e7d', o.x - 10, o.y - 34, 3, 32);
  rect(g, '#6a6e7d', o.x + 7, o.y - 34, 3, 32);
  rect(g, '#6a6e7d', o.x - 10, o.y - 35, 20, 3);
}

export function drawTorch(g, o, t) {
  const f = Math.sin(t * 11 + o.x) * 1.2;
  rect(g, '#4a3524', o.x - 1, o.y - 2, 2, 7);
  rect(g, '#8a8e9e', o.x - 3, o.y - 3, 6, 2);
  rect(g, '#e8651f', o.x - 3, o.y - 9 + f * 0.4, 6, 6);
  rect(g, '#ffb236', o.x - 2, o.y - 12 + f, 4, 7);
  rect(g, '#fff1a0', o.x - 1, o.y - 8 + f * 0.5, 2, 4);
}
