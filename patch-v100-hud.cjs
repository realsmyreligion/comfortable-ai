const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

// TornPulse main-dashboard cooldown emoji fix.
// Replays the successful Build #87 patch first, then replaces ONLY the
// main-page Drug / Booster / Medical / Scanner icon glyphs with emojis.
const BASE_COMMIT = '3f82576919dddbbaa9f8a698c951cd2e31b12253';
const BASE_PATH = 'patch-v100-hud.cjs';
const CONFIG_FILE = 'app.config.js';
const TEMP_BASE = path.join(process.cwd(), '.tornpulse-build87-known-good.cjs');

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
  if (start < 0) throw new Error(`TornPulse dashboard emoji fix: could not find ${name}`);
  const valueStart = start + prefix.length;
  if (src[valueStart] !== '"') throw new Error(`TornPulse dashboard emoji fix: ${name} is not a JSON string`);
  let i = valueStart + 1;
  let escaped = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') break;
  }
  if (i >= src.length || src[i + 1] !== ';') throw new Error(`TornPulse dashboard emoji fix: could not parse ${name}`);
  return {start:valueStart,end:i+1,value:JSON.parse(src.slice(valueStart,i+1))};
}

function setEmbedded(name, value) {
  const found = extractEmbedded(name);
  src = src.slice(0,found.start) + JSON.stringify(value) + src.slice(found.end);
}

let app = extractEmbedded('APP_JS').value;

function replaceMainCooldownIcon(labelWord, emoji) {
  const re = new RegExp(`<TPRefCooldown\\s+icon=["'][^"']+["']\\s+label=["'](?:[^"']*\\s)?${labelWord}["']`, 'g');
  let count = 0;
  app = app.replace(re, (m) => {
    count += 1;
    // Keep the text label clean; the emoji belongs in the dedicated icon box.
    return m
      .replace(/icon=["'][^"']+["']/, `icon="${emoji}"`)
      .replace(new RegExp(`label=["'][^"']*${labelWord}["']`), `label="${labelWord}"`);
  });
  if (!count) throw new Error(`TornPulse dashboard emoji fix: could not find main ${labelWord} cooldown`);
  console.log(`✓ main ${labelWord} icon -> ${emoji}`);
}

replaceMainCooldownIcon('DRUG', '💊');
replaceMainCooldownIcon('BOOSTER', '🥤');
replaceMainCooldownIcon('MEDICAL', '🩹');

// Scanner is its own component rather than TPRefCooldown.
const scannerBlockRe = /function TPScannerMini\(\) \{[\s\S]*?\n\}/;
const scannerMatch = app.match(scannerBlockRe);
if (!scannerMatch) throw new Error('TornPulse dashboard emoji fix: TPScannerMini not found');
let scannerBlock = scannerMatch[0];
scannerBlock = scannerBlock
  .replace(/(<Text style=\{\[styles\.tpRefCoolIconText,[^>]*>)[^<]*(<\/Text>)/, `$1📡$2`)
  .replace(/(<Text style=\{styles\.tpCooldownLabel\}>)[^<]*(<\/Text>)/, '$1SCANNER$2');
if (!scannerBlock.includes('📡')) throw new Error('TornPulse dashboard emoji fix: scanner emoji replacement failed');
app = app.replace(scannerBlockRe, scannerBlock);
console.log('✓ main SCANNER icon -> 📡');

setEmbedded('APP_JS', app);
fs.writeFileSync(CONFIG_FILE, src);
console.log('✓ TornPulse main dashboard cooldown emoji icons applied');
