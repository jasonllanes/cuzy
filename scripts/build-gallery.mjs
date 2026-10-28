// Scans the asset packs and writes gallery-manifest.json for asset-gallery.html.
// Run with: npm run gallery
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const PACKS = [
  'Farm RPG FREE 16x16 - Tiny Asset Pack',
  'Modern tiles_Free',
  'Sunnyside_World_ASSET_PACK_V2.1',
  'Apocalypse',
  'ENEMY',
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name === '__MACOSX') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (name.toLowerCase().endsWith('.png')) yield full;
  }
}

const files = [];
for (const pack of PACKS) {
  for (const full of walk(join(root, pack))) {
    const buf = readFileSync(full);
    // PNG header: width and height are big-endian ints at bytes 16 and 20
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    files.push({ p: relative(root, full).split(sep).join('/'), w, h });
  }
}
files.sort((a, b) => a.p.localeCompare(b.p, undefined, { numeric: true }));
writeFileSync(join(root, 'gallery-manifest.json'), JSON.stringify({ packs: PACKS, files }));
console.log(`Gallery manifest: ${files.length} images from ${PACKS.length} packs`);
