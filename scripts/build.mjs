// Builds the playable page from src/. Run: node scripts/build.mjs
//   index.html        the game as a standalone page (three.js from vendor/), served by GitHub Pages
//   dist/artifact.html the same page as a fragment with three.js from a CDN, for publishing as a Claude artifact
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const read = f => fs.readFileSync(root + f, 'utf8');
const src = read('src/page.src.html');
// pure modules, in dependency order: their imports of each other are dropped, their exports become plain declarations
const MODULES = ['src/logic.mjs', 'src/meta.mjs'];
const logic = MODULES.filter(f => fs.existsSync(root + f))
  .map(f => read(f).replace(/^import [^\n]* from '\.\/[\w.-]+';\n/gm, '').replace(/^export /gm, '')).join('\n');
const levels = read('src/levels.json').trim();
// the daily pool, one board per line in the source, packed tight in the page
const dailies = JSON.stringify(JSON.parse(read('src/dailies.json')));
for (const ph of ['/*__LOGIC__*/', '/*__LEVELS__*/', '/*__DAILIES__*/']) if (!src.includes(ph)) throw new Error(ph + ' placeholder missing in src/page.src.html');
const page = src.replace('/*__LOGIC__*/', () => logic).replace('/*__LEVELS__*/', () => levels).replace('/*__DAILIES__*/', () => dailies);

const CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0/';
if (!page.includes(CDN + 'build/three.module.js')) throw new Error('three.js import map not found');
const local = page.replace(CDN + 'build/three.module.js', './vendor/three/three.module.min.js').replace(CDN + 'examples/jsm/', './vendor/three/addons/');
const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#F7DAD0">
<meta name="description" content="Sum Sort: fill each jar with number tiles that add up to its badge.">
<style>html,body{margin:0;padding:0}[hidden]:not([hidden=until-found i]){display:none!important}</style>
</head>
<body>
`;
// the source starts with <title> and font links: those belong in the head of a standalone page
const cut = local.indexOf('<style>');
fs.writeFileSync(root + 'index.html', head.replace('</head>', local.slice(0, cut).replace('Sum Sort Prototype', 'Sum Sort') + '</head>') + local.slice(cut) + '\n</body>\n</html>\n');
fs.mkdirSync(root + 'dist', { recursive: true });
fs.writeFileSync(root + 'dist/artifact.html', page);
console.log('built index.html', (head.length + local.length), 'bytes');
