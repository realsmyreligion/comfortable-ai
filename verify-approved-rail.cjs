const fs = require('fs');

const source = fs.readFileSync('app.config.js', 'utf8');

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

const directRows = (hud.match(/addView\([^\n]+LinearLayout\.LayoutParams\(LinearLayout\.LayoutParams\.MATCH_PARENT/g) || []).length;
if (directRows < 8) throw new Error(`Expected at least eight full-width rail rows; found ${directRows}`);

console.log('TornPulse approved right-edge rail verification: PASS');
