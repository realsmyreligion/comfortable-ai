const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

// TornPulse Target Radar emoji fix.
// Replays the successful Build #88 patch, then changes ONLY the
// main dashboard Target Radar icon to the 🎯 emoji.
const BASE_COMMIT = '8b2099cb2033a6c95cdcd1a6de04bc506bfe777f';
const BASE_PATH = 'patch-v100-hud.cjs';
const CONFIG_FILE = 'app.config.js';
const TEMP_BASE = path.join(process.cwd(), '.tornpulse-build88-known-good.cjs');

try {
  try {
    execFileSync('git', ['fetch', '--depth=64', 'origin', 'main'], {stdio:'ignore'});
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
  if (start < 0) throw new Error(`TornPulse Target Radar emoji fix: could not find ${name}`);
  const valueStart = start + prefix.length;
  if (src[valueStart] !== '"') throw new Error(`TornPulse Target Radar emoji fix: ${name} is not a JSON string`);
  let i = valueStart + 1;
  let escaped = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') break;
  }
  if (i >= src.length || src[i + 1] !== ';') throw new Error(`TornPulse Target Radar emoji fix: could not parse ${name}`);
  return {start:valueStart,end:i+1,value:JSON.parse(src.slice(valueStart,i+1))};
}

function setEmbedded(name, value) {
  const found = extractEmbedded(name);
  src = src.slice(0,found.start) + JSON.stringify(value) + src.slice(found.end);
}

let app = extractEmbedded('APP_JS').value;

const oldIcon = '<View style={styles.tpRadarTitleIcon}><Text style={styles.tpRadarTitleIconText}>◎</Text></View>';
const newIcon = '<View style={styles.tpRadarTitleIcon}><Text style={styles.tpRadarTitleIconText}>🎯</Text></View>';
const count = app.split(oldIcon).length - 1;
if (count !== 1) {
  throw new Error(`TornPulse Target Radar emoji fix: expected 1 dashboard radar icon, found ${count}`);
}
app = app.replace(oldIcon, newIcon);
console.log('✓ main Target Radar icon -> 🎯');

setEmbedded('APP_JS', app);
fs.writeFileSync(CONFIG_FILE, src);
console.log('✓ TornPulse Target Radar emoji fix applied');
