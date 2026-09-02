const fs = require('fs');

const source = fs.readFileSync('app.config.js', 'utf8');

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
for (const image of [
  'tornpulse-app-icon.png',
  'tp-health.png',
  'tp-energy.png',
  'tp-nerve.png',
  'tp-happiness.png',
  'tp-drug.png',
  'tp-booster.png',
  'tp-medical.png',
  'tp-baldr.png',
]) {
  const bytes = fs.readFileSync(image);
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(pngSignature)) {
    throw new Error(`${image} is not a genuine Android-safe PNG`);
  }
}

function embedded(name) {
  const prefix = `const ${name} = `;
  const start = source.indexOf(prefix);
  if (start < 0) throw new Error(`Missing ${name}`);
  const valueStart = start + prefix.length;
  let escaped = false;
  let end = valueStart + 1;
  for (; end < source.length; end += 1) {
    const ch = source[end];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') break;
  }
  return JSON.parse(source.slice(valueStart, end + 1));
}

const hud = embedded('OVERLAY_SERVICE_KT');
const required = [
  'private var currentMinWidthDp = 118',
  'approved_right_rail_v1',
  'gravity = Gravity.TOP or Gravity.END',
  'railParams.x = 0',
  'lp.width = targetWidth',
  'hudCollapsed = !hudCollapsed',
  'minimumHeight = dp(48)',
  'minimumHeight = dp(43)',
  'TORNPULSE_CATEGORY_IMAGE_ENGINE',
  'BALDR LIST',
  'openBaldrList()',
  'WindowManager.LayoutParams(\n      dp(currentMinWidthDp)',
];

for (const marker of required) {
  if (!hud.includes(marker)) throw new Error(`Approved rail marker missing: ${marker}`);
}

for (const forbidden of ['vitalRowOne', 'vitalRowTwo', 'utilityRowOne', 'utilityRowTwo']) {
  if (hud.includes(forbidden)) throw new Error(`Legacy grid remains: ${forbidden}`);
}

if (hud.includes('Gravity.TOP or Gravity.START')) throw new Error('HUD is not locked to right-edge gravity');
if (hud.includes('initialX + dx.toInt()')) throw new Error('Horizontal HUD dragging is still enabled');

const directRows = (hud.match(/addView\([^\n]+LinearLayout\.LayoutParams\(LinearLayout\.LayoutParams\.MATCH_PARENT/g) || []).length;
if (directRows < 8) throw new Error(`Expected at least eight full-width rail rows; found ${directRows}`);

console.log('TornPulse approved right-edge rail verification: PASS');
