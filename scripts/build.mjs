// Builds the playable page from src/. Run: node scripts/build.mjs
//   index.html        the game as a standalone page (three.js from vendor/), served by GitHub Pages
//   dist/artifact.html the same page as a fragment with three.js from a CDN, for publishing as a Claude artifact
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const read = f => fs.readFileSync(root + f, 'utf8');
const src = read('src/page.src.html');
const logic = read('src/logic.mjs').replace(/^export /gm, '');
const levels = read('src/levels.json').trim();
if (!src.includes('/*__LOGIC__*/') || !src.includes('/*__LEVELS__*/')) throw new Error('placeholders missing in src/page.src.html');
const page = src.replace('/*__LOGIC__*/', () => logic).replace('/*__LEVELS__*/', () => levels);

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
