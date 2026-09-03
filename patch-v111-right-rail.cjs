const fs = require('fs');
const vm = require('vm');
const { execFileSync } = require('child_process');

const FILE = 'app.config.js';
const KNOWN_GOOD_COMMIT = 'b83b46e';

function embedded(source, name) {
  const match = source.match(new RegExp(`const ${name} = ("(?:\\\\.|[^"\\\\])*");`, 's'));
  if (!match) throw new Error(`Missing embedded ${name}`);
  return vm.runInNewContext(match[1]);
}

function setEmbedded(source, name, value) {
  const pattern = new RegExp(`const ${name} = "(?:\\\\.|[^"\\\\])*";`, 's');
  const matches = source.match(pattern);
  if (!matches || matches.length !== 1) throw new Error(`Expected one embedded ${name}`);
  return source.replace(pattern, `const ${name} = ${JSON.stringify(value)};`);
}

let source = fs.readFileSync(FILE, 'utf8');
const knownSource = execFileSync('git', ['show', `${KNOWN_GOOD_COMMIT}:app.config.js`], {
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});

let hud = embedded(knownSource, 'OVERLAY_SERVICE_KT');

hud = hud.replace(
  `    val collapsedWidthDp = when {\n      compact -> 100\n      large -> 126\n      else -> 114\n    }`,
  `    val collapsedWidthDp = 44`
);

const oldToggle = `            if (logoHit) {\n              hudCollapsed = false\n              expanded = false`;
const newToggle = `            if (logoHit) {\n              hudCollapsed = !hudCollapsed\n              expanded = false`;
if (!hud.includes(oldToggle)) throw new Error('Could not locate HUD logo minimize/expand action');
hud = hud.replace(oldToggle, newToggle);

const oldResize = `      val expectedWidthDp = if (hudCollapsed) currentCollapsedWidthDp else currentMinWidthDp\n      val renderedWidth = max(railView.width, dp(expectedWidthDp))\n      railParams.x = max(0, screen.widthPixels - renderedWidth - dp(8))`;
const newResize = `      val expectedWidthDp = if (hudCollapsed) currentCollapsedWidthDp else currentMinWidthDp\n      railParams.width = dp(expectedWidthDp)\n      val renderedWidth = dp(expectedWidthDp)\n      railParams.x = max(0, screen.widthPixels - renderedWidth - dp(8))`;
if (!hud.includes(oldResize)) throw new Error('Could not locate HUD right-edge resize block');
hud = hud.replace(oldResize, newResize);

if (!hud.includes('currentMinWidthDp = 118') ||
    !hud.includes('val collapsedWidthDp = 44') ||
    !hud.includes('hudCollapsed = !hudCollapsed') ||
    !hud.includes('right_dock_v1') ||
    !hud.includes('railParams.width = dp(expectedWidthDp)')) {
  throw new Error('Final right-rail verification failed');
}

source = setEmbedded(source, 'OVERLAY_SERVICE_KT', hud);
fs.writeFileSync(FILE, source, 'utf8');
console.log('✓ V17.1 thin right-edge HUD installed with working minimize/expand');
