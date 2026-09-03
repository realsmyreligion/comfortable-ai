const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

// TornPulse half-height floating HUD — corrected build patch.
// Replays successful Build #91, then compresses ONLY the native Android HUD.
// Width, live data, scanner logic, Baldr targets and main dashboard stay unchanged.
const BASE_COMMIT = 'ed9af1ca18853c2c893df6b9d3b50f1ed7c22be4';
const BASE_PATH = 'patch-v100-hud.cjs';
const CONFIG_FILE = 'app.config.js';
const TEMP_BASE = path.join(process.cwd(), '.tornpulse-build91-known-good.cjs');

try {
  try {
    execFileSync('git', ['fetch', '--depth=128', 'origin', 'main'], {stdio:'ignore'});
  } catch (_) {}
  const base = execFileSync('git', ['show', `${BASE_COMMIT}:${BASE_PATH}`], {encoding:'utf8'});
  fs.writeFileSync(TEMP_BASE, base, 'utf8');
  execFileSync(process.execPath, [TEMP_BASE], {stdio:'inherit'});
} finally {
  try { fs.unlinkSync(TEMP_BASE); } catch (_) {}
}

let src = fs.readFileSync(CONFIG_FILE, 'utf8');

function extractEmbedded(name) {
  const prefix = `const ${name} = `;
  const start = src.indexOf(prefix);
  if (start < 0) throw new Error(`TornPulse half-height HUD: could not find ${name}`);
  const valueStart = start + prefix.length;
  if (src[valueStart] !== '"') throw new Error(`TornPulse half-height HUD: ${name} is not a JSON string`);
  let i = valueStart + 1;
  let escaped = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') break;
  }
  if (i >= src.length || src[i + 1] !== ';') {
    throw new Error(`TornPulse half-height HUD: could not parse ${name}`);
  }
  return {start:valueStart,end:i+1,value:JSON.parse(src.slice(valueStart,i+1))};
}

function setEmbedded(name, value) {
  const found = extractEmbedded(name);
  src = src.slice(0,found.start) + JSON.stringify(value) + src.slice(found.end);
}

let kt = extractEmbedded('OVERLAY_SERVICE_KT').value;

function setWhen(name, compact, large, standard) {
  const re = new RegExp(
    `(val\\s+${name}\\s*=\\s*when\\s*\\{\\s*` +
    `compact\\s*->\\s*)[^\\n]+(\\s*` +
    `large\\s*->\\s*)[^\\n]+(\\s*` +
    `else\\s*->\\s*)[^\\n]+(\\s*\\})`
  );
  if (!re.test(kt)) {
    throw new Error(`TornPulse half-height HUD: ${name} sizing block not found`);
  }
  kt = kt.replace(re, `$1${compact}$2${large}$3${standard}$4`);
  console.log(`✓ ${name} compressed`);
}

function replaceAllExact(oldText, newText, label) {
  const count = kt.split(oldText).length - 1;
  if (!count) {
    console.log(`- ${label} skipped`);
    return;
  }
  kt = kt.split(oldText).join(newText);
  console.log(`✓ ${label} (${count})`);
}

// Keep horizontal sizing untouched; compress vertical measurements only.
setWhen('verticalPadding', '1', '2', '1');
setWhen('logoSize', '10', '12', '11');
setWhen('headerSize', '5.5f', '6.5f', '6f');
setWhen('statLabelSize', '5f', '5.8f', '5.3f');
setWhen('barsSize', '8.5f', '10.5f', '9.3f');
setWhen('cooldownSize', '5f', '5.8f', '5.3f');
setWhen('tickerSize', '5f', '5.8f', '5.3f');
setWhen('detailSize', '5f', '5.8f', '5.3f');

replaceAllExact(
  'setPadding(dp(2), dp(2), dp(2), dp(2))',
  'setPadding(dp(2), dp(1), dp(2), dp(1))',
  'cooldown chip vertical padding'
);
replaceAllExact(
  'setPadding(dp(4), dp(2), dp(4), dp(2))',
  'setPadding(dp(3), dp(1), dp(3), dp(1))',
  'clock strip vertical padding'
);
replaceAllExact(
  'setPadding(0, dp(3), 0, 0)',
  'setPadding(0, dp(1), 0, 0)',
  'HUD row top spacing'
);
replaceAllExact(
  'setPadding(0, dp(4), 0, 0)',
  'setPadding(0, dp(1), 0, 0)',
  'legacy HUD row top spacing'
);
replaceAllExact(
  'rightMargin = dp(8)',
  'rightMargin = dp(4)',
  'logo right margin'
);

// Reduce explicit small vertical spacer heights without changing HUD width.
kt = kt.replace(/height\s*=\s*dp\((?:4|5|6|7|8)\)/g, (m) => {
  const n = Number((m.match(/\d+/) || ['4'])[0]);
  return `height = dp(${Math.max(2, Math.round(n/2))})`;
});

// Verify the NEW sizing values instead of obsolete native variable names.
const required = [
  'compact -> 1',
  'compact -> 10',
  'compact -> 5.5f',
  'compact -> 8.5f',
  'compact -> 5f',
];
for (const marker of required) {
  if (!kt.includes(marker)) {
    throw new Error(`TornPulse half-height HUD: expected compressed marker missing: ${marker}`);
  }
}

setEmbedded('OVERLAY_SERVICE_KT', kt);
fs.writeFileSync(CONFIG_FILE, src);

console.log('✓ TornPulse floating HUD compressed to half-height profile');
